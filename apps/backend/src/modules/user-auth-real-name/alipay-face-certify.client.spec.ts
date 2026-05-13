import {
    BadGatewayException,
    GatewayTimeoutException,
} from '@nestjs/common';
import type { AlipaySdk } from 'alipay-sdk';
import { AlipayFaceCertifyClient } from './alipay-face-certify.client';

describe('AlipayFaceCertifyClient', () => {
    let sdk: jest.Mocked<Pick<AlipaySdk, 'curl'>>;
    let encryptedMultipartCurl: jest.Mock;
    let client: AlipayFaceCertifyClient;

    beforeEach(() => {
        sdk = {
            curl: jest.fn(),
        } as any;
        encryptedMultipartCurl = jest.fn();
        client = new AlipayFaceCertifyClient(
            sdk as unknown as AlipaySdk,
            encryptedMultipartCurl,
        );
    });

    it('归一化支付宝 passed=T 响应', async () => {
        encryptedMultipartCurl.mockResolvedValue({
            data: {
                certify_no: 'cert_123',
                passed: 'T',
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
                faceImageBuffer: Buffer.from('image-content'),
                faceImageExtension: 'png',
            }),
        ).resolves.toMatchObject({
            certifyNo: 'cert_123',
            passed: true,
            score: '88.1',
            quality: 'T',
            mismatchReason: null,
        });

        expect(sdk.curl).not.toHaveBeenCalled();
        expect(encryptedMultipartCurl).toHaveBeenCalledWith(
            expect.objectContaining({
                sdk,
                path: '/v3/datadigital/fincloud/generalsaas/face/source/certify',
                body: {
                    cert_name: '张三',
                    cert_no: '110101199001011234',
                    outer_biz_no: 'face_user_1_1_abc',
                    cert_type: 'IDENTITY_CARD',
                },
                file: {
                    fieldName: 'file_content',
                    fileName: 'face_user_1_1_abc.png',
                    stream: expect.any(Object),
                },
                requestId: 'face_user_1_1_abc',
                requestTimeout: 10000,
            }),
        );
    });

    it('未传人脸图片时使用 JSON body 加密请求', async () => {
        sdk.curl.mockResolvedValue({
            data: {
                certify_no: 'cert_123',
                passed: true,
            },
            responseHttpStatus: 200,
            traceId: 'trace_1',
        } as any);

        await client.certify({
            name: '张三',
            idcard: '110101199001011234',
            outerBizNo: 'face_user_1_1_abc',
        });

        expect(sdk.curl).toHaveBeenCalledWith(
            'POST',
            '/v3/datadigital/fincloud/generalsaas/face/source/certify',
            {
                body: {
                    cert_name: '张三',
                    cert_no: '110101199001011234',
                    outer_biz_no: 'face_user_1_1_abc',
                    cert_type: 'IDENTITY_CARD',
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

    it('归一化支付宝 passed=F 响应', async () => {
        sdk.curl.mockResolvedValue({
            data: {
                certifyNo: 'cert_789',
                passed: 'F',
                mismatchReason: '身份信息不一致',
            },
            responseHttpStatus: 200,
            traceId: 'trace_3',
        } as any);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
            }),
        ).resolves.toMatchObject({
            certifyNo: 'cert_789',
            passed: false,
            mismatchReason: '身份信息不一致',
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

    it('支付宝 V3 响应缺少签名头时抛出 502', async () => {
        const error = new TypeError(
            'The "signature" argument must be of type string or an instance of ArrayBuffer, Buffer, TypedArray, or DataView. Received undefined',
        );
        (error as any).code = 'ERR_INVALID_ARG_TYPE';
        sdk.curl.mockRejectedValue(error);

        await expect(
            client.certify({
                name: '张三',
                idcard: '110101199001011234',
                outerBizNo: 'face_user_1_1_abc',
            }),
        ).rejects.toBeInstanceOf(BadGatewayException);
    });
});
