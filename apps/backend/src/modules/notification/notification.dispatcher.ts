import { Inject, Injectable, Logger } from '@nestjs/common';
import type {
    NotificationChannel as NotificationChannelType,
    NotificationChannelContext,
    NotificationChannelPlanItem,
    NotificationChannelResult,
    NotificationEventPayload,
    NotificationTargetDescriptor,
    NotificationDeliveryStatus,
    NotificationDeliveryMode,
} from '@repo/types';

import { NOTIFICATION_CHANNELS } from './notification.constants';
import type { NotificationChannel } from './channels/notification-channel.interface';
import { NotificationRepository } from './notification.repository';
import { NotificationPreferenceService } from './notification-preference.service';
import {
    notificationTargets,
    notifications,
} from 'src/common/database/schema/notifications';
import { NotificationPresenceService } from './notification-presence.service';
import { NotificationMetricsService } from './notification-metrics.service';

interface TargetDispatchResult {
    targetId: string;
    results: NotificationChannelResult[];
}

export interface NotificationDispatchSummary {
    notificationId?: string;
    targetResults: TargetDispatchResult[];
}

interface DispatchSingleChannelParams {
    notification: NotificationRecord;
    target: NotificationTargetRecord;
    channel: NotificationChannelType;
    planItem?: NotificationChannelPlanItem;
    payloadOverride?: NotificationEventPayload;
    attempt?: number;
    deliveryId?: string;
    deliveryIdSuffix?: string;
    isRetry?: boolean;
}

@Injectable()
export class NotificationDispatcher {
    private readonly logger = new Logger(NotificationDispatcher.name);
    private readonly registry = new Map<
        NotificationChannelType,
        NotificationChannel
    >();

    constructor(
        @Inject(NOTIFICATION_CHANNELS)
        channels: NotificationChannel[],
        private readonly notificationRepository: NotificationRepository,
        private readonly preferenceService: NotificationPreferenceService,
        private readonly presenceService: NotificationPresenceService,
        private readonly metrics: NotificationMetricsService,
    ) {
        for (const channel of channels) {
            this.registry.set(channel.type, channel);
        }
    }

    async dispatch(
        payload: NotificationEventPayload,
    ): Promise<NotificationDispatchSummary> {
        if (!payload.notificationId) {
            this.logger.warn('缺少 notificationId，跳过调度');
            return { notificationId: undefined, targetResults: [] };
        }
        const notification =
            await this.notificationRepository.getNotificationWithTargets(
                payload.notificationId,
            );
        if (!notification) {
            this.logger.warn(
                `未找到通知记录: ${payload.notificationId}, event=${payload.event}`,
            );
            return {
                notificationId: payload.notificationId,
                targetResults: [],
            };
        }

        await this.notificationRepository.markDispatching(notification.id);
        const basePayload = this.buildBasePayload(notification, payload);

        const summary: NotificationDispatchSummary = {
            notificationId: notification.id,
            targetResults: [],
        };
        let hasSuccess = false;

        for (const target of notification.targets ?? []) {
            const plan = await this.preferenceService.resolvePlan(target);
            const targetResults = await this.dispatchToTarget(
                notification.id,
                target,
                plan,
                basePayload,
            );
            summary.targetResults.push({
                targetId: target.id,
                results: targetResults,
            });
            if (targetResults.some((result) => result.status === 'success')) {
                hasSuccess = true;
            }
        }

        await this.notificationRepository.updateNotificationStatus(
            notification.id,
            hasSuccess ? 'succeeded' : 'failed',
        );

        return summary;
    }

    async dispatchPlanForTarget(params: {
        notification: NotificationRecord;
        target: NotificationTargetRecord;
        plan: NotificationChannelPlanItem[];
        payloadOverride?: NotificationEventPayload;
    }): Promise<NotificationChannelResult[]> {
        const basePayload = this.buildBasePayload(
            params.notification,
            params.payloadOverride,
        );
        return this.dispatchToTarget(
            params.notification.id,
            params.target,
            params.plan,
            basePayload,
        );
    }

    async dispatchSingleChannel(
        params: DispatchSingleChannelParams,
    ): Promise<NotificationChannelResult> {
        const basePayload =
            params.payloadOverride ??
            this.buildBasePayload(params.notification);
        const attempt = params.attempt ?? 1;
        const deliveryId =
            params.deliveryId ??
            this.buildDeliveryId(
                params.notification.id,
                params.target.id,
                params.channel,
                attempt,
                params.deliveryIdSuffix,
            );
        const isUserOnline = params.target.userId
            ? await this.presenceService.isUserOnline(params.target.userId)
            : null;

        return this.runChannel({
            notificationId: params.notification.id,
            target: params.target,
            channel: params.channel,
            planItem: params.planItem,
            basePayload,
            attempt,
            deliveryId,
            isUserOnline,
            isRetry: params.isRetry ?? false,
        });
    }

    private async dispatchToTarget(
        notificationId: string,
        target: NotificationTargetRecord,
        plan: NotificationChannelPlanItem[],
        basePayload: NotificationEventPayload,
    ): Promise<NotificationChannelResult[]> {
        const results: NotificationChannelResult[] = [];
        const targetUserId = target.userId ?? basePayload.userId;
        const isUserOnline = targetUserId
            ? await this.presenceService.isUserOnline(targetUserId)
            : null;
        let attemptIndex = 1;

        for (const planItem of plan) {
            const deliveryId = this.buildDeliveryId(
                notificationId,
                target.id,
                planItem.channel,
                attemptIndex,
            );
            const result = await this.runChannel({
                notificationId,
                target,
                channel: planItem.channel,
                planItem,
                basePayload,
                attempt: attemptIndex,
                deliveryId,
                isUserOnline,
                isRetry: false,
            });
            results.push(result);
            if (result.status === 'success') {
                break;
            }
            attemptIndex += 1;
        }

        return results;
    }

    private buildDeliveryId(
        notificationId: string,
        targetId: string,
        channel: NotificationChannelType,
        attempt: number,
        suffix?: string,
    ) {
        const base = `${notificationId}:${targetId}:${channel}:${attempt}`;
        return suffix ? `${base}${suffix}` : base;
    }

    private async runChannel(params: {
        notificationId: string;
        target: NotificationTargetRecord;
        channel: NotificationChannelType;
        planItem?: NotificationChannelPlanItem;
        basePayload: NotificationEventPayload;
        attempt: number;
        deliveryId: string;
        isUserOnline: boolean | null;
        isRetry: boolean;
    }): Promise<NotificationChannelResult> {
        const {
            notificationId,
            target,
            channel,
            planItem,
            basePayload,
            attempt,
            deliveryId,
            isUserOnline,
            isRetry,
        } = params;
        const ctxPayload: NotificationEventPayload = {
            ...basePayload,
            targetId: target.targetId,
            userId: target.userId ?? basePayload.userId,
            deliveryChannel: channel,
            deliveryId,
        };
        const context: NotificationChannelContext = {
            payload: ctxPayload,
            target: this.toTargetDescriptor(target),
            deliveryMode: basePayload.deliveryMode,
            deliveryId,
        };

        const channelImpl = this.registry.get(channel);
        if (!channelImpl) {
            const result: NotificationChannelResult = {
                channel,
                status: 'skipped',
                detail: '渠道未注册',
            };
            this.metrics.recordDeliveryResult(channel, result.status, {
                event: basePayload.event,
                isRetry,
            });
            return result;
        }

        const condition = this.evaluatePlanCondition(
            planItem ?? ({ channel } as NotificationChannelPlanItem),
            isUserOnline,
        );
        if (!condition.allowed) {
            const result: NotificationChannelResult = {
                channel,
                status: 'unavailable',
                detail: condition.reason ?? '渠道条件不满足',
            };
            this.metrics.recordDeliveryResult(channel, result.status, {
                event: basePayload.event,
                isRetry,
            });
            return result;
        }

        await this.notificationRepository.createDeliveryLog({
            deliveryId,
            notificationId,
            targetRecordId: target.id,
            channel,
            attempt,
        });

        let result: NotificationChannelResult;
        try {
            const available = channelImpl.isAvailable
                ? await channelImpl.isAvailable(context)
                : true;
            if (!available) {
                result = {
                    channel,
                    status: 'unavailable',
                    detail: '渠道当前不可用',
                };
            } else {
                result = await channelImpl.send(context);
            }
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `渠道 ${channel} 处理通知 ${notificationId} 失败`,
                message,
            );
            result = {
                channel,
                status: 'failed',
                error: message,
            };
        }

        await this.notificationRepository.updateDeliveryLog(
            deliveryId,
            this.mapDeliveryUpdate(result, basePayload.deliveryMode),
        );
        this.metrics.recordDeliveryResult(channel, result.status, {
            event: basePayload.event,
            isRetry,
        });
        return result;
    }

    private toTargetDescriptor(
        target: NotificationTargetRecord,
    ): NotificationTargetDescriptor {
        return {
            targetId: target.targetId,
            userId: target.userId ?? undefined,
            metadata: target.metadata as Record<string, string>,
        };
    }

    private mapDeliveryUpdate(
        result: NotificationChannelResult,
        deliveryMode?: NotificationDeliveryMode,
    ): {
        status: NotificationDeliveryStatus;
        lastError?: string | null;
        deliveredAt?: Date | null;
        context?: Record<string, unknown>;
    } {
        const status = this.mapChannelStatus(result.status, deliveryMode);
        const deliveredAt =
            status === 'delivered' || status === 'sent' ? new Date() : null;
        return {
            status,
            lastError: result.error ?? null,
            deliveredAt,
        };
    }

    private mapChannelStatus(
        status: NotificationChannelResult['status'],
        deliveryMode?: NotificationDeliveryMode,
    ): NotificationDeliveryStatus {
        switch (status) {
            case 'success':
                return deliveryMode === 'strict' ? 'sent' : 'delivered';
            case 'skipped':
                return 'failed';
            case 'unavailable':
                return 'failed';
            case 'failed':
            default:
                return 'failed';
        }
    }

    private evaluatePlanCondition(
        planItem: NotificationChannelPlanItem,
        isUserOnline: boolean | null,
    ): { allowed: boolean; reason?: string } {
        switch (planItem.when) {
            case 'online':
                if (isUserOnline === true) {
                    return { allowed: true };
                }
                return {
                    allowed: false,
                    reason:
                        isUserOnline === false
                            ? '用户离线，跳过在线限定渠道'
                            : '无法判断在线状态，跳过在线限定渠道',
                };
            case 'offline':
                if (isUserOnline === false || isUserOnline === null) {
                    return { allowed: true };
                }
                return {
                    allowed: false,
                    reason: '用户在线，跳过离线限定渠道',
                };
            case 'always':
            default:
                return { allowed: true };
        }
    }

    private buildBasePayload(
        notification: NotificationRecord,
        incomingPayload?: NotificationEventPayload,
    ): NotificationEventPayload {
        const storedPayload = notification.payload as
            | NotificationEventPayload
            | undefined;
        const merged: Record<string, unknown> = {
            ...(storedPayload ?? {}),
            ...(incomingPayload ?? {}),
        };
        const resolvedEvent =
            (incomingPayload && incomingPayload.event) ??
            storedPayload?.event ??
            notification.event;
        const resolvedDeliveryMode =
            incomingPayload?.deliveryMode ??
            storedPayload?.deliveryMode ??
            notification.deliveryMode ??
            'best-effort';
        return {
            ...(merged as NotificationEventPayload),
            notificationId: notification.id,
            event: resolvedEvent,
            deliveryMode: resolvedDeliveryMode,
        };
    }
}
type NotificationTargetRecord = typeof notificationTargets.$inferSelect;
type NotificationRecord = typeof notifications.$inferSelect;
