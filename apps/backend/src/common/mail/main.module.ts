import { Module } from '@nestjs/common';
import { MailService } from './mail.service';
import { ConfigModule } from '@nestjs/config';
import { CacheModule } from '../cache';

@Module({
    imports: [ConfigModule, CacheModule],
    providers: [MailService],
    exports: [MailService],
})
export class MailModule {}
