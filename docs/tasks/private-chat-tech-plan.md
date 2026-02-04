# 私聊（用户 ↔ 服务人员）后端设计与落地 Checklist

## 目标与边界

目标：在现有 NestJS 后端中新增“用户与服务人员 1v1 私聊”能力。

明确边界（按当前需求）：

- 会话模型：固定一对一（`user` ↔ `service_personnel`），用户发第一条消息即建立会话。
- 消息类型：文本 / 图片 / 视频 / 订单卡片。
- 风控：需要拉黑、举报。
- 拉黑策略（按最新需求）：拉黑后只禁止双方互相发送消息；历史分页/加入房间/会话列表不受影响。
- 通知：暂不做离线推送（只做在线 WS 实时）。

## 现有项目能力盘点（可复用）

### 认证与角色

- REST 鉴权：`apps/backend/src/modules/auth/auth.guard.ts:66`
    - 通过 `better-auth` 的 `auth.api.getSession()` 获取 session。
    - 支持 `@Roles`（RBAC）校验。
- 服务人员模型：服务人员是 `users` 的一种角色 + 扩展表。
    - `apps/backend/src/common/database/schema/auth-user.ts:26`（`users.role` 包含 `service_personnel`）
    - `apps/backend/src/common/database/schema/shops-service.ts:90`（`service_personnel.user_id` 关联 `users.id`）

结论：Chat 参与者统一用 `users.id` 表达（worker 也是 userId）。

### 实时（socket.io）基础设施

通知模块已经落地了：

- WebSocket Gateway（鉴权/断连）：`apps/backend/src/modules/notification/notification-ws.gateway.ts:36`
    - namespace：`/api/notifications`
    - 握手：`auth.api.getSession({ headers: fromNodeHeaders(client.handshake.headers) })`
    - 未登录：向客户端发送错误事件后 `disconnect(true)`。
- 连接与房间管理：`apps/backend/src/modules/notification/notification-ws.service.ts:36`
    - broadcast room：`__broadcast__`
    - user room：`user:{userId}`
    - 心跳超时踢线：45s
- 在线状态：`apps/backend/src/modules/notification/notification-presence.service.ts:34`
    - Redis Hash：`NotificationRedisKeys.serviceOnlinePrefix + userId`
    - TTL：45s

结论：Chat 的 WS 设计应尽量“复制同样的握手鉴权 + room 管理模式”，但保持模块边界（不要把 chat 的连接混进 notification service）。

### 文件（图片/视频）体系

文件模块已经能支持：上传 → 存储（RustFS/S3）→ 预签名下载链接 + blurhash。

- 上传：`apps/backend/src/modules/files/files.controller.ts:36`（`POST /files/upload`）
    - 返回：`id`、`fileUrl`（当前实现为 `fileHash`）、`blurhash`（图片可选）等。
- 访问：`apps/backend/src/modules/files/files.controller.ts:68`（`GET /files/:fileIdentifier`）
    - 返回：`fileUrl`（预签名下载 URL）、`expiresIn`、`blurhash` 等。
- 预签名 TTL：`apps/backend/src/modules/files/files.service.ts:725`（默认 600 秒）。

结论：Chat 消息中的媒体内容只需要引用 `fileId`（或兼容 `fileHash`），不要把外链 URL 存进消息表。

## 总体设计（建议）

### 模块边界

- 新增 `ChatModule`：负责会话/消息/拉黑/举报 + WS 实时收发。
- `NotificationModule`：当前不接入（未来如果要“离线新消息提醒”，再让 Chat 在“对方离线”时发布一个通知事件）。
- `FilesModule`：复用，用于上传图片/视频，并在客户端渲染时通过 `/files/:idOrHash` 获取预签名 URL。

### 数据模型（Drizzle / Postgres）

最小可用 + 可扩展：

1. `chat_conversations`
    - `id` (varchar, createId)
    - `user_id` (FK -> users.id)
    - `worker_user_id` (FK -> users.id)
    - `created_at`, `updated_at`
    - `last_message_at` (nullable)
    - 唯一索引：`(user_id, worker_user_id)`

2. `chat_messages`
    - `id` (varchar, createId)
    - `conversation_id` (FK -> chat_conversations.id)
    - `sender_user_id` (FK -> users.id)
    - `content` (jsonb)
    - `client_msg_id` (varchar, 可选) —— 幂等、防重复发送
    - `created_at`
    - 索引：`(conversation_id, created_at desc)`
    - 唯一索引（可选但推荐）：`(conversation_id, sender_user_id, client_msg_id)` 或 `(conversation_id, client_msg_id)`

3. `chat_blocks`
    - `id` (varchar, createId)
    - `blocker_user_id` (FK -> users.id)
    - `blocked_user_id` (FK -> users.id)
    - `created_at`
    - 唯一索引：`(blocker_user_id, blocked_user_id)`

4. `chat_reports`
    - `id` (varchar, createId)
    - `reporter_user_id` (FK -> users.id)
    - `reported_user_id` (FK -> users.id)
    - `message_id` (nullable, FK -> chat_messages.id)
    - `reason` (varchar)
    - `detail` (text/jsonb, 可选)
    - `status` (varchar/enum, e.g. `open|reviewing|resolved|rejected`)
    - `created_at`, `updated_at`

### 消息内容（content JSON 规范）

建议在 `@repo/types` 定义 union，示例：

```ts
type ChatMessageContent =
    | { type: "text"; text: string }
    | {
          type: "image";
          fileId: string;
          blurhash?: string;
          width?: number;
          height?: number;
      }
    | { type: "video"; fileId: string; durationMs?: number }
    | {
          type: "order_card";
          orderId: string;
          snapshot?: {
              serviceName?: string;
              totalAmount?: string;
              status?: string;
          };
      };
```

说明：

- 图片/视频：存 `fileId`（复用 `files` 表），客户端展示时通过 `GET /api/files/:fileId` 拿预签名 URL。
- 订单卡片：存 `orderId` + 可选 `snapshot`（避免列表渲染时额外查太多；snapshot 不要求强一致）。

#### 订单卡片（order_card）实现方案与建议

你仓库里已经有“订单卡片”概念与接口：

- `packages/types/src/order.ts:92`（`OrderCardSchema`）
- `apps/backend/src/modules/order/order.controller.ts:116`（`GET /api/order/cards`，用户端订单列表卡片）
- `apps/backend/src/modules/order/order.controller.ts:139`（`GET /api/order/:id`，用户/服务人员均可访问的订单详情）

在 Chat 中发送 `order_card`，建议遵循下面 3 点（按安全与实现成本的最小集合）：

1. 权限校验（必须）
    - 发送 `order_card` 时，后端必须校验该 `orderId` 对“会话双方”都可见。
    - 推荐采用最安全且语义最清晰的规则：
        - `orders.customer_id == conversation.user_id` 且
        - `order_assignments.service_personnel_id == conversation.worker_user_id`

    理由：否则用户可以把与当前服务人员无关的订单信息发给对方，属于隐私泄露风险；同时服务人员端点 `GET /api/order/:id` 也会因为权限不匹配而打不开，体验不一致。

2. snapshot 内容（建议）
    - Chat 消息里不要塞完整订单详情（太重且易变）。建议 snapshot 只覆盖“卡片渲染必需字段”，并尽量与 `OrderCardSchema` 对齐：
        - `title`（可直接复用 `serviceName` 或拼接 “服务名称 + 规格”）
        - `status`（订单状态）
        - `appointmentTime`
        - `totalAmount`
        - 可选：`orderSerial`（用户/服务人员更容易对账与沟通）
        - 可选：`workerName/workerAvatar`（如果该卡片要在双方都一致显示）

    实现上，snapshot 的数据来源已经在订单 schema 里可直接取到：
    - 订单核心：`apps/backend/src/common/database/schema/orders.ts:29`
    - 分配关系：`apps/backend/src/common/database/schema/orders.ts:126`（`order_assignments.service_personnel_id`）

3. 点击卡片后的跳转/拉取（建议）
    - 客户端点击卡片：直接跳转到订单详情页，并调用现有 `GET /api/order/:id`。
    - 由于上面第 1 点保证“订单与会话双方绑定”，双方都应能成功拉取详情（避免卡片可发但打不开的尴尬）。

### API（REST）建议

REST 负责“列表 + 历史分页 + 管理动作”。

- `POST /api/chat/conversations`：upsert 会话（可选；若客户端不想先建会话，可直接走 WS 的首条消息自动建会话）。
- `GET /api/chat/conversations`：会话列表（按 `last_message_at desc`）。
- `GET /api/chat/messages?conversationId=...&cursor=...&limit=...`：消息分页。
- `POST /api/chat/blocks` / `DELETE /api/chat/blocks/:blockedUserId`：拉黑/取消拉黑。
- `POST /api/chat/reports`：举报。

权限规则：

- 所有接口默认 `AuthGuard`。
- 查询/发送必须校验“当前用户是会话参与者”。
- 拉黑后（按最新需求）：双方仍可查看历史/加入房间/获取会话列表，但不可发送消息（后端必须至少限制发送）。

### WebSocket（socket.io）建议

WS 只负责“实时发送/接收”，历史仍走 REST。

- namespace：建议 `@WebSocketGateway({ namespace: '/api/chat', cors: ... })`
- 握手鉴权：复制通知网关逻辑（better-auth session），未登录断开。

事件建议：

- client -> server：`chat:client`
    - `{ type: 'send', conversationId, content, clientMsgId? }`
    - `{ type: 'send', peerUserId, content, clientMsgId? }`（首条消息：服务端自动 upsert 会话并广播时回传 conversationId）
    - `{ type: 'join', conversationId }`（可选；也可服务端在 send/列表时自动 join）
- server -> client：`chat:message`
    - `{ conversationId, message: {...} }`
    - `{ type: 'error', code, message }`

房间策略：

- `room:conversation:{conversationId}`

- `room:user:{userId}`（用于按用户维度聚合其所有在线连接）
- 服务端 join 前必须校验 participant。

为保证“全局常连 + 自动 join 全部会话房间”的体验，并解决“对方在线但尚未 join 会话房间导致首条消息收不到”的风险，后端已做如下增强（对应实现：`apps/backend/src/modules/chat/chat-ws.gateway.ts` 与 `apps/backend/src/modules/chat/chat.constants.ts`）：

1. **连接建立后自动 join**
    - 服务端在握手鉴权成功后，会让该 socket 加入：
        - `room:user:{userId}`
        - 该用户最近活跃的会话房间 `room:conversation:{conversationId}`（默认上限 200，可调）

2. **发送消息时自动补 join 接收方**
    - 服务端在写库成功后，会将“接收方 user room”中的所有在线 socket 批量加入该会话房间（`socketsJoin`），然后仅向 `room:conversation:{conversationId}` 广播消息。
    - 结果：
        - 接收方在线但未显式 join 也能收到实时消息
        - 不需要双通道广播（避免重复投递）

因此，客户端侧的 `{ type: 'join', conversationId }` 仍可保留（例如进入某个会话页时手动 join），但不再是可靠收消息的前置条件。

## 风控与合规（必须项）

### 拉黑

- 所有“发送消息”前检查 `chat_blocks`：
    - `blocker = me && blocked = other` 或 `blocker = other && blocked = me`。
    - 备注（按最新需求）：拉黑不影响加入房间与拉取历史，只影响发送。

### 举报

- 举报仅记录入库 + 后台可查（先不做自动处置）。
- 推荐允许带 `message_id`（定位证据），并存 `reason` + `detail`。

### 反骚扰/限流（当前仓库未发现现成 Throttler）

代码库目前未发现 `@nestjs/throttler` / limiter 组件（仓内搜索未命中）。建议用现有 Redis cacheService 实现最小限流：

- 按 userId 维度：例如每分钟发送不超过 N 条。
- 按 IP 维度：例如未登录路径不开放 chat；已登录仍可按 IP 兜底。

实现方式可以复用 `FilesService` 的 `cacheService.increment(key, 1, ttl)` 模式。

## 修改方案（按仓库结构落位）

### 后端（apps/backend）

新增模块：

- `apps/backend/src/modules/chat/chat.module.ts`
- `apps/backend/src/modules/chat/chat.controller.ts`（REST）
- `apps/backend/src/modules/chat/chat.service.ts`（业务规则）
- `apps/backend/src/modules/chat/chat.repository.ts`（Drizzle 查询封装）
- `apps/backend/src/modules/chat/chat-ws.gateway.ts`（WS 鉴权 + 事件）

注册模块：

- `apps/backend/src/modules/modules.module.ts:16` 中 `imports` 加入 `ChatModule`。

新增 schema：

- `apps/backend/src/common/database/schema/chat.ts`
- `apps/backend/src/common/database/schema/index.ts:4` 导出 `chat`。

迁移：

- `apps/backend/drizzle/*` 新增 migration（按现有 Drizzle 工作流生成）。

### 共享类型（packages/types）

新增：

- `packages/types/src/chat.ts`：
    - ChatMessageContent union（zod schema + types）
    - REST DTO（create conversation / list / report / block）
    - WS 事件常量（仿照 `packages/types/src/notification.ts:102` 的写法）
- `packages/types/src/index.ts` 导出。

## 落地 Checklist（可执行）

1. 设计确认
    - 明确“用户能联系哪些服务人员”：至少要求 `users.role` 包含 `service_personnel`，是否还要检查 `service_personnel.is_available`。
    - 拉黑策略：拉黑后是否允许查看历史（建议允许看、禁止发）。

2. 数据库
    - 新增 `chat.ts` schema + migration。
    - 加索引：`(user_id, worker_user_id)` 唯一；`(conversation_id, created_at desc)`。

3. Types
    - `ChatMessageContent` 及 Zod 校验（文本长度、media fileId 格式、orderId 格式）。

4. REST
    - upsert 会话
    - 列表
    - 消息分页
    - 拉黑/举报

5. WebSocket
    - `/api/chat` namespace
    - 握手鉴权（better-auth session）
    - join room 前 participant 校验
    - `send`：校验（参与者 + 拉黑 + 简单限流）→ 写库 → 广播

6. 限流（最小版本）
    - Redis 计数器实现（按 userId + 固定窗口 ttl）。

7. 测试与验收

- 越权：非参与者无法 join/读/发。
- 拉黑：拉黑后双方无法发送（允许 join/读/会话列表）。
- 媒体：消息携带 `fileId`，客户端按 `/api/files/:fileId` 能拿到预签名 URL + blurhash。

客户端发送能力（前端验收要点）：

- 图片：选择图片 → `POST /api/files/upload` → 发送 `{ type: "image", fileId, blurhash?, width?, height? }`
- 视频：选择视频 → `POST /api/files/upload` → 发送 `{ type: "video", fileId }`
- 订单卡片：订单详情页点击“发送订单卡片” → upsert 会话 → 跳转会话页并携带 `draftOrderId` → 会话页自动发送 `{ type: "order_card", orderId }`（发送后清理参数避免重复）
