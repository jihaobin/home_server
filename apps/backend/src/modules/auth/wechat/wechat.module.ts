import { Module } from '@nestjs/common';
import { WeChatController } from './wechat.controller';

@Module({
    controllers: [WeChatController],
})
export class WeChatModule {}
