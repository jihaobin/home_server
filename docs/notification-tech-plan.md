# 通知模块技术方案与实施计划

## 背景

- 订单模块当前将事件写入 `stream:order-notify`，由 `OrderNotifyRelayService` 推送给后台 SSE。功能范围有限，不易复用，也难以支持服务人员 App 等多终端。
- 新需求要求在服务人员 App 端接收“新订单”“接单/拒单结果”等通知，后续还可能扩展更多业务事件与渠道。
- 目标是建设一个通用通知模块，面向接口配置多渠道，保证实时、高可靠、可扩展。

## 目标

1. 将通知能力解耦为独立模块，通过接口对上层业务透明。
2. 支持多渠道（应用内 SSE/WS、腾讯云消息推送、短信等）并可按用户偏好/在线状态自动选择并兜底。
3. 保证通知可追踪（投递日志、ACK、重试）、可监控，并具备高性能与实时性。

## 技术方案概览

### 架构

```
业务服务 -> NotificationPublisher -> OutboxTable -> OutboxRelay -> Redis Stream -> NotificationWorker
                                                       |
                                               NotificationDispatcher
                                               /     |      \
                                         SSE/WS   腾讯云推送   SMS ...
```

- **NotificationPublisher**：业务方注入该服务，提交 `NotificationCommand`。Publisher 仅在业务事务内写 `notifications`、`notification_targets` 以及 `notification_outbox`，不再尝试同步写 Redis，避免跨存储事务问题。
- **OutboxRelay**：守护进程定期扫描 `notification_outbox`，将未发送记录写入 Redis Stream（新命名 `stream:notifications`，迁移期可与旧 Stream 并行），成功后将记录标记为 `sent=true`。
- **Redis Stream + Worker**：沿用既有 ioredis 客户端模型，消费组保证消息不丢。Worker 最小化职责：消费 Stream → 解析成 `NotificationContext` → 调用 Dispatcher → ACK。
- **NotificationDispatcher**：依据 `NotificationPreferenceService` 输出的渠道计划 + Redis 在线状态，按优先级调用各 Channel，并记录投递结果。失败则按策略重试或切换渠道。
- **Channels**：实现统一 `NotificationChannel` 接口。首批实现：
  - `InAppChannel`：复用 `OrderNotifySseService`，迁入通知模块，支持多事件类型、Last-Event-ID 续播。
  - `TencentCloudPushChannel`：对接腾讯云消息推送（信鸽/TPNS），用于 App 在后台或未启动时通过厂商通道送达。
  - `SmsChannel`：复用 `apps/backend/src/common/sms/sms.service.ts`。
  - 后续可新增 Email、电话等渠道，模块接口保持不变。
- **渠道调度策略**：
  - 服务人员 App 在前台时优先使用应用内推送（WebSocket），若异常则直接降级到短信通知。
  - App 在后台或未启动时跳过应用内推送，直接调用腾讯云消息推送服务，若仍失败则同样由短信兜底，确保任何状态都能收到通知。
- **客户端在线状态与 ACK**：
  - App 前台建立 SSE/WS 连接，并通过心跳接口写入 `online:service:<userId>`，建议心跳 15s 一次、TTL 45s，降低误判。
  - Payload 包含 `eventId` 与 `deliveryMode`。`deliveryMode='strict'` 的通知需要客户端 `POST /notifications/ack` 更新 `notification_deliveries` 表；`deliveryMode='best-effort'` 则可不等待 ACK，简化弱通知流程。

## 数据结构

建议在 `apps/backend/drizzle` 中新增：

- `notifications`：事件主表（id、event、payload、priority、created_at、status）。
- `notification_targets`：通知目标（notification_id、target_type、target_id、metadata）。
- `notification_deliveries`：渠道投递日志（notification_id、channel、status、attempts、last_error、delivered_at、ack_at、delivery_id）。`delivery_id` 建议按 `${notification_id}:${target_id}:${channel_type}:${attempt_index}` 生成，用于去重、追踪与仪表盘统计。
- `notification_outbox`：Outbox 队列表（notification_id、retry_count、locked_at、sent）。
- `notification_preferences`：用户偏好及渠道计划缓存。

## 模块接口示例

```ts
export interface NotificationCommand<TPayload = unknown> {
    event: string;
    targets: NotificationTarget[];
    payload: TPayload;
    priority?: 'high' | 'normal' | 'low';
    metadata?: Record<string, string>;
    fallbackPlan?: NotificationPlan;
    deliveryMode?: 'strict' | 'best-effort';
    traceLevel?: 'none' | 'minimal' | 'full';
}

export interface NotificationChannel {
    readonly type: NotificationChannelType;
    isAvailable(target: NotificationTarget): Promise<boolean>;
    send(ctx: NotificationContext): Promise<NotificationResult>;
}
```

业务模块仅需构造 `NotificationCommand`，其余职责由通知模块处理。`NotificationPreferenceService` 可根据用户配置、事件类型、上下文环境 `metadata` 输出渠道执行计划，如：

```json
[
  { channel: 'in_app', when: 'online' },
  { channel: 'tencent_cloud_push', when: 'offline' },
  { channel: 'sms' }
]
```

Dispatcher 将按计划执行，并动态跳过被用户禁用的渠道或根据 `deliveryMode` 决定是否等待 ACK。
`traceLevel` 可控制监控粒度：`full` 记录详细时间线、`minimal` 只记录关键节点、`none` 用于无需写日志的弱通知。

## 实施计划

1. **基础设施**
   - 编写 Drizzle migration，创建上述表并同步 `packages/types` 中的类型定义。
   - 在 `apps/backend/src/modules/notification` 下实现 `NotificationModule`，导出 Publisher、Dispatcher、Channel Registry。
   - 落地 `notification_outbox` 表 + `OutboxRelay`（可通过 `ScheduleModule` 或独立 worker）扫描未发送记录并推进到 Redis Stream。OutboxRelay 执行批处理（例如每次拉取 50 条）、在处理前写 `locked_at` 并设置 `lock_owner`，超过 10 秒未释放则自动恢复；写 Redis 时使用 pipeline/批量命令提升吞吐。

2. **事件流迁移**
   - 将 `OrderNotifySseService`、`OrderNotifyRelayService` 移入通知模块并泛化，Stream 名称过渡到 `stream:notifications`。
   - 在 `OrderService` 等处用 `NotificationPublisher` 替换直接 `xAdd` 至 `OrderExpireRedisKeys.notifyStream` 的逻辑。旧 key 可以先继续写入，待客户端切换后彻底移除。
   - OutboxRelay 成功推送后更新 `notification_outbox.sent=true`，确保“DB 提交成功 + Redis 写成功”才算完成。Redis Stream 的消费者组建议统一命名（如 `group:notification-dispatcher`，consumer 为 `worker-${instanceId}`），方便水平扩展与 Pending 队列治理。

3. **渠道实现**
   - `InAppChannel`：基于现有 SSE/WS，支持多 event type、Last-Event-ID、心跳。
   - `TencentCloudPushChannel`：连接腾讯云消息推送服务（TPNS），映射应用在后台/未启动时使用的厂商通道，未配置凭证时返回 `unavailable`。
   - `SmsChannel`：封装 `SmsService`，做好限流与错误映射。
   - 为确保渠道模块循序落地，当前拆分的阶段性子任务如下：
     1. 梳理通知调度所需的核心类型与 Dispatcher/Channel Registry 骨架，统一四类渠道的接入契约。
     2. 扩展现有 SSE 能力（多目标缓冲、Last-Event-ID、心跳），并据此实现 InAppChannel。
     3. 实现 TencentCloudPushChannel 的占位版本，封装腾讯云推送 token/厂商 channel 映射，未开通时返回 `unavailable`。
     4. 实现 SmsChannel 的占位版本，复用短信服务并统一限流与错误处理。
     5. 将上述渠道注册进 NotificationModule 与 Dispatcher，联通 Redis Stream Worker，并补充必要测试与文档。

4. **客户端改造**
   - 服务人员 App（`apps/mobile-worker`）新增通知订阅：前台建立 SSE，收到新订单等事件时刷新列表或提示；后台/离线依赖 push/sms。
   - 实现 ACK 接口调用及心跳上报逻辑，确保服务端可判定在线状态、消息送达成功。心跳建议 15s，一旦 App 退到后台需立即关闭 SSE 并依赖其他渠道。

5. **监控与重试**
   - 在通知模块中暴露 Prometheus 指标（事件量、投递成功率、重试次数），通过 `/notifications/metrics` 提供抓取入口，并在 Publisher/Dispatcher/重试逻辑中统一上报。
   - 利用 `ScheduleModule` 编写重试任务：扫描 `notification_deliveries` 中失败/超时记录，决定二次投递或进入 DLQ；同时 OutboxRelay 需处理卡住的 outbox 记录（基于 `locked_at`），并同步刷新 Outbox/失败堆积指标。
   - 后续仍需将指标接入告警/仪表盘，并根据实际压测结果调优批次及并发度。

6. **推广 & 清理**
   - 逐步让其他业务（支付、签到、客服消息等）接入 `NotificationPublisher`。
   - 清理旧的订单专用通知代码，确保所有事件都通过通用模块流转。

### 实施进度（截至 2025-12-11）

1. **基础设施**：✅ 完成
   - Drizzle schema、`packages/types` 类型、新的 `NotificationModule`/Publisher/SSE/Relay 已落地并合入主模块。
2. **事件流迁移**：✅ 完成
   - 订单模块已改为调用 `NotificationPublisher`，Redis Stream 统一为 `stream:notifications`，旧 `OrderNotify*` 服务删除。
3. **渠道实现**：✅ 完成  
   - NotificationDispatcher + PreferenceService 已上线，可按“前台 InApp → 后台腾讯云推送 → 短信兜底”的链路调度渠道，并写入 `notification_deliveries`；腾讯云推送/Sms 目前为占位实现，等待绑定真实凭证。
4. **客户端改造**：🕒 进行中  
   - 管理端与服务端 App 均已迁移到 `useNotificationSocket` Hook，基于 `socket.io-client` 建立 WebSocket 长连并定时发送心跳，在前台即可实时刷新工单列表。
   - 移动端整合了腾讯云推送 SDK、AppState 切换和 `notifications:client` Offline 信令，后台或被系统杀掉时仍由离线推送兜底。
   - 仍待落地：严格通知的 `/notifications/ack` 调用、预约/提醒类事件的服务端调度逻辑，以及 ACK/心跳接口在客户端文档中的示例说明。
5. **监控与重试**：🕒 进行中
   - 已上线 `NotificationMetricsService` + `/notifications/metrics`，覆盖事件发布量、各渠道投递结果、重试次数以及 Outbox/失败堆积指标；`NotificationRetryService` 每分钟扫描失败投递与严格模式 ACK 超时记录，并恢复过期 Outbox 锁后触发重试。
   - 待办：将指标接入统一监控告警、根据实际运行数据调优批次大小/锁策略，并对重试结果做运营可视化。
6. **推广 & 清理**：未启动
   - 需要在渠道与监控闭环后逐步接入更多业务。

## 成功标准

- 服务人员新订单可在 App 前台 1 秒内收到通知，后台/离线可通过推送/短信收到。
- 通知投递状态可查询、可追踪，失败会自动切换渠道且有日志。
- 新增通知场景无需修改核心业务代码，只需调用统一接口。
