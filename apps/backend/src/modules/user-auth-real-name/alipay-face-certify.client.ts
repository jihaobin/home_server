import {
    BadGatewayException,
    GatewayTimeoutException,
    Injectable,
    Logger,
    Optional,
} from '@nestjs/common';
import { createSign, createVerify, randomUUID } from 'node:crypto';
import { Readable } from 'node:stream';
import { AlipayFormStream, AlipayRequestError, AlipaySdk } from 'alipay-sdk';
import urllib from 'urllib';
import * as cryptoJs from 'crypto-js';
import { createWorkerAliPaySdk } from 'src/lib/alipaySdk';

export type AlipayFaceSourceCertifyParams = {
    name: string;
    idcard: string;
    outerBizNo: string;
    faceImageBuffer?: Buffer;
    faceImageExtension?: 'jpg' | 'png';
};

export type AlipayFaceSourceCertifyResult = {
    certifyNo: string | null;
    passed: boolean;
    score: string | null;
    quality: string | null;
    mismatchReason: string | null;
    raw: unknown;
};

const FACE_SOURCE_CERTIFY_PATH =
    '/v3/datadigital/fincloud/generalsaas/face/source/certify';

type EncryptedMultipartCurlParams = {
    sdk: AlipaySdk;
    path: string;
    body: Record<string, string>;
    file: {
        fieldName: string;
        fileName: string;
        stream: Readable;
    };
    requestId: string;
    requestTimeout: number;
};

type EncryptedMultipartCurl = (
    params: EncryptedMultipartCurlParams,
) => Promise<EncryptedMultipartCurlResult>;

type EncryptedMultipartCurlResult = {
    data: unknown;
    responseHttpStatus: number;
    traceId: string;
};

function readField(
    source: Record<string, unknown>,
    snakeKey: string,
    camelKey: string,
) {
    return source[snakeKey] ?? source[camelKey] ?? null;
}

function normalizeNullableString(value: unknown) {
    if (value === null || value === undefined || value === '') {
        return null;
    }
    return String(value);
}

function normalizePassed(value: unknown) {
    if (value === true) {
        return true;
    }

    if (value === false) {
        return false;
    }

    const normalized = String(value).trim().toUpperCase();
    if (normalized === 'T' || normalized === 'TRUE') {
        return true;
    }
    if (normalized === 'F' || normalized === 'FALSE') {
        return false;
    }

    return false;
}

function parseAesKey(aesKey: string) {
    return {
        iv: cryptoJs.enc.Hex.parse('00000000000000000000000000000000'),
        key: cryptoJs.enc.Base64.parse(aesKey),
    };
}

function aesEncryptText(plainText: string, aesKey: string) {
    const { iv, key } = parseAesKey(aesKey);
    return cryptoJs.AES.encrypt(plainText, key, { iv }).toString();
}

function aesDecryptText(encryptedText: string, aesKey: string) {
    const { iv, key } = parseAesKey(aesKey);
    return cryptoJs.AES.decrypt(encryptedText, key, { iv }).toString(
        cryptoJs.enc.Utf8,
    );
}

function signatureV3(signString: string, appPrivateKey: string) {
    return createSign('RSA-SHA256')
        .update(signString, 'utf-8')
        .sign(appPrivateKey, 'base64');
}

function verifySignatureV3(
    signString: string,
    expectedSignature: string,
    alipayPublicKey: string,
) {
    return createVerify('RSA-SHA256')
        .update(signString, 'utf-8')
        .verify(alipayPublicKey, expectedSignature, 'base64');
}

function isTimeoutError(error: unknown) {
    if (!(error instanceof Error)) {
        return false;
    }
    const code = (error as Error & { code?: string }).code;
    const message = error.message.toLowerCase();
    return (
        code === 'ETIMEDOUT' ||
        code === 'ESOCKETTIMEDOUT' ||
        code === 'ECONNABORTED' ||
        message.includes('timeout') ||
        message.includes('timed out')
    );
}

function isMissingAlipayResponseSignatureError(error: unknown) {
    if (!(error instanceof TypeError)) {
        return false;
    }

    const code = (error as Error & { code?: string }).code;

    return (
        code === 'ERR_INVALID_ARG_TYPE' &&
        error.message.includes('"signature"') &&
        error.message.includes('Received undefined')
    );
}

function getSafeErrorLogPayload(error: unknown) {
    if (!(error instanceof Error)) {
        return { message: String(error) };
    }

    const alipayError = error as Error & {
        code?: string;
        traceId?: string;
        responseHttpStatus?: number;
        status?: number;
    };

    return {
        name: error.name,
        message: error.message,
        code: alipayError.code,
        traceId: alipayError.traceId,
        responseHttpStatus: alipayError.responseHttpStatus,
        status: alipayError.status,
    };
}

@Injectable()
export class AlipayFaceCertifyClient {
    private readonly alipaySdk: AlipaySdk;
    private readonly encryptedMultipartCurl: EncryptedMultipartCurl;
    private readonly logger = new Logger(AlipayFaceCertifyClient.name);

    constructor(
        @Optional() alipaySdk?: AlipaySdk,
        @Optional() encryptedMultipartCurl?: EncryptedMultipartCurl,
    ) {
        this.alipaySdk = alipaySdk ?? createWorkerAliPaySdk();
        this.encryptedMultipartCurl =
            encryptedMultipartCurl ?? curlEncryptedMultipart;
    }

    async certify(
        params: AlipayFaceSourceCertifyParams,
    ): Promise<AlipayFaceSourceCertifyResult> {
        try {
            const body: Record<string, string> = {
                cert_name: params.name,
                cert_no: params.idcard,
                outer_biz_no: params.outerBizNo,
                cert_type: 'IDENTITY_CARD',
            };

            const response = params.faceImageBuffer
                ? await this.certifyWithFaceImage({
                      body,
                      faceImageBuffer: params.faceImageBuffer,
                      faceImageExtension: params.faceImageExtension ?? 'jpg',
                      outerBizNo: params.outerBizNo,
                  })
                : await this.alipaySdk.curl('POST', FACE_SOURCE_CERTIFY_PATH, {
                      body,
                      needEncrypt: true,
                      requestId: params.outerBizNo,
                      requestTimeout: 10000,
                  });

            return this.normalizeResponse(response);
        } catch (error) {
            if (error instanceof BadGatewayException) {
                this.logger.warn(
                    `支付宝人脸核身响应异常: ${JSON.stringify(getSafeErrorLogPayload(error))}`,
                );
                throw error;
            }
            if (isTimeoutError(error)) {
                this.logger.warn(
                    `支付宝人脸核身请求超时: ${JSON.stringify(getSafeErrorLogPayload(error))}`,
                );
                throw new GatewayTimeoutException(
                    '人脸认证服务响应超时，请稍后重试',
                );
            }
            if (isMissingAlipayResponseSignatureError(error)) {
                this.logger.error(
                    `支付宝人脸核身响应缺少签名头，SDK验签失败: ${JSON.stringify(getSafeErrorLogPayload(error))}`,
                );
                throw new BadGatewayException(
                    '认证服务响应异常，请稍后重试',
                    error.message,
                );
            }
            this.logger.error(
                `支付宝人脸核身调用失败: ${JSON.stringify(getSafeErrorLogPayload(error))}`,
            );
            throw new BadGatewayException(
                '认证服务暂不可用，请稍后重试',
                error instanceof Error ? error.message : undefined,
            );
        }
    }

    private async certifyWithFaceImage({
        body,
        faceImageBuffer,
        faceImageExtension,
        outerBizNo,
    }: {
        body: Record<string, string>;
        faceImageBuffer: Buffer;
        faceImageExtension: 'jpg' | 'png';
        outerBizNo: string;
    }) {
        return this.encryptedMultipartCurl({
            sdk: this.alipaySdk,
            path: FACE_SOURCE_CERTIFY_PATH,
            body,
            file: {
                fieldName: 'file_content',
                fileName: `${outerBizNo}.${faceImageExtension}`,
                stream: Readable.from(faceImageBuffer),
            },
            requestId: outerBizNo,
            requestTimeout: 10000,
        });
    }

    private normalizeResponse(raw: unknown): AlipayFaceSourceCertifyResult {
        const maybeData =
            raw &&
            typeof raw === 'object' &&
            'data' in raw &&
            (raw as { data?: unknown }).data
                ? (raw as { data: unknown }).data
                : raw;

        if (!maybeData || typeof maybeData !== 'object') {
            throw new BadGatewayException('认证服务响应异常，请稍后重试');
        }

        const data = maybeData as Record<string, unknown>;
        const passedRaw = readField(data, 'passed', 'passed');

        if (passedRaw === null || passedRaw === undefined) {
            throw new BadGatewayException('认证服务响应异常，请稍后重试');
        }

        const passed = normalizePassed(passedRaw);

        return {
            certifyNo: normalizeNullableString(
                readField(data, 'certify_no', 'certifyNo'),
            ),
            passed,
            score: normalizeNullableString(readField(data, 'score', 'score')),
            quality: normalizeNullableString(
                readField(data, 'quality', 'quality'),
            ),
            mismatchReason: normalizeNullableString(
                readField(data, 'mismatch_reason', 'mismatchReason'),
            ),
            raw,
        };
    }
}

async function curlEncryptedMultipart({
    sdk,
    path,
    body,
    file,
    requestId,
    requestTimeout,
}: EncryptedMultipartCurlParams): Promise<EncryptedMultipartCurlResult> {
    const config = sdk.config;
    if (!config.encryptKey) {
        throw new TypeError(
            '请配置 config.encryptKey 才能通过加密表单上传调用支付宝',
        );
    }

    const endpointUrl = new URL(`${config.endpoint}${path}`);
    const httpRequestUrl = endpointUrl.pathname + endpointUrl.search;
    const encryptedBody = aesEncryptText(
        JSON.stringify(body),
        config.encryptKey,
    );

    const form = new AlipayFormStream();
    form.field('data', encryptedBody, 'text/plain');
    form.stream(file.fieldName, file.stream, file.fileName);

    const headers: Record<string, string> = {
        'user-agent': sdk.version,
        'alipay-request-id': requestId,
        'alipay-encryption-algm': 'AES',
        'alipay-encrypt-type': 'AES',
        accept: 'application/json',
        ...form.headers(),
    };

    if (config.alipayRootCertSn) {
        headers['alipay-root-cert-sn'] = config.alipayRootCertSn;
    }

    let authString = `app_id=${config.appId}`;
    if (config.appCertSn) {
        authString += `,app_cert_sn=${config.appCertSn}`;
    }
    authString += `,nonce=${randomUUID()},timestamp=${Date.now()}`;
    if (config.additionalAuthInfo) {
        authString += `,${config.additionalAuthInfo}`;
    }

    const signString = `${authString}\nPOST\n${httpRequestUrl}\n${encryptedBody}\n`;
    const signature = signatureV3(signString, config.privateKey);
    headers.authorization = `ALIPAY-SHA256withRSA ${authString},sign=${signature}`;

    const httpResponse = await urllib.request<string>(endpointUrl.toString(), {
        method: 'POST',
        dataType: 'text',
        timeout: requestTimeout ?? config.timeout,
        headers,
        content: new Readable().wrap(form as any),
        dispatcher: config.proxyAgent,
    });

    const traceId =
        (httpResponse.headers['alipay-trace-id'] as string | undefined) ??
        requestId;

    if (httpResponse.status >= 400) {
        const errorData = JSON.parse(httpResponse.data) as {
            code?: string;
            message?: string;
            links?: unknown;
        };
        throw new AlipayRequestError(errorData.message || '支付宝请求失败', {
            code: errorData.code,
            links: errorData.links as any,
            responseHttpStatus: httpResponse.status,
            responseHttpHeaders: httpResponse.headers,
            traceId,
        });
    }

    let httpResponseBody = httpResponse.data;
    const expectedSignature = httpResponse.headers['alipay-signature'] as
        | string
        | undefined;
    if (expectedSignature && config.alipayPublicKey) {
        const responseSignString = `${httpResponse.headers['alipay-timestamp'] as string}\n${httpResponse.headers['alipay-nonce'] as string}\n${httpResponseBody}\n`;
        const expectedAlipaySN = httpResponse.headers['alipay-sn'] as
            | string
            | undefined;
        if (
            expectedAlipaySN &&
            config.alipayCertSn &&
            expectedAlipaySN !== config.alipayCertSn
        ) {
            throw new AlipayRequestError(
                `支付宝公钥证书号不匹配，服务端返回的是：${expectedAlipaySN}，SDK 配置的是：${config.alipayCertSn}`,
                {
                    code: 'response-alipay-sn-verify-error',
                    responseDataRaw: httpResponse.data,
                    responseHttpStatus: httpResponse.status,
                    responseHttpHeaders: httpResponse.headers,
                    traceId,
                },
            );
        }
        if (
            !verifySignatureV3(
                responseSignString,
                expectedSignature,
                config.alipayPublicKey,
            )
        ) {
            throw new AlipayRequestError('支付宝响应验签失败', {
                code: 'response-signature-verify-error',
                responseDataRaw: httpResponse.data,
                responseHttpStatus: httpResponse.status,
                responseHttpHeaders: httpResponse.headers,
                traceId,
            });
        }
    }

    httpResponseBody = aesDecryptText(httpResponseBody, config.encryptKey);
    if (!httpResponseBody) {
        throw new AlipayRequestError(
            '解密失败，请确认 config.encryptKey 设置正确',
            {
                code: 'decrypt-error',
                responseDataRaw: httpResponse.data,
                responseHttpStatus: httpResponse.status,
                responseHttpHeaders: httpResponse.headers,
                traceId,
            },
        );
    }

    return {
        data: JSON.parse(httpResponseBody),
        responseHttpStatus: httpResponse.status,
        traceId,
    };
}
