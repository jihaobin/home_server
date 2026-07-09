# 服务下架申诉技术方案

日期：2026-05-18

## 背景

服务人员端的服务设置详情页已有“申诉”入口，但当前按钮处于禁用状态并提示“敬请期待”。现有服务发布审核链路已经支持管理员审核、驳回、下架、下架原因展示，以及服务人员整改后重新提交审核。

本方案补齐“管理员下架后的申诉”能力：服务人员认为下架理由不合理时，可提交申诉；管理员通过申诉后恢复原线上服务；管理员驳回后服务保持下架，服务人员可再次申诉。

## 目标

- 服务人员可对“管理员下架”的已发布服务提交申诉。
- 申诉通过后恢复原线上版本，不自动通过任何待审核整改草稿。
- 申诉驳回后记录驳回原因，并允许服务人员再次提交申诉。
- 管理员在现有服务审核/服务管理页处理申诉，不新增独立管理模块。
- 管理员处理申诉后只通知服务人员；管理端通知链路暂不接入。
- 整改重新提交审核与申诉并行存在，互不覆盖，避免状态冲突。

## 非目标范围

- 不支持审核不通过场景的申诉。审核不通过继续走“修改后重新提交审核”。
- 不支持申诉附件。首版只提交文字说明。
- 不新增客服工单系统。
- 不接入管理端通知链路。
- 不把申诉通过等同于整改草稿审核通过。

## 已确认业务决策

- 申诉对象只限“管理员下架”的已发布服务。
- 申诉通过后恢复原线上版本。
- 服务人员提交申诉时只填写申诉说明。
- 同一轮下架只允许一个进行中的申诉；被驳回后允许再次提交。
- 管理端处理动作只有“通过申诉”和“驳回申诉”。
- 管理端在现有服务审核/服务管理页增加申诉筛选与处理入口。
- 申诉结果只通知服务人员。
- 新增独立申诉表保存申诉状态和历史。
- 使用当前服务状态中的 `takenDownAt` 快照标识“同一轮下架”。

## 数据模型

新增表：`service_personnel_offering_appeals`

建议字段：

- `id`：主键。
- `servicePersonnelId`：服务人员 ID。
- `serviceId`：服务 ID。
- `takenDownAtSnapshot`：提交申诉时的 `service_personnel_offering_statuses.takenDownAt`。
- `takeDownReasonSnapshot`：提交申诉时的下架原因快照。
- `appealReason`：服务人员填写的申诉说明，建议 10-500 字。
- `status`：申诉状态。
- `reviewResultReason`：管理员驳回原因，或通过时的处理备注，首版通过可为空。
- `reviewedBy`：处理管理员 ID。
- `reviewedAt`：处理时间。
- `createdAt`：创建时间。
- `updatedAt`：更新时间。

申诉状态：

- `pending`：待处理。
- `approved`：申诉通过，原线上服务已恢复。
- `rejected`：申诉驳回，服务保持下架。
- `canceled`：申诉被系统取消。典型场景是服务已通过整改审核重新上线，本次申诉不再需要处理。

约束建议：

- 同一 `servicePersonnelId + serviceId + takenDownAtSnapshot` 下最多允许一个 `pending` 申诉。
- `takenDownAtSnapshot` 必须来自当前下架状态，不能由客户端传入。
- `takeDownReasonSnapshot` 用于保留提交申诉时的下架理由，避免后续状态变化影响申诉历史。

## 状态流

### 管理员下架

沿用现有逻辑：

- `service_personnel_offering_statuses.publicationStatus = taken_down`
- `reviewStatus = approved`
- 写入 `takeDownReason`
- 写入 `takenDownAt`
- 通知服务人员

### 服务人员提交申诉

提交条件：

- 当前登录用户是服务所属服务人员。
- 服务存在已发布状态。
- 当前 `publicationStatus = taken_down`。
- 当前有 `takenDownAt`。
- 同一 `takenDownAt` 下不存在 `pending` 申诉。

提交后：

- 新增 `pending` 申诉。
- 保存 `takenDownAtSnapshot` 和 `takeDownReasonSnapshot`。
- 写入 audit log。
- 刷新服务设置详情，页面显示“申诉已提交，等待管理员处理”。

### 管理员通过申诉

事务内处理：

- 锁定申诉记录。
- 校验申诉为 `pending`。
- 校验服务仍处于同一轮下架：当前 `publicationStatus = taken_down`，且当前 `takenDownAt` 等于申诉的 `takenDownAtSnapshot`。
- 更新申诉为 `approved`。
- 恢复服务状态：`publicationStatus = active`，`reviewStatus = approved`。
- 清空当前状态上的下架字段：`takeDownReason`、`takenDownBy`、`takenDownAt`。
- 写入 audit log。
- 通知服务人员申诉通过。

通过申诉只恢复原线上版本，不处理待审核整改草稿。

### 管理员驳回申诉

事务内处理：

- 锁定申诉记录。
- 校验申诉为 `pending`。
- 更新申诉为 `rejected`。
- 写入 `reviewResultReason`、`reviewedBy`、`reviewedAt`。
- 服务保持 `taken_down`。
- 写入 audit log。
- 通知服务人员申诉驳回。

驳回后，服务人员可再次提交申诉。同一轮下架下会产生新的申诉记录。

### 整改审核通过

服务人员认可下架理由时，可以不申诉，直接整改后重新提交审核。该路径与申诉路径并行：

- 整改审核通过后，按现有审核通过逻辑发布整改版本并恢复上线。
- 同一 `servicePersonnelId + serviceId + takenDownAtSnapshot` 下仍为 `pending` 的申诉自动更新为 `canceled`。
- 不额外发送“申诉取消”通知，避免和审核通过通知重复。

如果管理员正在处理一个已因整改上线而失效的申诉，后端应将申诉置为 `canceled`，并返回“服务已恢复上线，本次申诉已取消”。

### 再次下架

再次下架会产生新的 `takenDownAt`，自然形成新一轮申诉。旧申诉不能恢复新一轮下架状态。

## 后端接口

### 移动端提交申诉

`POST /work-skills/service-offerings/:serviceId/appeals`

请求体：

```json
{
    "appealReason": "申诉说明"
}
```

响应建议返回最新申诉摘要：

```json
{
    "id": "appeal_id",
    "status": "pending",
    "appealReason": "申诉说明",
    "createdAt": "2026-05-18T00:00:00.000Z"
}
```

后端从当前登录态解析服务人员，不信任客户端传入 `servicePersonnelId`。

### 移动端查询服务详情

复用现有服务设置详情接口，在服务项上增加当前下架轮次相关申诉摘要：

```json
{
    "latestAppeal": {
        "id": "appeal_id",
        "status": "pending",
        "appealReason": "申诉说明",
        "reviewResultReason": null,
        "createdAt": "2026-05-18T00:00:00.000Z",
        "reviewedAt": null
    }
}
```

只需要返回与当前 `takenDownAt` 匹配的最新申诉。历史轮次申诉不参与当前页面状态。

### 管理端列表筛选

现有服务审核/服务管理列表增加筛选值：

- `appeal_pending`：申诉待处理。

列表项补充：

- 最新 pending 申诉 ID。
- 申诉说明。
- 申诉提交时间。
- 下架原因快照。

### 管理端通过申诉

`POST /admin/service-offerings/appeals/:appealId/approve`

请求体首版可为空。

处理成功后返回处理后的申诉和服务状态摘要。

### 管理端驳回申诉

`POST /admin/service-offerings/appeals/:appealId/reject`

请求体：

```json
{
    "reason": "驳回原因"
}
```

驳回原因建议 2-300 字。

## 移动端设计

文件入口：`apps/mobile-worker/app/profile/service-settings-detail-redesign.tsx`

当前 `申诉（敬请期待）` 按钮改为真实入口：

- 无 pending 申诉时：按钮文案“申诉”。
- 有 pending 申诉时：按钮文案“申诉处理中”，禁用。
- 最新申诉被驳回时：notice 展示“申诉已驳回：{reason}”，按钮文案“重新申诉”。

点击申诉后展示弹窗或底部弹层：

- 展示当前下架原因。
- 输入申诉说明。
- 提交按钮。

提交成功：

- 关闭弹窗。
- toast 提示提交成功。
- 刷新服务详情。
- notice 显示“申诉已提交，等待管理员处理”。

提交失败：

- `409` 已有 pending 申诉：刷新详情并提示“申诉已提交，请等待管理员处理”。
- `409` 服务已恢复或状态变化：刷新详情并提示当前状态已变化。
- 其他错误使用现有 hooks 的 `meta.errorMessage` 机制。

## 管理端设计

在现有服务审核/服务管理页扩展，不新增独立页面。

列表筛选：

- 增加“申诉待处理”。
- 查询条件映射到后端 `appeal_pending`。

列表展示：

- 服务人员信息。
- 服务信息。
- 当前下架原因。
- 申诉说明。
- 申诉提交时间。

操作：

- “通过申诉”：确认后调用 approve 接口。
- “驳回申诉”：弹窗填写驳回原因后调用 reject 接口。

处理后：

- 刷新列表。
- 如果通过申诉，该服务不再出现在“申诉待处理”筛选下。
- 如果驳回申诉，该申诉不再出现在“申诉待处理”筛选下，但服务仍为下架状态。

## 通知策略

只通知服务人员：

- 管理员通过申诉：通知服务人员“服务申诉已通过，服务已恢复上线”。
- 管理员驳回申诉：通知服务人员“服务申诉已驳回”，包含驳回原因。

不通知管理员：

- 管理端通知链路暂未打通。
- 管理员通过“申诉待处理”筛选发现待处理事项。

## 错误处理

服务人员提交申诉：

- 服务不属于本人：`403`。
- 服务不存在或当前用户不可见：`404`。
- 服务不是管理员下架态：`409`。
- 当前下架状态缺少 `takenDownAt`：`409`。
- 同一轮已有 pending 申诉：`409`。
- 申诉说明为空或长度不合规：`400`。

管理员处理申诉：

- 申诉不存在：`404`。
- 申诉不是 `pending`：`409`。
- 服务已通过整改上线：申诉置 `canceled`，返回状态变化说明。
- 服务已进入新一轮下架：申诉置 `canceled`，返回状态变化说明。
- 驳回原因为空或长度不合规：`400`。

## 审计与一致性

需要写入 audit log 的事件：

- 服务人员提交申诉。
- 管理员通过申诉。
- 管理员驳回申诉。
- 系统取消申诉。

一致性要求：

- 通过/驳回申诉必须在事务中处理。
- 通过申诉时必须校验 `takenDownAtSnapshot`，防止旧申诉恢复新一轮下架。
- 整改审核通过后取消 pending 申诉也应在审核通过事务内完成。

## 测试计划

后端单测：

- taken_down 服务可提交申诉。
- active 服务不可提交申诉。
- 非本人服务不可提交申诉。
- 同一 `takenDownAtSnapshot` 下 pending 申诉不可重复。
- rejected 后可再次提交申诉。
- 通过申诉恢复原线上版本，并清空当前下架字段。
- 驳回申诉保留下架态并记录驳回原因。
- 整改审核通过会取消同一轮 pending 申诉。
- 旧轮次申诉不能恢复新一轮下架。
- 已恢复上线的 pending 申诉被处理时会转为 canceled。

类型与 hooks：

- `packages/types/src/work-skill.ts` 增加申诉 schema。
- 移动端 hook 增加提交申诉 mutation。
- 管理端 hook 或 admin service hook 增加申诉筛选、通过、驳回能力。

移动端验证：

- 下架态显示申诉入口。
- pending 显示申诉处理中且不可重复提交。
- rejected 显示驳回原因并允许重新申诉。
- 提交成功后刷新详情。

管理端验证：

- “申诉待处理”筛选只显示 pending 申诉。
- 通过后服务恢复上线并从待处理列表消失。
- 驳回必须填写原因。
- 驳回后服务保持下架并从待处理列表消失。

建议运行：

- `pnpm type-check`
- `pnpm --filter backend test`

## 实施边界

- 需要新增数据库 schema 和迁移 SQL。
- 不编辑 `dist/` 产物。
- 不改变现有公开服务列表过滤规则。
- 不削弱当前 `taken_down` 服务在用户端不可见的约束。
- 不提交 git commit，除非用户明确要求。
