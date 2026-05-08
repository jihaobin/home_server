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

const MAX_FACE_IMAGE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FACE_IMAGE_MIME_TYPES = new Set([
    'image/jpeg',
    'image/jpg',
    'image/png',
]);

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

        const faceImageBase64 = faceImageFileId
            ? await this.readFaceImageBase64(faceImageFileId)
            : undefined;

        const result = await this.alipayFaceCertifyClient.certify({
            name,
            idcard,
            outerBizNo: this.createOuterBizNo(userId),
            faceImageBase64,
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

    private async readFaceImageBase64(faceImageFileId: string) {
        const file =
            await this.filesService.getFileObjectBufferByIdentifier(
                faceImageFileId,
            );

        if (!ALLOWED_FACE_IMAGE_MIME_TYPES.has(file.mimeType.toLowerCase())) {
            throw new BadRequestException('人脸照片格式仅支持 JPG 或 PNG');
        }

        if (file.fileSize > MAX_FACE_IMAGE_BYTES) {
            throw new PayloadTooLargeException('人脸照片不能超过 5MB');
        }

        return file.buffer.toString('base64');
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
