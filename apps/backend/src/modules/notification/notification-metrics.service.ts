import { Injectable } from '@nestjs/common';
import {
    Counter,
    Gauge,
    Registry,
    collectDefaultMetrics,
    register,
} from 'prom-client';

interface DeliveryMetricOptions {
    event?: string;
    isRetry?: boolean;
}

type RetryReason = 'failed' | 'timeout' | 'stuck';

@Injectable()
export class NotificationMetricsService {
    private static metricsInitialized = false;
    private readonly registry: Registry;
    private readonly eventCounter: Counter<'event'>;
    private readonly deliveryResultCounter: Counter<
        'channel' | 'status' | 'retry'
    >;
    private readonly retryCounter: Counter<'channel' | 'reason'>;
    private readonly outboxGauge: Gauge<'type'>;
    private readonly failureGauge: Gauge<'type'>;

    constructor() {
        this.registry = register;
        if (!NotificationMetricsService.metricsInitialized) {
            collectDefaultMetrics({ register: this.registry });
            NotificationMetricsService.metricsInitialized = true;
        }

        this.eventCounter = new Counter({
            name: 'notification_events_published_total',
            help: '通知发布数量',
            labelNames: ['event'],
            registers: [this.registry],
        });

        this.deliveryResultCounter = new Counter({
            name: 'notification_delivery_results_total',
            help: '通知各渠道投递结果统计',
            labelNames: ['channel', 'status', 'retry'],
            registers: [this.registry],
        });

        this.retryCounter = new Counter({
            name: 'notification_delivery_retries_total',
            help: '通知重试次数',
            labelNames: ['channel', 'reason'],
            registers: [this.registry],
        });

        this.outboxGauge = new Gauge({
            name: 'notification_outbox_backlog',
            help: 'Outbox 队列堆积数量',
            labelNames: ['type'],
            registers: [this.registry],
        });

        this.failureGauge = new Gauge({
            name: 'notification_delivery_failures',
            help: '通知失败/待重试数量',
            labelNames: ['type'],
            registers: [this.registry],
        });
    }

    recordPublishedEvent(event: string | undefined, targets = 1) {
        if (!event) {
            return;
        }
        this.eventCounter.inc({ event }, Math.max(1, targets));
    }

    recordDeliveryResult(
        channel: string,
        status: string,
        options?: DeliveryMetricOptions,
    ) {
        this.deliveryResultCounter.inc(
            {
                channel,
                status,
                retry: options?.isRetry ? '1' : '0',
            },
            1,
        );
    }

    recordRetryScheduled(channel: string, reason: RetryReason) {
        this.retryCounter.inc({ channel, reason });
    }

    updateOutboxBacklog(type: string, value: number) {
        this.outboxGauge.set({ type }, Math.max(0, value));
    }

    updateFailureGauge(type: string, value: number) {
        this.failureGauge.set({ type }, Math.max(0, value));
    }

    async getMetricsSnapshot() {
        return this.registry.metrics();
    }

    getContentType() {
        return this.registry.contentType;
    }
}
