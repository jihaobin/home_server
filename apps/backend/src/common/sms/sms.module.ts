import { Module } from '@nestjs/common';

import { CacheModule } from '../cache';
import { SmsService } from './sms.service';
import { STSModule } from '../sts/sts.module';

@Module({
    imports: [CacheModule, STSModule],
    providers: [SmsService],
    exports: [SmsService],
})
export class SmsModule {}
