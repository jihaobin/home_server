# 微信支付、退款与商家转账接入方案

> 2026-03-31 同步说明：
> 当前仓库已经完成微信三条主链路的首版落地，包含：
>
> 1. 微信 App 支付：后端 v3 下单/查单/回调验签、`WechatPaymentProvider` 注册、关单，以及 `mobile-user` 端基于 `expo-wechat` 的真实拉起与回跳确认；
> 2. 微信退款：`WechatRefundProvider`、退款申请、退款查单、退款回调与退款结算；
> 3. 微信商家转账：`WechatPayoutProvider`、worker 微信绑定闭环、微信提现查单/回调/撤销、后台审核异步终态，以及 `mobile-worker` 端基于 `requestMerchantTransfer` 的自动确认收款。
>
> 截至 2026-03-31，真正仍需继续补的重点已经收敛为：
>
> 1. 支付/退款/转账三条链路更系统的集成测试、真机回归与异常场景验证；
> 2. `packages/types` 中微信商家转账底层 query/notify/request schema 与少量文档细节补齐；
> 3. 更完整的统一对账、审计与运营补偿能力。

## 1. 结论

如果本仓库要把微信能力补齐，不应只做“App 支付”，而要按三条链路一起设计：

1. 微信 App 支付：用户下单付款；
2. 微信退款：支付成功后的原路退款；
3. 微信商家转账：服务人员提现到微信零钱。

这三条链路都可以接，但难度和前置条件并不一样：

| 能力               | 是否可做         | 关键前置条件                                                            | 与当前仓库的主要差异                                                                                 |
| ------------------ | ---------------- | ----------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------- |
| 微信 App 支付      | 已完成首版               | 商户号绑定移动应用 AppID，后端接 v3 签名与回调                          | 已落地 payment provider、v3 client、移动端拉起与支付回跳、关单与定时补偿；剩余缺口主要是异常验证与测试完善 |
| 微信退款           | 已完成首版               | 已有微信支付成功订单，补退款 provider、回调与查单                       | 已落地微信 refund provider、退款申请、查单、回调与结算；剩余缺口主要是后台可视化、退款实体建模与测试      |
| 微信商家转账到零钱 | 已完成首版（Android 闭环） | 必须有商家转账权限、用户 `openid`、用户确认收款、场景报备、运营账户资金 | 已落地 worker 微信绑定、商家转账 provider、查单/回调/撤销与自动确认收款；剩余缺口主要是端到端验证、对账与 iOS 能力确认 |

最重要的结论有五个：

- 微信支付、退款与商家转账三类 provider 已经都能接入现有 `pay` 模块；
- 微信提现不是“打到微信号”，而是 **商家转账到零钱**，必须依赖 `openid`；
- 结合当前业务前提，微信提现只服务于“服务人员提现平台收益”，因此微信绑定应围绕 `mobile-worker` 端展开，而不是泛化成全站统一微信账户；
- `openid` 是 **appid 维度** 的，所以即便现在微信提现只发生在 `mobile-worker`，也至少要明确“这是 worker appid 对应的 openid”，不能与用户端支付场景混用；
- 微信商家转账成功后 **不支持退回**，只能在用户确认收款前撤销，因此提现状态机必须继续围绕“冻结余额 + 异步终态”维护。

## 2. 这次调研确认的官方规则

以下结论均来自官方文档：

### 2.1 微信 App 支付

- 官方开发指引更新时间：**2026-01-16**
- 支付下单接口：`POST /v3/pay/transactions/app`
- 商户后端先下单拿 `prepay_id`，再由 App 用 OpenSDK 拉起支付；
- 客户端回到 App 后，仍要调用后端查单，不能只信任前端回调；
- 后端同时接收支付成功回调，回调和查单共同保证最终一致性；
- 超时未支付时，商户可调用关单接口关闭订单。

### 2.2 微信退款

- 微信退款产品介绍更新时间：**2025-06-27**
- 退款申请接口：`POST /v3/refund/domestic/refunds`
- 查询退款接口：`GET /v3/refund/domestic/refunds/{out_refund_no}`
- 退款结果通知支持：
  - `REFUND.SUCCESS`
  - `REFUND.ABNORMAL`
  - `REFUND.CLOSED`
- 订单支付成功后 **1 年内** 可退款；
- 支持全额或部分退款，**最多 50 次部分退款**；
- 退款是原路退回，不是“退到商户自定义账户”。

### 2.3 微信商家转账到零钱

- 产品介绍更新时间：**2026-01-28**
- 开发指引更新时间：**2026-02-02**
- 发起转账接口：`POST /v3/fund-app/mch-transfer/transfer-bills`
- 查询转账单接口：`GET /v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_bill_no}`
- 撤销转账接口：`POST /v3/fund-app/mch-transfer/transfer-bills/out-bill-no/{out_bill_no}/cancel`
- 回调通知类型：`MCHTRANSFER.BILL.FINISHED`

官方约束非常关键：

- 当前产品只支持 **转到用户微信零钱**；
- 转账成功资金 **不支持退回**；
- 商户必须在用户侧拉起 **微信官方确认收款页面**；
- 收款对象必须是该 `appid` 下的 **`openid`**；
- 发起转账时必须带 **转账场景 ID** 和 **场景报备信息**；
- 金额单位是分；
- 单笔转账金额 `>= 2000 元` 时，**必须传收款人姓名并加密**；
- 转账前必须配置 **接口安全 IP**；
- 商家转账依赖运营账户资金，余额不足时会停在 `PROCESSING` / 返回资金不足类错误；
- 用户 24 小时内未确认收款，系统会自动关单并退款给商户，但是否真的关闭仍要查单确认；
- App 侧调起用户确认收款，不是 `PayReq`，而是 `WXOpenBusinessView`，业务类型固定 `requestMerchantTransfer`。

这意味着微信提现在产品形态上更接近“带用户确认步骤的提现工单”，而不是“后台直接打款成功”。

## 3. 当前仓库现状与差距

### 3.1 已有基础

- [enums.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/enums.ts)
  - `payment_method` 已包含 `wechat_pay`。
- [orders.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/orders.ts)
  - `payments` 表已支持多支付方式；
  - `orderSerial` 当前格式 `ORD + YYYYMMDD + 8位随机串`，长度 19，满足微信 `out_trade_no` 6 到 32 位限制。
- [pay.repository.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.repository.ts)
  - 已有支付记录、余额、提现记录的仓储能力。
- [paySheet.tsx](/mnt/f/home_server/apps/mobile-user/components/pay/paySheet.tsx)
  - 已默认展示并优先选择微信支付，真实接入微信支付拉起流程。
- [payment-provider.interface.ts](/mnt/f/home_server/apps/backend/src/modules/pay/providers/payment-provider.interface.ts)
  - 已抽出支付 provider 接口与统一分发器。
- [refund-provider.interface.ts](/mnt/f/home_server/apps/backend/src/modules/pay/providers/refund-provider.interface.ts)
  - 已抽出退款 provider 接口与统一分发器。
- [payout-provider.interface.ts](/mnt/f/home_server/apps/backend/src/modules/pay/providers/payout-provider.interface.ts)
  - 已抽出打款 provider 接口与统一分发器。
- [pay.ts](/mnt/f/home_server/packages/types/src/pay.ts)
  - 支付、查单、提现请求已经放开 `wechat_pay`，并预留微信支付拉起参数结构。
- [pay.module.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.module.ts)
  - 已注册 `WechatPaymentProvider`，支付分发器已真正接入微信支付。
- [wechat-payment.provider.ts](/mnt/f/home_server/apps/backend/src/modules/pay/providers/wechat-payment.provider.ts)
  - 已实现微信 App 下单、查单、支付回调解析与状态映射。
- [wechatPay.client.ts](/mnt/f/home_server/apps/backend/src/lib/wechatPay/wechatPay.client.ts)
  - 已实现 v3 请求签名、响应验签、支付回调验签解密、App 拉起参数组装与按商户单号查单。
- [packages/lib/src/pay.ts](/mnt/f/home_server/packages/lib/src/pay.ts)
  - 已封装 `ensureWeChatAppRegistered()`、`isWeChatAppInstalled()`、`wechatPay()`。
- [app.config.js](/mnt/f/home_server/apps/mobile-user/app.config.js)
  - 已接入 `expo-wechat` plugin、微信 scheme、Universal Link 对应的 Associated Domains 与 Android Proguard 规则。
- [useOrderPayment.ts](/mnt/f/home_server/apps/mobile-user/hooks/useOrderPayment.ts)
  - 已处理微信支付发起、回跳前 pending session 持久化、失败兜底与返回 App 后的查单确认。
- [wechat-payment-return.tsx](/mnt/f/home_server/apps/mobile-user/app/servicePersonnel/wechat-payment-return.tsx)
  - 已在回到 App 后消费微信回调快照并主动查单，统一跳转支付结果页或订单列表。
- [user-profiles.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/user-profiles.ts)
  - 已增加 `wechatWorkerOpenId / wechatWorkerUnionId / wechatWorkerAppId / wechatWorkerBoundAt`。
- [financial.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/financial.ts)
  - 提现记录已增加 `providerState / providerAppId / providerBillNo / providerPackageInfo / providerMeta`，并扩展 `processing / failed / cancelled` 状态。

### 3.2 当前剩余工作

- [pay.service.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.service.ts)
  - `pay()`、支付回调、查单、关单、退款、提现、微信提现结果上报/查单都已经按渠道接入；
  - 当前主要剩余的是更系统的异常补偿验证与端到端测试。
- [pay.ts](/mnt/f/home_server/packages/types/src/pay.ts)
  - 基础类型已兼容微信支付、微信退款、worker 绑定与微信提现结果同步；
  - 当前还缺部分微信商家转账底层 schema 的继续补齐。
- [packages/lib/src/pay.ts](/mnt/f/home_server/packages/lib/src/pay.ts)
  - 已同时提供微信支付、微信授权与 `requestMerchantTransfer` 确认收款封装；
  - 当前主要剩余的是围绕 Expo/真机兼容性的回归验证。
- [admin-withdrawals.service.ts](/mnt/f/home_server/apps/backend/src/modules/pay/admin-withdrawals.service.ts)
  - 审核流、微信打款 provider 对接、WAIT_USER_CONFIRM 通知与异步终态回写都已完成；
  - 当前主要剩余的是对账、告警与更细的补偿治理。
- [user-profiles.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/user-profiles.ts)
  - 微信 worker 维度字段、绑定接口、绑定页面流程和数据写入闭环都已接入；
  - 当前更多是长期是否升级为独立绑定表的架构决策。
- [pay.module.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.module.ts)
  - 当前已注册 `AlipayPaymentProvider`、`WechatPaymentProvider`、`AlipayRefundProvider`、`WechatRefundProvider`、`AlipayPayoutProvider`、`WechatPayoutProvider`。
- [useOrderPayment.ts](/mnt/f/home_server/apps/mobile-user/hooks/useOrderPayment.ts)
  - 已完成微信支付拉起、前后台切回、结果对账；
  - 当前仍缺更完整的异常回流覆盖与端到端测试验证。
- [account-binding.tsx](/mnt/f/home_server/apps/mobile-worker/app/profile/account-binding.tsx)
  - 服务人员端已经接入微信提现绑定入口、授权回跳消费与解绑闭环；
  - 当前主要剩余的是体验打磨与真机回归验证。

### 3.3 一个关键数据问题

虽然仓库里已经有 [user-profiles.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/user-profiles.ts) 里的 worker 微信字段作为稳定落库结构，但截至 2026-03-31，正式的绑定闭环实际上已经补齐。

当前的实际问题是：

- 微信商家转账必须使用 `openid`；
- `openid` 是 **`appid` 维度** 的；
- 现阶段已经明确按“服务人员在 `mobile-worker` 下的微信提现收款身份”建模；
- [pay.controller.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.controller.ts) 已经补上 worker 微信绑定的专用接口，不再依赖 [wechat.controller.ts](/mnt/f/home_server/apps/backend/src/modules/auth/wechat/wechat.controller.ts) 这类内部 OAuth 转发入口；
- 因此短期的关键任务已经从“补齐 worker 端微信绑定的授权、换取和落库流程”转为“继续验证绑定/打款/确认收款的端到端稳定性”。

## 4. 推荐的总体架构

## 4.1 三类 provider 分开

建议不要把所有微信逻辑都塞进 `PayService`。最少拆成三类 provider：

- `payment provider`
  - 负责支付下单、查单、支付回调、关单；
- `refund provider`
  - 负责退款申请、退款查单、退款回调；
- `payout provider`
  - 负责提现打款、转账查单、转账回调、转账撤销。

当前目录已经基本按这个方向落地，后续微信 provider 可以沿用同一结构继续补齐：

- `apps/backend/src/modules/pay/providers/payment-provider.interface.ts`
- `apps/backend/src/modules/pay/providers/refund-provider.interface.ts`
- `apps/backend/src/modules/pay/providers/payout-provider.interface.ts`
- `apps/backend/src/modules/pay/providers/alipay-payment.provider.ts`
- `apps/backend/src/modules/pay/providers/wechat-payment.provider.ts`
- `apps/backend/src/modules/pay/providers/alipay-refund.provider.ts`
- `apps/backend/src/modules/pay/providers/wechat-refund.provider.ts`
- `apps/backend/src/modules/pay/providers/alipay-payout.provider.ts`
- `apps/backend/src/modules/pay/providers/wechat-payout.provider.ts`

如果你暂时不想整体迁目录，也可以先沿用当前 `refund/` 结构，但建议最终统一。

### 4.2 `PayService` 只保留编排职责

建议 `PayService` 只负责：

- 订单、金额、角色权限校验；
- 创建/复用本地 `payments`、`withdrawals` 记录；
- 调用对应 provider；
- 维护统一的幂等更新逻辑；
- 推动订单状态、余额冻结/释放、通知、审计。

### 4.3 微信底层能力统一封装

当前 `apps/backend/src/lib/wechatPay/` 目录已经落地支付主链路能力，后续继续在这里补齐退款与商家转账：

- `apps/backend/src/lib/wechatPay/wechatPay.client.ts`
- `apps/backend/src/lib/wechatPay/wechatPay.crypto.ts`
- `apps/backend/src/lib/wechatPay/wechatPay.types.ts`

共用能力包括：

- API v3 请求签名；
- 平台证书验签；
- 敏感字段公钥加密；
- AEAD_AES_256_GCM 解密；
- 支付、退款、转账接口调用；
- 支付/退款/转账三类回调的统一验签与解密。

## 5. 配置与环境变量建议

由于你这个仓库有用户端与服务人员端两套 App，建议微信配置从一开始就区分：

当前代码里已经实际读取并依赖的最小环境变量包括：

- 后端：
  - `WECHAT_PAY_MCH_ID`
  - `WECHAT_PAY_API_V3_KEY`
  - `WECHAT_PAY_MERCHANT_CERT_SERIAL_NO`
  - `WECHAT_PAY_PRIVATE_KEY_PATH`
  - `WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH` 或 `WECHAT_PAY_PLATFORM_CERT_PATH`
  - `WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID` 或 `WECHAT_PAY_PLATFORM_CERT_SERIAL_NO`
  - `WECHAT_PAY_BASE_URL`
  - `WECHAT_PAY_USER_APP_ID`
  - `WECHAT_PAY_USER_NOTIFY_URL`
  - `WECHAT_PAY_USER_REFUND_NOTIFY_URL`
  - `WECHAT_PAY_WORKER_APP_ID`
  - `WECHAT_PAY_WORKER_APP_SECRET`
  - `WECHAT_PAY_WORKER_TRANSFER_NOTIFY_URL`
  - `WECHAT_PAY_WORKER_TRANSFER_SCENE_ID`
- `mobile-user`：
  - `EXPO_PUBLIC_WECHAT_USER_APP_ID` 或 `EXPO_PUBLIC_WECHAT_APP_ID`
  - `EXPO_PUBLIC_WECHAT_USER_UNIVERSAL_LINK` 或 `EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK`
- `mobile-worker`：
  - `EXPO_PUBLIC_WECHAT_WORKER_APP_ID` 或 `EXPO_PUBLIC_WECHAT_APP_ID`
  - `EXPO_PUBLIC_WECHAT_WORKER_UNIVERSAL_LINK` 或 `EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK`

下面这组是当前实现已经用到或明确预留的完整目标配置：

```env
WECHAT_PAY_MCH_ID=
WECHAT_PAY_API_V3_KEY=
WECHAT_PAY_MERCHANT_CERT_SERIAL_NO=
WECHAT_PAY_PRIVATE_KEY_PATH=
WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH=
WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID=
WECHAT_PAY_PLATFORM_CERT_PATH=
WECHAT_PAY_BASE_URL=https://api.mch.weixin.qq.com

WECHAT_PAY_USER_APP_ID=
WECHAT_PAY_USER_NOTIFY_URL=
WECHAT_PAY_USER_REFUND_NOTIFY_URL=

WECHAT_PAY_WORKER_APP_ID=
WECHAT_PAY_WORKER_APP_SECRET=
WECHAT_PAY_WORKER_TRANSFER_NOTIFY_URL=
WECHAT_PAY_WORKER_TRANSFER_SCENE_ID=

WECHAT_PAY_TRANSFER_SOURCE_IP=
```

说明：

- `WECHAT_PAY_USER_APP_ID`
  - 用户端 `mobile-user` 的微信开放平台移动应用 AppID，用于 App 支付；
- `WECHAT_PAY_WORKER_APP_ID`
  - 服务人员端 `mobile-worker` 的微信开放平台移动应用 AppID，用于微信提现确认收款；
- `WECHAT_PAY_WORKER_APP_SECRET`
  - 服务人员端微信提现绑定换取 `openid/unionid` 所需的开放平台应用密钥；
- `WECHAT_PAY_WORKER_TRANSFER_SCENE_ID`
  - 商家转账场景 ID。对“服务人员提现”更可能使用“佣金报酬”场景；
- `WECHAT_PAY_TRANSFER_SOURCE_IP`
  - 商家转账必须配置接口安全 IP；
- 通知 URL 必须全部走环境变量，不能硬编码。

当前 `mobile-worker` 端实际还依赖：

- `EXPO_PUBLIC_WECHAT_WORKER_APP_ID` 或 `EXPO_PUBLIC_WECHAT_APP_ID`
- `EXPO_PUBLIC_WECHAT_WORKER_UNIVERSAL_LINK` 或 `EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK`

如果后续确认两个 App 共用同一个微信 AppID，可以合并；但设计上不要先假定它们一定相同。

## 6. 微信 App 支付接入设计

### 6.0 App 端实现选型

当前方案已在 Expo App 侧统一使用 [`expo-wechat`](https://github.com/likeSo/expo-wechat) 作为微信能力实现基础。

采用方式如下：

- `mobile-user` 端的微信支付拉起优先基于 `expo-wechat` 实现；
- `mobile-worker` 端后续涉及微信授权、拉起微信客户端等基础能力，也统一优先复用 `expo-wechat`；
- 若后续微信提现确认收款场景所需的 `requestMerchantTransfer` 能力未被该库直接覆盖，则在这一选型基础上补充原生扩展，而不再另起一套微信 SDK 方案。

### 6.1 接口设计

保留现有入口：

`POST /pay/orders/:orderId`

但返回体改为多态：

```ts
type InitiatePaymentResponse =
    | {
          payType: "alipay";
          paymentId: string;
          outTradeNo: string;
          amount: number;
          currency: string;
          orderString: string;
      }
    | {
          payType: "wechat_pay";
          paymentId: string;
          outTradeNo: string;
          amount: number;
          currency: string;
          wechatPayRequest: {
              appId: string;
              partnerId: string;
              prepayId: string;
              packageValue: "Sign=WXPay";
              nonceStr: string;
              timeStamp: string;
              sign: string;
          };
      };
```

### 6.2 微信支付服务端流程

1. 校验订单仍然是 `pending_payment`；
2. 复用/创建本地 `payments` 记录，`paymentMethod='wechat_pay'`；
3. 调微信下单 `POST /v3/pay/transactions/app`；
4. 使用 `orderSerial` 作为 `out_trade_no`；
5. `amount.total` 用分；
6. `time_expire` 用 RFC3339；
7. 返回 `prepay_id` 后，后端再组装 App 拉起签名；
8. 客户端拉起微信；
9. 客户端返回后调用后端查单；
10. 后端同时接收支付成功回调；
11. 支付成功后写 `transaction_id`，推进订单到 `pending_acceptance`。

### 6.3 回调与查单

当前已经有统一回调入口：

- `POST /pay/notify/:channel`

微信支付可以直接走：

- `POST /pay/notify/wechat_pay`

保留并增强：

- `GET /pay/orders/:orderId/payment-status`

支付状态返回体建议统一为：

```ts
{
    orderId: string;
    orderSerial: string;
    payType: "alipay" | "wechat_pay";
    paymentStatus: "pending" | "succeeded" | "failed" | "refunded";
    channelStatus: string;
    amount?: string;
    transactionId?: string;
    message: string;
}
```

微信支付状态建议映射：

| 微信 `trade_state` | 本地 `paymentStatus`                 |
| ------------------ | ------------------------------------ |
| `SUCCESS`          | `succeeded`                          |
| `NOTPAY`           | `pending`                            |
| `USERPAYING`       | `pending`                            |
| `CLOSED`           | `failed`                             |
| `PAYERROR`         | `failed`                             |
| `REFUND`           | 交给退款链路维护，支付查询不单独推进 |

### 6.4 支付侧当前剩余工作

- [alipay-payment.provider.ts](/mnt/f/home_server/apps/backend/src/modules/pay/providers/alipay-payment.provider.ts) 里的支付宝 `notify_url` 已切到环境变量，不再是微信接入阻塞项；
- [wechatPay.client.ts](/mnt/f/home_server/apps/backend/src/lib/wechatPay/wechatPay.client.ts) 已覆盖支付下单、查单、回调验签与“关单”接口；
- [packages/lib/src/pay.ts](/mnt/f/home_server/packages/lib/src/pay.ts) 已同时补上 worker 端商家转账确认收款封装；
- [useOrderPayment.ts](/mnt/f/home_server/apps/mobile-user/hooks/useOrderPayment.ts) 与 [wechat-payment-return.tsx](/mnt/f/home_server/apps/mobile-user/app/servicePersonnel/wechat-payment-return.tsx) 已完成首版结果处理，当前剩余重点是更系统的异常场景验证与真机回归；
- 支付闭环当前不再缺核心代码能力，后续重点已经转为补偿验证、日志审计与端到端测试。

## 7. 微信退款接入设计

### 7.1 适用范围

微信退款只适用于：

- 本地支付方式是 `wechat_pay`；
- 微信侧该订单已支付成功；
- 支付成功时间在 1 年内。

### 7.2 推荐实现

建议新增：

- `apps/backend/src/modules/pay/providers/wechat-refund.provider.ts`

行为：

1. 接受退款请求；
2. 调 `POST /v3/refund/domestic/refunds`；
3. 使用本地退款单号作为 `out_refund_no`；
4. 优先用 `transaction_id`，兜底用 `out_trade_no`；
5. 写入微信退款单号 `refund_id`；
6. 监听退款回调或主动查单确认终态；
7. 成功后更新订单、支付、流水。

### 7.3 退款回调与查单

建议新增：

- `POST /pay/wechat/refund/notify`

并支持：

- `GET /v3/refund/domestic/refunds/{out_refund_no}` 的主动查单

微信退款终态建议映射：

| 微信 `refund_status` | 建议本地语义              |
| -------------------- | ------------------------- |
| `SUCCESS`            | 退款成功                  |
| `CLOSED`             | 退款关闭                  |
| `ABNORMAL`           | 退款异常，需人工/补偿处理 |
| `PROCESSING`         | 处理中，保留中间态        |

### 7.4 当前仓库进展与剩余工作

- 当前 `RefundDispatcher` 已同时注册支付宝与微信 provider；
- [pay.controller.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.controller.ts) 已暴露 `POST /pay/wechat/refund/notify`；
- [pay.service.ts](/mnt/f/home_server/apps/backend/src/modules/pay/pay.service.ts) 已支持微信退款受理、`PROCESSING` 中间态与回调后结算；
- [pay.ts](/mnt/f/home_server/packages/types/src/pay.ts) 已补微信退款回调与退款查单 schema；
- 当前仍建议补独立 `refunds` 实体或至少更清晰的退款聚合视图，否则后续多次部分退款与运营追踪会越来越难维护。

## 8. 微信提现与商家转账设计

这一部分不是“支付能力的顺手附带”，而是一条独立链路。

### 8.1 先说清楚：微信提现不是绑定微信号

微信商家转账需要的是：

- 商户号绑定的某个 `appid`；
- 用户在该 `appid` 下的 `openid`；
- 可选的真实姓名校验；
- 拉起微信官方确认收款页；
- 场景报备信息。

也就是说，你不能像支付宝那样靠“账号 + 姓名”直接打款到某个外部账户。

### 8.2 对当前仓库的直接影响

当前仓库已经在 `user_profiles` 中落地了 worker 维度的微信字段，这满足 MVP 阶段“服务人员微信提现绑定”的方向。

从长期演进角度，更完整的方案仍然是新增一张多身份绑定表，例如：

`pay_account_bindings`

建议字段：

```ts
id;
userId;
provider; // alipay | wechat
appId; // 微信 appid / 支付宝应用标识
accountType; // openid / unionid / alipay_user_id / ...
accountId;
unionId;
realName;
isDefault;
createdAt;
updatedAt;
```

这是推荐的长期方案。原因：

- `openid` 是 `appid` 维度；
- 用户端和服务人员端未来可能对应不同微信 AppID；
- 服务人员提现时，应优先取 `worker appid` 对应的 `openid`；
- 后续如果还要做微信绑定展示、解绑、换绑，也更容易维护。

### 8.2.1 结合你当前业务前提，MVP 可以更收敛

你补充的信息很重要：

- 微信转账功能只用于“服务人员提取平台收益”；
- 服务人员端已经支持绑定支付宝账号；
- 后续会在服务人员端新增“绑定微信账号”。

在这个前提下，方案 **不需要推翻**，但微信提现部分可以从“全局通用账户体系”收敛成“worker 端收款身份绑定”。

也就是说，MVP 阶段可以先只解决一件事：

- 服务人员在 `mobile-worker` 端绑定一个可用于微信提现的微信收款身份；
- 后台提现审核通过后，只使用 `WECHAT_PAY_WORKER_APP_ID` 对应的 `openid` 发起商家转账。

从方案层面看，有两个可选落地层级；当前仓库已经先按方案 A 落地：

#### 方案 A：MVP 直接扩展 `user_profiles`

当前仓库已经在 [user-profiles.ts](/mnt/f/home_server/apps/backend/src/common/database/schema/user-profiles.ts) 中落地如下字段：

```ts
wechatWorkerOpenId;
wechatWorkerUnionId;
wechatWorkerBoundAt;
wechatWorkerAppId;
```

优点：

- 改动小；
- 与当前“支付宝绑定也在 `user_profiles`”的模式一致；
- 最适合快速验证微信提现闭环。

缺点：

- 一旦未来出现多微信 AppID、多绑定主体、用户端也要复用绑定信息，就会再次遇到扩展性问题。

#### 方案 B：按长期方案直接引入绑定表

如果你预计后续会出现以下任一情况，建议直接上 `pay_account_bindings`：

- `mobile-user` 和 `mobile-worker` 使用不同微信 AppID；
- 后续用户端也可能要接入微信提现/返现/赔付；
- 一个用户需要管理多个支付绑定；
- 需要做更完整的绑定状态、解绑审计、换绑流程。

### 8.2.2 当前阶段的绑定落地策略

当前阶段采用的是更收敛的 MVP 方案：

- 微信提现绑定只围绕 `mobile-worker` 展开；
- 绑定数据先落在 `user_profiles` 的 worker 专用字段；
- 字段必须明确体现 `worker` 和 `appId` 语义；
- 如果后续出现多微信 AppID、多端复用或多账户管理，再升级为独立绑定表。

### 8.3 当前提现状态机进展

当前仓库中的 `WithdrawalStatusEnum` 已经扩展为：

- `pending`
- `approved`
- `processing`
- `failed`
- `cancelled`
- `rejected`
- `completed`

这已经能承载微信提现的第一阶段中间态。

微信转账至少有这些状态：

- `ACCEPTED`
- `PROCESSING`
- `WAIT_USER_CONFIRM`
- `TRANSFERING`
- `SUCCESS`
- `FAIL`
- `CANCELING`
- `CANCELLED`

当前实现已经在提现记录上保留了渠道原始状态字段：

```ts
providerState;
providerBillNo;
providerPackageInfo;
providerAppId;
```

后续对微信商家转账的细粒度状态，如 `WAIT_USER_CONFIRM`、`TRANSFERING`，继续保留在 `providerState` 即可，本地枚举不必一一镜像微信原始状态。

### 8.4 推荐的提现业务流程

#### 用户申请提现

1. 服务人员提交提现申请；
2. 后端校验余额；
3. 冻结余额；
4. 创建本地 `withdrawals`，状态 `pending`。

这里建议前端请求体继续保留 `payType`，让服务人员主动选择：

- `alipay`
- `wechat_pay`

但具体收款账号不由前端传，而是由后端根据已绑定的收款身份自动填充。

#### 管理员审核通过

1. 管理员审核通过；
2. 后端按提现渠道调用不同 provider；
3. 若为微信，则调用微信“发起转账”；
4. 若为支付宝，则维持现有同步打款逻辑；
5. 微信分支下，本地 `withdrawals` 状态改为 `approved` 或 `processing`，并进入“待用户微信确认收款”的异步链路；
6. 微信分支下，保存：
    - `out_bill_no = withdrawalId`
    - `transfer_bill_no`
    - `providerState`
    - `package_info`
    - `providerAppId`
    - `transferSceneId`

#### 用户确认收款

1. 如果微信提现返回 `WAIT_USER_CONFIRM`；
2. `mobile-worker` 端在前台自动拉起微信官方确认收款页（不新增按钮/页面）；
3. 客户端返回后调用后端查单；
4. 后端等待微信转账回调或主动查单进入终态。

#### 无新增按钮/页面的触发策略（推荐）

为满足“不要新增按钮或新页面”的产品要求，建议把 SDK 调用时机设计为“**状态驱动 + 前台自动触发**”：

1. 管理员审核通过后，后端发起微信商家转账并写入：
    - `providerState=WAIT_USER_CONFIRM`（或微信等价待确认状态）；
    - `providerPackageInfo`（调用 `requestMerchantTransfer` 所需 `package`）；
    - `providerAppId`；
2. 后端同时下发站内通知/Push，提示“您的提现已到账，请点击此通知确认收款”；
3. `mobile-worker` 不新增页面：在**现有首页/工作台（或当前默认落地页）**的以下时机统一执行一次检测：
    - App 冷启动完成后；
    - `AppState` 从后台切回前台；
    - 用户点击 Push 进入应用后；
4. 检测到存在 `WAIT_USER_CONFIRM` 且有 `providerPackageInfo` 的提现单时，直接调用微信 SDK：
    - Android: `WXOpenBusinessView`
    - `businessType=requestMerchantTransfer`
5. SDK 返回后立即调用后端查单接口，刷新该提现单状态。

实现约束（避免骚扰与重复拉起）：

- 仅在 App 前台触发，后台任务不直接拉起 SDK；
- 按提现单维度做本地幂等锁（例如 `withdrawalId + 30s cooldown`），防止同一单重复弹起；
- 一次只处理一笔待确认单（建议按创建时间升序）；
- 若用户取消或微信拉起失败，保留 `WAIT_USER_CONFIRM`，在下次前台激活时自动重试；
- 超过业务超时阈值仍未确认时，后端执行查单/撤销补偿并更新为 `cancelled/failed`。

#### 终态处理

- `SUCCESS`
  - 提现状态改 `completed`；
  - 冻结余额真正扣减；
  - 写提现流水；
- `FAIL`
  - 提现状态改 `failed`；
  - 冻结余额退回可用余额；
  - 写失败原因；
- `CANCELLED`
  - 提现状态改 `cancelled`；
  - 冻结余额退回；
- `rejected`
  - 仅用于管理员人工拒绝。

### 8.5 商家转账的场景选择建议

对“服务人员提现”最接近的官方场景通常是：

- **佣金报酬**

因为官方场景说明里“向劳务提供方，如销售、团长、主播支付佣金、报酬等”与服务人员收益提现更接近。

这意味着你在发起转账时需要报备类似：

- `岗位类型`
- `报酬说明`

例如：

- `岗位类型`: `上门服务人员`
- `报酬说明`: `2026年03月服务佣金提现`

具体场景 ID 需要在商户平台申请和查看，不能拍脑袋写死。

### 8.6 微信转账需要的 App 侧能力

与支付不同，微信提现确认收款需要另一套原生能力：

- Android 使用 `WXOpenBusinessView`
- `businessType = requestMerchantTransfer`
- `query` 里要传：
  - `mchId`
  - `appId`
  - `package`

官方还要求：

- Android openSDK 版本 `>= 5.3.1`
- 微信版本需 `>= 8.0.45.51` 才能正常拉起用户确认收款

这意味着你不能只做“微信支付插件”，还要做“商家转账确认收款插件”。

当前 App 端微信能力的基础选型统一为 [`expo-wechat`](https://github.com/likeSo/expo-wechat)：

- 微信支付、微信授权、微信客户端唤起等基础能力优先基于该库实现；
- 如果后续确认该库尚未覆盖 `requestMerchantTransfer`，则在此基础上补充商家转账确认收款所需的原生扩展。

同时，`mobile-worker` 端还需要一套“微信绑定”能力，至少包含：

- 查询当前微信绑定状态；
- 发起微信绑定；
- 保存 `worker appid` 对应的 `openid`；
- 解绑或更换绑定。

### 8.7 当前后台审核流进展与剩余工作

[admin-withdrawals.service.ts](/mnt/f/home_server/apps/backend/src/modules/pay/admin-withdrawals.service.ts) 当前逻辑是：

- 审核通过；
- 调用 `PayoutDispatcher`；
- 支持推进到 `approved / processing / completed / failed / cancelled`；
- 终态时才执行冻结余额扣减或退回。

这意味着后台审核流的可插拔改造已经完成。并且截至 2026-03-31，下面几项也已经落地：

- `WechatPayoutProvider` 已接入；
- 微信商家转账查单/回调/撤销已接入；
- worker 端已接上“基于现有页面生命周期自动触发”的用户确认收款能力（不新增按钮/页面）；
- 微信终态已经回写现有提现审核流，并在 `WAIT_USER_CONFIRM` 时联动通知。

当前剩余工作主要变成：

- 真机端到端验证，尤其是 Android 微信版本兼容性与异常回流；
- iOS 侧是否要补同等确认收款能力，还是明确维持“仅 Android 支持”；
- 更完整的提现对账、告警与运营补偿。

## 9. 类型与接口建议

### 9.1 `packages/types/src/pay.ts`

当前已经完成：

- 多态的 `InitiatePaymentResponseSchema`
- 微信支付请求参数 schema
- 发起支付请求体中的 `payType` 已放开 `wechat_pay`
- `UserWithdrawBodySchema`
  - 已放开 `wechat_pay`
- `QueryPaymentStatusResponseSchema`
  - 已统一为渠道无关结构

当前已经补齐：

- 微信支付拉起参数 schema
- 微信退款回调 schema
- 微信退款查单 schema
- worker 微信绑定/解绑/状态 schema
- worker 微信确认收款结果上报与提现渠道状态快照 schema

提现相关类型当前已去掉支付宝专属语义，但后续还可以继续补：

- `UserWithdrawResponseSchema`
  - 可继续补通用字段：
    - `providerBillNo`
    - `requiresUserConfirm`
    - `providerPackageInfo`

当前仍建议继续补：

- 微信商家转账底层请求/响应 schema
- 微信商家转账查单响应 schema
- 微信商家转账回调 schema

### 9.2 数据库与实体建议

当前已经落地：

- MVP 方案：`user_profiles` 已增加 `wechatWorkerOpenId/wechatWorkerUnionId/wechatWorkerAppId/wechatWorkerBoundAt`
- `withdrawals` 已增加：
  - `providerState`
  - `providerAppId`
  - `providerPackageInfo`
  - `providerBillNo`
  - `providerMeta`

后续可继续演进：

- 长期方案：新增 `pay_account_bindings` 表，存微信 `openid` 等多身份绑定；
- 若已有退款能力要长期维护，建议新增独立 `refunds` 表，而不是只靠支付记录附带状态。

## 10. 分阶段实施顺序

### 第一阶段：支付闭环（已完成首版）

目标：

- 微信下单；
- App 拉起支付；
- 客户端回到 App 后查单；
- 支付回调落库；
- 订单进入 `pending_acceptance`。

当前进展：

- 服务端 payment dispatcher、统一查单结构、统一回调入口已经到位；
- `WechatPaymentProvider`、`WechatPayClient`、移动端 `expo-wechat` 拉起、回跳后的主动查单确认均已落地；
- 微信关单也已经补上，并已接入订单超时/取消/定时扫描补偿；
- 当前剩余工作主要是异常补偿验证与端到端测试，不再属于首版支付闭环阻塞项。

### 第二阶段：退款闭环（已完成首版）

目标：

- 微信退款 provider；
- 退款回调；
- 退款查单；
- 后台退款入口可用。

当前进展：

- 退款 dispatcher 和按渠道退款入口已经完成；
- 微信 refund provider、退款通知、退款查单与退款结算都已接入；
- 当前剩余工作主要是退款实体建模、运营可视化与更系统的回归测试。

### 第三阶段：微信提现基础设施（已完成首版）

目标：

- 服务人员端微信绑定能力；
- 落库 worker 维度 `openid/appId`；
- 微信转账 client；
- 提现状态机扩展；
- 后台审核改成异步终态。

当前进展：

- worker 维度微信字段、提现状态机扩展、后台审核异步终态能力已落地；
- 服务人员端微信绑定能力、微信转账 client 与 provider 已完成；
- 微信转账查单、回调、撤销与通知也已接入。

### 第四阶段：服务人员端确认收款（已完成 Android 首版）

目标：

- `mobile-worker` 集成微信 OpenSDK 的商家转账确认收款能力；
- 基于现有页面与生命周期自动检测 `WAIT_USER_CONFIRM` 并拉起确认（不新增按钮/页面）；
- 用户返回 App 后主动查单。

当前进展：

- `mobile-worker` 已接入 `requestMerchantTransfer` 封装与结果监听；
- 已基于 App 前后台切换、通知事件和提现列表状态自动检测 `WAIT_USER_CONFIRM` 并拉起确认；
- 用户返回 App 后已会上报结果并主动查单；
- 当前实现仍以 Android 为主，iOS 是否补齐需单独确认。

### 第五阶段：撤销、补偿与对账（部分完成）

目标：

- 用户未确认前可撤销转账；
- 转账失败自动解冻；
- 支付/退款/转账三条链路统一审计与对账。

当前进展：

- 微信商家转账撤销接口已经接入，worker 端取消确认收款时会触发撤销/查单补偿；
- 转账失败、取消后的冻结余额回退已回写现有提现状态机；
- 统一审计、对账报表与更细粒度运营补偿仍未完成。

## 11. 我对这个仓库的建议落地顺序

如果按“少返工、可演进”原则，建议顺序是：

1. `pay` 模块拆成 payment/refund/payout 三类 provider，这一步已经完成；
2. 先打通微信支付；
3. 再补微信退款；
4. 再补 worker 端微信绑定与商家转账 provider；
5. 最后做微信商家转账确认收款、撤销和对账。

截至 2026-03-31，这个顺序已经基本执行到第 5 步，其中“确认收款、撤销”已完成首版，真正剩下的是“对账”和更系统的补偿治理。

原因：

- 支付和退款与现有订单支付主链路最接近；
- 微信提现受 `openid`、场景报备、用户确认、运营账户资金影响更大；
- 先把微信提现做了，反而会倒逼你重构一大片提现状态与账户绑定逻辑。

## 12. 实施时的关键风险

### 12.1 `openid` 维度错误

如果你把用户端 `appid` 下的 `openid` 用到服务人员端微信提现，或者反过来混用，会直接触发：

- `OPENID_INVALID`
- 用户无法确认收款
- 转账失败

### 12.2 提现状态与余额状态不同步

微信转账不是同步终态，冻结余额的释放/扣减必须跟最终状态走，不能在管理员点击“通过”时就当作完成。

### 12.3 不要把微信提现理解为“微信版支付宝转账”

支付宝可以通过账号标识直接打款，微信商家转账必须走：

- `openid`
- 场景报备
- 微信官方确认收款页
- 中间态查单

产品交互和服务端状态机都完全不同。

### 12.4 回调验签必须保留 raw body

支付、退款、商家转账三类微信回调都一样，必须基于原始请求体验签。

### 12.5 本地状态与渠道状态要分层维护

当前 `WithdrawalStatusEnum` 已经包含 `processing/failed/cancelled`，足够承载本地业务流转；微信侧更细粒度的状态继续保留在 `providerState` 中即可。

## 13. 参考资料

### 13.1 微信支付

- 微信支付 App 支付开发指引（更新时间：2026-01-16）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070176>
- 微信支付 App 下单（更新时间：2025-03-31）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070347>
- 微信支付 App 调起支付（更新时间：2025-02-19）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070351>
- 微信支付成功回调通知（更新时间：2024-12-27）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070368>
- 微信支付回调和查单实现指引（更新时间：2024-12-18）
  <https://pay.weixin.qq.com/doc/v3/merchant/4012075249>
- 微信商户订单号查询订单（更新时间：2024-12-27）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070356>
- 微信关闭订单
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070360>

### 13.2 微信退款

- 微信退款产品介绍（更新时间：2025-06-27）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013071001>
- 微信退款申请（更新时间：2025-01-09）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013070371>
- 查询单笔退款（更新时间：2025-01-09）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013071041>
- 退款结果通知（更新时间：2025-01-02）
  <https://pay.weixin.qq.com/doc/v3/merchant/4013071196>

### 13.3 微信商家转账

- 商家转账产品介绍（更新时间：2026-01-28）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012711988>
- 商家转账开发指引（更新时间：2026-02-02）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012715211>
- 发起转账（更新时间：2025-03-21）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012716434>
- 商户单号查询转账单（更新时间：2025-03-21）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012716437>
- 撤销转账（更新时间：2025-03-18）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012716458>
- 商家转账回调通知（更新时间：2025-03-07）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012712115>
- Android 调起用户确认收款（更新时间：2025-03-07）
  <https://pay.wechatpay.cn/doc/v3/merchant/4012719576>
- 转账失败原因说明（更新时间：2025-04-15）
  <https://pay.wechatpay.cn/doc/v3/merchant/4013774966>
