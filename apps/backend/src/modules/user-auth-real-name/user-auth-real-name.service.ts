import { Injectable } from '@nestjs/common';
import { realNameAuthPost } from './api';

@Injectable()
export class UserAuthRealNameService {
    /**
     * 身份证实名认证
     */
    async authRealName({ name, idcard }: { name: string; idcard: string }) {
        const response = await realNameAuthPost({ name, idCard: idcard });
        return response;
    }
}
