import { Inject, Injectable, Logger } from '@nestjs/common';
import { eq } from 'drizzle-orm';

import type {
    NotificationChannelContext,
    NotificationChannelResult,
} from '@repo/types';
import type { NotificationChannel } from './notification-channel.interface';
import { SmsService } from 'src/common/sms/sms.service';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { users } from 'src/common/database/schema/auth-user';

@Injectable()
export class SmsChannel implements NotificationChannel {
    readonly type = 'sms';
    private readonly logger = new Logger(SmsChannel.name);
    private readonly messageMaxLength = 140;

    constructor(
        private readonly smsService: SmsService,
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async isAvailable(ctx: NotificationChannelContext): Promise<boolean> {
        const phone = await this.resolvePhoneNumber(ctx);
        this.logger.debug(`短信渠道可用性检查，手机号: ${phone ?? '未找到'}`);
        return Boolean(phone);
    }

    async send(
        ctx: NotificationChannelContext,
    ): Promise<NotificationChannelResult> {
        this.logger.debug('开始通过短信渠道发送通知');
        const phoneNumber = await this.resolvePhoneNumber(ctx);
        if (!phoneNumber) {
            return {
                channel: this.type,
                status: 'unavailable',
                detail: '缺少可用于发送短信的手机号',
            };
        }

        const event = ctx.payload.event;
        const templateCode = this.resolveTemplateCode(event);
        if (!templateCode) {
            return {
                channel: this.type,
                status: 'failed',
                error: `未配置短信模板: ${event ?? 'unknown'}`,
            };
        }

        const message = this.buildMessage(ctx);
        this.logger.debug(
            `短信模板发送，event=${event ?? 'unknown'} template=${templateCode} message=${message}`,
        );

        try {
            const result = await this.smsService.sendTemplateSms({
                phone: phoneNumber,
                templateCode,
                outId: ctx.deliveryId,
            });
            this.logger.debug(`短信发送结果: ${JSON.stringify(result)}`);
            if (!result.success) {
                return {
                    channel: this.type,
                    status: 'failed',
                    error: result.error ?? '短信发送失败',
                };
            }
            return {
                channel: this.type,
                status: 'success',
                detail: result.messageId
                    ? `messageId=${result.messageId}`
                    : undefined,
            };
        } catch (error) {
            const messageText =
                error instanceof Error ? error.message : String(error);
            const stack = error instanceof Error ? error.stack : undefined;
            this.logger.error(
                `短信渠道发送失败 event=${event ?? 'unknown'} template=${templateCode} phone=${phoneNumber} deliveryId=${ctx.deliveryId ?? 'none'} 错误=${messageText}`,
                stack,
            );
            return {
                channel: this.type,
                status: 'failed',
                error: messageText,
            };
        }
    }

    private async resolvePhoneNumber(
        ctx: NotificationChannelContext,
    ): Promise<string | null> {
        const candidate =
            this.normalizePhone(
                ctx.target?.metadata?.phone ?? ctx.target?.metadata?.mobile,
            ) ??
            this.normalizePhone(
                ctx.payload.phone ??
                    ctx.payload.phoneNumber ??
                    ctx.payload.mobile,
            );
        if (candidate) {
            return candidate;
        }

        const userId = ctx.target?.userId ?? ctx.payload.userId;
        if (!userId) {
            return null;
        }
        const user = await this.db.query.users.findFirst({
            columns: {
                phoneNumber: true,
            },
            where: eq(users.id, userId),
        });
        return this.normalizePhone(user?.phoneNumber);
    }

    private buildMessage(ctx: NotificationChannelContext): string {
        const { payload } = ctx;
        const base =
            payload.message ??
            this.buildFallbackMessage(payload.event, payload.serviceName);
        return base.length > this.messageMaxLength
            ? `${base.slice(0, this.messageMaxLength - 3)}...`
            : base;
    }

    private buildFallbackMessage(event?: string, serviceName?: string) {
        if (event === 'order_pending_acceptance_assigned') {
            return `${serviceName ?? '订单'}待接单，请尽快处理`;
        }
        if (event === 'order_cancelled') {
            return `${serviceName ?? '订单'}已取消，请查看原因`;
        }
        if (event === 'order_payment_expired') {
            return `${serviceName ?? '订单'}支付超时，已自动取消`;
        }
        return '您有新的通知，请打开应用查看';
    }

    private resolveTemplateCode(event?: string): string | undefined {
        if (event === 'order_pending_acceptance_assigned') {
            return process.env.ALIYUN_SMS_TEMPLATE_NEW_ORDER;
        }
        if (event === 'order_pending_acceptance_warning') {
            return process.env.ALIYUN_SMS_TEMPLATE_PENDING_ACCEPTANCE;
        }
        if (event === 'order_service_eta_warning') {
            return process.env.ALIYUN_SMS_TEMPLATE_SERVICE_REMINDER;
        }
        if (event === 'order_cancelled') {
            return process.env.ALIYUN_SMS_TEMPLATE_ORDER_CANCELLED;
        }
        return undefined;
    }

    private normalizePhone(value?: string | null): string | null {
        if (typeof value !== 'string') {
            return null;
        }
        const digits = value.replace(/[\s-]/g, '');
        if (!digits.length) {
            return null;
        }
        return digits;
    }
}
