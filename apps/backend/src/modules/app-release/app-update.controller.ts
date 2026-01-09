import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AppUpdateCheckQuerySchema,
    AppUpdateCheckResponseSchema,
    type AppUpdateCheckQuery,
} from '@repo/types';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';
import { Public } from '../auth/decorators';
import { AppReleaseService } from './app-release.service';

@ApiTags('应用更新')
@Controller('app-updates')
@UseGuards(AuthGuard)
export class AppUpdateController {
    constructor(private readonly service: AppReleaseService) {}

    @Get('check')
    @Public()
    @ApiOperation({
        summary: '检查应用更新',
        description:
            '返回最新版本信息、强制更新判定以及下载链接（预签名 URL 或覆盖链接）',
    })
    @ApiSuccessResponse(AppUpdateCheckResponseSchema, {
        description: '更新检查结果',
    })
    @ApiErrorResponses()
    async check(
        @Query(new ZodValidationPipe(AppUpdateCheckQuerySchema))
        query: AppUpdateCheckQuery,
    ) {
        return this.service.checkForUpdate(query);
    }
}
