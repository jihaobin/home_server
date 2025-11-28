# 订单支付超时 Redis 延迟队列方案（优化预研）

> 本文档记录“Redis ZSET（延迟） + Redis Stream（可靠投递）”方案的整体设计与实施要点，用于未来需要将现有 Cron + 数据库轮询的超时处理升级为更实时、可横向扩展的架构时参考。

## 一、改造动机

- 现状：订单创建后依赖数据库 `payment_expires_at` + Cron 任务批量扫描并更新状态，粒度在分钟级，且事件无法即时通知其它模块。
- 目标：在不引入额外消息中间件的前提下，利用 Redis 的 ZSET 和 Stream 能力，实现亚秒级的过期感知、可靠分发以及多消费者扩展能力，为后续 WebSocket/推送和事件驱动治理打基础。

## 二、总体架构

```
Order API -> Redis ZSET (order:payment-expire)
    |
    | 1. 写入 score = expiresAt
    v
扫描器 Worker
    |
    | 2. BZPOPMIN / ZPOPMIN 到期订单
    v
Redis Stream order-expired-stream
    |
    | 3. XADD {orderId, expiresAt, attempt}
    v
订单过期消费者组
    |
    | 4. XREADGROUP -> 业务处理（DB、补偿）
    v
通知 Stream order-notify-stream
    |
    | 5. XADD -> 下游（WS、推送、日志）
```

## 三、数据结构设计

| 名称 | 类型 | Key 示例 | Value/Score | 说明 |
| --- | --- | --- | --- | --- |
| `order:payment-expire` | ZSET | 固定 | `score=expiresAt (unix ms)`，`member=orderId` | 延迟队列，支持重复写时用 ZADD NX/XX |
| `order-expired-stream` | Stream | `stream:order-expired` | `orderId`, `expiresAt`, `attempt` | 可靠投递，支持消费者组 |
| `order-notify-stream` | Stream | `stream:order-notify` | `event=order_payment_expired`, `orderId`, `message` | 提供给通知中心或 WebSocket |
| `order-expired-dlq` | Stream | `stream:order-expired-dlq` | 原始 payload + `error` | 处理失败超过 N 次的死信 |

## 四、核心模块

### 1. 延迟写入（订单创建/支付后）

```ts
await redisClient.zadd(
    'order:payment-expire',
    Date.parse(paymentExpiresAt.toISOString()),
    orderId,
);
```

- 同步写入 `orders.payment_expires_at`，保证 DB 仍是最终一致来源。
- 若订单取消/支付完成，需在业务流程中 `ZREM order:payment-expire orderId`。

### 2. 扫描器（Delay Scanner）

- 单独 Nest Provider 或独立 worker 进程，启动后循环：
    1. `BZPOPMIN order:payment-expire 1000`（或 `ZPOPMIN` + sleep）拉取最早的订单；
    2. 若 `score > now`，说明未到期：`ZADD` 回去并 `await delay(score-now)`；
    3. 到期则 `XADD stream:order-expired * orderId ...`，并标记 `attempt=1`；
    4. 支持 `graceful shutdown`：通过 `AbortController`/`onModuleDestroy` 终止循环。
- 高可靠：可使用 `SETNX lock:order-expire-scanner` + TTL，确保只有一个扫描器在处理；崩溃后锁超时自动转移。

### 3. 订单过期消费者（OrderExpirationWorker）

- 创建消费者组 `XGROUP CREATE stream:order-expired order-expired-group $ MKSTREAM`。
- 处理流程：
    1. `XREADGROUP GROUP group consumer BLOCK 5000 COUNT N STREAMS stream:order-expired >`
    2. 对每条消息执行：
        - `SELECT ... FOR UPDATE` 校验订单仍为 `pending_payment` 且 `payment_expires_at <= now`;
        - `UPDATE orders SET status='cancelled', cancel_reason='payment_timeout', ...`;
        - 标记最新支付记录为 `failed`；
        - `XADD stream:order-notify ...` 派发通知；
    3. 成功后 `XACK stream:order-expired group msgId`，必要时 `XDEL`。
- 错误处理：
  - 业务失败：`XACK` 前先判断 `attempt < MAX_RETRY`，若未超限则 `XADD` 回 stream 并 `attempt++`。
  - 超过阈值：`XACK` 原消息，`XADD stream:order-expired-dlq` 并写整合日志+告警。
- Backoff：对重试消息增加 `retry_delay = baseDelay * attempt^2`，可通过 `setTimeout` 及二次 `XADD`。

### 4. 通知消费者

- `order-notify-stream` 设计轻量：只携带事件类型、订单 ID、触发时间。
- 可由 WebSocket 服务、消息推送、日志 alerter 等形成多个消费者组，互不干扰。

## 五、可靠性 & 运维要点

| 需求 | 对应措施 |
| --- | --- |
| 阻塞式读取 | `BZPOPMIN` / `XREADGROUP ... BLOCK`，减少空转 |
| 错误保护 | DB 操作包裹事务，失败进入重试或 DLQ；Stream 消息只有在最终成功或进入 DLQ 时才 `XACK` |
| Backoff | 在重试时按指数退避（例如 200ms, 800ms, 3.2s）避免风暴 |
| Graceful Shutdown | 使用 Nest `OnModuleDestroy`/`beforeApplicationShutdown`，先标志 `running=false`，等待循环退出后关闭 Redis |
| 监控 | 关键指标：`ZSET size`, `Pending entries (XPENDING)`, `DLQ size`, `平均处理耗时`；可接入 Prometheus & 日志 |
| 重启恢复 | Stream 天生持久化，消费者重启后读取 Pending Entries。延迟扫描器重新从 ZSET 读取即可 |

## 六、实施步骤（推荐顺序）

1. **封装 Redis 能力**：在 `IoRedisCacheService` 内新增对 ZSET、Stream 常用指令的 Promise API，避免业务自行处理序列化。
2. **搭建 Delay Scanner**：
    - 编写 `OrderExpireScheduler`，注入 Redis 客户端；
    - 实现单实例锁、`BZPOPMIN` 循环、回写 Stream。
3. **实现 Expiration Worker**：
    - 使用 `@Processor`（BullMQ）或自定义 `OrderExpireConsumer`；
    - 完成事务更新 + Stream ack + 通知；
    - 配置 Backoff 与 DLQ。
4. **通知链路**：定义 `order-notify-stream` 消息 schema，并在 WebSocket/推送侧实现消费。
5. **灰度 & 回退**：
    - 初期保留旧 Cron 任务作为兜底（只记录日志不更新）；
    - 核验新链路稳定后再关闭 Cron。
6. **文档 & 监控**：完善 Runbook（启动/停止、常见报警处理、如何手工 ack 等），为 DevOps 提供操作指引。

## 七、接口与代码骨架

```ts
// 1. 添加订单
await orderRepository.create(...);
await redisCache.zadd('order:payment-expire', expiresAtMs, orderId);

// 2. 扫描器
while (!shouldStop) {
    const entry = await redisCache.bzpopmin('order:payment-expire', 1000);
    if (!entry) continue;
    const [key, member, score] = entry;
    if (Number(score) > Date.now()) {
        await redisCache.zadd(key, score, member);
        await delay(score - Date.now());
        continue;
    }
    await redisCache.xadd('stream:order-expired', '*', {
        orderId: member,
        expiresAt: new Date(Number(score)).toISOString(),
        attempt: 1,
    });
}

// 3. 消费者
const messages = await redisCache.xreadgroup(
    'order-expired-group',
    consumerId,
    { key: 'stream:order-expired', id: '>' },
    { block: 5000, count: 10 },
);
```

## 八、未来扩展

- **多类型任务**：同一套 ZSET + Stream 还可复用到“优惠券过期、活动结束提醒”等场景，需在消息体中加入 `eventType`。
- **可视化运维**：可用 `redis-streams-ui` 或自建仪表盘查看 pending/dead-letter。
- **高可用**：若延迟要求更严格，可考虑 Measured Timer（例如 Redis Gears、Keyspace Notification）或直接引入专业延迟队列服务（如 RabbitMQ x-delayed-message、RocketMQ 延迟消息）。

---

本方案尚未纳入当前生产实现；如需上线，请先完成 PoC、压测与风险评估，并结合业务节奏决定切换窗口。
