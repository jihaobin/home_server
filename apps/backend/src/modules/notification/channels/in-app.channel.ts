import { Injectable, Logger } from '@nestjs/common';

import type {
    NotificationChannelContext,
    NotificationChannelResult,
} from '@repo/types';
import type { NotificationChannel } from './notification-channel.interface';
import { NotificationWsService } from '../notification-ws.service';

@Injectable()
export class InAppChannel implements NotificationChannel {
    readonly type = 'in_app';
    private readonly logger = new Logger(InAppChannel.name);

    constructor(
        private readonly notificationWsService: NotificationWsService,
    ) {}

    async send(
        ctx: NotificationChannelContext,
    ): Promise<NotificationChannelResult> {
        const targetUserId = ctx.target?.userId ?? ctx.payload.userId;
        this.notificationWsService.emit({
            ...ctx.payload,
            userId: targetUserId ?? ctx.payload.userId,
            deliveryChannel: this.type,
        });
        this.logger.debug?.(`已通过 InApp 渠道派发事件 ${ctx.payload.event}`);
        return {
            channel: this.type,
            status: 'success',
        };
    }
}
