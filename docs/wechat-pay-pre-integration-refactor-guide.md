# 微信支付接入前重构指南

> 2026-03-24 更新：
> 本文档中的“大部分前置重构”已经完成。
> 当前它更适合作为“为什么之前要这么重构”的背景说明，而不是一份待办清单。
> 现在真正剩余的核心工作，已经收敛为：
> 1. `WechatRefundProvider`
> 2. `WechatPayoutProvider`
> 3. worker 端微信提现确认收款原生能力

## 1. 文档目的

本文档不是讲“怎么直接接微信支付 API”，而是基于当前仓库实现与 [wechat-pay-app-integration-plan.md](./wechat-pay-app-integration-plan.md) 的目标方案，整理出一份更适合当前代码库的“接入前改造指南”。

目标只有一个：

- 在不马上接入微信支付、微信退款、微信提现的前提下，先把现有支付域从“支付宝特例实现”重构成“可接多渠道”的结构；
- 让后续接微信时主要是补 provider 与 SDK 封装，而不是再次推翻支付、提现、绑定、状态机。

## 2. 先给结论

当前仓库真正还没做完的，已经不再是“前置重构四件套”，而是下面三件事：

1. 补齐微信退款 provider，而不是继续只靠支付宝退款。
2. 补齐微信提现 provider，而不是停留在“绑定身份已存在，但打款链路未接”的状态。
3. 补 worker 端微信提现确认收款的原生能力，因为当前 `expo-wechat` 只覆盖支付与授权，不覆盖 `requestMerchantTransfer`。

以下事项已经完成，不再属于“接入前必须先做”的阻塞项：

- `pay` 模块已按 `payment / refund / payout` provider 化；
- 支付状态查询、回调、定时扫描已改成渠道感知；
- 提现状态机与 `withdrawals` 渠道字段已扩展；
- 服务人员端微信绑定已经改成真实微信授权闭环；
- 用户端微信支付已可真实拉起，不再是“假入口”。

## 3. 当前代码与目标方案的核心差距

### 3.1 支付主链路不再是“支付宝特化实现”

当前 [pay.service.ts](../apps/backend/src/modules/pay/pay.service.ts) 中：

- `pay()` 已支持 `alipay | wechat_pay`；
- 下单已通过 `PaymentDispatcher` 分发；
- `payNotify()` 已被统一入口 `handlePaymentNotify(channel, payload)` 取代；
- `queryPaymentStatus()` 已返回统一的 `payType + paymentStatus + channelStatus`；
- `scanAndQueryPendingPayments()` 已按 `paymentMethod` 查询不同渠道。

并且当前工作区里已经有：

- [wechat-payment.provider.ts](../apps/backend/src/modules/pay/providers/wechat-payment.provider.ts)
- [wechatPay.client.ts](../apps/backend/src/lib/wechatPay/wechatPay.client.ts)
- [wechatPay.crypto.ts](../apps/backend/src/lib/wechatPay/wechatPay.crypto.ts)

所以当前支付主链路已经完成第一阶段微信支付接入，不再只是“支付宝支付服务”。

### 3.2 退款已经开始抽象，但只抽了一半

当前 [refund.interface.ts](../apps/backend/src/modules/pay/refund/refund.interface.ts)、[refund.dispatcher.ts](../apps/backend/src/modules/pay/refund/refund.dispatcher.ts) 已经有 provider 分发器，但：

- 目录结构仍然只有 `refund/` 一支；
- `PayModule` 只注册了 [alipay-refund.provider.ts](../apps/backend/src/modules/pay/refund/alipay-refund.provider.ts)；
- 支付与提现链路没有采用同样的 provider 模式。

也就是说，退款已经证明“provider 抽象是可行的”，但支付与提现还没有跟上。

### 3.3 提现模型与微信提现天然不兼容

当前 [admin-withdrawals.service.ts](../apps/backend/src/modules/pay/admin-withdrawals.service.ts) 的审核通过逻辑是：

1. 校验提现方式必须是 `alipay`；
2. 立即调用支付宝打款；
3. 立即扣减冻结余额；
4. 立即把提现状态写成 `completed`。

而微信提现不是同步终态，至少会出现：

- `WAIT_USER_CONFIRM`
- `PROCESSING`
- `TRANSFERING`
- `SUCCESS`
- `FAIL`
- `CANCELLED`

所以当前实现的问题不是“暂不支持微信”，而是“当前状态机无法容纳微信”。

### 3.4 收款绑定模型不再只有支付宝闭环

当前 [user-profiles.ts](../apps/backend/src/common/database/schema/user-profiles.ts) 已有：

- `alipayUserId`
- `alipayOpenId`
- `wechatWorkerOpenId`
- `wechatWorkerUnionId`
- `wechatWorkerAppId`
- `wechatWorkerBoundAt`

当前 [pay.service.ts](../apps/backend/src/modules/pay/pay.service.ts) 也已经能：

- 按 `wechat_pay` 读取 `wechatWorkerOpenId / wechatWorkerAppId`；
- 通过 `/pay/worker/wechat/auth/exchange` 把 worker 微信授权结果落库。

但微信提现要求：

- 收款标识必须是 `openid`；
- `openid` 是 `appid` 维度；
- 当前业务里，微信提现场景明确属于 `mobile-worker`。

因此，哪怕你不马上做统一支付账户中心，也至少要把“worker 端微信收款身份”建模清楚。

### 3.5 前端两处错误心智已经被收敛

当前这两处已经处理：

- [paySheet.tsx](../apps/mobile-user/components/pay/paySheet.tsx) + [useOrderPayment.ts](../apps/mobile-user/hooks/useOrderPayment.ts) 已真实接入微信支付；
- [account-binding.tsx](../apps/mobile-worker/app/profile/account-binding.tsx) 已真实接入微信授权绑定，不再是手填假表单。

## 4. 接入前重构的总体原则

### 4.1 先重构域模型，再接 SDK

第一阶段不要急着引微信 OpenSDK、微信支付 v3 HTTP client，也不要先写回调验签。先把“接口、状态机、表结构、服务职责”改对。

### 4.2 先保留现有支付宝行为，再抽象出多渠道骨架

重构后的第一目标不是“马上支持微信”，而是：

- 支付仍能正常支付宝下单；
- 退款仍能正常支付宝退款；
- 提现仍能正常支付宝审核打款；
- 但代码结构已经允许后续无痛插入微信分支。

### 4.3 剩余未完成能力不要提前暴露

截至当前工作区：

- 用户端微信支付已经可以暴露；
- 服务人员端微信绑定已经可以暴露；
- 但 **微信提现申请、微信提现确认收款** 仍不应提前暴露成“已可用”。

## 5. 推荐的接入前改造方案

### 5.1 第一步：统一支付域目录与 provider 抽象

建议把当前 `pay` 模块改成三类 provider：

- `payment provider`
- `refund provider`
- `payout provider`

建议结构：

```txt
apps/backend/src/modules/pay/
├── providers/
│   ├── payment-provider.interface.ts
│   ├── refund-provider.interface.ts
│   ├── payout-provider.interface.ts
│   ├── alipay-payment.provider.ts
│   ├── alipay-refund.provider.ts
│   ├── alipay-payout.provider.ts
│   ├── wechat-payment.provider.ts
│   ├── wechat-refund.provider.ts
│   └── wechat-payout.provider.ts
├── pay.service.ts
├── pay.repository.ts
└── ...
```

本阶段只要求：

- 先把现有支付宝支付代码从 `PayService.pay()` 中抽到 `AlipayPaymentProvider`；
- 先把 `AdminWithdrawalsService` 里的支付宝打款代码抽到 `AlipayPayoutProvider`；
- 现有 `refund/` 目录可以迁入 `providers/`，也可以先保留，但接口命名要统一。

### 本步完成标准

- `PayService` 不再直接调用支付宝 SDK 下单；
- `AdminWithdrawalsService` 不再直接持有支付宝打款实现；
- `PayModule` 通过 provider 注册表分发渠道能力；
- 即便还没有任何微信代码，也已经形成 `alipay` 的 payment/refund/payout 三类 provider。

### 5.2 第二步：收敛 `PayService` 的职责

重构后的 `PayService` 只保留编排职责：

- 校验订单、金额、用户角色；
- 创建或复用本地 `payments`、`withdrawals` 记录；
- 根据渠道选择 provider；
- 调用统一的幂等更新逻辑；
- 推动订单状态、余额冻结/释放、财务流水、通知。

不应该继续放在 `PayService` 里的内容：

- 支付宝下单参数拼装；
- 支付宝回调签名校验；
- 支付宝查单实现；
- 支付宝授权串构造；
- 支付宝提现打款请求细节。

其中支付宝授权绑定可以暂时保留在 `PayService`，但建议中期迁到专门的 `pay-account.service.ts` 或 `worker-payout-account.service.ts`。

### 5.3 第三步：统一支付状态返回结构

当前 [packages/types/src/pay.ts](../packages/types/src/pay.ts) 中：

- `InitiatePaymentResponseSchema` 仍然是支付宝 `orderString` 结构；
- `QueryPaymentStatusResponseSchema` 仍然依赖 `tradeStatus`；
- `UserWithdrawResponseSchema` 仍然带 `alipayOrderId` 这种渠道专属字段。

建议先做“通用结构改造”，即便此时只有支付宝实现：

```ts
type InitiatePaymentResponse =
    | {
          payType: 'alipay';
          paymentId: string;
          outTradeNo: string;
          amount: number;
          currency: string;
          orderString: string;
      }
    | {
          payType: 'wechat_pay';
          paymentId: string;
          outTradeNo: string;
          amount: number;
          currency: string;
          wechatPayRequest: {
              appId: string;
              partnerId: string;
              prepayId: string;
              packageValue: string;
              nonceStr: string;
              timeStamp: string;
              sign: string;
          };
      };
```

支付状态建议改成：

```ts
{
    orderId: string;
    orderSerial: string;
    payType: 'alipay' | 'wechat_pay';
    paymentStatus: 'pending' | 'succeeded' | 'failed' | 'refunded';
    channelStatus: string;
    amount?: string;
    transactionId?: string;
    message: string;
}
```

这样做的意义是：

- 当前支付宝仍可把 `channelStatus` 填成 `WAIT_BUYER_PAY / TRADE_SUCCESS`；
- 后续微信可把 `channelStatus` 填成 `NOTPAY / SUCCESS / USERPAYING`；
- 前端不必再依赖“支付宝专属字段名”。

### 本步建议同步修改

- [pay.controller.ts](../apps/backend/src/modules/pay/pay.controller.ts)
- [packages/types/src/pay.ts](../packages/types/src/pay.ts)
- [packages/hooks/src/api/pay/index.ts](../packages/hooks/src/api/pay/index.ts)
- [apps/mobile-user/hooks/useOrderPayment.ts](../apps/mobile-user/hooks/useOrderPayment.ts)

### 5.4 第四步：把“支付查询/回调/扫描”改成渠道感知

当前问题：

- `payNotify()` 只处理支付宝；
- `queryPaymentStatus()` 只查支付宝；
- `scanAndQueryPendingPayments()` 只扫支付宝；
- `updatePaymentStatusIdempotent()` 的参数就是支付宝 `tradeStatus`。

建议拆成：

- `handlePaymentNotify(channel, payload)`
- `queryPaymentStatus(orderId, userId)` 内部按最近一次支付记录的 `paymentMethod` 选择 provider
- `scanAndQueryPendingPayments()` 按 `paymentMethod` 分组扫描
- `updatePaymentStatusIdempotent()` 改为接受统一输入：

```ts
{
    orderId: string;
    channel: 'alipay' | 'wechat_pay';
    providerStatus: string;
    transactionId?: string;
    paidAt?: Date;
}
```

这一步是微信支付正式接入前最重要的服务端重构之一，因为它决定了后面是否还要在核心流程里继续写死支付宝。

### 5.5 第五步：重做提现状态机

当前 [withdrawals](../apps/backend/src/common/database/schema/financial.ts) 的状态只有：

- `pending`
- `approved`
- `rejected`
- `completed`

建议至少扩展为：

- `pending`
- `approved`
- `processing`
- `completed`
- `failed`
- `cancelled`
- `rejected`

原因：

- `approved` 表示人工审核通过，不等于渠道打款完成；
- `processing` 表示渠道已受理但还未终态；
- `failed` 表示渠道打款失败；
- `cancelled` 表示渠道撤销或系统取消；
- `rejected` 只表示人工拒绝。

如果你想进一步避免“审核状态”和“打款状态”混在一个字段里，可以中期拆成两列：

- `reviewStatus`
- `payoutStatus`

但从当前仓库改造成本看，先扩充 `withdrawal_status` 就够用了。

### 5.6 第六步：扩展 `withdrawals` 表的渠道字段

当前 `withdrawals` 只能表达支付宝同步打款结果，建议先补以下字段：

- `provider_state`
- `provider_app_id`
- `provider_bill_no`
- `provider_package_info`
- `provider_meta`

建议用途：

- `provider_state`：保存微信 `WAIT_USER_CONFIRM / SUCCESS / FAIL` 等原始状态；
- `provider_app_id`：明确这笔提现是基于哪个 appid 的收款身份；
- `provider_bill_no`：保存微信转账单号或支付宝渠道单号；
- `provider_package_info`：保存微信提现确认收款所需 `package_info`；
- `provider_meta`：保存场景 ID、失败码、原始扩展响应等。

这一步不是“为了微信提现才加字段”，而是为了把提现记录从“平台审核记录”升级为“渠道打款工单”。

### 5.7 第七步：先明确微信收款绑定模型，再做真实绑定

结合当前业务，推荐分两档：

### 方案 A：MVP 继续放在 `user_profiles`

适用前提：

- 近期只有 `mobile-worker` 需要微信提现；
- 只会绑定一个 worker appid；
- 不急着做用户端微信账户复用。

建议新增字段：

- `wechatWorkerOpenId`
- `wechatWorkerUnionId`
- `wechatWorkerAppId`
- `wechatWorkerBoundAt`

这是最小改动方案。

### 方案 B：直接引入绑定表

适用前提：

- 未来 `mobile-user` 与 `mobile-worker` 可能使用不同 AppID；
- 未来还会有返现、补偿、赔付等微信出款场景；
- 你希望把支付宝/微信绑定统一管理。

建议新增 `pay_account_bindings`：

```txt
id
user_id
provider
app_id
account_type
account_id
union_id
real_name
is_default
created_at
updated_at
```

### 当前仓库的推荐选择

对你现在的业务，我建议：

- 本次文档先按方案 A 落地；
- 字段名必须带 `worker` 和 `appId` 语义，不能只加一个模糊的 `wechatOpenId`；
- 等微信提现跑通后，再判断是否升级为 `pay_account_bindings`。

### 5.8 第八步：把服务人员提现申请改成“按渠道选择绑定身份”

当前 [pay.service.ts](../apps/backend/src/modules/pay/pay.service.ts) 的 `withdraw()`：

- 只接受 `payType='alipay'`；
- 只从 `user_profiles.alipayUserId/alipayOpenId` 取收款方；
- 创建 `withdrawals` 时直接写死支付宝语义。

建议改成：

1. 用户仍然提交 `amount / currency / payType / remark`；
2. 服务端根据 `payType` 查找对应绑定身份；
3. 若 `alipay`：
   - 读取 `alipayUserId / alipayOpenId`
4. 若 `wechat_pay`：
   - 读取 `wechatWorkerOpenId / wechatWorkerAppId`
5. 冻结余额并创建 `withdrawals`；
6. 返回统一响应，不再出现支付宝专属字段名。

注意：

- 这一阶段可以先把后端模型与类型准备好，但前端不一定马上开放 `wechat_pay`；
- 是否对用户开放微信提现按钮，要等后台审核流和 worker 端确认收款能力准备好之后再放开。

### 5.9 第九步：把后台审核流改成“审核”和“打款终态”分离

当前 [admin-withdrawals.service.ts](../apps/backend/src/modules/pay/admin-withdrawals.service.ts) 的 `approveAndPayout()` 需要改成下面的职责：

1. 读取提现记录；
2. 校验是否允许审核；
3. 调用 `PayoutProvider`；
4. 根据 provider 返回结果更新审核信息与渠道中间态；
5. 仅在真正终态成功时扣减冻结余额并写资金流水；
6. 渠道失败或撤销时释放冻结余额。

对于不同渠道：

- 支付宝 `PayoutProvider`
  - 仍可同步走到 `completed`
- 微信 `PayoutProvider`
  - 可能只推进到 `approved` 或 `processing`
  - 后续由回调/查单推进到 `completed / failed / cancelled`

这是接入微信商家转账前必须完成的服务端重构。

### 5.10 第十步：先修正前端错误暴露，再谈微信接入

### 用户端支付入口

在正式接微信支付前，建议先做其一：

- 暂时隐藏“微信支付”选项；
- 或展示但禁用，并明确标注“即将支持”。

不要继续保持当前状态：

- UI 可以选微信；
- 实际提交永远是支付宝；
- 失败提示再告诉用户“仅支持支付宝”。

### 服务人员端微信绑定入口

在正式接微信提现前，建议先做其一：

- 下线当前手填式微信绑定表单；
- 或保留入口但改成只读占位页，明确“待接入微信授权绑定”。

不要继续保留“手填微信账号/姓名”的假绑定实现，因为真实微信提现根本不认这种数据。

## 6. 推荐实施顺序

建议按下面顺序理解当前阶段，每一步都可以独立提交：

#### 阶段 0：先收敛错误入口

- 已完成。

#### 阶段 1：重构支付域结构，但不改外部行为

- 引入 `payment/refund/payout` provider 抽象；
- 把支付宝实现迁入 provider；
- `PayService` 改成编排层；
- 支付、退款、提现行为保持现状。

当前状态：已完成。

#### 阶段 2：统一类型与接口语义

- 改 `InitiatePaymentResponseSchema`；
- 改 `QueryPaymentStatusResponseSchema`；
- 改 `UserWithdrawResponseSchema`；
- hooks 和移动端同步适配通用字段名。

当前状态：已完成。

#### 阶段 3：重构提现数据模型

- 扩展 `withdrawal_status`；
- 给 `withdrawals` 增加 provider 相关字段；
- 给 `user_profiles` 增加 worker 微信字段，或新建绑定表；
- 仓储和管理端列表一起适配。

当前状态：已完成 MVP 方案（`user_profiles` worker 字段）。

#### 阶段 4：重构后台审核与结算流程

- 审核通过不再默认等于完成；
- `PayoutProvider` 接管打款；
- 冻结余额只在终态时扣减或释放。

当前状态：支付宝分支已完成，微信提现分支仍待接入。

#### 阶段 5：再开始真正接微信

- 接微信支付 provider；
- 接微信退款 provider；
- 接微信提现 provider；
- 接 worker 端微信授权绑定；
- 接 worker 端确认收款。

当前状态：

- `WechatPaymentProvider` 已完成；
- worker 端微信授权绑定已完成；
- `WechatRefundProvider` 未完成；
- `WechatPayoutProvider` 未完成；
- worker 端确认收款未完成。

## 7. 这次重构建议涉及的文件

### 服务端核心

- [apps/backend/src/modules/pay/pay.service.ts](../apps/backend/src/modules/pay/pay.service.ts)
- [apps/backend/src/modules/pay/pay.controller.ts](../apps/backend/src/modules/pay/pay.controller.ts)
- [apps/backend/src/modules/pay/pay.module.ts](../apps/backend/src/modules/pay/pay.module.ts)
- [apps/backend/src/modules/pay/pay.repository.ts](../apps/backend/src/modules/pay/pay.repository.ts)
- [apps/backend/src/modules/pay/admin-withdrawals.service.ts](../apps/backend/src/modules/pay/admin-withdrawals.service.ts)
- [apps/backend/src/modules/pay/admin-withdrawals.repository.ts](../apps/backend/src/modules/pay/admin-withdrawals.repository.ts)

### 数据库与类型

- [apps/backend/src/common/database/schema/enums.ts](../apps/backend/src/common/database/schema/enums.ts)
- [apps/backend/src/common/database/schema/financial.ts](../apps/backend/src/common/database/schema/financial.ts)
- [apps/backend/src/common/database/schema/user-profiles.ts](../apps/backend/src/common/database/schema/user-profiles.ts)
- [packages/types/src/pay.ts](../packages/types/src/pay.ts)
- [packages/types/src/database-entity.ts](../packages/types/src/database-entity.ts)
- [packages/types/src/admin.ts](../packages/types/src/admin.ts)

### 前端

- [packages/hooks/src/api/pay/index.ts](../packages/hooks/src/api/pay/index.ts)
- [packages/lib/src/pay.ts](../packages/lib/src/pay.ts)
- [apps/mobile-user/components/pay/paySheet.tsx](../apps/mobile-user/components/pay/paySheet.tsx)
- [apps/mobile-user/hooks/useOrderPayment.ts](../apps/mobile-user/hooks/useOrderPayment.ts)
- [apps/mobile-worker/app/profile/account-binding.tsx](../apps/mobile-worker/app/profile/account-binding.tsx)
- [apps/mobile-worker/app/earnings/withdraw.tsx](../apps/mobile-worker/app/earnings/withdraw.tsx)

## 8. 本文档对应的验收标准

当下面条件成立时，可以认为“已经完成微信接入前重构”：

1. 支付、退款、提现三条链路都已有 provider 抽象，支付宝实现已迁入 provider。
2. `PayService` 不再直接持有支付宝下单、查单、打款细节。
3. `QueryPaymentStatusResponse` 已使用 `payType + channelStatus`，不再依赖支付宝专属 `tradeStatus` 命名。
4. `withdrawals` 可以表达中间态与渠道原始状态，不再默认“审核通过即完成”。
5. 服务人员端已有真实可落库的微信收款身份模型，至少能区分 `worker appid`。
6. 用户端不会再暴露“可选但不可用”的微信支付。
7. 服务人员端不会再暴露“手填微信号即可绑定”的伪流程。

截至 **2026-03-24**：

- 上述 1~7 项已全部满足；
- 因此“微信接入前重构”本身可以视为完成。

## 9. 当前真正不建议跳过的事

现在不建议直接跳过、强行推进的，是下面两件事：

- 在没有 `WechatRefundProvider` 的情况下，把微信支付订单直接纳入“可退款”承诺；
- 在没有 `requestMerchantTransfer` 原生能力的情况下，把微信提现按钮直接开放给服务人员。

原因不是结构还没重构好，而是剩余渠道能力本身还没补完。

## 10. 最后建议

如果你希望“少返工、可持续演进”，当前接下来的开发顺序建议固定为：

1. 先补 `WechatRefundProvider`；
2. 再补 `WechatPayoutProvider` 与转账查单/回调；
3. 再补 worker 端 `requestMerchantTransfer` 原生能力；
4. 最后才开放微信提现申请与确认收款。

这条路径比“直接把微信提现按钮打开，再边用边补洞”要稳得多，也更符合你当前仓库的实际状态。
