import { ForbiddenException, Injectable, Logger } from '@nestjs/common';

import type {
    NotificationChannelResult,
    NotificationDeliveryStatus,
} from '@repo/types';
import type { NotificationMetadata } from 'src/common/database/schema/notifications';

import { NotificationDispatcher } from './notification.dispatcher';
import { NotificationRepository } from './notification.repository';
import { TencentCloudPushService } from './channels/tencent-cloud-push.channel/tencent-cloud-push.service';
import type {
    TencentPushCallbackBodyDto,
    TencentPushCallbackEventDto,
    TencentPushCallbackQueryDto,
} from './dto/tencent-push-callback.dto';

interface SmsFallbackResult {
    success: boolean;
    results?: NotificationChannelResult[];
    error?: string;
}

@Injectable()
export class TencentPushCallbackService {
    private readonly logger = new Logger(TencentPushCallbackService.name);

    constructor(
        private readonly notificationRepository: NotificationRepository,
        private readonly dispatcher: NotificationDispatcher,
        private readonly tencentPushService: TencentCloudPushService,
    ) {}

    async handleCallback(
        query: TencentPushCallbackQueryDto,
        body: TencentPushCallbackBodyDto,
    ) {
        this.ensureSdkAppIdMatches(query.SdkAppid);
        for (const event of body.Events) {
            await this.processEvent(event);
        }
    }

    private ensureSdkAppIdMatches(incomingId: number) {
        const configured = this.tencentPushService.getSdkAppId();
        if (configured && configured !== incomingId) {
            throw new ForbiddenException('SdkAppid 不匹配');
        }
    }

    private async processEvent(event: TencentPushCallbackEventDto) {
        if (!event.DataId) {
            this.logger.warn('回调缺少 DataId，无法定位投递记录');
            return;
        }
        const delivery =
            await this.notificationRepository.getDeliveryWithDetails(
                event.DataId,
            );
        if (!delivery) {
            this.logger.warn(`未找到投递记录: ${event.DataId}`);
            return;
        }

        const context = this.buildNextContext(delivery.context, event);
        const updates = this.buildDeliveryUpdate(event, context);
        await this.notificationRepository.updateDeliveryLog(
            event.DataId,
            updates,
        );

        const shouldFallback = this.shouldTriggerSmsFallback(delivery, event);
        if (!shouldFallback) {
            return;
        }

        const fallbackResult = await this.dispatchSmsFallback(delivery);
        const contextWithFallback = this.appendFallbackContext(
            context,
            fallbackResult,
        );
        await this.notificationRepository.updateDeliveryLog(event.DataId, {
            context: contextWithFallback,
        });
    }

    private buildDeliveryUpdate(
        event: TencentPushCallbackEventDto,
        context: NotificationMetadata,
    ): {
        status: NotificationDeliveryStatus;
        lastError: string | null;
        deliveredAt?: Date | null;
        context: NotificationMetadata;
    } {
        const status = this.mapStatusFromEvent(event);
        const deliveredAt =
            status === 'delivered'
                ? (this.toDate(event.EventTime) ?? null)
                : null;
        return {
            status,
            lastError:
                event.ErrCode === 0
                    ? null
                    : (event.ErrInfo?.trim() ?? `ErrCode=${event.ErrCode}`),
            deliveredAt,
            context,
        };
    }

    private buildNextContext(
        existing: NotificationMetadata | null | undefined,
        event: TencentPushCallbackEventDto,
    ): NotificationMetadata {
        const context = this.cloneContext(existing);
        const tencentPush = this.toRecord(context.tencentPush);
        tencentPush.taskId = event.TaskId;
        tencentPush.eventType = event.EventType;
        tencentPush.taskTime = event.TaskTime ?? null;
        tencentPush.eventTime = event.EventTime ?? null;
        tencentPush.pushStage = event.PushStage ?? null;
        tencentPush.pushPlatform = event.PushPlatform ?? null;
        tencentPush.deviceType = event.DeviceType ?? null;
        tencentPush.errCode = event.ErrCode;
        tencentPush.errInfo = event.ErrInfo ?? null;
        tencentPush.toAccount = event.To_Account;
        tencentPush.updatedAt = new Date().toISOString();
        context.tencentPush = tencentPush;
        return context;
    }

    private shouldTriggerSmsFallback(
        delivery: Awaited<
            ReturnType<NotificationRepository['getDeliveryWithDetails']>
        >,
        event: TencentPushCallbackEventDto,
    ) {
        if (!delivery) {
            return false;
        }
        if (event.ErrCode === 0) {
            return false;
        }
        if (!delivery.notification || !delivery.target) {
            this.logger.warn('投递记录缺少关联的通知或目标，无法兜底短信');
            return false;
        }
        const fallback = this.toRecord(
            this.cloneContext(delivery.context).fallback,
        );
        return fallback.smsTriggered !== true;
    }

    private async dispatchSmsFallback(
        delivery: NonNullable<
            Awaited<
                ReturnType<NotificationRepository['getDeliveryWithDetails']>
            >
        >,
    ): Promise<SmsFallbackResult> {
        if (!delivery.notification || !delivery.target) {
            return {
                success: false,
                error: '缺少通知或目标信息',
            };
        }
        try {
            const results = await this.dispatcher.dispatchPlanForTarget({
                notification: delivery.notification,
                target: delivery.target,
                plan: [{ channel: 'sms' }],
            });
            const success = results.some(
                (result) => result.status === 'success',
            );
            return { success, results };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.error(
                `通知 ${delivery.notification.id} 触发短信兜底失败`,
                message,
            );
            return { success: false, error: message };
        }
    }

    private appendFallbackContext(
        context: NotificationMetadata,
        fallback: SmsFallbackResult,
    ): NotificationMetadata {
        const clone = this.cloneContext(context);
        const fallbackContext = this.toRecord(clone.fallback);
        fallbackContext.smsTriggered = true;
        fallbackContext.smsTriggeredAt = new Date().toISOString();
        fallbackContext.smsSuccess = fallback.success;
        if (fallback.error) {
            fallbackContext.smsError = fallback.error;
        }
        if (fallback.results?.length) {
            fallbackContext.smsResults = fallback.results.map((result) => ({
                channel: result.channel,
                status: result.status,
                detail: result.detail,
                error: result.error,
            }));
        }
        clone.fallback = fallbackContext;
        return clone;
    }

    private mapStatusFromEvent(
        event: TencentPushCallbackEventDto,
    ): NotificationDeliveryStatus {
        if (event.ErrCode !== 0) {
            return 'failed';
        }
        switch (event.PushStage) {
            case 2:
            case 3:
                return 'delivered';
            case 1:
            default:
                return 'sent';
        }
    }

    private toDate(timestamp?: number) {
        if (typeof timestamp !== 'number' || !Number.isFinite(timestamp)) {
            return undefined;
        }
        return new Date(timestamp * 1000);
    }

    private cloneContext(
        context: NotificationMetadata | null | undefined,
    ): NotificationMetadata {
        if (!context || typeof context !== 'object' || Array.isArray(context)) {
            return {};
        }
        return { ...context };
    }

    private toRecord(value: unknown): Record<string, unknown> {
        if (!value || typeof value !== 'object' || Array.isArray(value)) {
            return {};
        }
        return { ...(value as Record<string, unknown>) };
    }
}
