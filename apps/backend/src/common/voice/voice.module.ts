import { Module } from '@nestjs/common';

import { CacheModule } from '../cache';
import { STSModule } from '../sts/sts.module';
import { VoiceCallService } from './voice.service';

@Module({
    imports: [CacheModule, STSModule],
    providers: [VoiceCallService],
    exports: [VoiceCallService],
})
export class VoiceCallModule {}
