import { existsSync, readFileSync } from 'node:fs';
import { X509Certificate } from 'node:crypto';
import { resolve } from 'node:path';
import {
    createWechatPayNonce,
    decryptWechatPayAead,
    signWechatPayMessage,
    verifyWechatPaySignature,
} from './wechatPay.crypto';
import type {
    WechatPayAppLaunchRequest,
    WechatPayAppPrepayRequest,
    WechatPayAppPrepayResponse,
    WechatPayConfig,
    WechatPayCreateRefundRequest,
    WechatPayCreateRefundResponse,
    WechatPayDecryptedRefund,
    WechatPayDecryptedTransaction,
    WechatPayNotifyEnvelope,
    WechatPayNotifyParseResult,
    WechatPayOrderQueryResponse,
    WechatPayRefundNotifyParseResult,
    WechatPayRefundQueryResponse,
    WechatPayRequestHeaders,
} from './wechatPay.types';

type WechatPayRequestOptions = {
    method: 'GET' | 'POST';
    path: string;
    body?: Record<string, unknown>;
};

type WechatPayResponseHeaders = {
    serial?: string;
    signature?: string;
    timestamp?: string;
    nonce?: string;
};

class WechatPayApiError extends Error {
    constructor(
        message: string,
        public readonly statusCode: number,
        public readonly responseBody: string,
    ) {
        super(message);
        this.name = 'WechatPayApiError';
    }
}

function resolveWechatPayConfigFromEnv(): WechatPayConfig {
    const mchId = process.env.WECHAT_PAY_MCH_ID?.trim();
    const apiV3Key = process.env.WECHAT_PAY_API_V3_KEY?.trim();
    const baseUrl =
        process.env.WECHAT_PAY_BASE_URL?.trim() ||
        'https://api.mch.weixin.qq.com';
    const userAppId = process.env.WECHAT_PAY_USER_APP_ID?.trim();
    const userNotifyUrl = process.env.WECHAT_PAY_USER_NOTIFY_URL?.trim();
    const userRefundNotifyUrl =
        process.env.WECHAT_PAY_USER_REFUND_NOTIFY_URL?.trim() || userNotifyUrl;

    const resolveExistingPath = (candidates: Array<string | undefined>) => {
        const resolved = candidates
            .filter((candidate): candidate is string =>
                Boolean(candidate?.trim()),
            )
            .map((candidate) => resolve(process.cwd(), candidate))
            .find((candidate) => existsSync(candidate));

        return resolved;
    };

    const merchantCertPath = resolveExistingPath([
        process.env.WECHAT_PAY_MERCHANT_CERT_PATH,
        'wechat_certificate/apiclient_cert.pem',
        'dist/wechat_certificate/apiclient_cert.pem',
    ]);
    const privateKeyPath = resolveExistingPath([
        process.env.WECHAT_PAY_PRIVATE_KEY_PATH,
        'wechat_certificate/apiclient_key.pem',
        'dist/wechat_certificate/apiclient_key.pem',
    ]);
    const platformPublicKeyPath = resolveExistingPath([
        process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH,
        process.env.WECHAT_PAY_PLATFORM_CERT_PATH,
        'wechat_certificate/pub_key.pem',
        'dist/wechat_certificate/pub_key.pem',
    ]);

    const merchantCertPem = merchantCertPath
        ? readFileSync(merchantCertPath, 'utf8')
        : null;
    const merchantCertSerialNo =
        process.env.WECHAT_PAY_MERCHANT_CERT_SERIAL_NO?.trim() ||
        (merchantCertPem
            ? new X509Certificate(merchantCertPem).serialNumber.toUpperCase()
            : undefined);
    const platformVerifierId =
        process.env.WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID?.trim() ||
        process.env.WECHAT_PAY_PLATFORM_CERT_SERIAL_NO?.trim();

    if (!mchId) {
        throw new Error('未配置 WECHAT_PAY_MCH_ID');
    }
    if (!apiV3Key || apiV3Key.length !== 32) {
        throw new Error('未配置合法的 WECHAT_PAY_API_V3_KEY');
    }
    if (!merchantCertSerialNo) {
        throw new Error(
            '未配置 WECHAT_PAY_MERCHANT_CERT_SERIAL_NO，且无法从商户证书推导序列号',
        );
    }
    if (!privateKeyPath) {
        throw new Error(
            '未配置 WECHAT_PAY_PRIVATE_KEY_PATH，且未找到默认商户私钥文件',
        );
    }
    if (!platformPublicKeyPath) {
        throw new Error(
            '未配置 WECHAT_PAY_PLATFORM_PUBLIC_KEY_PATH / WECHAT_PAY_PLATFORM_CERT_PATH，且未找到默认微信支付公钥文件',
        );
    }
    if (!platformVerifierId) {
        throw new Error(
            '未配置 WECHAT_PAY_PLATFORM_PUBLIC_KEY_ID / WECHAT_PAY_PLATFORM_CERT_SERIAL_NO',
        );
    }
    if (!userAppId) {
        throw new Error('未配置 WECHAT_PAY_USER_APP_ID');
    }
    if (!userNotifyUrl) {
        throw new Error('未配置 WECHAT_PAY_USER_NOTIFY_URL');
    }
    if (!userRefundNotifyUrl) {
        throw new Error('未配置 WECHAT_PAY_USER_REFUND_NOTIFY_URL');
    }

    return {
        mchId,
        apiV3Key,
        merchantCertSerialNo,
        privateKeyPem: readFileSync(privateKeyPath, 'utf8'),
        platformVerifierPem: readFileSync(platformPublicKeyPath, 'utf8'),
        platformVerifierId,
        baseUrl,
        userAppId,
        userNotifyUrl,
        userRefundNotifyUrl,
    };
}

function buildNormalizedHeaders(headers: Headers): WechatPayResponseHeaders {
    return {
        serial: headers.get('wechatpay-serial') ?? undefined,
        signature: headers.get('wechatpay-signature') ?? undefined,
        timestamp: headers.get('wechatpay-timestamp') ?? undefined,
        nonce: headers.get('wechatpay-nonce') ?? undefined,
    };
}

function parseJson<T>(text: string): T {
    return JSON.parse(text) as T;
}

export class WechatPayClient {
    private readonly config: WechatPayConfig;

    private readonly platformPublicKeyPem: string;

    private readonly platformSerialNo: string;

    constructor(config?: WechatPayConfig) {
        this.config = config ?? resolveWechatPayConfigFromEnv();
        this.platformPublicKeyPem = this.config.platformVerifierPem;
        this.platformSerialNo = this.config.platformVerifierId.toUpperCase();
    }

    getUserAppId() {
        return this.config.userAppId;
    }

    getMchId() {
        return this.config.mchId;
    }

    getUserNotifyUrl() {
        return this.config.userNotifyUrl;
    }

    getUserRefundNotifyUrl() {
        return this.config.userRefundNotifyUrl;
    }

    private buildAuthorizationHeader({
        method,
        path,
        body,
    }: {
        method: string;
        path: string;
        body: string;
    }) {
        const timestamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = createWechatPayNonce();
        const message = `${method}\n${path}\n${timestamp}\n${nonceStr}\n${body}\n`;
        const signature = signWechatPayMessage(
            message,
            this.config.privateKeyPem,
        );

        return `WECHATPAY2-SHA256-RSA2048 mchid="${this.config.mchId}",nonce_str="${nonceStr}",timestamp="${timestamp}",serial_no="${this.config.merchantCertSerialNo}",signature="${signature}"`;
    }

    private verifyResponseSignature(
        rawBody: string,
        headers: WechatPayResponseHeaders,
    ) {
        if (!headers.signature || !headers.timestamp || !headers.nonce) {
            return;
        }

        if (headers.signature.startsWith('WECHATPAY/SIGNTEST/')) {
            throw new Error('微信支付返回了签名探测流量，当前未通过探测');
        }

        if (headers.serial?.toUpperCase() !== this.platformSerialNo) {
            throw new Error('微信支付响应证书序列号与本地平台证书不匹配');
        }

        const message = `${headers.timestamp}\n${headers.nonce}\n${rawBody}\n`;
        const valid = verifyWechatPaySignature({
            message,
            signature: headers.signature,
            publicKeyPem: this.platformPublicKeyPem,
        });

        if (!valid) {
            throw new Error('微信支付响应验签失败');
        }
    }

    private async request<T>({
        method,
        path,
        body,
    }: WechatPayRequestOptions): Promise<T> {
        const serializedBody = body ? JSON.stringify(body) : '';
        const response = await fetch(`${this.config.baseUrl}${path}`, {
            method,
            headers: {
                Accept: 'application/json',
                'Content-Type': 'application/json',
                Authorization: this.buildAuthorizationHeader({
                    method,
                    path,
                    body: serializedBody,
                }),
            },
            body: serializedBody || undefined,
        });

        const responseText = await response.text();
        const responseHeaders = buildNormalizedHeaders(response.headers);

        if (response.ok) {
            this.verifyResponseSignature(responseText, responseHeaders);
            return parseJson<T>(responseText);
        }

        throw new WechatPayApiError(
            `微信支付请求失败: ${response.status}`,
            response.status,
            responseText,
        );
    }

    async createAppPrepayOrder(request: WechatPayAppPrepayRequest) {
        return this.request<WechatPayAppPrepayResponse>({
            method: 'POST',
            path: '/v3/pay/transactions/app',
            body: request as unknown as Record<string, unknown>,
        });
    }

    async queryOrderByOutTradeNo(outTradeNo: string) {
        const encodedOutTradeNo = encodeURIComponent(outTradeNo);

        try {
            return await this.request<WechatPayOrderQueryResponse>({
                method: 'GET',
                path: `/v3/pay/transactions/out-trade-no/${encodedOutTradeNo}?mchid=${encodeURIComponent(this.config.mchId)}`,
            });
        } catch (error) {
            if (
                error instanceof WechatPayApiError &&
                error.statusCode === 404
            ) {
                return null;
            }

            throw error;
        }
    }

    async createDomesticRefund(request: WechatPayCreateRefundRequest) {
        return this.request<WechatPayCreateRefundResponse>({
            method: 'POST',
            path: '/v3/refund/domestic/refunds',
            body: request as unknown as Record<string, unknown>,
        });
    }

    async queryDomesticRefundByOutRefundNo(outRefundNo: string) {
        const encodedOutRefundNo = encodeURIComponent(outRefundNo);

        try {
            return await this.request<WechatPayRefundQueryResponse>({
                method: 'GET',
                path: `/v3/refund/domestic/refunds/${encodedOutRefundNo}`,
            });
        } catch (error) {
            if (
                error instanceof WechatPayApiError &&
                error.statusCode === 404
            ) {
                return null;
            }

            throw error;
        }
    }

    buildAppLaunchRequest(prepayId: string): WechatPayAppLaunchRequest {
        const timeStamp = Math.floor(Date.now() / 1000).toString();
        const nonceStr = createWechatPayNonce();
        const message = `${this.config.userAppId}\n${timeStamp}\n${nonceStr}\n${prepayId}\n`;
        const sign = signWechatPayMessage(message, this.config.privateKeyPem);

        return {
            appId: this.config.userAppId,
            partnerId: this.config.mchId,
            prepayId,
            packageValue: 'Sign=WXPay',
            nonceStr,
            timeStamp,
            sign,
        };
    }

    parseAndVerifyPaymentNotify({
        rawBody,
        headers,
    }: {
        rawBody: string;
        headers: WechatPayRequestHeaders;
    }): WechatPayNotifyParseResult {
        const timestamp = headers['wechatpay-timestamp'];
        const nonce = headers['wechatpay-nonce'];
        const signature = headers['wechatpay-signature'];
        const serial = headers['wechatpay-serial'];

        if (
            typeof timestamp !== 'string' ||
            typeof nonce !== 'string' ||
            typeof signature !== 'string' ||
            typeof serial !== 'string'
        ) {
            throw new Error('微信支付回调头缺失');
        }

        if (signature.startsWith('WECHATPAY/SIGNTEST/')) {
            throw new Error('微信支付回调为签名探测流量，当前未通过探测');
        }

        if (serial.toUpperCase() !== this.platformSerialNo) {
            throw new Error('微信支付回调证书序列号不匹配');
        }

        const verificationMessage = `${timestamp}\n${nonce}\n${rawBody}\n`;
        const valid = verifyWechatPaySignature({
            message: verificationMessage,
            signature,
            publicKeyPem: this.platformPublicKeyPem,
        });

        if (!valid) {
            throw new Error('微信支付回调验签失败');
        }

        const { envelope, decrypted } = this.parseAndDecryptNotify(rawBody);
        const transaction = parseJson<WechatPayDecryptedTransaction>(decrypted);

        return {
            envelope,
            transaction,
        };
    }

    parseAndVerifyRefundNotify({
        rawBody,
        headers,
    }: {
        rawBody: string;
        headers: WechatPayRequestHeaders;
    }): WechatPayRefundNotifyParseResult {
        this.verifyNotifyHeaders(rawBody, headers);
        const { envelope, decrypted } = this.parseAndDecryptNotify(rawBody);
        const refund = parseJson<WechatPayDecryptedRefund>(decrypted);

        return {
            envelope,
            refund,
        };
    }

    private verifyNotifyHeaders(
        rawBody: string,
        headers: WechatPayRequestHeaders,
    ) {
        const timestamp = headers['wechatpay-timestamp'];
        const nonce = headers['wechatpay-nonce'];
        const signature = headers['wechatpay-signature'];
        const serial = headers['wechatpay-serial'];

        if (
            typeof timestamp !== 'string' ||
            typeof nonce !== 'string' ||
            typeof signature !== 'string' ||
            typeof serial !== 'string'
        ) {
            throw new Error('微信支付回调头缺失');
        }

        if (signature.startsWith('WECHATPAY/SIGNTEST/')) {
            throw new Error('微信支付回调为签名探测流量，当前未通过探测');
        }

        if (serial.toUpperCase() !== this.platformSerialNo) {
            throw new Error('微信支付回调证书序列号不匹配');
        }

        const verificationMessage = `${timestamp}\n${nonce}\n${rawBody}\n`;
        const valid = verifyWechatPaySignature({
            message: verificationMessage,
            signature,
            publicKeyPem: this.platformPublicKeyPem,
        });

        if (!valid) {
            throw new Error('微信支付回调验签失败');
        }
    }

    private parseAndDecryptNotify(rawBody: string) {
        const envelope = parseJson<WechatPayNotifyEnvelope>(rawBody);
        const decrypted = decryptWechatPayAead({
            apiV3Key: this.config.apiV3Key,
            associatedData: envelope.resource.associated_data,
            nonce: envelope.resource.nonce,
            ciphertext: envelope.resource.ciphertext,
        });

        return {
            envelope,
            decrypted,
        };
    }
}
