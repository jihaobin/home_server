# 私聊（用户端 + 服务人员端）前端对接方案（全局常连 + 自动 Join）

状态：Draft（作为实现依据）

## 1. 目标与边界

目标：将已落地的私聊后端能力对接到 `apps/mobile-user`（用户端）与 `apps/mobile-worker`（服务人员端），并实现**前台全局常连**、**自动 join 全部会话房间**、**消息实时收发 + 历史分页**的体验。

边界（按当前需求，不扩展）：

- 会话：固定 1v1（用户 ↔ 服务人员），首条消息可自动建会话。
- 消息类型：文本 / 图片 / 视频 / 订单卡片。
- 风控：拉黑（仅影响发送）、举报（仅入库）。
- 通知：不做离线推送（仅在线 WS 实时）。

## 2. 冻结需求（必须严格满足）

1. 两端均需“全局常连”（App 前台激活时保持连接）。
2. 两端均需“自动 join 全部会话房间”。
3. 任何一方在线时，对方发送消息必须实时送达（不依赖进入会话页/手动 join）。
4. 历史消息分页走 REST；实时收发走 WS。
5. 拉黑后：双方仍可看历史/会话列表/加入房间，但不可互相发送消息（服务端会拒绝，客户端需提示）。

## 3. 现有契约（不要发明协议）

### 3.1 REST API（后端已实现）

对应 controller：`apps/backend/src/modules/chat/chat.controller.ts`

- `POST /api/chat/conversations`：upsert 会话（body：`ChatUpsertConversationDto`）
- `GET /api/chat/conversations?limit=...`：会话列表（response：`ChatConversationListResponse`）
- `GET /api/chat/messages?conversationId=...&cursor=...&limit=...`：消息分页（response：`ChatMessageListResponse`，倒序）
- `POST /api/chat/blocks`：拉黑（body：`ChatCreateBlockDto`）
- `DELETE /api/chat/blocks/:blockedUserId`：取消拉黑
- `POST /api/chat/reports`：举报（body：`ChatCreateReportDto`）

### 3.2 WS（socket.io）

- namespace：`/api/chat`（见 `apps/backend/src/modules/chat/chat-ws.gateway.ts`）
- client -> server event：`chat:client`（常量：`CHAT_SOCKET_CLIENT_EVENT`）
- server -> client event：`chat:message`（常量：`CHAT_SOCKET_SERVER_EVENT`）

事件/类型来自：`packages/types/src/chat.ts`

- `ChatSocketClientMessage`：`send` / `join`
- `ChatSocketServerMessage`：`message` / `error`

### 3.3 房间策略（已按“全局常连 + 自动 join”增强）

后端现在同时使用：

- `room:conversation:{conversationId}`：会话房间
- `room:user:{userId}`：用户房间（聚合该用户所有在线连接）

服务端行为（你前端要依赖的保证）：

1. socket 连接鉴权成功后：会自动加入 `room:user:{userId}`，并自动加入该用户最近活跃的会话房间（默认上限 200）。
2. 当任意一方发送消息后：服务端会把“接收方 user room”内所有 socket 批量加入该会话房间（`socketsJoin`），然后仅向 `room:conversation:{conversationId}` 广播消息。

因此：客户端 `join` 事件可以保留（进入会话页时主动 join），但**不能再把 join 作为能否实时收消息的前置条件**。

## 4. 前端总体方案（结论）

把前端实现拆成 3 层，便于 AI agent 分工与验收：

1. **数据访问层（@repo/hooks）**：封装 chat REST（列表/分页/拉黑/举报/建会话），供两端复用。
2. **连接层（每个 App 一个全局 ChatSocketBridge）**：负责 socket 连接生命周期（cookie 鉴权、前后台切换、重连、错误上报）与“joinAll”。
3. **缓存同步层（React Query）**：收到 WS 消息后，增量更新“会话列表缓存 + 消息列表缓存”，避免频繁 refetch。

## 5. 数据访问层（必须放到 @repo/hooks）

### 5.1 新增文件与导出

新增：`packages/hooks/src/api/chat/index.ts`

并在 `packages/hooks/package.json` 增加 exports：

```json
{
    "./api/chat": "./src/api/chat/index.ts"
}
```

参考风格：`packages/hooks/src/api/order/index.ts`（queryKey、meta.errorMessage、invalidate）。

### 5.2 建议的 queryKey 约定（稳定、可被 Bridge 更新）

```ts
const CHAT_QUERY_KEY = {
    CONVERSATIONS: "chat-conversations",
    MESSAGES_INFINITE: "chat-messages-infinite",
} as const;
```

推荐键：

- 会话列表：`[CHAT_QUERY_KEY.CONVERSATIONS, { limit }]`
- 消息分页：`[CHAT_QUERY_KEY.MESSAGES_INFINITE, { conversationId, limit }]`

### 5.3 必须提供的 hooks（最小集合）

1. `useChatConversations({ limit })`（`useSuspenseQuery`）
2. `useChatMessagesInfinite({ conversationId, limit })`（`useSuspenseInfiniteQuery`）
    - `getNextPageParam` 使用 `nextCursor`
3. `useChatUpsertConversation()`（`useMutation`）
4. `useChatBlock()` / `useChatUnblock()`（`useMutation`）
5. `useChatReport()`（`useMutation`）

注意：所有请求都应走 `apiClient`：`@repo/lib/http-client`，它会在 RN 端通过 `Cookie` header 携带 better-auth 会话（见 `packages/lib/src/http-client.ts`）。

## 6. 连接层：ChatSocketBridge（两端都要）

### 6.1 连接鉴权（关键点）

后端握手读取 `client.handshake.headers` 做 `auth.api.getSession()`。

因此 RN 端必须像通知一样显式设置 Cookie：

- `socket.io-client` 使用 `extraHeaders: { Cookie: cookieHeader }`
- 同时保留 `withCredentials: true`

参考实现：`apps/mobile-worker/hooks/use-notification-socket.ts`。

### 6.2 endpoint 计算（避免 /api/api/chat）

socket endpoint = `站点 origin + /api/chat`。

- **站点 origin**：不包含 `/api`（参考 worker：`apps/mobile-worker/lib/config.ts` 的解析逻辑）。
- mobile-user 当前未提供 config 文件：可直接复制同样的 origin 解析逻辑（从 `EXPO_PUBLIC_AUTH_BASE_URL` 或 `EXPO_PUBLIC_API_BASE_URL` 推导）。

### 6.3 生命周期（建议与通知一致）

与 worker 通知 hook 一致：

- AppState 变为 `active`：connect + joinAll（或依赖服务端 auto-join）
- AppState 非 `active`：disconnect
- 连接失败：记录 lastError，交由 Bridge toast（或上报）

### 6.4 自动 joinAll（客户端层面仍建议做一遍）

虽然服务端会 auto-join 最近活跃会话，但为了“长期会话数可能 >200”的可扩展性，客户端仍建议在连接成功后：

1. 调一次 `GET /api/chat/conversations?limit=...`（上限 100，按后端参数校验）
2. 对每个 conversationId 发 `{ type: 'join', conversationId }`

实现方式：在 `useChatSocket` 内维护 `joinedConversationIds: Set<string>`，避免重复 join。

## 7. 缓存同步层：收到 WS 消息如何更新 UI

### 7.1 消息列表（会话页）

消息分页接口是**倒序**（最新在前），`ChatMessageListResponse.nextCursor` 用于拉更早消息。

收到实时消息后，建议更新第一屏（第一页）顶部：

- 找到对应 infinite query 的第一页
- 去重（按 `message.id`；可额外按 `clientMsgId` 兜底）
- unshift 新消息到 items[0]

### 7.2 会话列表（列表页）

收到消息后应立即：

- 更新该会话的 `lastMessageAt`（用 `message.createdAt`）
- 把该会话移动到列表第一位
- 若列表里没有该会话：插入一个“最小会话项”（至少包含 id/userId/workerUserId/createdAt/updatedAt；必要时触发一次 conversations refetch 补全）

### 7.3 发送消息的幂等与 UI 体验

客户端发送时必须携带 `clientMsgId`（UUID/时间戳都可，但推荐 UUID）：

- 用于防止重连/点击重复导致重复入库
- 用于本地“乐观消息”与服务端回写消息做匹配（通过 `clientMsgId` 替换 pending 状态）

注意：服务端回传的 `ChatMessage.clientMsgId` 可能为 null（如果你不传），因此要强制前端传。

## 8. 页面与交互（建议最小可用落位）

此文档仅给出建议路由，具体 UI 组件按现有 mobile-ui/NativeWind 规范实现。

### 8.1 用户端（apps/mobile-user）

建议新增：

- 会话列表：`apps/mobile-user/app/(tabs)/chat/index.tsx`（新增一个 Tab 或从 profile/订单详情入口跳转，按产品决定）
- 会话详情：`apps/mobile-user/app/chat/[conversationId].tsx`

入口建议（不新增后端）：

- 在订单详情页、服务人员详情页提供“联系服务人员”按钮：调用 `useChatUpsertConversation` 后跳转到会话页。

### 8.2 服务人员端（apps/mobile-worker）

建议新增：

- 会话列表：`apps/mobile-worker/app/(tabs)/chat.tsx`（或 `chat/index.tsx`，看现有路由习惯）
- 会话详情：`apps/mobile-worker/app/chat/[conversationId].tsx`

### 8.3 会话详情页必须包含

- 历史消息列表（分页加载更多）
- 输入框 + 发送按钮
- 图片/视频发送（复用 files 上传）
- 订单卡片发送（从订单详情页“发送订单卡片”进入最简单）
- 举报/拉黑入口（可放在 header 菜单）

## 9. 媒体与订单卡片（不要把 URL 存进消息）

### 9.1 图片/视频

流程：

1. 客户端用 `useUploadFile`（`packages/hooks/src/api/files/index.ts`）上传
2. 获取 `fileId`（upload response 的 `id`）与可选 blurhash
3. 发送 chat 消息 content：`{ type: "image"|"video", fileId, blurhash? }`
4. 渲染时用 `useFile(fileId)` 获取预签名 URL（10 分钟）与 blurhash（`GET /api/files/:fileIdentifier`）

当前代码落位（已实现）：

- user：`apps/mobile-user/hooks/use-chat-send-attachments.ts` + `apps/mobile-user/components/chat/ChatComposerView.tsx`
- worker：`apps/mobile-worker/hooks/use-chat-send-attachments.ts` + `apps/mobile-worker/components/chat/ChatComposerView.tsx`

说明：会话页底部输入框左侧提供两个入口按钮（占位文案为“图/视”，后续可替换 UI），触发：选择媒体 → 上传 → 发送对应 content。

### 9.2 订单卡片

消息 content：`{ type: "order_card", orderId, snapshot? }`（结构见 `packages/types/src/chat.ts`）。

点击卡片：跳转到订单详情页（两端各自路由不同）。

发送方式（已实现，最小闭环）：

1. 在订单详情页点击“发送订单卡片”
2. 前端先 `POST /api/chat/conversations` upsert 会话
3. 跳转到会话页，并携带 URL 参数 `draftOrderId=<orderId>`
4. 会话页检测到 `draftOrderId` 后自动发送 `{ type: "order_card", orderId: draftOrderId }`，并通过 `router.replace` 清理参数，避免重复发送

代码落位：

- user 订单详情：`apps/mobile-user/app/order/[id].tsx`
- worker 订单详情：`apps/mobile-worker/app/orders/[id].tsx`
- 会话页 draft 参数处理：`apps/mobile-user/app/chat/[conversationId].tsx`、`apps/mobile-worker/app/chat/[conversationId].tsx`

## 10. 给 AI agent 的执行 Checklist（按依赖顺序）

1. 在 `@repo/hooks` 新增 `api/chat`（含 exports），并在两端页面中替换为该 hook。
2. worker：新增 `hooks/use-chat-socket.ts`（仿通知 hook），在 `apps/mobile-worker/app/_layout.tsx` 中新增 `ChatSocketBridge`（与 NotificationSocketBridge 并列）。
3. user：
    - 增加 `socket.io-client` 依赖（与 worker 对齐版本 4.8.x）
    - 新增 `hooks/use-chat-socket.ts`，在 `apps/mobile-user/app/_layout.tsx` 中新增 `ChatSocketBridge`
4. 新增会话列表页与会话详情页（两端都要）：接入 conversations + messages + send。
5. 实现缓存同步：`queryClient.setQueryData` 更新 conversations 与 messages。
6. 验收与质量：
    - `pnpm --filter mobile-user type-check` / `lint`
    - `pnpm --filter mobile-worker type-check` / `lint`

## 11. 验收清单（必须可复现）

1. 双端登录后前台建立 WS 连接；断网/切后台/回前台可自动恢复。
2. 任意一方首次发起聊天（peerUserId send）对方在线可实时收到首条消息。
3. 会话列表实时置顶与 lastMessageAt 更新；会话详情页实时追加消息。
4. 拉黑后双方均无法发送（服务端返回 error，客户端提示）；历史仍可拉取。
5. 图片/视频消息可发送与展示（预签名 URL + blurhash 占位可选）。
