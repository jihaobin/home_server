import {
    BadGatewayException,
    GatewayTimeoutException,
} from '@nestjs/common';
import type { AlipaySdk } from 'alipay-sdk';
import { AlipayFaceCertifyClient } from './alipay-face-certify.client';

describe('AlipayFaceCertifyClient', () => {
    let sdk: jest.Mocked<Pick<AlipaySdk, 'curl'>>;
    let client: AlipayFaceCertifyClient;

    beforeEach(() => {
        sdk = {
            curl: jest.fn(),
        } as any;
        client = new AlipayFaceCertifyClient(sdk as unknown as AlipaySdk);
    });

    it('归一化支付宝 passed=true 响应', async () => {
        sdk.curl.mockResolvedValue({
            data: {
                certify_no: 'cert_123',
                passed: 'true',
                score: '88.1',
                quality: 'T',
                mismatch_reason: '',
            },
            responseHttpStatus: 200,
            traceId: 'trace_1',
        } as any);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
                faceImageBase64: 'aW1hZ2U=',
            }),
        ).resolves.toMatchObject({
            certifyNo: 'cert_123',
            passed: true,
            score: '88.1',
            quality: 'T',
            mismatchReason: null,
        });

        expect(sdk.curl).toHaveBeenCalledWith(
            'POST',
            '/v3/datadigital/fincloud/generalsaas/face/source/certify',
            {
                body: {
                    cert_name: '张三',
                    cert_no: '110101199001011234',
                    outer_biz_no: 'face_user_1_1_abc',
                    face_image: 'aW1hZ2U=',
                },
                needEncrypt: true,
                requestId: 'face_user_1_1_abc',
                requestTimeout: 10000,
            },
        );
    });

    it('归一化支付宝 passed=false 响应', async () => {
        sdk.curl.mockResolvedValue({
            data: {
                certifyNo: 'cert_456',
                passed: false,
                mismatchReason: '照片质量不足',
            },
            responseHttpStatus: 200,
            traceId: 'trace_2',
        } as any);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
            }),
        ).resolves.toMatchObject({
            certifyNo: 'cert_456',
            passed: false,
            mismatchReason: '照片质量不足',
        });
    });

    it('缺少 passed 字段时抛出 502', async () => {
        sdk.curl.mockResolvedValue({
            data: {
                certify_no: 'cert_123',
            },
            responseHttpStatus: 200,
            traceId: 'trace_1',
        } as any);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
            }),
        ).rejects.toBeInstanceOf(BadGatewayException);
    });

    it('超时错误映射为 504', async () => {
        const error = new Error('socket timeout');
        (error as any).code = 'ETIMEDOUT';
        sdk.curl.mockRejectedValue(error);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
            }),
        ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });
});
