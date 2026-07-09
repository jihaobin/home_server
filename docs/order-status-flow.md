# 订单状态流转说明

> 本文档记录当前代码中的订单状态机、主要业务入口和容易混淆的状态语义，用于产品、后端、管理端和移动端对齐。

## 一、状态总览

订单主状态来自 `order_status` 枚举：

| 状态 | 展示语义 | 当前实际含义 |
| --- | --- | --- |
| `pending_payment` | 待支付 | 订单已创建，等待客户完成支付 |
| `payment_timeout` | 支付超时 | 待支付订单超过 `payment_expires_at`，系统关闭支付单并释放订单 |
| `pending_acceptance` | 待接单 | 支付成功，等待服务人员确认接单 |
| `paid` | 待服务/待完成确认 | 服务人员已接单；服务完成前后都停留在该状态，直到扫码确认完成 |
| `completed` | 已完成 | 服务人员扫码完成确认成功，订单结束并触发收益处理 |
| `cancelled` | 已取消 | 用户、服务人员或退款流程导致订单取消 |
| `refunded` | 已退款 | 已完成订单发生全额退款后的终态 |
| `staff_rejected` | 服务人员拒单 | 枚举保留；当前后端未找到完整写入流程 |

关联状态：

| 类型 | 字段 | 取值 | 说明 |
| --- | --- | --- | --- |
| 支付状态 | `payments.status` | `pending` / `succeeded` / `failed` / `refunded` | 支付记录状态，不等同于订单主状态 |
| 分配决策 | `order_assignments.decision_status` | `pending` / `accepted` / `rejected` | 服务人员接单决策 |
| 完成确认 | `order_checkins.status` | `pending` / `verified` / `revoked` / `expired` | 兼容沿用旧表名，语义为完成确认二维码 |

## 二、主流程

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

## 三、合法状态转换

仓库层维护了状态转换白名单：

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

代码位置：`apps/backend/src/modules/order/order.reposityro.ts` 的 `validStatusTransitions`。

## 四、关键入口

- 创建订单：`POST /api/order/createWithDesignatedPersonnel`
- 服务人员接单：`POST /api/order/:id/accept`
- 生成完成确认二维码：`GET /api/order/:id/completion-confirmation`
- 扫码确认完成：`POST /api/order/completion-confirmation/verify`
- 兼容旧二维码接口：`GET /api/order/:id/check-in` / `POST /api/order/check-in/verify`，Swagger 标记 deprecated，语义仍为完成确认。

完成确认约束：

- 只有订单客户可以生成二维码。
- 订单状态必须是 `paid`。
- 服务人员必须是订单分配的服务人员。
- 二维码必须存在、未使用、未撤销、未过期。
- 成功后订单从 `paid` 原子更新为 `completed`，写入 `service_completed_at`，服务人员技能维度 `serviced_count + 1`，并调用 `PayService.handleOrderCompletion`。

## 五、注意事项

- `in_progress` 已从主状态删除。历史 `in_progress` 订单通过迁移统一改为 `paid`。
- `orders.service_started_at` 字段保留历史数据，新流程不再写入。
- 管理端不提供手动切到 `completed` 的入口，避免绕过收益分配、服务次数递增和提醒清理。
- `staff_rejected` 仍为保留枚举，当前后端未找到完整拒单写入流程。

## 六、关键代码索引

| 模块 | 文件 | 说明 |
| --- | --- | --- |
| 订单枚举 | `apps/backend/src/common/database/schema/enums.ts` | `order_status`、`payment_status`、`assignment_decision_status` |
| 订单表 | `apps/backend/src/common/database/schema/orders.ts` | 订单、分配、支付记录表结构 |
| 状态机 | `apps/backend/src/modules/order/order.reposityro.ts` | `validStatusTransitions`、取消、接单、完成 |
| 订单服务 | `apps/backend/src/modules/order/order.service.ts` | 创建、取消、接单、完成副作用、提醒调度 |
| 支付服务 | `apps/backend/src/modules/pay/pay.service.ts` | 支付成功、退款、订单状态联动 |
| 完成确认 | `apps/backend/src/modules/order/order-checkin.service.ts` | 二维码确认后 `paid -> completed` |
| 支付超时 | `apps/backend/src/modules/order/workers/order-expire-consumer.service.ts` | 超时消费后 `pending_payment -> payment_timeout` |
| 用户端订单列表 | `apps/mobile-user/app/(tabs)/orders/index.tsx` | 用户端状态文案和动作 |
| 服务人员订单详情 | `apps/mobile-worker/app/orders/[id].tsx` | 服务人员端接单、取消、改期、扫码确认完成入口 |
| 管理端订单详情 | `apps/admin-web/src/app/(management)/orders/_components/order-detail-drawer.tsx` | 后台手动改状态入口 |
