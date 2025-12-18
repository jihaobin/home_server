import { Injectable, Logger } from '@nestjs/common';

import type {
    NotificationCommand,
    NotificationEventPayload,
    NotificationTargetDescriptor,
    NotificationTargetType,
} from '@repo/types';

import {
    NotificationRepository,
    type NormalizedNotificationTarget,
} from './notification.repository';
import { NotificationMetricsService } from './notification-metrics.service';

@Injectable()
export class NotificationPublisher {
    private readonly logger = new Logger(NotificationPublisher.name);

    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly metrics: NotificationMetricsService,
    ) {}

    async publish(
        command: NotificationCommand<NotificationEventPayload>,
    ): Promise<string | undefined> {
        if (!command?.event) {
            this.logger.warn('忽略缺少 event 的通知载荷');
            return;
        }

        const payload = this.buildPayload(command);
        const targets = this.normalizeTargets(command, payload);
        try {
            const result = await this.notificationRepository.createNotification(
                { ...command, payload },
                targets,
            );
            this.metrics.recordPublishedEvent(payload.event, targets.length);
            return result.notificationId;
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error('写入通知失败', message);
            throw error;
        }
    }

    private buildPayload(
        command: NotificationCommand<NotificationEventPayload>,
    ): NotificationEventPayload {
        const payload: NotificationEventPayload = {
            ...command.payload,
        };
        if (!payload.event) {
            payload.event = command.event;
        }
        if (!payload.triggeredAt) {
            payload.triggeredAt = new Date().toISOString();
        }
        return payload;
    }

    private normalizeTargets(
        command: NotificationCommand<NotificationEventPayload>,
        payload: NotificationEventPayload,
    ): NormalizedNotificationTarget[] {
        const resolvedTargets =
            command.targets && command.targets.length
                ? command.targets
                : this.inferTargetsFromPayload(payload);

        return resolvedTargets.map((target) => {
            const targetId =
                target.targetId ??
                target.userId ??
                payload.userId ??
                payload.targetId ??
                payload.orderId ??
                command.event;
            const targetType = this.inferTargetType(target, payload);
            const normalized: NormalizedNotificationTarget = {
                ...target,
                targetId,
                targetType,
            };
            return normalized;
        });
    }

    private inferTargetType(
        target: NotificationTargetDescriptor,
        payload: NotificationEventPayload,
    ): NotificationTargetType {
        if (target.userId || payload.userId) {
            return 'user';
        }
        return 'custom';
    }

    private inferTargetsFromPayload(
        payload: NotificationEventPayload,
    ): Array<
        NotificationTargetDescriptor & { targetType: NotificationTargetType }
    > {
        if (payload.userId) {
            return [
                {
                    targetId: payload.userId,
                    userId: payload.userId,
                    targetType: 'user',
                },
            ];
        }
        if (payload.targetId) {
            return [
                {
                    targetId: payload.targetId,
                    targetType: 'custom',
                },
            ];
        }
        return [
            {
                targetId: payload.orderId ?? payload.event,
                targetType: 'custom',
            },
        ];
    }
}
