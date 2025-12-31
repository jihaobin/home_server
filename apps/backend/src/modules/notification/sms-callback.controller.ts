import { Body, Controller, Post } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

import { Public } from '../auth/decorators';
import { SkipTransform } from 'src/common/interceptors';
import { SmsCallbackService } from './sms-callback.service';

@ApiTags('通知回调')
@Controller('notifications/sms')
export class SmsCallbackController {
    constructor(private readonly smsCallbackService: SmsCallbackService) {}

    @Public()
    @SkipTransform()
    @Post('callback')
    async handleCallback(@Body() reports: unknown) {
        await this.smsCallbackService.handleReports(reports);
        return { code: 0, msg: '接收成功' };
    }
}
