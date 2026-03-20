# 通知模块 WebSocket 迁移方案

## 1. 现状梳理

| 模块/文件 | 职责 | 与 SSE 相关的点 |
| --- | --- | --- |
| `NotificationSseService` | 利用 RxJS Subject 存储事件、支持 Last-Event-ID 重放 | 所有通知事件都经由 `stream()` 返回 `Observable<MessageEvent>` |
| `NotificationRelayService` | 从 Redis Stream 读事件 → 推送给 `NotificationSseService` | 直接调用 `notificationSseService.emit(payload)` |
| `OrderEventsController` (`/orders/events`) | 为管理端订单页提供 SSE 流 | `@Sse` + `NotificationSseService.stream(lastEventId)` |
| `NotificationController` (`/notifications/stream`) | 服务端 SSE 订阅接口 | 同样依赖 `NotificationSseService.streamForUser` |
| Admin Web `orders-page-content.tsx` | 通过 `EventSource` 监听 `/orders/events` | 仅支持浏览器 SSE |
| 移动端（计划中） | 原需求是 SSE 订阅、心跳、ACK | React Native 端缺乏稳定 SSE 库 |

## 2. 目标

1. 将通知推送链路切换到 WebSocket，统一服务管理端 Web/移动端。
2. 支持多客户端连接、心跳/在线状态上报，与现有 `NotificationPresenceService` 协同。
3. 确保管理端能在浏览器环境保持兼容；移动端（React Native）使用 WebSocket 原生实现。
4. 替换所有 SSE API 和客户端逻辑，保留 ACK/Heartbeat 等 REST 接口。

## 3. WebSocket 架构设计

### 3.1 服务端

- **WebSocket Gateway**：基于 NestJS `@WebSocketGateway` + `socket.io` 实现；使用 `socket.io` 的房间和命名空间能力管理用户连接。
  - 命名空间 `/notifications`，支持查询参数/headers 传递 session token，由现有 `AuthGuard` 共用鉴权逻辑。
  - 连接成功后注册 `connectionId`，写入 Redis `online:service:<userId>`，保留 TTL（45s）。
- **事件分发**：
  - `NotificationRelayService` 不再调用 SSE service，而是通过新的 `NotificationWsService` 将事件推送到对应连接（按 userId 或广播）。
  - 仍走 Outbox → Redis Stream → Dispatcher → Delivery 记录逻辑。
- **协议**：JSON message，字段建议：

  ```json
  {
    "type": "notification",
    "event": "order_assignment_decision",
    "payload": { ... },
    "deliveryId": "...",
    "deliveryMode": "strict"
  }
  ```

  - 额外保留 `type: "heartbeat_ack"` 等扩展。
- **心跳**：WebSocket 会在客户端发送 `{"type":"heartbeat","timestamp":...}`，服务端刷新在线状态；若超时未收到，主动断开。

- **事件类型常量**：后台影响所有通知事件的 `type`/`event` 字段，统一在 `packages/types` 中定义（如 `NotificationSocketEvent` 枚举、`NOTIFICATION_CHANNELS` 常量），既供服务端发送时引用，也供前端监听时使用，避免魔法字符串。

### 3.2 客户端

- **React Native**：使用 `socket.io-client` 提供的 WebSocket 实现（Expo/React Native 均支持），管理重连、前后台切换（后台关闭 WS）。
- **腾讯云消息推送**：App 退到后台或被系统杀死后，由 `TencentCloudPushChannel` 触发 TPNS/厂商通道远程通知，唤醒客户端或直接在通知栏展示，取代原先的 Expo Push 占位方案。
- **Admin Web**：同样采用 `socket.io-client`，将现有 `EventSource` 替换为 Socket.IO 连接，复用统一的事件类型常量。
- **重连策略**：指数退避 + 最大间隔 30s，配合 `Last-Event-ID` 逻辑可通过 REST 回补未读（后续可扩展）。

### 3.3 服务人员通知事件

- `order_pending_acceptance_assigned`：支付成功并已分配给指定服务人员时触发，提醒尽快接单。
- `order_cancelled`：订单被客户或平台取消时触发，附带取消原因。
- `order_pending_acceptance_warning`：`pending_acceptance` 状态下 45/15 分钟的提醒与强制取消提示，将在后续迭代补充。
- `order_service_eta_warning`：服务人员已接单但尚未上门时的 30/15 分钟提醒，占位逻辑已预留。

## 4. 实施步骤

1. **后端基础设施**
   - 新增 `NotificationWsGateway` + `NotificationWsService`，实现连接管理、鉴权、心跳。
   - 更新 `NotificationRelayService`/`NotificationDispatcher`，在成功发送后调用 WS 服务推送给对应连接；保留 Outbox 流程。
   - 维护在线状态时统一通过 `NotificationPresenceService`（WS 连接建立/关闭时刷新 Redis）。
2. **API 替换**
   - 废弃 `/orders/events` 与 `/notifications/stream` SSE endpoint；新增 `/notifications/ws` WebSocket URL（也可在同一 Gateway 中区分事件类型）。
   - 心跳/ACK REST 接口可继续使用，前端只需在 WS 事件中拿到 `deliveryId` 触发。
3. **客户端改造**
   - 管理端：将 `EventSource` 替换为 `WebSocket`，调整事件解析、重连逻辑。
   - React Native：封装统一的 `useNotificationSocket` hook，处理连接、心跳、ACK 提交。
4. **兼容与回滚**
   - 不用兼容直接删除sse的代码。因为应用没有上线，一个真实用户都没有。

## 5. 风险与注意事项

- **鉴权**：WebSocket 握手需重用 `better-auth` session，注意跨域/CORS 设置。
- **心跳**：移动端后台/锁屏时需及时关闭 WS，依赖腾讯云消息推送兜底；否则服务器会误判在线。
- **重连风暴**：大规模断网时需有退避策略，避免大量重连请求压垮服务。
- **并发连接**：需评估 NestJS `ws` Gateway 的连接上限，必要时切换到专用 WS 服务或使用 `socket.io`。

## 6. 后续计划

1. 实现并部署 WebSocket 服务及客户端 SDK。
2. 更新 admin-web & mobile-worker 的通知订阅逻辑。
3. 回收 SSE 代码、更新文档与监控。

该方案将作为通知模块第四阶段（客户端改造）的执行蓝图，后续变更请继续在本文件记录。

## 7. 执行进度同步（2025-12-11）

- ✅ 后端 SSE 入口（`/orders/events`, `/notifications/stream`）已确认下线，由 `NotificationWsService` / `NotificationWsGateway` 统一承载实时推送。
- ✅ `NotificationRelayService` → `NotificationDispatcher` 链路已切换到 WebSocket 推送，废除了 `NotificationSseService` 依赖。
- ✅ 管理端订单页已完成 WebSocket 订阅改造，基于 `useNotificationSocket` hook 统一封装连接 / 心跳 / 重连，并在订单模块实测通过。
- 🕒 移动端（Expo）服务人员 App 已通过 `useNotificationSocket` 统一封装心跳、Offline 信令与 AppState 管理，并串联腾讯云推送 SDK；Hook 同时内置 `/notifications/ack` 调用，但服务端尚未投递 `deliveryMode='strict'` 事件，ACK/重放链路仍待后端放量验证。
- ⏳ ACK / Heartbeat 接口的对外文档、`NotificationSocketEventType` 使用示例仍待沉淀到开发手册，方便前端同学集成与排障。
- 🕒 WebSocket 推送已接入通知模块的 Prometheus 指标与重试任务，`/notifications/metrics` 可观测链路健康，但 Dispatcher 仍把成功状态直接标记为 `delivered`，ACK 超时重试暂时拿不到数据，需等严格模式上线后再补闭环。
