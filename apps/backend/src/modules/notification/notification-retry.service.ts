import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';

import type {
    NotificationChannelPlanItem,
    NotificationEventPayload,
} from '@repo/types';
import type { NotificationMetadata } from 'src/common/database/schema/notifications';

import {
    NotificationRepository,
    type DeliveryWithRelations,
    type NotificationTargetRecord,
} from './notification.repository';
import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationMetricsService } from './notification-metrics.service';

type RetryReason = 'failed' | 'timeout';

@Injectable()
export class NotificationRetryService {
    private readonly logger = new Logger(NotificationRetryService.name);
    // 单次失败后需要等待的冷却时间
    private readonly retryDelayMs = 60_000;
    // 发送成功但未收到 ACK 的超时时间
    private readonly ackTimeoutMs = 120_000;
    // 每条投递的最大重试次数
    private readonly maxRetryPerDelivery = 3;
    // 查询数据库时 attempt 字段的安全上限，避免溢出
    private readonly deliveryAttemptUpperBound = this.maxRetryPerDelivery + 1;
    // 单次扫描批处理的最大投递数量
    private readonly retryBatchSize = 50;
    // Outbox 锁超过该时间未释放则视为失效
    private readonly outboxLockTimeoutMs = 10_000;

    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly dispatcher: NotificationDispatcher,
        private readonly metrics: NotificationMetricsService,
    ) {}

    @Cron(CronExpression.EVERY_MINUTE)
    async handleRetrySweep() {
        await this.retryFailedDeliveries();
        await this.retryAckTimeouts();
        await this.recoverOutboxLocks();
        await this.refreshGauges();
    }

    private async retryFailedDeliveries() {
        const threshold = new Date(Date.now() - this.retryDelayMs);
        const deliveries =
            await this.notificationRepository.findDeliveriesForRetry({
                statuses: ['failed'],
                olderThan: threshold,
                maxAttempts: this.deliveryAttemptUpperBound,
                limit: this.retryBatchSize,
            });
        for (const delivery of deliveries) {
            await this.retryDelivery(delivery, 'failed');
        }
    }

    private async retryAckTimeouts() {
        const threshold = new Date(Date.now() - this.ackTimeoutMs);
        const deliveries =
            await this.notificationRepository.findPendingAckDeliveries({
                olderThan: threshold,
                maxAttempts: this.deliveryAttemptUpperBound,
                limit: this.retryBatchSize,
            });
        for (const delivery of deliveries) {
            if (delivery.notification?.deliveryMode !== 'strict') {
                continue;
            }
            await this.retryDelivery(delivery, 'timeout');
        }
    }

    private async retryDelivery(
        delivery: DeliveryWithRelations,
        reason: RetryReason,
    ) {
        if (!delivery.notification || !delivery.target) {
            return;
        }
        const payload = (delivery.notification.payload ??
            {}) as NotificationEventPayload;
        const currentRetry = this.extractRetryCount(delivery.context);
        if (currentRetry >= this.maxRetryPerDelivery) {
            await this.archiveDeliveryContext(delivery, currentRetry, reason);
            return;
        }
        const nextRetry = currentRetry + 1;
        const newDeliveryId = `${delivery.deliveryId}:r${nextRetry}`;
        const planItem = this.findPlanItem(delivery.target, delivery.channel);
        this.metrics.recordRetryScheduled(delivery.channel, reason);
        await this.dispatcher.dispatchSingleChannel({
            notification: delivery.notification,
            target: delivery.target,
            channel: delivery.channel,
            planItem,
            payloadOverride: payload,
            attempt: delivery.attempt + nextRetry,
            deliveryId: newDeliveryId,
            isRetry: true,
        });
        await this.archiveDeliveryContext(delivery, nextRetry, reason);
    }

    private async recoverOutboxLocks() {
        const released =
            await this.notificationRepository.releaseStaleOutboxLocks(
                this.outboxLockTimeoutMs,
            );
        if (released > 0) {
            this.logger.log(`释放 ${released} 条过期通知 Outbox 锁`);
        }
    }

    private async refreshGauges() {
        const [outboxCount, failedCount] = await Promise.all([
            this.notificationRepository.countPendingOutbox(),
            this.notificationRepository.countDeliveriesByStatus(['failed']),
        ]);
        this.metrics.updateOutboxBacklog('pending', outboxCount);
        this.metrics.updateFailureGauge('failed', failedCount);
    }

    private extractRetryCount(context?: NotificationMetadata | null): number {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            return 0;
        }
        const retry = this.toRecord((context as Record<string, unknown>).retry);
        const rawCount = retry.count;
        if (typeof rawCount === 'number' && Number.isFinite(rawCount)) {
            return rawCount;
        }
        return 0;
    }

    private findPlanItem(
        target: NotificationTargetRecord,
        channel: NotificationChannelPlanItem['channel'],
    ): NotificationChannelPlanItem | undefined {
        if (!Array.isArray(target.channelPlan)) {
            return undefined;
        }
        const plan = target.channelPlan;
        return plan.find((item) => item.channel === channel);
    }

    private async archiveDeliveryContext(
        delivery: DeliveryWithRelations,
        retryCount: number,
        reason: RetryReason,
    ) {
        const context = this.cloneContext(delivery.context);
        const retryContext = this.toRecord(context.retry);
        retryContext.archived = true;
        retryContext.count = retryCount;
        retryContext.reason = reason;
        retryContext.lastRetryAt = new Date().toISOString();
        retryContext.lastDeliveryId = delivery.deliveryId;
        context.retry = retryContext;
        await this.notificationRepository.updateDeliveryLog(
            delivery.deliveryId,
            {
                context,
            },
        );
    }

    private cloneContext(
        context: NotificationMetadata | null | undefined,
    ): NotificationMetadata {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            return {};
        }
        return { ...context };
    }

    private toRecord(value: unknown): Record<string, any> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...(value as Record<string, any>) };
    }
}
