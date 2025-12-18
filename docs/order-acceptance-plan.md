# 接单/拒单功能实施计划

## 背景与目标

- 当前用户指定服务人员的订单会在创建时默认写入 `order_assignments.accepted_at`，导致无法体现服务人员的自主接单/拒单动作。
- 需要新增一套操作流，让服务人员在移动端可选择“接受”或“拒绝”，并且同步影响订单状态、通知链路以及后续调度。
- 本计划梳理落地步骤与注意事项，方便后续研发、联调与测试。

## 工作计划

### 1. 数据模型与迁移

1. 为 `order_assignments` 增加 `decision_status`（`pending`/`accepted`/`rejected`）、`rejected_at`、`reject_reason` 字段，将 `accepted_at` 默认值改为 `NULL`。
2. 在订单维度标识“待接单”，在 `order_status` 枚举中新增 `pending_acceptance`，并同步更新 `packages/types/src/database-entity.ts`、`packages/types/src/order.ts`、`OrderRepository.validStatusTransitions`。
3. 编写 drizzle migration，确保老数据迁移策略明确（例如将现有 `accepted_at` 非空的记录批量迁移为 `decision_status = 'accepted'`）。

### 2. 后端接口与领域逻辑

1. 在 `OrderRepository`/`OrderService` 中新增 `acceptAssignment` 与 `rejectAssignment`，在同一事务中完成权限校验、状态检查及字段写入：
   - 校验订单已支付且非取消/超时。
   - 校验 `order_assignments.service_personnel_id` 等于当前登录人且 `decision_status = 'pending'`。
   - 接受时写入 `accepted_at`、`decision_status = 'accepted'`，必要时推进订单状态到 `in_progress` 或 `pending_acceptance → paid`。
   - 拒绝时写入 `reject_reason`、`rejected_at`、`decision_status = 'rejected'`，并决定后续处理（自动取消或回到调度池）。
2. 在 `OrderController` 暴露 `POST /order/:id/accept` 与 `POST /order/:id/reject` 接口，只允许 `service_personnel` 角色访问，拒绝接口需校验原因字段。
3. 更新 `packages/hooks/src/api/order/index.ts`，新增 `useAcceptOrder`、`useRejectOrder`，成功后失效 `orders-list`、`orders-list-infinite`、`staff-orders-list`、`order-detail` 相关缓存。

### 3. 通知链路

1. 在接单/拒单成功的事务后，向 `OrderExpireRedisKeys.notifyStream` 推送事件（如 `event = 'order_assignment_decision'`），载荷包含 `orderId`、`decisionStatus`、`operatorId`、`triggeredAt` 等。
2. 复用现有 `OrderNotifyRelayService`（SSE）派发信息；如移动端暂不消费 SSE，可在对应页面操作成功后手动刷新列表，后续再接入事件流。
3. 根据需要扩展推送/短信等下游渠道，确保客服与用户同步获知接单结果。

### 4. 移动端（服务人员端）

1. `apps/mobile-worker/app/(tabs)/orders.tsx` 请求参数中去掉 `onlyAccepted: true`，支持查看 `decision_status = 'pending'` 的待接单列表，可新增 Tab 筛选。
2. 在订单详情页 `apps/mobile-worker/app/orders/[id].tsx` 增加“接单”“拒绝”按钮，分别调用新 hooks 并显示确认弹窗，拒绝弹窗可复用取消弹窗的交互框架。
3. 视需要在订单卡片展示接单状态标签（例如“待接单”“已拒绝”），帮助服务人员快速定位。

### 5. 测试与交付

1. 单元测试：为 `OrderService` 新增用例覆盖多端并发、重复接单、非本人操作、订单状态非法等场景。
2. 接口联调：准备 Postman Collection，覆盖接单/拒单成功及失败路径。
3. 移动端自测：验证待接单→接单→服务流程、拒单后回流/取消流程、通知刷新等。
4. 回归既有流程（创建订单、支付、取消、超时、完成），确保未受影响。

## 注意事项

- **状态一致性**：所有状态跳转需更新 `validStatusTransitions`，并在事务内一次性写入，避免出现订单状态与分配状态不一致的情况。
- **并发与幂等**：接口要通过 `WHERE decision_status = 'pending' AND service_personnel_id = $currentId` 等条件防止多人同时操作导致的数据脏写。
- **老订单兼容**：已有“默认接单”的订单需在迁移中标记为 `decision_status = 'accepted'`，否则会被误判为仍待接单。
- **拒单去向**：拒单后是否重新分配或直接取消需提前确定策略，并为后续调度/客服流程提供必要的信息（原因、时间等）。
- **通知可靠性**：若后续引入推送/短信，注意失败重试与监控；SSE 仅在 App 前台有效，必要时配合轮询刷新。
- **安全与审计**：记录操作人 ID、IP（若可得）等信息，便于客服追溯；接口必须校验权限，防止越权操作。
