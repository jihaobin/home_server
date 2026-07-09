# 订单完成扫码流程设计

> 目标：删除订单主状态 `in_progress`（服务中），将原“到场扫码核验”改为“服务完成后，用户认可并出示二维码，服务人员扫码后订单直接完成”。

## 背景

当前订单主流程中，服务人员接单后订单进入 `paid`。用户端生成到场核验二维码，服务人员扫码后订单从 `paid` 进入 `in_progress`。之后用户再手动确认完成，订单从 `in_progress` 进入 `completed`。

经过业务讨论，`in_progress` 目前没有独立业务价值，且“到场扫码”会增加现场操作成本。新流程中，接单后的订单保持 `paid`，服务完成且用户认可后，由用户出示完成确认二维码，服务人员扫码，订单直接进入 `completed`。

## 术语

- `paid`：服务人员已接单，订单待服务或服务已完成但尚未扫码确认。
- `completed`：服务人员扫码完成确认成功后，订单完成并触发收益处理。
- 完成确认二维码：用户端为 `paid` 订单生成的一次性二维码，服务人员扫码后用于确认订单完成。
- 旧到场核验：当前 `check-in` 命名下的二维码能力。新流程不再表达“到场”语义。

## 新状态机

订单主状态保留：

| 状态 | 展示语义 | 新实际含义 |
| --- | --- | --- |
| `pending_payment` | 待支付 | 订单已创建，等待客户完成支付 |
| `payment_timeout` | 支付超时 | 待支付订单超过 `payment_expires_at`，系统关闭支付单并释放订单 |
| `pending_acceptance` | 待接单 | 支付成功，等待服务人员确认接单 |
| `paid` | 待服务 | 服务人员已接单；服务完成前后都停留在该状态，直到扫码确认完成 |
| `completed` | 已完成 | 服务人员扫码完成确认成功，订单服务结束并触发收益处理 |
| `cancelled` | 已取消 | 用户、服务人员或退款流程导致订单取消 |
| `refunded` | 已退款 | 已完成订单发生全额退款后的终态 |
| `staff_rejected` | 服务人员拒单 | 枚举保留；当前后端仍未找到完整写入流程 |

删除：

| 状态 | 删除原因 |
| --- | --- |
| `in_progress` | 不再需要单独表示“服务中”；服务是否开始不作为订单主状态 |

合法状态转换：

| 当前状态 | 可转换到 |
| --- | --- |
| `pending_payment` | `pending_acceptance` / `paid` / `cancelled` / `payment_timeout` |
| `pending_acceptance` | `paid` / `cancelled` |
| `paid` | `completed` / `cancelled` |
| `completed` | `refunded` |
| `staff_rejected` | 无 |
| `cancelled` | 无 |
| `payment_timeout` | 无 |
| `refunded` | 无 |

主流程：

```text
创建订单
pending_payment
  ├─ 支付成功 -> pending_acceptance
  │              └─ 服务人员接单 -> paid
  │                                └─ 用户认可后，服务人员扫码完成确认 -> completed
  │                                                            └─ 完成后全额退款 -> refunded
  ├─ 支付超时 -> payment_timeout
  └─ 用户取消 -> cancelled

pending_acceptance / paid
  ├─ 用户或服务人员取消 -> 走退款；全额退款后通常落到 cancelled
  └─ 服务人员改期 -> 只改 appointment_time，不改状态
```

## 完成确认二维码

### 生成二维码

用户端在订单详情页为 `paid` 订单生成二维码。

约束：

- 当前登录用户必须是订单客户。
- 订单状态必须是 `paid`。
- 生成新二维码前撤销同一订单未使用的旧二维码。
- 二维码仍使用短期 token，过期后不能核验。

接口建议：

- 新接口：`GET /api/order/:id/completion-confirmation`
- 兼容接口：`GET /api/order/:id/check-in` 可短期保留，但 Swagger 标记 deprecated，文案不再出现“到场”。

### 服务人员扫码

服务人员端扫码后提交 token 和当前定位。

约束：

- 二维码必须存在、未使用、未撤销、未过期。
- token 中的订单 ID 必须与服务端记录一致。
- 当前服务人员必须是该订单分配的服务人员。
- 订单当前状态必须是 `paid`。
- 定位字段可继续上报并记录到 `verified_geom`，但不再作为“到场距离校验”入口。若未来要恢复地理限制，应作为完成确认的独立规则重新设计。

成功后：

- 二维码记录更新为 `verified`。
- 写入 `verified_at`、`verified_by`、`verified_geom`。
- 订单从 `paid` 原子更新为 `completed`。
- 写入 `orders.service_completed_at`。
- 服务人员技能维度 `serviced_count + 1`。
- 调用 `PayService.handleOrderCompletion` 处理收益分配。
- 清理上门提醒调度。
- 返回完成后的订单或明确成功结果。

接口建议：

- 新接口：`POST /api/order/completion-confirmation/verify`
- 兼容接口：`POST /api/order/check-in/verify` 可短期保留，但实现语义改为完成确认，Swagger 标记 deprecated。

## 后端改动范围

### 枚举与类型

修改：

- `apps/backend/src/common/database/schema/enums.ts`
- `packages/types/src/database-entity.ts`

要求：

- 删除 `order_status` / `OrderStatusEnum` 中的 `in_progress`。
- 同步修正文案：`paid` 不再写“已支付”，应写“已接单待服务/待完成确认”。
- 所有 `Record<OrderStatus, ...>` 类型必须补齐 `pending_acceptance`、`staff_rejected`，删除 `in_progress`。

### 数据迁移

生产/测试库迁移规则：

```sql
UPDATE orders
SET status = 'paid', updated_at = NOW()
WHERE status = 'in_progress';
```

随后从 PostgreSQL enum 中移除 `in_progress`。如果 PostgreSQL 版本或 Drizzle 迁移限制导致 enum 不能直接删除值，应按安全方式重建 enum：

1. 创建新 enum，不含 `in_progress`。
2. 将 `orders.status` 转成 text，再转成新 enum。
3. 替换旧 enum 名称。
4. 保留历史 `service_started_at`，但新流程不再写入该字段。

### 状态机与完成逻辑

修改：

- `apps/backend/src/modules/order/order.reposityro.ts`
- `apps/backend/src/modules/order/order.service.ts`

要求：

- `validStatusTransitions.paid` 改为 `['completed', 'cancelled']`。
- 删除 `validStatusTransitions.in_progress`。
- 删除或废弃 `startService()`。
- `completeOrderAndIncrementServicedCount()` 改为只允许 `paid -> completed`。
- 错误文案从“订单必须处于服务中状态才能完成”改为“订单必须处于待服务状态才能完成确认”。
- 保持完成动作原子和幂等，避免重复扫码导致重复增加 `serviced_count` 或重复收益分配。

### 二维码服务

修改：

- `apps/backend/src/modules/order/order-checkin.service.ts`
- `apps/backend/src/modules/order/order-checkin.repository.ts`
- `apps/backend/src/modules/order/order.controller.ts`

要求：

- 业务命名改为“完成确认”，不再叫“到场核验”。
- 生成二维码只允许 `paid`。
- 核验成功后不再调用 `startService()`，而是进入完整完成流程。
- `OrderService.completeOrder()` 需要支持服务人员扫码触发完成，但仍要校验扫码者是分配服务人员。
- 旧 `POST /api/order/:id/complete` 的用户手动完成入口应废弃或收紧为后台/兼容用途，不再作为用户端主流程。

## 前端改动范围

### 用户端

修改：

- `apps/mobile-user/app/order/[id].tsx`
- `apps/mobile-user/app/(tabs)/orders/index.tsx`
- `apps/mobile-user/components/orders_screen/*`
- `packages/hooks/src/api/order/index.ts`
- `packages/types/src/order.ts`

要求：

- 删除 `in_progress` / “待验收” tab。
- `paid` tab 覆盖 `pending_acceptance + paid`，其中 `paid` 表示“待服务/待完成确认”。
- 订单详情只在 `paid` 状态展示完成确认二维码。
- 二维码文案改为“完成确认二维码”“服务完成并认可后，请出示此二维码供服务人员扫码确认完成”。
- 删除用户手动“确认完成”主按钮，不再调用 `POST /order/:id/complete` 作为主流程。
- 扫码成功后用户端刷新订单，状态显示 `completed`。

### 服务人员端

修改：

- `apps/mobile-worker/app/scan/index.tsx`
- `apps/mobile-worker/app/orders/[id].tsx`
- `apps/mobile-worker/app/(tabs)/orders.tsx`
- `apps/mobile-worker/app/(tabs)/index.tsx`
- `apps/mobile-worker/lib/order-priority.ts`

要求：

- 删除“服务中”分组和筛选。
- `paid` 分组作为“待服务/待完成确认”。
- 扫码入口文案改为“扫码确认完成”。
- 扫码页文案改为“确认完成中...”。
- 扫码成功弹窗文案改为“订单已完成”。
- 首页优先工单排序从“待接单 > 服务中 > 待服务”改为“待接单 > 待服务”。

### 管理端

修改：

- `apps/admin-web/src/app/(management)/orders/_constants.ts`
- `apps/admin-web/src/app/(management)/orders/_components/*`
- `apps/admin-web/src/app/(management)/orders/_utils/query.ts`
- `packages/hooks/src/api/ssr/admin-orders.ts`

要求：

- 删除 `in_progress` 标签、筛选项、badge 样式和手动改状态选项。
- 状态文案补齐 `pending_acceptance`、`staff_rejected`。
- 管理端手动改到 `completed` 若继续存在，应明确走后端完成流程或显示警告。不能绕过收益处理、服务次数递增和提醒清理。

## 兼容与命名策略

短期建议：

- 数据表 `order_checkins` 暂时保留，避免一次性迁移过多表名和外键。
- 代码层新增“completion confirmation”语义，旧 `check-in` service/controller/hook 逐步重命名。
- 旧 `check-in` API 保留一个版本周期，内部调用新完成确认逻辑，Swagger 标记 deprecated。

长期建议：

- 新建 `order_completion_confirmations` 表替代 `order_checkins`。
- 字段保留 `token_hash/status/expires_at/verified_at/verified_by/verified_geom`。
- 历史 `order_checkins` 作为旧到场核验审计表保留或迁移后归档。

本次实现优先采用短期方案，减少核心流程变更时的数据库风险。

## 风险与防护

### 重复收益分配

风险：同一二维码重复提交或网络重试，可能多次调用收益处理。

防护：

- 订单完成更新必须使用 `WHERE status = 'paid'`。
- 二维码状态更新必须只允许 `pending -> verified`。
- 收益处理入口继续检查订单状态和已有收益流水，保持幂等。

### 历史订单语义变化

风险：历史 `in_progress` 迁为 `paid` 后，前端会展示为“待服务/待完成确认”。

决策：

- 接受该语义变化。旧 `in_progress` 本质是“已到场但未完成”，新流程中最接近 `paid`。
- 保留 `service_started_at` 供历史审计。

### 接口兼容

风险：移动端未同时发版时，旧扫码接口语义改变。

防护：

- 旧接口短期保留，但语义变为完成确认。
- 返回 message 使用新文案。
- 若旧服务人员端扫码旧二维码，成功后直接完成订单；这是符合新业务规则的结果。

## 验收标准

后端：

- `OrderStatusEnum` 和 DB enum 不再包含 `in_progress`。
- `paid` 订单扫码完成确认后直接变为 `completed`。
- `pending_acceptance`、`cancelled`、`completed` 订单不能生成完成确认二维码。
- 非分配服务人员扫码失败。
- 过期二维码扫码失败。
- 重复扫码不会重复完成、重复计数、重复分账。
- 历史 `in_progress` 数据迁移为 `paid`。

用户端：

- 订单详情 `paid` 状态展示完成确认二维码。
- 不再出现“服务中”“到场核验”“待验收”。
- 不再提供用户手动确认完成主入口。

服务人员端：

- 不再出现“服务中”tab/分组。
- 扫码页表达“确认完成”。
- 扫码成功后订单进入已完成。

管理端：

- 筛选、表格、详情、手动改状态不再出现 `in_progress`。
- `pending_acceptance`、`staff_rejected` 有明确展示文案。

文档：

- `docs/order-status-flow.md` 更新为新流程。
- 相关页面结构文档中“扫码核验/服务中”描述同步更新。
