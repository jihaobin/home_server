import { Body, Controller, Post, Query, UsePipes } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import {
    MultiZodValidationPipe,
    type MultiZodValidationConfig,
} from 'src/common/pipes/zod-validation.pipe';

import {
    TencentPushCallbackBodySchema,
    TencentPushCallbackQuerySchema,
    type TencentPushCallbackBodyDto,
    type TencentPushCallbackQueryDto,
} from './dto/tencent-push-callback.dto';
import { TencentPushCallbackService } from './tencent-push-callback.service';
import { Public } from '../auth/decorators';
import { SkipTransform } from 'src/common/interceptors';

const validationConfig: MultiZodValidationConfig = {
    query: TencentPushCallbackQuerySchema,
    body: TencentPushCallbackBodySchema,
};

@ApiTags('通知回调')
@Controller('notifications/tencent-push')
export class TencentPushCallbackController {
    constructor(
        private readonly tencentPushCallbackService: TencentPushCallbackService,
    ) {}

    @Public()
    @SkipTransform()
    @Post('callback')
    @UsePipes(new MultiZodValidationPipe(validationConfig))
    async handleCallback(
        @Query() query: TencentPushCallbackQueryDto,
        @Body() body: TencentPushCallbackBodyDto,
    ) {
        try {
            await this.tencentPushCallbackService.handleCallback(query, body);
            return {
                ActionStatus: 'OK',
                ErrorInfo: '',
                ErrorCode: 0,
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '回调处理失败';
            return {
                ActionStatus: 'FAIL',
                ErrorInfo: message,
                ErrorCode: 1,
            };
        }
    }
}
