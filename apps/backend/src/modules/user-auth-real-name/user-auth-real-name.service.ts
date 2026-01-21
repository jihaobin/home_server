import { Inject, Injectable } from '@nestjs/common';
import { realNameAuthPost } from './api';
import { UserAuthRealNameRepository } from './user-auth-real-name-repository';
import { BusinessException } from 'src/common/exceptions';
import {
    CreateUserAuthRealName,
    ErrorCode,
    UpdateUserAuthRealName,
} from '@repo/types';

@Injectable()
export class UserAuthRealNameService {
    @Inject()
    private readonly userAuthRealNameRepository: UserAuthRealNameRepository;

    /**
     * 身份证实名认证
     */
    async authRealName({
        name,
        idcard,
        userId,
    }: {
        name: string;
        idcard: string;
        userId: string;
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

        const response = await realNameAuthPost({ name, idCard: idcard });
        return response;
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
