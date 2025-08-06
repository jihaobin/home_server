import { ofetch } from 'ofetch';
import { createHash } from 'crypto';

/**
 * 计算腾讯地图API的签名
 * @param path 请求路径，如：/ws/geocoder/v1
 * @param params 请求参数对象
 * @param secretKey SK密钥
 * @returns 签名字符串
 */
function calculateSignature(
    path: string,
    params: Record<string, unknown>,
    secretKey: string,
): string {
    // 1. 对参数按名称升序排序
    const sortedKeys = Object.keys(params).sort();

    // 2. 拼接参数字符串
    const queryString = sortedKeys
        .map((key) => `${key}=${String(params[key])}`)
        .join('&');

    // 3. 拼接完整字符串：请求路径 + "?" + 排序后的参数 + SK
    const signString = `${path}?${queryString}${secretKey}`;

    // 4. 计算MD5值（小写）
    const signature = createHash('md5')
        .update(signString, 'utf8')
        .digest('hex');

    return signature;
}

export const fetch = ofetch.create({
    baseURL: 'https://apis.map.qq.com',
    onRequest: ({ request, options }) => {
        const key = process.env.TMAP_KEY;
        const secretKey = process.env.TMAP_SECRET;

        if (!key) {
            throw new Error('TMAP_KEY environment variable is required');
        }

        if (!secretKey) {
            throw new Error('TMAP_SECRET environment variable is required');
        }

        // 构建基础参数（包含key但不包含sig）
        const baseParams: Record<string, unknown> = {
            key,
            ...options.query,
        };

        // 从请求URL中提取路径
        const url = typeof request === 'string' ? request : request.url;
        const urlPath = new URL(url, 'https://apis.map.qq.com').pathname;

        // 计算签名
        const signature = calculateSignature(urlPath, baseParams, secretKey);

        // 添加签名到参数中
        baseParams.sig = signature;

        // 设置最终的查询参数
        options.query = baseParams;
    },
});
