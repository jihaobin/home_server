import {
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request } from 'express';

import {
    ChatConversationListQuerySchema,
    ChatCreateBlockSchema,
    ChatCreateReportSchema,
    ChatMessageListQuerySchema,
    ChatUpsertConversationSchema,
    type ChatConversationListQuery,
    type ChatCreateBlockDto,
    type ChatCreateReportDto,
    type ChatMessageListQuery,
    type ChatUpsertConversationDto,
} from '@repo/types';
import { ZodValidationPipe } from 'src/common/pipes';
import { AuthGuard } from '../auth/auth.guard';

import { ChatService } from './chat.service';

@ApiTags('私聊模块')
@Controller('chat')
export class ChatController {
    constructor(private readonly chatService: ChatService) {}

    @UseGuards(AuthGuard)
    @Post('conversations')
    @UsePipes(new ZodValidationPipe(ChatUpsertConversationSchema))
    @ApiOperation({ summary: '创建/获取私聊会话' })
    async upsertConversation(
        @Body() dto: ChatUpsertConversationDto,
        @Req() req: Request,
    ) {
        return await this.chatService.upsertConversation({
            requesterId: req.user.id,
            peerUserId: dto.peerUserId,
        });
    }

    @UseGuards(AuthGuard)
    @Get('conversations')
    @UsePipes(new ZodValidationPipe(ChatConversationListQuerySchema))
    @ApiOperation({ summary: '私聊会话列表' })
    async listConversations(
        @Query() query: ChatConversationListQuery,
        @Req() req: Request,
    ) {
        return await this.chatService.listConversations({
            requesterId: req.user.id,
            limit: query.limit,
        });
    }

    @UseGuards(AuthGuard)
    @Get('messages')
    @UsePipes(new ZodValidationPipe(ChatMessageListQuerySchema))
    @ApiOperation({ summary: '私聊消息分页' })
    async listMessages(
        @Query() query: ChatMessageListQuery,
        @Req() req: Request,
    ) {
        return await this.chatService.listMessages({
            requesterId: req.user.id,
            conversationId: query.conversationId,
            cursor: query.cursor,
            limit: query.limit,
        });
    }

    @UseGuards(AuthGuard)
    @Post('blocks')
    @UsePipes(new ZodValidationPipe(ChatCreateBlockSchema))
    @ApiOperation({ summary: '拉黑' })
    async createBlock(@Body() dto: ChatCreateBlockDto, @Req() req: Request) {
        return await this.chatService.createBlock({
            requesterId: req.user.id,
            blockedUserId: dto.blockedUserId,
        });
    }

    @UseGuards(AuthGuard)
    @Delete('blocks/:blockedUserId')
    @ApiOperation({ summary: '取消拉黑' })
    async deleteBlock(
        @Param('blockedUserId') blockedUserId: string,
        @Req() req: Request,
    ) {
        return await this.chatService.deleteBlock({
            requesterId: req.user.id,
            blockedUserId,
        });
    }

    @UseGuards(AuthGuard)
    @Post('reports')
    @UsePipes(new ZodValidationPipe(ChatCreateReportSchema))
    @ApiOperation({ summary: '举报' })
    async createReport(@Body() dto: ChatCreateReportDto, @Req() req: Request) {
        return await this.chatService.createReport({
            requesterId: req.user.id,
            dto,
        });
    }
}
