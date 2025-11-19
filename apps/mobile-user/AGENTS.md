# Mobile User Agents 指南

## 项目定位

- `apps/mobile-user` 为面向终端用户的 Expo Router 客户端，依托 React Native 0.81 + React 19 同时支持原生与 Web。
- 所有后端交互走 `/api/**` REST 接口，数据模型来自 `@repo/types`，工具函数沿用 `@repo/utils`，避免重复声明。
- 关键业务聚焦登录注册、订单管理、服务地址维护和地图定位，与 `apps/mobile-worker` 在授权 Cookie、地址结构上保持一致。
- 顶层 `Provider` 在 `app/_layout.tsx` 中装配主题、会话、缓存和错误组件，保证各屏共享统一体验。

## ⚠️ NativeWind CSS Interop 已知问题

**问题描述：**

- NativeWind v4 的 `react-native-css-interop` 存在竞态条件，当动态切换某些 className 时会触发导航上下文错误
- 错误信息：`Couldn't find a navigation context. Have you wrapped your app with 'NavigationContainer'?`
- 这个错误是误导性的 - 实际问题不在于 NavigationContainer，而在于 CSS Interop 的内部机制

**触发问题的 className：**

- `shadow-*`（如 `shadow-sm`、`shadow-md`）
- `bg-color/opacity` 快捷语法（如 `bg-white/15`、`bg-primary/10`）
- `text-color/opacity` 快捷语法（如 `text-white/80`）
- `opacity-*`（如 `opacity-50`）
- `text-pretty` 等实验性类

**解决方案：**

1. **对于动态切换的组件**（如按钮激活状态、开关切换）：
   - 使用内联 `style` 替代动态 `className`
   - 保留静态的 `className`（如布局、间距）

   ```tsx
   // ❌ 错误 - 动态切换 shadow 和 bg 会触发错误
   <Pressable className={isSelected ? "bg-primary shadow-sm" : "bg-muted"}>

   // ✅ 正确 - 使用内联样式
   <Pressable
     className="px-4 py-2 rounded-full"
     style={isSelected ? {
       backgroundColor: "hsl(var(--primary))",
       shadowColor: "#000",
       shadowOffset: { width: 0, height: 1 },
       shadowOpacity: 0.05,
       shadowRadius: 2,
       elevation: 1,
     } : {
       backgroundColor: "hsl(var(--muted))"
     }}
   >
   ```

2. **对于静态组件**（不动态切换的）：
   - 可以安全使用这些 className
   - 问题主要出现在状态变化导致 className 重新计算时

3. **CSS 变量使用：**
   - 使用 `hsl(var(--primary))` 等 CSS 变量保持主题一致性
   - 主题颜色定义在 `packages/mobile-ui/src/theme.ts` 中

**相关 Issues：**

- <https://github.com/nativewind/nativewind/issues/1557>
- <https://github.com/nativewind/nativewind/issues/1536>

**示例修复：**

参考 `app/address/edit-address.tsx` 中的 `GenderButton` 组件和默认地址切换开关的实现。

## 主要依赖栈

- Expo 54 + expo-router 6 构建导航，结合 React Navigation `ThemeProvider` 与 `@repo/mobile-ui` 样式体系。
- `@tanstack/react-query` 配合 `apps/mobile-user/lib/query-client.ts` 统一查询缓存、错误提示与 Retry 策略。
- `better-auth/react` 通过 `@better-auth/expo/client` 与 `expo-secure-store` 组合处理会话持久化与多端 Cookie。
- `expo-qq-location`、`expo-location` 与自研 `lib/location-utils.ts` 提供高精度定位、后台刷新与坐标系转换。
- `react-native-mmkv` 作为本地缓存（地址逆地理缓存等），地址状态使用 `zustand` + `immer` 管理。
- UI 组件依赖 `@repo/mobile-ui`、`@rn-primitives` 与 `nativewind` tailwind 语法；反馈使用 `sonner-native`。

## 运行与构建

- 在仓库根目录执行 `pnpm install` 后，使用 `pnpm mobile-user:dev`（或 `pnpm --filter mobile-user run dev`）开启 Expo bundler。
- Expo 脚本均经由 `dotenvx` 读取 `apps/mobile-user/.env.development`；生产构建对应 `.env.production`。
- 平台调试命令：`pnpm --filter mobile-user run android` / `ios` / `web`，必要时先运行 `pnpm --filter mobile-user run clean` 清除缓存。
- 产出静态包使用 `pnpm mobile-user:build`，随后通过 `expo export` 生成 release 资源。
- 若需要落地 Dev Client，请先安装 `expo-dev-client`，再按 Expo 指南运行 `npx expo run:<platform>`。
- 环境变量需配合 `pnpm env:setup` 融合 `env/` 片段，本地私密值仅保存在各自 `.env.*`。

## 目录速览

- `app/_layout.tsx`：挂载 `Provider`、导航 `Stack`、`StatusBar` 与主题；Stack 层定义 `auth`、`(tabs)`、`address/edit-address`。
- `app/(tabs)/`：三个主 Tab（`index`、`orders`、`profile`）及其 `_layout`，整合底部导航与登录后入口。
- `app/auth/`：`login.tsx`、`register.tsx` 通过 `authClient` 调用 better-auth API，实现邮箱登录注册与 Expo Router 跳转。
- `app/address/`：`select-address`、`select-city`、`edit-address`、`service-address` 组成地址生命周期，联动 `TencentMap` 与 `zustand`。
- `components/`：`provider.tsx`、`SessionProvider.tsx`、`TencentMap.tsx`、`error-boundaries.tsx`、`LogoutButton.tsx` 等跨页面组件。
- `hooks/` 与 `stores/`：业务 Hook（含 `hooks/api/*` 地址、订单、支付）和 `useAddressEditStore`；`lib/` 集中 `http-client`、`auth-client`、`location-utils`、`query-client`。

## 会话与鉴权

- `lib/auth-client.ts` 通过 `createAuthClient` 拼装 better-auth 与 `@better-auth/expo/client`，默认基址 `http://192.168.0.103:5050`（按环境覆盖）。
- `components/SessionProvider.tsx` 负责拉取 `authClient.getSession()`，在 Context 中暴露 `data`/`isLoading`/`error`/`refetch`。
- `components/provider.tsx` 将 `SessionProvider` 包裹在 `QueryClientProvider` 内，并与 `focusManager`、`onlineManager` 同步 AppState/网络状态。
- `hooks/useAuth.ts` 复用 SessionProvider 导出的 `useAuth`，页面层统一从该 Hook 获取 `signIn`/`signOut` 等操作。
- `app/_layout.tsx` 在 Stack 中配置 header 回退中文标题、`PortalHost`，以及针对 `auth`/`(tabs)` 路由的可见性。
- Cookie 携带通过 `lib/http-client.ts` 的请求拦截器注入，确保 React Query `query`/`mutation` 均带会话。

## 数据与状态

- `lib/http-client.ts` 基于 `@repo/utils/api-client` 创建 `apiClient`，所有请求默认挂载 Cookie 头并指向 `EXPO_PUBLIC_API_BASE_URL`。
- `lib/query-client.ts` 自定义 `QueryClient`：401 不重试、其余失败最多两次，`onError` 读取 `query.meta.errorMessage` 并调用 `toast`。
- `hooks/api/address/index.ts` 使用 `react-native-mmkv` 做逆地理与城市缓存，并提供 `useUserAddresses`、`useCreateAddress` 等 Hook。
- `hooks/api/order/index.ts` 汇总订单列表、详情、取消等接口，统一 `queryKey` 以便底部 Tab 自动刷新。
- `hooks/api/pay/index.ts` 暴露 `genericAuthSign` 获取支付授权签名，配合端上 SDK 调用。
- `hooks/useLocation.ts` 与 `hooks/useDebounceThrottle.ts` 提供定位监听、防抖节流能力，供地址表单复用。
- `stores/address-store.ts` 借助 `zustand` + `immer` 管理当前编辑地址与手动选择状态，页面完成后记得调用 `reset()` 清理。

## 定位与地图

- `lib/location-utils.ts` 实现 `HighAccuracyLocationManager`，优先使用缓存位置，再回落系统/实时定位，并输出 GCJ02/BD09 坐标。
- `hooks/useLocation.ts` 集成 `expo-qq-location` 监听、权限申请与状态机，含去抖逻辑和错误 toast。
- `components/TencentMap.tsx` 通过 `react-native-webview` 嵌入 `map.qq.com`，支持当前位置同步、拾取回调和精度标识。
- `app/address/select-address.tsx` 与 `select-city.tsx` 结合 `TencentMap`、`useLocation`、`hooks/api/address` 完成选址、搜索、逆地理。
- `EXPO_PUBLIC_TENCENT_MAP_KEY` 控制地图脚本 key，默认值仅供开发，请在生产 `.env.production` 中补齐。
- 若调整定位策略，请同步更新 `useHighAccuracyLocation` 与 `expo-qq-location` 的 `RequestLevel`，确保缓存 key 一致。

## 页面流程提示

- 登录/注册页面位于 `app/auth`，成功后执行 `router.replace('/(tabs)')`；如需强制登录，可在 `app/_layout.tsx` 基于 `useSession` 判定。
- 地址管理入口 `app/address/service-address.tsx` 使用 `useUserAddresses` 加载列表，并借助 `useAddressEditStore` 在路由间传递编辑态。
- `edit-address.tsx` 组合 `react-hook-form`、`useLocation`、`TencentMap`，提交前会调用后端创建/更新接口，记得在 `finally` 中调用 `reset()`。
- `select-address.tsx` 支持逆地理和关键字联想（`Suggestion API`），成功后通过 Router 返回编辑页并写入 store。
- `select-city.tsx` 使用 `useChinaCity` 查询行政区，选择后立刻同步 `useAddressEditStore` 并返回上一页。
- `app/(tabs)/orders.tsx`、`profile.tsx` 当前为占位，后续扩展时可直接引入上述 Hook 与 Provider。

## UI 与样式

- 全局样式在 `app/_layout.tsx` 首行引入 `@repo/mobile-ui/styles/global.css`，`nativewind` 将 tailwind 类转换为 RN 样式。
- UI 组件来自 `@repo/mobile-ui` 遵循 PascalCase 组件命名与 camelCase props，复杂区域可酌情添加注释。
- 主题与字体由 `ThemeProvider`、`StatusBar` 控制，`useColorScheme` 自动切换深浅色，Web 端额外在 `document.documentElement` 上设置背景。
- `PortalHost` 支持抽屉、对话框等 Portal 组件，避免多重 Provider 导致 Portal 重复。
- `Button`、`Input` 等组件已封装主题态，页面只需追加 `className`；自定义颜色前先确认 `packages/mobile-ui` 是否有对应 token。
- 表单场景 Prefer `Label` + `Input` + `Text` 组合，与现有登录/地址页面保持一致以继承样式。

## 调试与错误处理

- `components/provider.tsx` 集成 `DevToolsBubble`，点击浮标即可查看 React Query 缓存并复制请求数据。
- `ErrorBoundary` 提供重新加载按钮，`reset` 后会清理 Query 错误；`onCopy` 支持快速复制错误描述。
- `sonner-native` 的 `Toaster` 默认位于顶部居中，React Query `meta.errorMessage` 会自动弹出；自定义请求错误时请设置该字段。
- `hooks/api/address.cacheUtils` 提供 `clearAllGeoCache` 与 `getCacheStats`，调试逆地理缓存时可手动调用。
- `useLocation` 内含详细日志与 toast，定位失败优先检查权限、网络以及 `expo-qq-location` 监听是否释放。
- Web 调试地图时需允许加载 `https://map.qq.com/api/gljs`，必要时在 `TencentMap.tsx` 临时替换 API Key。

## 测试与质量

- 当前未内建移动端测试脚本，新增功能建议使用 React Native Testing Library / Expo E2E，并与源码同目录存放。
- 质量检查命令：`pnpm --filter mobile-user run lint`、`pnpm --filter mobile-user run type-check`，提交前务必通过。
- 接口调试可在 `pnpm mobile-user:dev` 运行后借助 React Query DevTools 验证缓存与请求行为。
- 遵循 `.editorconfig`（CRLF、4 空格缩进），Markdown/TS 文件提交前运行 `pnpm format:check`。
- 涉及后端鉴权的改动需同时运行 `pnpm backend:dev`，确保 Cookie 同源无误。
- 引入原生模块时须执行 `expo prebuild` 并检查 android/ios 下生成的配置，避免破坏 CI。

## 外部资源

- Expo & Expo Router 文档：<https://docs.expo.dev/> · <https://expo.github.io/router/docs>
- TanStack Query v5 文档：<https://tanstack.com/query/latest>
- Better Auth 指南：<https://better-auth.vercel.app/>
- 腾讯位置服务：<https://lbs.qq.com/>
- React Native MMKV：<https://github.com/mrousavy/react-native-mmkv>
- 共享组件库参考：查看 `packages/mobile-ui` 或运行 `pnpm storybook`
