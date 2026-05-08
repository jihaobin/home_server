import {
    BadGatewayException,
    GatewayTimeoutException,
    Injectable,
    Logger,
    Optional,
} from '@nestjs/common';
import { AlipaySdk } from 'alipay-sdk';
import { createWorkerAliPaySdk } from 'src/lib/alipaySdk';

export type AlipayFaceSourceCertifyParams = {
    name: string;
    idcard: string;
    outerBizNo: string;
    faceImageBase64?: string;
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
    private readonly logger = new Logger(AlipayFaceCertifyClient.name);

    constructor(@Optional() alipaySdk?: AlipaySdk) {
        this.alipaySdk = alipaySdk ?? createWorkerAliPaySdk();
    }

    async certify(
        params: AlipayFaceSourceCertifyParams,
    ): Promise<AlipayFaceSourceCertifyResult> {
        try {
            const body: Record<string, string> = {
                cert_name: params.name,
                cert_no: params.idcard,
                outer_biz_no: params.outerBizNo,
            };

            if (params.faceImageBase64) {
                body.face_image = params.faceImageBase64;
            }

            const response = await this.alipaySdk.curl(
                'POST',
                FACE_SOURCE_CERTIFY_PATH,
                {
                    body,
                    needEncrypt: true,
                    requestId: params.outerBizNo,
                    requestTimeout: 10000,
                },
            );

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
            this.logger.error(
                `支付宝人脸核身调用失败: ${JSON.stringify(getSafeErrorLogPayload(error))}`,
            );
            throw new BadGatewayException(
                '认证服务暂不可用，请稍后重试',
                error instanceof Error ? error.message : undefined,
            );
        }
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

        const passed = passedRaw === true || String(passedRaw) === 'true';

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
