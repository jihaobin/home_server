import {
    BadGatewayException,
    BadRequestException,
    GatewayTimeoutException,
} from '@nestjs/common';
import { BusinessException } from 'src/common/exceptions';
import type { FilesService } from '../files/files.service';
import type {
    AlipayFaceCertifyClient,
    AlipayFaceSourceCertifyResult,
} from './alipay-face-certify.client';
import type { UserAuthRealNameRepository } from './user-auth-real-name-repository';
import { UserAuthRealNameService } from './user-auth-real-name.service';

jest.mock('sharp', () => jest.fn());

type MockRepository = jest.Mocked<
    Pick<
        UserAuthRealNameRepository,
        | 'isIdCardUsedByAnotherUser'
        | 'getUserRealNameByUserId'
        | 'createUserRealNameAuth'
        | 'updateUserRealNameAuth'
    >
>;

type MockAlipayClient = jest.Mocked<Pick<AlipayFaceCertifyClient, 'certify'>>;

type MockFilesService = jest.Mocked<
    Pick<FilesService, 'getFileObjectBufferByIdentifier'>
>;

const passedResult = (
    overrides: Partial<AlipayFaceSourceCertifyResult> = {},
): AlipayFaceSourceCertifyResult => ({
    certifyNo: 'cert_123',
    passed: true,
    score: '86.5',
    quality: 'T',
    mismatchReason: null,
    raw: { passed: 'true' },
    ...overrides,
});

describe('UserAuthRealNameService', () => {
    let service: UserAuthRealNameService;
    let repository: MockRepository;
    let alipayClient: MockAlipayClient;
    let filesService: MockFilesService;

    beforeEach(() => {
        repository = {
            isIdCardUsedByAnotherUser: jest.fn().mockResolvedValue(false),
            getUserRealNameByUserId: jest.fn().mockResolvedValue(null),
            createUserRealNameAuth: jest.fn().mockResolvedValue({}),
            updateUserRealNameAuth: jest.fn().mockResolvedValue({}),
        };
        alipayClient = {
            certify: jest.fn().mockResolvedValue(passedResult()),
        };
        filesService = {
            getFileObjectBufferByIdentifier: jest.fn(),
        };

        service = new UserAuthRealNameService();
        (service as any).userAuthRealNameRepository =
            repository as unknown as UserAuthRealNameRepository;
        (service as any).alipayFaceCertifyClient =
            alipayClient as unknown as AlipayFaceCertifyClient;
        (service as any).filesService = filesService as unknown as FilesService;
    });

    it('身份证被其他用户占用时拒绝并且不调用支付宝', async () => {
        repository.isIdCardUsedByAnotherUser.mockResolvedValue(true);

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
            }),
        ).rejects.toBeInstanceOf(BusinessException);

        expect(alipayClient.certify).not.toHaveBeenCalled();
        expect(repository.createUserRealNameAuth).not.toHaveBeenCalled();
        expect(repository.updateUserRealNameAuth).not.toHaveBeenCalled();
    });

    it('支付宝核验通过后创建实名资料并返回脱敏前业务结果', async () => {
        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
            }),
        ).resolves.toMatchObject({
            name: '张三',
            idcard: '110101199001011234',
            res: true,
            passed: true,
            certifyNo: 'cert_123',
            description: '实名认证通过',
        });

        expect(alipayClient.certify).toHaveBeenCalledWith(
            expect.objectContaining({
                name: '张三',
                idcard: '110101199001011234',
                faceImageBase64: undefined,
                outerBizNo: expect.stringMatching(/^face_user_1_\d+_/),
            }),
        );
        expect(repository.createUserRealNameAuth).toHaveBeenCalledWith({
            userId: 'user_1',
            realName: '张三',
            idCardNumber: '110101199001011234',
        });
        expect(repository.updateUserRealNameAuth).not.toHaveBeenCalled();
    });

    it('已有实名资料时核验通过后更新实名资料', async () => {
        repository.getUserRealNameByUserId.mockResolvedValue({
            userId: 'user_1',
        } as any);

        await service.authRealName({
            userId: 'user_1',
            name: '李四',
            idcard: '110101199001011235',
        });

        expect(repository.updateUserRealNameAuth).toHaveBeenCalledWith({
            userId: 'user_1',
            realName: '李四',
            idCardNumber: '110101199001011235',
        });
        expect(repository.createUserRealNameAuth).not.toHaveBeenCalled();
    });

    it('传入人脸文件时读取图片并提交 base64', async () => {
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: Buffer.from('image-content'),
            mimeType: 'image/jpeg',
            fileSize: 13,
        });

        await service.authRealName({
            userId: 'user_1',
            name: '张三',
            idcard: '110101199001011234',
            faceImageFileId: 'file_1',
        });

        expect(filesService.getFileObjectBufferByIdentifier).toHaveBeenCalledWith(
            'file_1',
        );
        expect(alipayClient.certify).toHaveBeenCalledWith(
            expect.objectContaining({
                faceImageBase64: Buffer.from('image-content').toString('base64'),
            }),
        );
    });

    it('人脸文件不是图片时拒绝', async () => {
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: Buffer.from('file'),
            mimeType: 'application/pdf',
            fileSize: 4,
        });

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
                faceImageFileId: 'file_1',
            }),
        ).rejects.toBeInstanceOf(BadRequestException);

        expect(alipayClient.certify).not.toHaveBeenCalled();
    });

    it('支付宝核验不通过时返回业务失败且不落库', async () => {
        alipayClient.certify.mockResolvedValue(
            passedResult({
                passed: false,
                mismatchReason: '身份信息不一致',
            }),
        );

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
            }),
        ).rejects.toThrow('身份信息不一致');

        expect(repository.createUserRealNameAuth).not.toHaveBeenCalled();
        expect(repository.updateUserRealNameAuth).not.toHaveBeenCalled();
    });

    it('支付宝超时异常透传为 504', async () => {
        alipayClient.certify.mockRejectedValue(
            new GatewayTimeoutException('人脸认证服务响应超时，请稍后重试'),
        );

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
            }),
        ).rejects.toBeInstanceOf(GatewayTimeoutException);
    });

    it('支付宝响应结构异常透传为 502', async () => {
        alipayClient.certify.mockRejectedValue(
            new BadGatewayException('认证服务响应异常，请稍后重试'),
        );

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
            }),
        ).rejects.toBeInstanceOf(BadGatewayException);
    });
});
