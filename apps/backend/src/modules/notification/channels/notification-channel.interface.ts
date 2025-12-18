import type {
    NotificationChannel as NotificationChannelType,
    NotificationChannelContext,
    NotificationChannelResult,
} from '@repo/types';

export interface NotificationChannel {
    readonly type: NotificationChannelType;
    /**
     * 用于预判渠道是否可用，例如检查设备在线状态或凭证是否配置
     */
    isAvailable?(ctx: NotificationChannelContext): Promise<boolean> | boolean;

    /**
     * 执行具体的通知投递，返回成功/失败结果
     */
    send(ctx: NotificationChannelContext): Promise<NotificationChannelResult>;
}
