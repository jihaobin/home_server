import { BadRequestException, HttpException } from '@nestjs/common';
import { UserAuthRealNameApiResponse } from '@repo/types';

interface RequestOptions {
    data: Record<string, any>;
    headers: Record<string, string>;
}

async function initClient(): Promise<any> {
    // 动态导入 CommonJS 模块

    const { Client } = await import('aliyun-api-gateway');
    // eslint-disable-next-line @typescript-eslint/no-unsafe-call
    return new Client('204931781', 'Dc8NMFMMQD1n5hhH7vFEo0ekF8y9WveE');
}

export async function realNameAuthPost({
    name,
    idCard,
}: {
    name: string;
    idCard: string;
}) {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
    const client = await initClient();
    const url =
        'https://kzidcardv1.market.alicloudapi.com/api-mall/api/id_card/check';
    const options: RequestOptions = {
        data: {
            name: name,
            idcard: idCard,
        },
        headers: {
            accept: 'application/json',
            'content-type': 'application/x-www-form-urlencoded',
        },
    };

    // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
    const result = (await client.post(
        url,
        options,
    )) as UserAuthRealNameApiResponse;
    if (result.code === 200) {
        return result.data;
    } else {
        throw new HttpException(result.msg, result.code);
    }
}
