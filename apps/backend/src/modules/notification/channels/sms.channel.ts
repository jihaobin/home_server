import { Injectable, Logger } from '@nestjs/common';

import type {
    NotificationChannelContext,
    NotificationChannelResult,
} from '@repo/types';
import type { NotificationChannel } from './notification-channel.interface';

@Injectable()
export class SmsChannel implements NotificationChannel {
    readonly type = 'sms';
    private readonly logger = new Logger(SmsChannel.name);

    async send(
        ctx: NotificationChannelContext,
    ): Promise<NotificationChannelResult> {
        this.logger.debug?.(
            `SmsChannel 占位实现收到事件 ${ctx.payload.event}，等待短信网关接入`,
        );
        return {
            channel: this.type,
            status: 'unavailable',
            detail: '短信网关尚未接入通知模块',
        };
    }
}
