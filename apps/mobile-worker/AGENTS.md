# Mobile Worker Agents 指南

## 项目定位

- `apps/mobile-worker` 为服务人员端 Expo Router 客户端（React Native 0.81 + Expo 54）。
- 数据模型来自 `@repo/types`，请求、缓存与失效策略尽量复用 `@repo/hooks` / `@repo/lib` / `@repo/mobile-ui`。
- 与 `mobile-user` 共享移动端基础设施，但业务重点在接单、履约、聊天、收益提现、实名认证、推送通知。

## ⚠️ NativeWind CSS Interop 已知问题

**问题描述：**

- NativeWind v4 的 `react-native-css-interop` 存在竞态条件，当动态切换某些 className 时会触发导航上下文错误
- 错误信息：`Couldn't find a navigation context. Have you wrapped your app with 'NavigationContainer'?`
- 这个错误是误导性的，实际问题不在于 `NavigationContainer`，而在于 CSS Interop 的内部机制

**触发问题的 className：**

- `shadow-*`（如 `shadow-sm`、`shadow-md`）
- `bg-color/opacity` 快捷语法（如 `bg-white/15`、`bg-primary/10`）
- `text-color/opacity` 快捷语法（如 `text-white/80`）
- `opacity-*`（如 `opacity-50`）
- `text-pretty` 等实验性类

**解决方案：**

1. **对于动态切换的组件**（如按钮激活态、筛选切换、状态徽标）：
    - 使用内联 `style` 替代动态 `className`
    - 保留静态的 `className`（如布局、圆角、间距）

    ```tsx
    // ❌ 错误：动态切换 shadow 和 bg 可能触发 CSS interop 异常
    <Pressable className={active ? "bg-primary shadow-sm" : "bg-muted"} />

    // ✅ 正确：把动态视觉状态放到内联 style
    <Pressable
      className="rounded-full px-4 py-2"
      style={
        active
          ? {
              backgroundColor: "hsl(var(--primary))",
              shadowColor: "#000",
              shadowOffset: { width: 0, height: 1 },
              shadowOpacity: 0.05,
              shadowRadius: 2,
              elevation: 1,
            }
          : {
              backgroundColor: "hsl(var(--muted))",
            }
      }
    />
    ```

2. **对于静态组件**（不动态切换的）：
    - 可以继续使用这些 className
    - 问题主要出现在状态变化导致 className 重新计算时

3. **CSS 变量使用：**
    - 使用 `hsl(var(--primary))`、`hsl(var(--muted))` 等 CSS 变量保持主题一致性
    - 主题 token 定义参考 `packages/mobile-ui` 中的样式与主题常量

**相关 Issues：**

- <https://github.com/nativewind/nativewind/issues/1557>
- <https://github.com/nativewind/nativewind/issues/1536>

## 主要依赖栈

- Expo 54 + expo-router 6 构建导航，结合 React Navigation `ThemeProvider` 与 `@repo/mobile-ui` 的样式体系。
- `@tanstack/react-query` 通过 `@repo/mobile-ui/components/provider` 统一 QueryClient、网络状态、错误提示与 DevTools。
- `better-auth/react` 通过 `@better-auth/expo/client` + `expo-secure-store` 持久化会话，`lib/auth.ts` 额外封装了服务人员端登出清理逻辑。
- 实时通知采用 Socket.IO WebSocket + 心跳 + 严格 ACK，并集成腾讯云推送（TPNS）与 `expo-notifications`。
- 聊天能力由 `@repo/hooks/api/chat` + `hooks/use-chat-socket.ts` + `hooks/use-chat-send-message.ts` / `use-chat-send-attachments.ts` 组合实现。
- 图片与附件能力依赖 `expo-image`、`expo-image-picker`、`expo-image-manipulator`、`expo-file-system`，上传逻辑复用 `@repo/hooks/api/files`。
- 收益/提现/微信绑定相关流程依赖 `@repo/hooks/api/pay`、`lib/wechat-binding-session.ts`、`lib/wechat-merchant-transfer-session.ts`。

## 运行与构建

- 在仓库根目录执行 `pnpm install` 后，使用 `pnpm mobile-worker:dev`（或 `pnpm --filter mobile-work run dev`）启动 Expo bundler。
- Expo 脚本均通过 `dotenvx` 读取 `apps/mobile-worker/.env.development`；生产构建对应 `.env.production`。
- 平台调试命令：`pnpm --filter mobile-work run android` / `ios` / `web`，必要时先运行 `pnpm --filter mobile-work run clean` 清缓存。
- 静态导出使用 `pnpm --filter mobile-work run build`，其内部会执行 `expo export`。
- 环境变量需先运行 `pnpm env:setup` 生成各端 `.env.*`；私密值只保留在本地或 CI 注入。
- 若新增原生能力或需要真机调试，可按 Expo 流程使用 Dev Client / `expo run:<platform>`。

## 目录速览

- `app/_layout.tsx`：Provider、主题、推送初始化、通知 WebSocket、聊天 Socket、全局导航入口。
- `app/(tabs)/`：主 Tab 页面，当前包含 `index`、`orders`、`earnings`、`chat`、`profile`。
- `app/auth/`：`login.tsx`、`verify.tsx`，负责手机号验证码登录与会话建立。
- `app/orders/[id].tsx`：订单详情，联动接单/拒单/履约与会话跳转。
- `app/chat/`：聊天列表与会话详情页。
- `app/profile/`：个人资料、服务设置、服务区域、账号绑定、设置等个人中心页面。
- `app/verification/`：实名认证页。
- `app/scan/`：扫码核销/验单入口。
- `hooks/`：通知、聊天、微信提现回调等端上行为 Hook。
- `lib/`：鉴权、配置、聊天 socket、订单排序、交易时间格式化等基础封装。
- `components/`：上传器、聊天列表/消息行、订单弹层等跨页面组件。

## 会话与鉴权

- `lib/auth.ts` 使用 `createAuthClient` 组合 `expoClient`、`phoneNumberClient` 与角色字段插件，App Scheme 为 `mobileworker`。
- `signOutWithCleanup()` 会先调用 open-api 登出接口，再执行 `authClient.signOut()`，避免只清本地态不清服务端 Cookie。
- `app/_layout.tsx` 将自定义 `authClient` 注入 `@repo/mobile-ui/components/provider`，所有 API 请求都会共用同一套会话来源。
- 页面层统一通过 `useSession()` / `useAuth()` 获取当前会话与刷新能力，不要自行重复实现 session Context。
- 需要登录保护的页面优先使用 `RequireAuth` 包裹，而不是在每个页面里手写跳转分支。
- 通知 ACK、聊天 socket、订单页等依赖 Cookie 的场景，都以 `authClient.getCookie()` 为准。

## 数据、通知与聊天

- 页面数据优先走 `@repo/hooks`：订单使用 `api/order`，收益提现使用 `api/pay`，服务者资料使用 `api/service-personnel`，实名认证使用 `api/user`。
- `useGlobalPageRefresh` 是当前移动端的统一下拉刷新协调器；页面有多个查询时优先用它聚合刷新。
- 通知连接事件名来自 `@repo/types`：`NOTIFICATION_SOCKET_CLIENT_EVENT` / `NOTIFICATION_SOCKET_SERVER_EVENT`。
- 心跳默认 15 秒（`DEFAULT_HEARTBEAT_INTERVAL`）；前后台切换会主动发送 Offline 并断开连接，避免后台误判在线。
- 严格 ACK 仅在服务端消息 `deliveryMode === "strict"` 且包含 `deliveryId` 时触发，客户端会 `POST {endpoint}/ack`。
- 通知到达后会触发订单相关查询失效：`['staff-orders-list']`，以及携带 `orderId` 时的 `['order-detail', orderId]`。
- 聊天实时能力由 `hooks/use-chat-socket.ts` 驱动；消息发送与附件上传分别走 `use-chat-send-message.ts` 和 `use-chat-send-attachments.ts`。
- 订单详情页会通过 `@repo/hooks/api/chat` upsert 会话，涉及消息页跳转时优先复用现有聊天查询 key 与 Hook。

## 页面流程提示

- 登录入口位于 `app/auth`；验证码验证成功后建立会话并进入主 Tab。
- 首页 `app/(tabs)/index.tsx` 聚合服务者资料、仪表盘统计、收益概览与待处理订单，并提供扫码、资料编辑、服务设置、提现快捷入口。
- 订单页 `app/(tabs)/orders.tsx` 使用状态 Tab + 分组排序展示工单，优先关注待接单与服务中订单。
- 收益页 `app/(tabs)/earnings.tsx` 区分收益记录与提现记录，提现页在 `app/earnings/withdraw.tsx`。
- 聊天入口位于 `app/(tabs)/chat.tsx` 与 `app/chat/[conversationId].tsx`，系统通知与用户会话是两类不同消息源。
- 个人中心 `app/(tabs)/profile.tsx` 汇总实名认证、服务设置、服务区域、账号绑定等入口；服务设置页位于 `profile/service-settings-redesign.tsx`。
- 扫码页 `app/scan/index.tsx` 使用 Expo Camera；改动扫码逻辑时记得同步检查权限申请与核销接口。
- 实名认证页 `app/verification/id-card.tsx` 依赖 `@repo/hooks/api/user` 的实名查询与提交能力。

## UI 与样式

- 全局样式在 `app/_layout.tsx` 首行引入 `@repo/mobile-ui/styles/mobile-work.css`。
- 主题由 `ThemeProvider`、`StatusBar` 与 `NAV_THEME` 协同控制；Web 端会在 `document.documentElement` 上补充 `bg-background`。
- 优先复用 `@repo/mobile-ui` 组件、`@rn-primitives`、以及现有页面中的视觉 token，不要重复造一套服务人员端基础控件。
- 远程图片统一优先使用 `expo-image`；后端若提供 `blurhash`，前端通过 `placeholder={{ blurhash }}` 展示占位。
- Portal 组件统一挂到根布局里的 `PortalHost`，避免多层 Provider 造成浮层错位。
- 页面层可以混用 `className` 与少量必要的 `style`，但不要同时用两套方式表达同一个静态视觉规则。

## 页面落地规范（NativeWind）

1. **颜色必须优先走主题 token**
    - 避免在页面里散落 `#fff/#000/#4CAF50` 这类硬编码。
    - 优先使用：`bg-background` / `bg-card` / `bg-primary` / `text-foreground` / `text-muted-foreground` / `border-border` / `text-destructive` 等语义 token。

2. **静态样式优先统一走 NativeWind `className`**
    - 页面层不要把一整块静态视觉样式拆成一半 `className`、一半内联 `style`。
    - 对于需要 `className` 支持的三方组件，优先做一次性 interop 适配，再在页面里统一使用 class。

3. **尽量避免 arbitrary 值**
    - 避免 `text-[14px]`、`rounded-[22px]` 这类散落页面的任意值。
    - 字体、字号、颜色、阴影如确实需要扩展，优先在 `apps/mobile-worker/tailwind.config.js` 或共享 UI token 中补语义化 key。

4. **动态态样式遵守 CSS interop 风险规避**
    - `shadow-*`、`bg-*/opacity`、`text-*/opacity`、`opacity-*` 等类在动态切换场景下不要拼接到 className。
    - 这类动态差异请下沉到内联 `style`，仅保留静态布局类在 `className` 中。

5. **资源命名遵守 Android/Expo 约束**
    - 字体、图片等资源文件名不要包含空格，统一使用 `-` 或 `_`。

## 调试与错误处理

- `@repo/mobile-ui/components/provider` 已集成 `DevToolsBubble`，调试 React Query 时优先用它查看缓存与请求状态。
- 全局异常通过 `ErrorBoundary` 兜底；页面级别如有独立错误态，可继续按 `FallbackComponent` 模式扩展。
- `sonner-native` 的 `Toaster` 已在根 Provider 挂载；接口错误提示尽量通过 Query `meta.errorMessage` 或统一 toast 输出。
- 推送初始化缺少 `EXPO_PUBLIC_TENCENT_PUSH_SDK_APP_ID` / `EXPO_PUBLIC_TENCENT_PUSH_APP_KEY` 时会在控制台告警并跳过初始化。
- 通知与聊天问题优先检查：Cookie 是否存在、`API_BASE_URL` 是否正确、AppState 切换后 socket 是否按预期重连。
- 扫码/拍照/上传相关问题优先检查权限、原生模块安装状态，以及 `expo prebuild` 后的原生配置是否同步。

## 环境变量与原生能力

- API / Auth Origin 由 `EXPO_PUBLIC_AUTH_BASE_URL` 或 `EXPO_PUBLIC_API_BASE_URL` 推导，`lib/config.ts` 会自动兼容是否携带 `/api`。
- 推送初始化依赖：`EXPO_PUBLIC_TENCENT_PUSH_SDK_APP_ID`、`EXPO_PUBLIC_TENCENT_PUSH_APP_KEY`。
- 微信相关流程通常依赖：`EXPO_PUBLIC_WECHAT_WORKER_APP_ID`、`EXPO_PUBLIC_WECHAT_WORKER_UNIVERSAL_LINK`，必要时回退通用微信变量。
- 地图/定位、扫码、推送、相册上传都可能涉及原生权限；改动时同步检查 `app.config.js` / plugin 配置。
- `plugins/` 下包含推送、明文流量、签名等原生配置插件；修改构建行为时优先从这里入手。

## 测试与质量

- 基础检查命令：`pnpm --filter mobile-work run lint`、`pnpm --filter mobile-work run type-check`。
- 涉及鉴权、通知、聊天、提现等链路时，建议同时运行后端服务验证 Cookie、WebSocket 与支付相关接口。
- 当前移动端自动化测试覆盖有限；新增核心流程建议补充最少的集成测试或在 PR 中列出真机/模拟器验证路径。
- 引入或调整原生模块后，需要执行 `expo prebuild` 并检查 android/ios 生成配置是否符合预期。
- 提交前遵循仓库 `.editorconfig` 与格式化要求，必要时执行 `pnpm format:check`。

## 外部资源

- Expo & Expo Router 文档：<https://docs.expo.dev/> · <https://expo.github.io/router/docs>
- TanStack Query v5 文档：<https://tanstack.com/query/latest>
- Better Auth 指南：<https://better-auth.vercel.app/>
- Socket.IO Client 文档：<https://socket.io/docs/v4/client-api/>
- 腾讯云移动推送 TPNS：<https://cloud.tencent.com/document/product/548>
- 共享组件库与主题：查看 `packages/mobile-ui`
