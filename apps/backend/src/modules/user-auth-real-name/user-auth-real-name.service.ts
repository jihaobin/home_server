import {
    BadRequestException,
    Inject,
    Injectable,
    PayloadTooLargeException,
} from '@nestjs/common';
import { UserAuthRealNameRepository } from './user-auth-real-name-repository';
import { BusinessException } from 'src/common/exceptions';
import {
    CreateUserAuthRealName,
    ErrorCode,
    UpdateUserAuthRealName,
} from '@repo/types';
import { createId } from '@paralleldrive/cuid2';
import { FilesService } from '../files/files.service';
import { AlipayFaceCertifyClient } from './alipay-face-certify.client';
import * as sharp from 'sharp';

const MAX_FACE_IMAGE_BYTES = 1 * 1024 * 1024;
const FACE_IMAGE_TARGET_SHORT_SIDE = 720;
const FACE_IMAGE_MAX_WIDTH = 1080;
const FACE_IMAGE_MAX_HEIGHT = 1920;
const FACE_IMAGE_MIN_WIDTH = 480;
const FACE_IMAGE_MIN_HEIGHT = 640;
const FACE_IMAGE_JPEG_QUALITY = 92;
const ALLOWED_FACE_IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/jpg']);

type FaceImagePayload = {
    buffer: Buffer;
    extension: 'jpg';
};

@Injectable()
export class UserAuthRealNameService {
    @Inject()
    private readonly userAuthRealNameRepository: UserAuthRealNameRepository;

    @Inject()
    private readonly alipayFaceCertifyClient: AlipayFaceCertifyClient;

    @Inject()
    private readonly filesService: FilesService;

    /**
     * 身份证实名认证
     */
    async authRealName({
        name,
        idcard,
        userId,
        faceImageFileId,
    }: {
        name: string;
        idcard: string;
        userId: string;
        faceImageFileId?: string;
    }) {
        const hasConflict =
            await this.userAuthRealNameRepository.isIdCardUsedByAnotherUser(
                idcard,
                userId,
            );

        if (hasConflict) {
            throw new BusinessException(
                '该身份证号已被占用，请更换后重试',
                ErrorCode.RESOURCE_EXISTS,
            );
        }

        const faceImage = faceImageFileId
            ? await this.readFaceImageBuffer(faceImageFileId)
            : undefined;

        const result = await this.alipayFaceCertifyClient.certify({
            name,
            idcard,
            outerBizNo: this.createOuterBizNo(userId),
            faceImageBuffer: faceImage?.buffer,
            faceImageExtension: faceImage?.extension,
        });
        if (!result.passed) {
            throw new BadRequestException(
                result.mismatchReason || '实名认证未通过，请核对信息后重试',
            );
        }

        await this.upsertUserRealNameAuth({
            userId,
            realName: name,
            idCardNumber: idcard,
        });

        return {
            name,
            idcard,
            res: true,
            passed: true,
            description: faceImageFileId
                ? '实名和人脸认证通过'
                : '实名认证通过',
            certifyNo: result.certifyNo,
            score: result.score,
            quality: result.quality,
            mismatchReason: result.mismatchReason,
        };
    }

    private createOuterBizNo(userId: string) {
        return `face_${userId}_${Date.now()}_${createId()}`;
    }

    private async readFaceImageBuffer(
        faceImageFileId: string,
    ): Promise<FaceImagePayload> {
        const file =
            await this.filesService.getFileObjectBufferByIdentifier(
                faceImageFileId,
            );
        const mimeType = file.mimeType.toLowerCase();

        if (!ALLOWED_FACE_IMAGE_MIME_TYPES.has(mimeType)) {
            throw new BadRequestException('人脸照片格式仅支持 JPG 或 JPEG');
        }

        const normalizedImage = await this.normalizeFaceImageBuffer(
            file.buffer,
        );

        if (normalizedImage.buffer.length > MAX_FACE_IMAGE_BYTES) {
            throw new PayloadTooLargeException(
                '人脸照片压缩后仍超过 1MB，请重新拍摄或从相册选择更小的照片',
            );
        }

        return normalizedImage;
    }

    private async normalizeFaceImageBuffer(
        buffer: Buffer,
    ): Promise<FaceImagePayload> {
        const image = sharp(buffer).rotate();
        const metadata = await image.metadata();
        const width = metadata.width ?? 0;
        const height = metadata.height ?? 0;

        if (width <= 0 || height <= 0) {
            throw new BadRequestException('无法识别人脸照片尺寸，请重新上传');
        }

        if (width > height) {
            throw new BadRequestException('人脸照片需保持竖向拍摄');
        }

        if (width < FACE_IMAGE_MIN_WIDTH || height < FACE_IMAGE_MIN_HEIGHT) {
            throw new BadRequestException('人脸照片分辨率不能低于 640x480');
        }

        const normalizedBuffer = await image
            .resize({
                width: FACE_IMAGE_TARGET_SHORT_SIDE,
                height: FACE_IMAGE_MAX_HEIGHT,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .resize({
                width: FACE_IMAGE_MAX_WIDTH,
                height: FACE_IMAGE_MAX_HEIGHT,
                fit: 'inside',
                withoutEnlargement: true,
            })
            .jpeg({
                quality: FACE_IMAGE_JPEG_QUALITY,
                mozjpeg: true,
            })
            .toBuffer();

        return { buffer: normalizedBuffer, extension: 'jpg' };
    }

    private async upsertUserRealNameAuth(data: UpdateUserAuthRealName) {
        const existing =
            await this.userAuthRealNameRepository.getUserRealNameByUserId(
                data.userId,
            );

        if (existing) {
            return this.userAuthRealNameRepository.updateUserRealNameAuth(data);
        }

        return this.userAuthRealNameRepository.createUserRealNameAuth(
            data as CreateUserAuthRealName,
        );
    }

    /**
     * 获取用户实名认证信息
     */
    async getUserRealNameByUserId(userId: string) {
        return this.userAuthRealNameRepository.getUserRealNameByUserId(userId);
    }

    /**
     * 创建用户实名认证信息
     */
    async createUserRealNameAuth(data: CreateUserAuthRealName) {
        return this.userAuthRealNameRepository.createUserRealNameAuth(data);
    }

    /**
     * 更新用户实名认证信息
     */
    async updateUserRealNameAuth(data: UpdateUserAuthRealName) {
        return this.userAuthRealNameRepository.updateUserRealNameAuth(data);
    }

    /**
     * 删除用户实名认证信息
     */
    async deleteUserRealNameAuth(id: string) {
        return this.userAuthRealNameRepository.deleteUpdateUserRealNameAuth(id);
    }
}
