import { Injectable, Logger } from '@nestjs/common';

import type {
    NotificationChannelContext,
    NotificationChannelResult,
} from '@repo/types';
import type { NotificationChannel } from '../notification-channel.interface';
import { TencentCloudPushService } from './tencent-cloud-push.service';
import { NotificationPresenceService } from '../../notification-presence.service';
import { NotificationDeviceService } from '../../notification-device.service';

@Injectable()
export class TencentCloudPushChannel implements NotificationChannel {
    readonly type = 'tencent_cloud_push';
    private readonly logger = new Logger(TencentCloudPushChannel.name);
    private readonly maxBatchTargets = 500;

    constructor(
        private readonly pushService: TencentCloudPushService,
        private readonly presenceService: NotificationPresenceService,
        private readonly deviceService: NotificationDeviceService,
    ) {}

    isAvailable(): boolean {
        return this.pushService.isConfigured();
    }

    async send(
        ctx: NotificationChannelContext,
    ): Promise<NotificationChannelResult> {
        if (!this.pushService.isConfigured()) {
            return {
                channel: this.type,
                status: 'unavailable',
                detail: '腾讯云推送凭证未配置',
            };
        }

        const userId = ctx.target?.userId ?? ctx.payload.userId;
        const isOnline = userId
            ? await this.presenceService.isUserOnline(userId)
            : false;

        const accounts = await this.resolveAccounts(ctx);
        if (!accounts.length) {
            return {
                channel: this.type,
                status: 'unavailable',
                detail: '缺少可推送的账号/RegistrationID',
            };
        }

        const content = this.buildContent(ctx);
        const ext = this.buildExt(ctx);

        try {
            const result = await this.pushService.sendBatchPush({
                accounts,
                title: content.title,
                body: content.body,
                dataId:
                    ctx.deliveryId ??
                    ctx.payload.deliveryId ??
                    ctx.payload.notificationId,
                pushFlag: isOnline ? 1 : 0,
                ext,
            });
            this.logger.debug?.(
                `腾讯云推送完成: event=${ctx.payload.event}, targets=${accounts.join(',')}`,
            );
            return {
                channel: this.type,
                status: 'success',
                detail: result.taskId ? `TaskId=${result.taskId}` : undefined,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(
                `腾讯云推送失败: event=${ctx.payload.event}`,
                message,
            );
            return {
                channel: this.type,
                status: 'failed',
                error: message,
            };
        }
    }

    private async resolveAccounts(
        ctx: NotificationChannelContext,
    ): Promise<string[]> {
        const resolved = new Set<string>();
        const userId = ctx.target?.userId ?? ctx.payload.userId;
        if (userId) {
            const onlineDevices =
                await this.presenceService.getOnlineDevices(userId);
            for (const device of onlineDevices) {
                if (device.registrationId) {
                    resolved.add(device.registrationId);
                }
            }
        }

        const metadata = ctx.target?.metadata ?? {};
        const metadataCandidates = [
            metadata?.tencentPushAccount,
            metadata?.tencentCloudAccount,
            metadata?.tencentRegistrationId,
            ctx.target?.userId,
            ctx.payload.userId,
            ctx.target?.targetId,
            ctx.payload.targetId,
        ];
        for (const candidate of metadataCandidates) {
            if (typeof candidate === 'string' && candidate.trim().length > 0) {
                resolved.add(candidate);
            }
        }

        if (userId && resolved.size < this.maxBatchTargets) {
            const devices = await this.deviceService.getDevices(userId);
            for (const device of devices) {
                if (device.registrationId) {
                    resolved.add(device.registrationId);
                }
                if (resolved.size >= this.maxBatchTargets) {
                    break;
                }
            }
        }

        return Array.from(resolved).slice(0, this.maxBatchTargets);
    }

    private buildContent(ctx: NotificationChannelContext): {
        title: string;
        body: string;
    } {
        const title =
            ctx.payload.serviceName ?? ctx.payload.event ?? '叮咚服务提醒';
        const body =
            ctx.payload.message ??
            (ctx.payload.status
                ? `状态：${ctx.payload.status}`
                : '请打开 App 查看详细信息');
        return { title, body };
    }

    private buildExt(
        ctx: NotificationChannelContext,
    ): Record<string, unknown> | undefined {
        const ext: Record<string, unknown> = {
            event: ctx.payload.event,
            notificationId: ctx.payload.notificationId,
            orderId: ctx.payload.orderId,
            status: ctx.payload.status,
            deliveryMode: ctx.deliveryMode,
        };
        if (ctx.deliveryId) {
            ext.deliveryId = ctx.deliveryId;
        }
        if (ctx.payload.message) {
            ext.message = ctx.payload.message;
        }
        if (ctx.payload.assignmentType) {
            ext.assignmentType = ctx.payload.assignmentType;
        }
        if (ctx.payload.triggeredAt) {
            ext.triggeredAt = ctx.payload.triggeredAt;
        }
        return Object.keys(ext).length ? ext : undefined;
    }
}
