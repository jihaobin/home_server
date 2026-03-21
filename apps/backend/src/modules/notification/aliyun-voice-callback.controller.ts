import { Body, Controller, HttpStatus, Post, Req, Res } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';

import { SkipTransform } from 'src/common/interceptors';

import { Public } from '../auth/decorators';
import { AliyunVoiceCallbackService } from './aliyun-voice-callback.service';

@ApiTags('通知回调')
@Controller('notifications/voice')
export class AliyunVoiceCallbackController {
    constructor(
        private readonly aliyunVoiceCallbackService: AliyunVoiceCallbackService,
    ) {}

    @Public()
    @SkipTransform()
    @Post('callback')
    async handleCallback(
        @Req() req: Request,
        @Res({ passthrough: true }) res: Response,
        @Body() body: unknown,
    ) {
        try {
            await this.aliyunVoiceCallbackService.handleCallback(req, body);
            res.status(HttpStatus.OK);
            return {
                code: 0,
                msg: '接收成功',
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '回调处理失败';
            res.status(HttpStatus.INTERNAL_SERVER_ERROR);
            return {
                code: HttpStatus.INTERNAL_SERVER_ERROR,
                msg: message,
            };
        }
    }
}
