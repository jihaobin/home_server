import {
    BadRequestException,
    Body,
    Controller,
    Delete,
    Get,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
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
import { ChatWsService } from './chat-ws.service';

@ApiTags('私聊模块')
@Controller('chat')
export class ChatController {
    constructor(
        private readonly chatService: ChatService,
        private readonly chatWsService: ChatWsService,
    ) {}

    private formatDebugValue(value: unknown): string {
        if (Array.isArray(value)) {
            const serialized = value.map((item) => this.formatDebugValue(item));
            return `[${serialized.join(', ')}]`;
        }
        if (typeof value === 'string') {
            return `"${value}"`;
        }
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return 'undefined';
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    private toOptionalString(value: unknown): string | undefined {
        const normalize = (input?: string): string | undefined => {
            if (!input) {
                return undefined;
            }
            const trimmed = input.trim();
            if (!trimmed.length) {
                return undefined;
            }
            const lowered = trimmed.toLowerCase();
            if (lowered === 'undefined' || lowered === 'null') {
                return undefined;
            }
            return lowered;
        };

        if (typeof value === 'string') {
            return normalize(value);
        }
        if (Array.isArray(value) && value.length > 0) {
            const [first] = value;
            return typeof first === 'string' ? normalize(first) : undefined;
        }
        return undefined;
    }

    private parseClientRole(raw: unknown): 'customer' | 'service_personnel' {
        const normalized = this.toOptionalString(raw);
        if (normalized === 'customer' || normalized === 'service_personnel') {
            return normalized;
        }
        throw new BadRequestException(
            `clientRole 参数无效，必须为 customer 或 service_personnel；收到=${this.formatDebugValue(raw)}（type=${Array.isArray(raw) ? 'array' : typeof raw}）`,
        );
    }

    @UseGuards(AuthGuard)
    @Post('conversations')
    @ApiOperation({ summary: '创建/获取私聊会话' })
    async upsertConversation(
        @Body(new ZodValidationPipe(ChatUpsertConversationSchema))
        dto: ChatUpsertConversationDto,
        @Query('clientRole') clientRoleRaw: string,
        @Req() req: Request,
    ) {
        const clientRole = this.parseClientRole(clientRoleRaw);
        return await this.chatService.upsertConversation({
            requesterId: req.user.id,
            peerUserId: dto.peerUserId,
            clientRole,
        });
    }

    @UseGuards(AuthGuard)
    @Get('conversations')
    @ApiOperation({ summary: '私聊会话列表' })
    async listConversations(
        @Query(new ZodValidationPipe(ChatConversationListQuerySchema))
        query: ChatConversationListQuery,
        @Query('clientRole') clientRoleRaw: string,
        @Req() req: Request,
    ) {
        const clientRole = this.parseClientRole(clientRoleRaw);
        return await this.chatService.listConversations({
            requesterId: req.user.id,
            limit: query.limit,
            clientRole,
        });
    }

    @UseGuards(AuthGuard)
    @Get('conversations/:conversationId')
    @ApiOperation({ summary: '私聊会话详情摘要' })
    async getConversationDetail(
        @Param('conversationId') conversationId: string,
        @Query('clientRole') clientRoleRaw: string,
        @Req() req: Request,
    ) {
        const clientRole = this.parseClientRole(clientRoleRaw);
        return await this.chatService.getConversationDetail({
            requesterId: req.user.id,
            conversationId,
            clientRole,
        });
    }

    @UseGuards(AuthGuard)
    @Post('conversations/:conversationId/read')
    @ApiOperation({ summary: '私聊会话已读上报' })
    async markConversationRead(
        @Param('conversationId') conversationId: string,
        @Body() dto: { lastReadMessageId: string },
        @Query('clientRole') clientRoleRaw: string,
        @Req() req: Request,
    ) {
        const clientRole = this.parseClientRole(clientRoleRaw);
        const read = await this.chatService.markConversationRead({
            requesterId: req.user.id,
            conversationId,
            clientRole,
            lastReadMessageId: dto.lastReadMessageId,
        });

        this.chatWsService.emitReadReceipt({
            conversationId,
            readerUserId: req.user.id,
            lastReadMessageId: read.lastReadMessageId,
            lastReadAt: read.lastReadAt.toISOString(),
        });

        return { ok: true };
    }

    @UseGuards(AuthGuard)
    @Get('messages')
    @ApiOperation({ summary: '私聊消息分页' })
    async listMessages(
        @Query(new ZodValidationPipe(ChatMessageListQuerySchema))
        query: ChatMessageListQuery,
        @Query('clientRole') clientRoleRaw: string,
        @Req() req: Request,
    ) {
        const clientRole = this.parseClientRole(clientRoleRaw);
        return await this.chatService.listMessages({
            requesterId: req.user.id,
            conversationId: query.conversationId,
            clientRole,
            cursor: query.cursor,
            limit: query.limit,
        });
    }

    @UseGuards(AuthGuard)
    @Post('blocks')
    @ApiOperation({ summary: '拉黑' })
    async createBlock(
        @Body(new ZodValidationPipe(ChatCreateBlockSchema))
        dto: ChatCreateBlockDto,
        @Req() req: Request,
    ) {
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
    @ApiOperation({ summary: '举报' })
    async createReport(
        @Body(new ZodValidationPipe(ChatCreateReportSchema))
        dto: ChatCreateReportDto,
        @Req() req: Request,
    ) {
        return await this.chatService.createReport({
            requesterId: req.user.id,
            dto,
        });
    }
}
