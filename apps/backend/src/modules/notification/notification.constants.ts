import type {
    NotificationChannel as NotificationChannelType,
    NotificationChannelPlanItem,
} from '@repo/types';

export const NOTIFICATION_CHANNELS = Symbol('NOTIFICATION_CHANNELS');

export const KNOWN_NOTIFICATION_CHANNELS: readonly NotificationChannelType[] = [
    'in_app',
    'tencent_cloud_push',
    'sms',
] as const;

export const DEFAULT_NOTIFICATION_CHANNEL_PLAN: readonly NotificationChannelPlanItem[] =
    [
        { channel: 'in_app', when: 'online' },
        { channel: 'tencent_cloud_push', when: 'offline' },
        { channel: 'sms' },
    ];

export function isNotificationChannelType(
    value: string,
): value is NotificationChannelType {
    return (
        KNOWN_NOTIFICATION_CHANNELS.findIndex(
            (channel) => channel === (value as NotificationChannelType),
        ) !== -1
    );
}
