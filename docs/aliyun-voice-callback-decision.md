# 阿里云语音通知回调接入决策说明

更新日期：2026-03-20

## 背景

- 当前后端已经接入阿里云 Dyvms 语音通知能力，底层封装位于 `apps/backend/src/common/voice/voice.service.ts`。
- 新订单场景下，`NotificationDispatcher` 会在常规通知渠道执行后，额外触发 `NotificationVoiceCallService` 发起语音提醒。
- 团队当前需要判断：是否应该配置阿里云回调接口，接收语音是否真正发送成功、是否接通、是否失败等状态通知。

## 结论

**建议配置阿里云语音回调接口，并至少接入 `VoiceReport`。**

这个结论的含义不是“没有回调就不能发起语音通知”，而是：

- 如果只是验证阿里云 API 能否调用成功，回调不是硬门槛。
- 如果要把“新订单语音提醒”作为正式生产链路的一部分，并希望具备可追踪、可补救、可统计、可复盘的能力，那么回调基本是必需项。

## 当前实现现状

### 1. 当前只拿到了“阿里云已受理请求”

`VoiceCallService.singleCallByTts()` 当前在阿里云返回 `code === 'OK'` 时，就将本次调用视为成功，并返回 `callId`、`requestId`、`outId` 等信息。

这只能说明：

- 请求参数合法；
- 阿里云接口已受理；
- 本次语音任务已进入阿里云侧处理流程。

这**不能**说明：

- 电话一定拨通了；
- 服务人员一定接听了；
- TTS 一定播放完成了；
- 本次提醒对业务真的产生了效果。

### 2. 当前语音链路没有纳入统一投递闭环

现有通知模块中：

- 腾讯云推送已有回调接口，会根据回调更新投递状态，并在失败时触发短信兜底。
- 短信已有回执回调接口，会将 `delivered/failed` 等状态写回 `notification_deliveries`。

但语音提醒目前仍是额外触发逻辑：

- 不属于 `notification_channel` 枚举的一部分；
- 不会创建独立的 delivery log；
- 没有异步回调去更新最终状态；
- 没有基于最终语音结果做自动补救。

### 3. 当前实现已经具备接回调的关键条件

虽然没有回调闭环，但当前代码已经为后续接入做好了一个很重要的铺垫：

- 语音发起时会传 `outId`；
- `outId` 中已编码 `notificationId`、`orderId`、`targetRecordId`；
- 阿里云成功返回时还能拿到 `callId`。

这意味着后续无论是按 `outId` 还是按 `callId`，都可以把回调事件准确关联回业务通知记录。

## 从产品经理角度看，为什么建议接回调

### 1. 需要区分“请求发出”与“提醒触达”

对于 `order_pending_acceptance_assigned` 这类强时效事件，产品真正关心的是：

- 服务人员有没有被叫到；
- 语音提醒有没有真正到达；
- 没到达时是否已经触发了其他补救渠道；
- 不同提醒方式谁更有效。

如果没有回调，系统只能回答“我们调用了阿里云接口”，不能回答“服务人员是否真的收到这次提醒”。

### 2. 需要支撑投诉、排障和运营复盘

没有回调时，运营和客服常见问题会很难回答：

- 某个订单为什么没人接单，语音到底打没打出去？
- 用户说没接到电话，系统是没拨、拨失败、还是拨通未接？
- 哪些时段、哪些地区、哪些运营商的语音成功率更差？

这些都需要依赖回调或查询详情能力，而不仅仅是发起接口日志。

### 3. 需要支撑自动补救策略

如果产品希望把新订单提醒做成强提醒链路，典型策略会包括：

- 语音失败后自动短信兜底；
- 多次未接通后触发二次语音；
- 长时间未接单时改派或升级告警。

这些策略都依赖“最终结果”，而不是单纯依赖发起接口返回。

## 从后端架构角度看，为什么建议接回调

### 1. 现在的语音链路和现有通知架构不对称

现有通知架构已经在做统一的投递状态管理：

- 渠道投递创建 `notification_deliveries`；
- 状态在 `pending/sent/delivered/failed` 之间流转；
- 严格模式下还支持 ACK 与重试；
- 短信、腾讯推送都已有回调闭环。

语音通知目前没有进入这套闭环，架构上存在明显缺口：

- 无法统一统计各渠道成功率；
- 无法统一查看某条通知的全渠道时间线；
- 无法统一做失败重试和兜底；
- 无法支撑后续运营面板或审计需求。

### 2. 语音链路当前缺少最终一致性来源

在分布式通知系统里，“接口调用成功”通常只是中间状态，不是最终状态。

对于语音通知，最终状态应来自以下两类之一：

- 阿里云推送的异步回调；
- 业务侧主动查询呼叫明细。

其中，**回调更适合作为默认主链路**，因为它成本更低、实时性更好，也更符合现有短信/推送的架构模式。

### 3. 不接回调会导致后续能力都要靠“猜”

不接回调时，系统只能基于下面这些弱信号推断状态：

- 阿里云接口是否返回 `OK`
- 是否拿到 `callId`
- 订单后续是否被接单

这三者都不能直接代表“通知送达成功”。这会让重试、兜底、告警、数据报表都变得不可靠。

## 方案级别

### 最小可行方案（建议先做）

接入阿里云 `VoiceReport` 回调，并新增一个公开接口，例如：

`POST /api/notifications/voice/callback`

接口职责：

- 接收阿里云语音回执；
- 解析 `outId` / `callId`；
- 根据状态码更新语音投递状态；
- 记录原始回调上下文；
- 必要时触发短信或其他补救逻辑；
- 快速返回成功响应，避免阿里云重复重试。

### 第二阶段（可选）

如果后续需要更细的过程观测，再补 `VoiceCallReport`：

- 区分振铃、接听、挂断等中间状态；
- 支撑更实时的监控看板；
- 支撑“振铃后无人接听”和“根本没有呼通”这类更细的产品判断。

## 推荐的数据与状态设计

建议不要只打印日志，至少把语音也纳入通知投递记录体系。推荐记录：

- `notificationId`
- `targetId`
- `channel=voice` 或语音扩展字段
- `outId`
- `callId`
- `status`
- `lastError`
- `deliveredAt`
- `context.voiceReport`
- `context.voiceCallReport`
- 原始回调 payload

如果暂时不想扩展现有 `notification_channel` 枚举，也至少应新增一张独立语音投递表，避免状态信息只存在日志里。

## 推荐的业务判定边界

需要明确两个概念不要混用：

- **通知成功**：语音已被阿里云处理并产生明确结果，例如已接通、已播放、已失败。
- **业务成功**：服务人员真正接单、ACK 或在业务时限内响应。

语音回调解决的是“通知链路状态”，不是“业务状态”。

## 不接回调的情况下，当前方案还能否上线

可以上线，但需要接受以下限制：

- 只能证明“语音接口调用成功”，不能证明“提醒真正触达”；
- 无法可靠地做失败自动补救；
- 无法沉淀准确的语音成功率报表；
- 排障时只能看应用日志和阿里云控制台；
- 后续若要做运营可视化，仍然要返工补闭环。

因此：

- **测试环境 / 小范围验证**：可以先不接回调。
- **正式生产 / 强提醒场景**：建议接回调。

## 实施建议

### 建议按以下顺序推进

1. 新增文档化的语音回调 DTO、Controller、Service。
2. 先接 `VoiceReport`，做幂等处理。
3. 将回调结果落库到统一通知体系或独立语音投递表。
4. 基于最终状态补充短信兜底或二次提醒策略。
5. 如有必要，再补 `VoiceCallReport` 做更细粒度过程跟踪。

### 实现注意点

- 回调接口必须公开访问，但要补充来源校验、字段校验与幂等处理。
- 处理逻辑要尽量快，避免超时导致阿里云重复推送。
- 回调 payload 建议完整保留到 `context`，方便后续排障。
- 若使用 `outId` 关联业务，必须保证生成规则稳定且可解析。
- 若后续要把语音纳入统一渠道体系，需要同步扩展类型定义、枚举和监控指标。

## 与当前代码的对应关系

- 语音发起封装：`apps/backend/src/common/voice/voice.service.ts`
- 新订单自动语音触发：`apps/backend/src/modules/notification/notification-voice-call.service.ts`
- 常规通知调度入口：`apps/backend/src/modules/notification/notification.dispatcher.ts`
- 腾讯推送回调参考：`apps/backend/src/modules/notification/tencent-push-callback.controller.ts`、`apps/backend/src/modules/notification/tencent-push-callback.service.ts`
- 短信回调参考：`apps/backend/src/modules/notification/sms-callback.controller.ts`、`apps/backend/src/modules/notification/sms-callback.service.ts`

## 最终建议

对于当前“新订单分配后给服务人员发语音提醒”的业务场景，语音通知具备明显的强时效特征，因此建议将阿里云语音回调视为**正式生产闭环的一部分**。

推荐优先级判断如下：

- 想先验证语音能力是否可用：可以暂不接回调。
- 想把语音作为正式通知链路：应接回调。
- 想做可靠统计、兜底补救、运营复盘：必须接回调。

## 参考链接

- 阿里云 `SingleCallByTts` API
  - <https://help.aliyun.com/zh/vms/developer-reference/api-dyvmsapi-2017-05-25-singlecallbytts>
- 阿里云语音通知 / 语音验证码快速开始
  - <https://help.aliyun.com/zh/vms/getting-started/through-the-api-or-sdk-using-voice-notification-or-audio-captcha>
- 阿里云回执消息说明与配置流程
  - <https://help.aliyun.com/zh/vms/developer-reference/return-receipt-message-description-and-configuration-process>
- 阿里云 `VoiceReport` 数据结构
  - <https://help.aliyun.com/zh/vms/voicereport-6>
- 阿里云 `VoiceCallReport` 数据结构
  - <https://help.aliyun.com/zh/vms/developer-reference/voicecallreport-3>
- 阿里云 HTTP 批量推送模式说明
  - <https://help.aliyun.com/zh/vms/developer-reference/http-batch-delivery-mode-1>
