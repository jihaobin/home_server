# Mobile User Android Toast 返回闪退排查与修复方案

## 1. 背景

- 项目：`/mnt/f/home_server`
- 端：Expo Router 移动端 `apps/mobile-user`
- 排查日期：2026-03-18
- 问题页面：`apps/mobile-user/app/servicePersonnel/order-confirm.tsx`

当前问题是：

- Android 端在 toast 仍显示或退场动画尚未结束时，立即执行返回操作，会高概率或稳定闪退。
- 典型报错为：

```text
java.lang.IllegalStateException: SafeAreaProvider contains null child at index X when traversal in dispatchGetDisplayList, the view may have been removed.
```

这类崩溃与以下操作强相关：

1. 进入确认订单页。
2. 点击“立即支付”触发 `toast.error(...)`。
3. 在 toast 未消失前立刻返回上一页。
4. Android 崩溃。

## 2. 当前约束

本次修复必须同时满足：

1. 保留“全局 toaster 弹窗”的交互方式。
2. 不接受返回操作额外延迟。
3. 在上述复现路径下不崩溃。

## 3. 本地现状

### 3.1 相关挂载点

- `packages/mobile-ui/src/components/provider.tsx`
  - 这里挂载了 `SafeAreaProvider` 和 `Toaster`。
  - Android 下当前还用 `LayoutAnimationConfig(skipEntering/skipExiting)` 包裹 `Toaster`。
- `apps/mobile-user/app/_layout.tsx`
  - 已在 `pathname` 变化、`beforeRemove`、`transitionStart` 时执行 `toast.dismiss()`。
- `apps/mobile-user/app/servicePersonnel/order-confirm.tsx`
  - 当前页面侧为了绕过问题，已经引入 “dismiss toast + 延迟 back” 的安全返回方案。

### 3.2 当前依赖状态

排查时确认工作区存在两个 `sonner-native` 版本：

- `apps/mobile-user/package.json`
  - `sonner-native: ^0.21.0`
- `packages/mobile-ui/package.json`
  - `sonner-native: ^0.23.1`

实际解析结果：

- `apps/mobile-user` 内直接 import `sonner-native` 时，解析到 `apps/mobile-user/node_modules/sonner-native`，版本 `0.21.2`
- `packages/mobile-ui` 内 import `sonner-native` 时，解析到根目录 `node_modules/sonner-native`，版本 `0.23.1`

这意味着：

- app 侧 `toast.*` 调用与 UI 库内部 `Toaster` 宿主，可能不是同一个 `sonner-native` 单例实例。
- 对于这类全局 store + 宿主组件模型，这是额外风险点。

## 4. 已有尝试及结论

已尝试方案包括：

- 全局层去重 `Toaster`
- 路由切换时 `toast.dismiss()`
- Android 下使用 `LayoutAnimationConfig(skipEntering/skipExiting)` 包裹 `Toaster`
- 页面内改成本地提示
- 页面返回前先 dismiss toast，再延迟返回

结论如下：

1. “页面内提示”虽然能规避问题，但不符合产品需求。
2. “延迟返回”虽然有效，但违背“不接受额外返回延迟”的约束。
3. `toast.dismiss()` 能降低竞态窗口，但不能从根上解决 Android 绘制阶段的视图树并发卸载问题。
4. `LayoutAnimationConfig` 价值有限，因为 `sonner-native` 的进出场核心是 Reanimated `entering/exiting` 布局动画，不是 React Native `LayoutAnimation`。

## 5. 外部检索过程

本次排查分成两条线并行进行：

1. 检索 `sonner-native`、Expo、React Native、SafeArea、Portal、Reanimated 相关 issue 和资料。
2. 对照本地工作区的 `Toaster` 挂载方式、依赖解析结果和现有 workaround。

### 5.1 关键词与方向

主要使用过的检索关键词包括：

- `sonner-native SafeAreaProvider contains null child at index traversal Android`
- `SafeAreaProvider contains null child sonner-native expo`
- `dispatchGetDisplayList null child react native android`
- `Expo Router sonner-native Android back crash toast`
- `react-native-safe-area-context contains null child`
- `react-native-reanimated null child dispatchGetDisplayList`

### 5.2 检索筛选逻辑

检索时重点筛选以下类型资料：

1. 与报错栈高度一致的 issue。
2. 与 Expo 54 / RN 0.81.x / Android / Fabric 相关的资料。
3. 明确提到 overlay、portal、toast、modal、route back、entering/exiting animation 的 case。
4. 上游库 changelog 和提交记录，而不是只看二手转述。

### 5.3 本地交叉验证过程

在仓库内额外确认了以下事实：

1. `Toaster` 当前确实挂在 `SafeAreaProvider` 子树内。
2. `apps/mobile-user` 和 `packages/mobile-ui` 使用了不同版本的 `sonner-native`。
3. 当前回避方案已经引入了 `toast.dismiss()` 和延迟返回，但这两项都只是压制症状。
4. 当前 `react-native-reanimated` 锁定在 `4.1.6` 解析结果上。

## 6. 外部资料证据链

### 6.1 `react-native-safe-area-context` 同类问题

来源：

- https://github.com/AppAndFlow/react-native-safe-area-context/issues/692

关键信息：

- issue 标题就是 `SafeAreaProvider contains null child at index`
- 环境为 `react-native 0.81.5`、Android、Fabric
- 维护者最终判断这不是 `safe-area-context` 自身问题
- 2026-03-04 的结论明确指向 `react-native-reanimated#8907`

影响：

- 报错出现在 `SafeAreaProvider`，不等于根因一定在 `SafeAreaProvider`
- 需要把排查重点从 safe-area 转向 Reanimated 在 Android 绘制阶段的提交行为

### 6.2 `react-native-reanimated` 同类问题

来源：

- https://github.com/software-mansion/react-native-reanimated/issues/8422
- https://github.com/software-mansion/react-native-reanimated/issues/8907
- https://github.com/software-mansion/react-native-reanimated/pull/9072

关键信息：

- `#8422`：`Animated.View` 使用 `entering/exiting`，在关闭 modal 并导航时触发 Android `dispatchGetDisplayList` 崩溃
- `#8907`：动画进行中返回，触发 `null child at index X when traversal in dispatchGetDisplayList`
- `#9072`：标题为 `[Android] Fix commits during drawing`，2026-03-13 已合入

影响：

- 这条链路与当前问题高度一致
- 问题模式不是 toast 专属，而是 Android 绘制期间存在动画视图并发提交/卸载时的通用问题

### 6.3 Reanimated 社区 workaround

来源：

- https://github.com/software-mansion/react-native-reanimated/issues/8907#issuecomment-3995238585
- https://docs.swmansion.com/react-native-reanimated/docs/guides/performance

社区已验证的 workaround：

1. 在 `package.json` 中启用：

```json
{
    "reanimated": {
        "staticFeatureFlags": {
            "DISABLE_COMMIT_PAUSING_MECHANISM": true
        }
    }
}
```

2. 在 Expo 配置中启用：

```json
[
    "expo-build-properties",
    {
        "android": {
            "reactNativeReleaseLevel": "experimental"
        }
    }
]
```

官方文档还提到：

- `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` 可让 `opacity` / `transform` 等非布局属性走更快路径，减少 `ShadowTree::commit`
- 但该 flag 有点击命中副作用，需要额外回归测试

影响：

- 这是当前最接近“保留全局 toaster + 不引入返回延迟”的方案
- 方案针对的正是 Android 上的 commit/drawing 竞态，而不是页面级临时绕过

### 6.4 `sonner-native` 上游 Android 修复历史

来源：

- https://github.com/gunnartorfis/sonner-native/blob/main/CHANGELOG.md

相关版本记录：

1. `0.19.1`
   - `temporarily disable opacity gesture animation on Android`
2. `0.20.0`
   - `attempt to fix android crash`
3. `0.21.1`
   - `fixes flicker caused by two animations trying animating the same view and property`
4. `0.21.2`
   - `android ghost element`

影响：

- `sonner-native` 本身在 2025 年已经连续修过多轮 Android 动画问题
- 当前工作区还存在双版本并存，属于需要优先收敛的依赖状态

### 6.5 其他库的旁证

来源：

- https://github.com/callstack/react-native-paper/issues/4809

关键信息：

- Expo 54 / RN 0.81.4 环境下，仅仅是 `Portal` 中的 loading 组件，也会触发类似 `dispatchGetDisplayList` 崩溃

影响：

- 再次说明这是 Android overlay/portal/动画卸载竞态问题，不是 `sonner-native` 唯一独有

## 7. 根因判断

综合外部资料和本地现状，当前更可信的根因是：

1. `sonner-native` toast 在 Android 上使用 Reanimated `entering/exiting` 动画。
2. 用户在 toast 仍处于显示或退场阶段时立即执行返回，导致路由退场和 overlay 视图卸载并发发生。
3. Android 在 `dispatchGetDisplayList` 遍历视图树时，遇到已被并发移除的 child，抛出 `null child at index ...`。
4. `SafeAreaProvider` 只是崩溃栈里出现的父容器，不是根因组件。
5. 当前工作区的双 `sonner-native` 版本，会进一步放大全局 toast store / Toaster 宿主不一致的风险。

## 8. 修复目标

目标不是“降低复现率”，而是：

1. 保留全局 toaster
2. 不增加返回延迟
3. 在确认订单页的稳定复现路径下不崩溃

## 9. 建议修复方案

### 9.1 P0：统一 `sonner-native` 实例

建议先做依赖收敛：

1. 移除 `apps/mobile-user` 对 `sonner-native` 的直接依赖，或与 `@repo/mobile-ui` 统一到同一版本
2. 约束 app 侧不要再直接从 `sonner-native` import
3. 由 `@repo/mobile-ui` 暴露统一的 toast 入口，保证 `toast.*` 和 `Toaster` 使用同一份实例

建议方向：

- `packages/mobile-ui` 内封装 `toast` 与 `Toaster`
- `apps/mobile-user` 统一从 `@repo/mobile-ui` 的导出入口使用

这样做的原因：

- `sonner-native` 是全局状态模型
- 调用方和宿主组件来自不同依赖副本时，行为不可预测

### 9.2 P1：启用 Reanimated Android workaround

在 `apps/mobile-user/package.json` 添加：

```json
{
    "reanimated": {
        "staticFeatureFlags": {
            "DISABLE_COMMIT_PAUSING_MECHANISM": true
        }
    }
}
```

在 `apps/mobile-user/app.json` 的 `expo-build-properties` 中增加：

```json
{
    "android": {
        "buildArchs": ["arm64-v8a"],
        "reactNativeReleaseLevel": "experimental"
    }
}
```

原因：

- 这是目前外部资料里最接近当前问题模式的官方/社区 workaround
- 它针对的是 Android 绘制阶段的 commit 竞态
- 相比“延迟返回”，更符合当前需求约束

### 9.3 P2：保留全局层 `toast.dismiss()`，但不再依赖页面延迟返回

全局 dismiss 仍然有价值，建议保留：

- 路由切换时 `toast.dismiss()`
- `beforeRemove` / `transitionStart` 时 `toast.dismiss()`

但应把它视为“缩小竞态窗口”的辅助措施，不再作为主修复方案。

页面内这类逻辑建议逐步移除：

- `dismiss + setTimeout(back, 350ms)`

原因：

- 它违反“不接受返回延迟”的前提
- 它只是在避开时序，不是在修复底层竞态

### 9.4 P3：视回归结果决定是否追加 `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS`

如果 P0 + P1 后仍有个别 Android 机型残留问题，可评估：

```json
{
    "reanimated": {
        "staticFeatureFlags": {
            "DISABLE_COMMIT_PAUSING_MECHANISM": true,
            "ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS": true
        }
    }
}
```

注意：

- 该方案需要额外回归触摸命中和手势行为
- 不建议一开始就直接打开，避免扩大变更面

### 9.5 P4：关注上游正式修复版本

由于 Reanimated 上游已在 2026-03-13 合入：

- https://github.com/software-mansion/react-native-reanimated/pull/9072

后续应关注 Expo 可稳定接入的 Reanimated 版本，一旦包含该修复，应优先验证并考虑回收临时 workaround。

## 10. 拟修改文件清单

建议改动的文件如下：

1. `apps/mobile-user/package.json`
   - 增加 Reanimated static feature flags
   - 收敛或移除 app 侧直接声明的 `sonner-native`
2. `apps/mobile-user/app.json`
   - 在 `expo-build-properties` 下增加 `android.reactNativeReleaseLevel: "experimental"`
3. `packages/mobile-ui`
   - 新增统一 toast 导出入口
   - 由 UI 库统一持有 `Toaster`
4. `apps/mobile-user/app/_layout.tsx`
   - 保留全局 dismiss
   - 统一改为使用 UI 库导出的 toast
5. `apps/mobile-user/app/servicePersonnel/order-confirm.tsx`
   - 去掉页面级延迟返回逻辑
   - 改回正常 `router.back()`

## 11. 验证方案

修复后建议按以下顺序验证：

### 11.1 核心回归

1. 进入确认订单页
2. 点击“立即支付”触发 `toast.error(...)`
3. 在 toast 未消失前立即返回
4. 连续执行 20 次以上
5. 确认不崩溃

### 11.2 扩展场景

1. 普通 `toast.success` / `toast.info` / `toast.loading`
2. 手势返回、物理返回、导航栏返回按钮
3. 页面切换时存在多个 toast
4. 其他带全局 toast 的页面
5. 真机 Android 13 / 14 / 15 / 16 条件下回归

### 11.3 功能回归

1. 全局 toaster 样式是否正常
2. dismiss 行为是否正常
3. 点击与手势是否受影响
4. 路由切换是否仍有 ghost element、闪烁或残影

## 12. 风险与注意事项

1. `reactNativeReleaseLevel: experimental` 会扩大 Android 运行时差异面，需要真机回归。
2. `ANDROID_SYNCHRONOUSLY_UPDATE_UI_PROPS` 可能影响点击命中，不应默认和 P1 一起启用。
3. 如果继续保留双 `sonner-native` 版本，即使崩溃下降，后续仍可能出现 toast 不显示、dismiss 无效、状态不同步等问题。
4. `LayoutAnimationConfig` 不是主修复点，不能替代 Reanimated 层面的处理。

## 13. 最终建议

建议执行顺序：

1. 先统一 `sonner-native` 为单实例
2. 再启用 Reanimated workaround
3. 验证通过后移除页面级延迟返回
4. 后续再跟进 Reanimated 上游正式修复版本

这样可以在不牺牲交互的前提下，最大程度贴近当前外部社区的有效方案，并且让修复路径具备可维护性。
