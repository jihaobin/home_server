import { Module } from '@nestjs/common';

import { ChatController } from './chat.controller';
import { ChatRepository } from './chat.repository';
import { ChatService } from './chat.service';
import { ChatWsGateway } from './chat-ws.gateway';
import { ChatWsService } from './chat-ws.service';

@Module({
    controllers: [ChatController],
    providers: [ChatService, ChatRepository, ChatWsGateway, ChatWsService],
    exports: [ChatService],
})
export class ChatModule {}
