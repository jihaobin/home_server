export const OrderExpireRedisKeys = {
    delayZset: 'order:payment-expire',
    expiredStream: 'stream:order-expired',
    notifyStream: 'stream:order-notify',
    deadLetterStream: 'stream:order-expired-dlq',
    scannerLock: 'lock:order-expire-scanner',
} as const;

export type OrderExpireRedisKey =
    (typeof OrderExpireRedisKeys)[keyof typeof OrderExpireRedisKeys];
