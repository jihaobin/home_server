export const NotificationRedisKeys = {
    stream: 'stream:notifications',
    consumerGroup: 'group:notification-dispatcher',
    serviceOnlinePrefix: 'online:service:',
    serviceDevicePrefix: 'device:service:',
} as const;

export type NotificationRedisKey =
    (typeof NotificationRedisKeys)[keyof typeof NotificationRedisKeys];
