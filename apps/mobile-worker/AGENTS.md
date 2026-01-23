# Mobile Worker Agents 指南

## 项目定位

- `apps/mobile-worker` 为服务人员端 Expo Router 客户端（`expo-router/entry`），与后端通过 Cookie 会话交互。
- 实时通知：Socket.IO WebSocket + 心跳 +（可选）严格模式 ACK；并集成腾讯云推送（TPNS）。

## 去哪里看

- 根布局/Provider/推送初始化：`apps/mobile-worker/app/_layout.tsx`
- 通知连接与心跳/ACK：`apps/mobile-worker/hooks/use-notification-socket.ts`
- 页面结构说明（较详细）：`apps/mobile-worker/PAGE_STRUCTURE.md`

## 通知链路要点

- WebSocket 连接事件名来自 `@repo/types`：`NOTIFICATION_SOCKET_CLIENT_EVENT` / `NOTIFICATION_SOCKET_SERVER_EVENT`。
- 心跳：默认 15s（`DEFAULT_HEARTBEAT_INTERVAL`），前后台切换会主动 Offline 并断开连接（避免后台误判在线）。
- 严格 ACK：仅当服务端下发 `deliveryMode === "strict"` 且包含 `deliveryId` 时，客户端会 `POST {endpoint}/ack`。
- 列表刷新：通知到达会 invalidate `['staff-orders-list']`，并在有 `orderId` 时 invalidate `['order-detail', orderId]`（见 `apps/mobile-worker/app/_layout.tsx`）。

## 环境变量

- 推送初始化依赖：`EXPO_PUBLIC_TENCENT_PUSH_SDK_APP_ID`、`EXPO_PUBLIC_TENCENT_PUSH_APP_KEY`（见 `apps/mobile-worker/app/_layout.tsx`）。
- 启动前先跑：`pnpm env:setup`，确保 `.env.development` 已生成。

## NativeWind 注意事项

- 与 `apps/mobile-user` 同样存在 NativeWind CSS interop 的动态 className 风险：动态样式优先用内联 `style`。
