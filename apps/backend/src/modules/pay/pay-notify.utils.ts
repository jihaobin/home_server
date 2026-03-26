import type { Request } from 'express';

export function serializeParsedNotifyBody(
    body: Request['body'],
    channel: 'alipay' | 'wechat_pay',
) {
    if (!body || typeof body !== 'object' || Buffer.isBuffer(body)) {
        return null;
    }

    if (channel === 'wechat_pay') {
        return JSON.stringify(body);
    }

    return new URLSearchParams(
        Object.entries(body as Record<string, string>).map(([key, value]) => [
            key,
            String(value),
        ]),
    ).toString();
}
