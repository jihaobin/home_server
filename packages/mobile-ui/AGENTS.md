# Mobile UI Agents 指南

## 概览

- `@repo/mobile-ui` 为 Expo/RN 应用提供基础组件与 Provider（NativeWind + rn-primitives）。
- 按 subpath 导入：`@repo/mobile-ui/components/*`、`@repo/mobile-ui/styles/*.css`、`@repo/mobile-ui/lib/*`。

## 去哪里改

- Provider/会话：`packages/mobile-ui/src/components/provider.tsx`、`packages/mobile-ui/src/components/SessionProvider.tsx`
- UI primitives：`packages/mobile-ui/src/components/ui/*.tsx`
- 样式：`packages/mobile-ui/src/styles/mobile-user.css`、`packages/mobile-ui/src/styles/mobile-work.css`
- 主题常量：`packages/mobile-ui/src/lib/mobile-user-constants.ts`、`packages/mobile-ui/src/lib/mobile-work-constants.ts`

## 约定

- 动态样式（尤其 shadow/opacity）在 NativeWind 下优先用内联 `style`（移动端已知问题见 `apps/mobile-user/AGENTS.md`）。
