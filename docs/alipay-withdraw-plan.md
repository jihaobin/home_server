# 支付宝提现方案（最终版）

本文档用于落地“服务人员支付宝提现”能力，提现申请与打款执行分离：用户端仅提交提现申请并冻结余额，后台管理员审核后调用支付宝单笔转账接口完成打款与入账。

---

## 1. 关键决策（已确认）

1. **继续保留人工审核流程**：用户端发起提现申请后，状态为 `pending`，由后台管理员审核并执行打款。
2. **打款使用 `createWorkerAliPaySdk` 对应的 AppId**：后台调用 `alipay.fund.trans.uni.transfer` 时使用服务人员端（worker）支付宝应用的 SDK（含证书/密钥配置）。
3. **用户提现接口彻底移除 `payee` 入参**：该接口尚未上线，无存量调用方，不做兼容逻辑（不再接收/忽略 payee）。
4. **落地 ≥ 50000 元强制填写 remark**：满足监管/风控要求，避免命中 `MEMO_REQUIRED_IN_TRANSFER_ERROR` 等错误。

---

## 2. 业务目标与范围

### 2.1 目标

- 服务人员可发起支付宝提现申请；
- 余额在申请时冻结，审核通过后打款并扣减冻结余额；
- 收款方信息不由前端提供，而从 `user_profiles` 表读取绑定的 `alipay_user_id` 或 `alipay_open_id`；
- 支持幂等重试：同一 `withdrawalId` 作为 `out_biz_no`，重复调用不会重复打款。

### 2.2 非目标（本期不做）

- 支付宝转账结果不确定时的“自动查询最终状态”（`alipay.fund.trans.common.query`）与后台补偿任务；
- 提现状态细分为 `processing` 等（仍沿用现有 `pending/approved/rejected/completed`）。

---

## 3. 数据来源与收款方识别规则

### 3.1 数据表

使用 `user_profiles`（见：`apps/backend/src/common/database/schema/user-profiles.ts`）：

- `alipay_user_id`（字段：`alipayUserId`）
- `alipay_open_id`（字段：`alipayOpenId`）
- `real_name`（字段：`realName`）

### 3.2 识别规则（两字段只会存在一个）

按优先级选择收款标识：

1. 若 `alipayUserId` 有值：
    - `payeeAccountType = 'ALIPAY_USER_ID'`
    - `payeeAccount = alipayUserId`
2. 否则若 `alipayOpenId` 有值：
    - `payeeAccountType = 'ALIPAY_OPEN_ID'`
    - `payeeAccount = alipayOpenId`
3. 两者都为空：拒绝提现申请（提示先完成支付宝绑定/授权）。

`payeeName`：

- 优先写入 `user_profiles.realName`（可空）。
- 不使用 `ALIPAY_LOGON_ID`，因此不强制要求姓名，但若有真实姓名建议写入以提高成功率。

---

## 4. 用户提现申请流程（服务人员端）

### 4.1 接口契约变更

变更位置：`packages/types/src/pay.ts`

- `UserWithdrawBody` 移除字段：`payee`
- 保留字段：`amount/currency/payType/remark`

> 说明：不做兼容，因为接口未上线、无调用方。

### 4.2 后端实现位置

- `apps/backend/src/modules/pay/pay.service.ts`
  - 方法：`withdraw(userId, payload)`

### 4.3 处理步骤（同步事务）

1. 校验 `userId`、校验服务人员身份（现有逻辑保留）。
2. 校验 `payType === 'alipay'`（现有逻辑保留）。
3. 金额校验：
    - 金额保留两位小数（现有 Decimal 处理保留）
    - **最小金额 `>= 0.1`**
    - **当 `amount >= 50000` 时 `remark` 必填且非空**
4. 查询 `user_profiles` 获取收款方 `alipayUserId/alipayOpenId/realName`：
    - 无绑定信息：抛出 `BadRequestException`（例如：`请先绑定支付宝账号后再提现`）。
5. DB Transaction：
    - 查询 `user_balances`，校验可用余额充足；
    - `availableBalance -= amount`，`frozenBalance += amount`，更新 `totalBalance`；
    - 创建 `withdrawals`：
        - `status = pending`
        - `method = alipay`
        - `payeeAccount/payeeAccountType/payeeName` 来自 `user_profiles`
        - `remark` 来自用户输入（满足第3步校验）
6. 返回 `withdrawalId/status/amount/currency/balance/outBizNo`。

### 4.4 关键点

- 用户端不再提交收款账号，避免伪造收款方导致资金风险；
- 冻结资金与创建提现记录必须在同一事务内，避免部分成功导致账实不一致。

---

## 5. 后台审核与打款流程（Admin）

### 5.1 实现位置

- `apps/backend/src/modules/pay/admin-withdrawals.service.ts`
  - `approveAndPayout()`
  - `executeAlipayTransfer()`

### 5.2 SDK 选择（已确认）

将 `AdminWithdrawalsService` 内部用于转账的 SDK 从：

- `createAliPaySdk()`

调整为：

- `createWorkerAliPaySdk()`

原因：

- 收款方 identity 可能是 `ALIPAY_OPEN_ID`，且 openId 具有应用维度属性；
- 统一用 worker 应用作为打款主体与签约主体，避免 openId 不匹配导致不可用。

### 5.3 转账请求（alipay.fund.trans.uni.transfer）

统一使用：

- `out_biz_no = withdrawalId`（幂等关键）
- `biz_scene = DIRECT_TRANSFER`
- `product_code = TRANS_ACCOUNT_NO_PWD`
- `trans_amount = amount.toFixed(2)`
- `order_title = 服务人员提现`
- `payee_info.identity = withdrawals.payeeAccount`
- `payee_info.identity_type = withdrawals.payeeAccountType`（`ALIPAY_USER_ID` / `ALIPAY_OPEN_ID`）
- `payee_info.name = withdrawals.payeeName`（可选）
- `remark = withdrawals.remark`（可选，但受 ≥50000 必填约束）

成功后（保持现有逻辑）：

1. 校验冻结余额足够；
2. `frozenBalance -= amount`，并更新 `lastTransactionId`；
3. `withdrawals.status = completed`，写入 `payoutReferenceId`；
4. 写入 `financial_transactions` 一条 `transactionType = withdrawal` 的负数流水。

失败后（保持现有逻辑）：

- 抛出错误给管理员；
- 提现记录保持非完成状态，冻结余额不变，可选择重试或驳回（驳回会解冻）。

---

## 6. 风控/校验与错误处理策略

### 6.1 金额与备注

- 金额：
  - `>= 0.1`
  - 最多两位小数
- 备注：
  - `amount >= 50000` 时必填（非空、去除首尾空格后长度 > 0）

### 6.2 幂等与重试

- 使用 `withdrawalId` 作为 `out_biz_no`，管理员重复点击“通过/重试”不会造成重复打款；
- 若支付宝返回 `SYSTEM_ERROR` 等不可判定结果：本期不做自动查询，仍由管理员人工重试或后续补偿能力处理。

---

## 7. 需要修改的文件清单（落地时）

### 7.1 类型与前端请求

- `packages/types/src/pay.ts`
  - 调整 `UserWithdrawBodySchema`：移除 `payee`
- `packages/hooks/src/api/pay/index.ts`
  - 同步请求体结构（移除 `payee`）
- 对应调用页面（admin-web/mobile-worker）如有联调代码，同步删除 `payee` 相关字段。

### 7.2 后端

- `apps/backend/src/modules/pay/pay.service.ts`
  - `withdraw()`：从 `user_profiles` 读取收款方标识并写入 `withdrawals`
  - 增加金额下限与 5w 备注校验
- `apps/backend/src/modules/pay/admin-withdrawals.service.ts`
  - `executeAlipayTransfer()` 使用 `createWorkerAliPaySdk()`

---

## 8. 验收标准（Checklist）

- 服务人员未绑定支付宝（`alipay_user_id/open_id` 均为空）时，提现申请被拒绝；
- 提现申请成功时：
  - `user_balances.available` 减少、`frozen` 增加，数值精确到 2 位；
  - `withdrawals` 记录写入 `payeeAccount/payeeAccountType/payeeName`；
  - 返回体包含 `withdrawalId/outBizNo`（等于提现记录 id）。
- `amount >= 50000` 且 `remark` 为空时，提现申请被拒绝；
- 管理员审核通过后：
  - 调用 `alipay.fund.trans.uni.transfer` 成功；
  - `withdrawals.status` 变为 `completed`，`payoutReferenceId` 写入；
  - 冻结余额扣减，流水写入正确。
- 管理员驳回后：
  - 冻结余额解冻回可用余额；
  - `withdrawals.status` 变为 `rejected`。
