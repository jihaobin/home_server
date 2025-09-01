import { Controller, Get, Query, UsePipes } from '@nestjs/common';
import { UserAuthRealNameService } from './user-auth-real-name.service';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    userAuthRealNameApiRequestSchema,
    userAuthRealNameDataSchema,
} from '@repo/types';
import { ZodValidationPipe } from 'nestjs-zod';
import { ApiQueries, ApiSuccessResponse } from 'src/common/decorator';

@ApiTags('用户实名认证')
@Controller('userAuthRealName')
export class UserAuthRealNameController {
    constructor(
        private readonly userAuthRealNameService: UserAuthRealNameService,
    ) {}

    @Get('realNameAuth')
    @UsePipes(new ZodValidationPipe(userAuthRealNameApiRequestSchema))
    @ApiOperation({
        summary: '检查用户信息和身份证是否一致',
        description: '检查用户信息和身份证是否一致',
    })
    @ApiQueries(userAuthRealNameApiRequestSchema)
    @ApiSuccessResponse(userAuthRealNameDataSchema, {
        description: '成功获取实名信息',
    })
    async realNameAuth(@Query() query: { name: string; idcard: string }) {
        const response = await this.userAuthRealNameService.authRealName(query);
        return response;
    }
}
