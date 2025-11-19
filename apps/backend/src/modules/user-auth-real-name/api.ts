import { BadRequestException, GatewayTimeoutException } from '@nestjs/common';

import { UserAuthRealNameApiResponse } from '@repo/types';

interface RequestOptions {
    data: Record<string, any>;

    headers: Record<string, string>;

    timeout?: number;
}

async function initClient(): Promise<any> {
    // 动态导入 CommonJS 模块

    const { Client } = await import('aliyun-api-gateway');

    return new Client(
        process.env.ALIYUN_REAL_NAME_AUTH_ACCESS_KEY,

        process.env.ALIYUN_REAL_NAME_AUTH_ACCESS_KEY_SECRET,
    );
}

export async function realNameAuthPost({
    name,
    idCard,
}: {
    name: string;
    idCard: string;
}) {
    const client = await initClient();
    const url = process.env.ALIYUN_REAL_NAME_AUTH_URL;
    const timeout =
        Number(process.env.ALIYUN_REAL_NAME_AUTH_TIMEOUT ?? 10000) || 10000;
    const maxTimeoutRetry =
        Number(process.env.ALIYUN_REAL_NAME_AUTH_TIMEOUT_RETRY ?? 1) || 1;
    const requestOnce = async () => {
        const options: RequestOptions = {
            data: {
                name: name,
                idcard: idCard,
            },
            headers: {
                accept: 'application/json',
                'content-type': 'application/x-www-form-urlencoded',
            },
            timeout,
        };
        return (await client.post(
            url,
            options,
        )) as unknown as UserAuthRealNameApiResponse;
    };
    const isTimeoutError = (error: unknown) => {
        if (!error || typeof error !== 'object') {
            return false;
        }
        const name = (error as any)?.name ?? '';
        return typeof name === 'string' && name.includes('RequestTimeout');
    };

    let attempt = 0;
    let result: UserAuthRealNameApiResponse | undefined;

    while (attempt <= maxTimeoutRetry) {
        try {
            result = await requestOnce();
            break;
        } catch (error) {
            if (isTimeoutError(error)) {
                if (attempt < maxTimeoutRetry) {
                    attempt += 1;
                    continue;
                }

                throw new GatewayTimeoutException(
                    '实名认证服务响应超时，请稍后再试',
                );
            }

            throw error;
        }
    }

    if (!result) {
        throw new GatewayTimeoutException('实名认证服务暂时不可用，请稍后重试');
    }

    // 兼容第三方返回 code 为字符串的情况，统一转换为数字进行判断

    const bizCode =
        typeof (result as any)?.code === 'string' ||
        typeof (result as any)?.code === 'number'
            ? Number((result as any).code)
            : undefined;

    if (bizCode === 0) {
        return (result as any).result;
    }

    throw new BadRequestException((result as any).message);
}
