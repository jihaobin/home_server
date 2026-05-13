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
import * as sharp from 'sharp';

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

const sharpMock = sharp as unknown as jest.Mock;

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
        sharpMock.mockReset();
        sharpMock.mockReturnValue({
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 720, height: 1280 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('normalized-jpeg')),
        });
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
                faceImageBuffer: undefined,
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

    it('传入人脸文件时规范化为高质量 JPEG 后提交支付宝', async () => {
        const imagePipeline = {
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 720, height: 1280 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn().mockResolvedValue(Buffer.from('normalized-jpeg')),
        };
        sharpMock.mockReturnValue(imagePipeline);
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
                faceImageBuffer: Buffer.from('normalized-jpeg'),
                faceImageExtension: 'jpg',
            }),
        );
        expect(imagePipeline.resize).toHaveBeenCalledWith({
            width: 720,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true,
        });
        expect(imagePipeline.jpeg).toHaveBeenCalledWith({
            quality: 92,
            mozjpeg: true,
        });
    });

    it('PNG 人脸文件不符合支付宝格式要求时拒绝', async () => {
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: Buffer.from('png-content'),
            mimeType: 'image/png',
            fileSize: 11,
        });

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
                faceImageFileId: 'file_1',
            }),
        ).rejects.toThrow('人脸照片格式仅支持 JPG 或 JPEG');

        expect(alipayClient.certify).not.toHaveBeenCalled();
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

    it('人脸文件超过 1MB 时压缩后再提交支付宝', async () => {
        const originalBuffer = Buffer.alloc(1024 * 1024 + 100);
        const compressedBuffer = Buffer.from('compressed-image');
        const toBuffer = jest.fn().mockResolvedValue(compressedBuffer);
        const imagePipeline = {
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 720, height: 1280 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer,
        };
        sharpMock.mockReturnValue(imagePipeline);
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: originalBuffer,
            mimeType: 'image/jpeg',
            fileSize: originalBuffer.length,
        });

        await service.authRealName({
            userId: 'user_1',
            name: '张三',
            idcard: '110101199001011234',
            faceImageFileId: 'file_1',
        });

        expect(sharpMock).toHaveBeenCalledWith(originalBuffer);
        expect(imagePipeline.resize).toHaveBeenCalledWith({
            width: 720,
            height: 1920,
            fit: 'inside',
            withoutEnlargement: true,
        });
        expect(imagePipeline.jpeg).toHaveBeenCalledWith({
            quality: 92,
            mozjpeg: true,
        });
        expect(alipayClient.certify).toHaveBeenCalledWith(
            expect.objectContaining({
                faceImageBuffer: compressedBuffer,
                faceImageExtension: 'jpg',
            }),
        );
    });

    it('人脸照片宽大于高时拒绝', async () => {
        sharpMock.mockReturnValue({
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 1280, height: 720 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn(),
        });
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: Buffer.from('landscape-image'),
            mimeType: 'image/jpeg',
            fileSize: 15,
        });

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
                faceImageFileId: 'file_1',
            }),
        ).rejects.toThrow('人脸照片需保持竖向拍摄');

        expect(alipayClient.certify).not.toHaveBeenCalled();
    });

    it('人脸照片分辨率低于 640x480 时拒绝', async () => {
        sharpMock.mockReturnValue({
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 360, height: 600 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer: jest.fn(),
        });
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: Buffer.from('small-image'),
            mimeType: 'image/jpeg',
            fileSize: 11,
        });

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
                faceImageFileId: 'file_1',
            }),
        ).rejects.toThrow('人脸照片分辨率不能低于 640x480');

        expect(alipayClient.certify).not.toHaveBeenCalled();
    });

    it('人脸文件压缩后仍超过 1MB 时拒绝且不调用支付宝', async () => {
        const originalBuffer = Buffer.alloc(1024 * 1024 + 100);
        const oversizedBuffer = Buffer.alloc(1024 * 1024 + 1);
        const toBuffer = jest.fn().mockResolvedValue(oversizedBuffer);
        sharpMock.mockReturnValue({
            rotate: jest.fn().mockReturnThis(),
            metadata: jest.fn().mockResolvedValue({ width: 720, height: 1280 }),
            resize: jest.fn().mockReturnThis(),
            jpeg: jest.fn().mockReturnThis(),
            toBuffer,
        });
        filesService.getFileObjectBufferByIdentifier.mockResolvedValue({
            buffer: originalBuffer,
            mimeType: 'image/jpeg',
            fileSize: originalBuffer.length,
        });

        await expect(
            service.authRealName({
                userId: 'user_1',
                name: '张三',
                idcard: '110101199001011234',
                faceImageFileId: 'file_1',
            }),
        ).rejects.toThrow('人脸照片压缩后仍超过 1MB');

        expect(toBuffer).toHaveBeenCalledTimes(1);
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
