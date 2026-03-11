import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';

import { eq } from 'drizzle-orm';

import type {
    ChatConversation,
    ChatCreateReportDto,
    ChatMessage,
    ChatMessageContent,
    ChatMessageListResponse,
} from '@repo/types';
import {
    ChatMessageContentSchema,
    type ChatConversationListResponse,
} from '@repo/types';
import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { users } from 'src/common/database/schema/auth-user';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';

import {
    CHAT_RATE_LIMIT_DEFAULT_MAX_PER_WINDOW,
    CHAT_RATE_LIMIT_WINDOW_SECONDS,
    CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT,
    chatRateLimitKey,
} from './chat.constants';
import { ChatRepository } from './chat.repository';

import type {
    ChatClientRole,
    ChatConversationListRow,
    ChatConversationRecord,
    ChatMessageRecord,
} from './chat.repository';

type UserRoleInDb = 'customer' | 'service_personnel' | (string & {});

@Injectable()
export class ChatService {
    private readonly logger = new Logger(ChatService.name);

    constructor(
        private readonly chatRepository: ChatRepository,
        @Inject(DB)
        private readonly db: DbType,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    private getRateLimitMax(): number {
        const raw = Number(process.env.CHAT_RATE_LIMIT_MAX_PER_MINUTE);
        if (Number.isFinite(raw) && raw > 0) {
            return raw;
        }
        return CHAT_RATE_LIMIT_DEFAULT_MAX_PER_WINDOW;
    }

    private extractUserRoles(user: { role: unknown }): UserRoleInDb[] {
        const role = user.role;
        if (Array.isArray(role)) {
            return role.filter((r): r is string => typeof r === 'string');
        }
        if (typeof role === 'string') {
            return role
                .split(',')
                .map((r) => r.trim())
                .filter(Boolean);
        }
        return [];
    }

    private async requireUserById(userId: string) {
        const [row] = await this.db
            .select({
                id: users.id,
                role: users.role,
            })
            .from(users)
            .where(eq(users.id, userId))
            .limit(1);

        if (!row) {
            throw new BadRequestException('用户不存在');
        }
        return row;
    }

    private normalizeConversationPair(params: {
        meId: string;
        peerUserId: string;
        meRoles: UserRoleInDb[];
        peerRoles: UserRoleInDb[];
        clientRole: ChatClientRole;
    }): { userId: string; workerUserId: string } {
        const meIsWorker = params.meRoles.includes('service_personnel');
        const peerIsWorker = params.peerRoles.includes('service_personnel');
        const meIsCustomer = params.meRoles.includes('customer');
        const peerIsCustomer = params.peerRoles.includes('customer');

        if (params.clientRole === 'customer') {
            if (!meIsCustomer) {
                throw new ForbiddenException('当前账号不具备普通用户身份');
            }
            if (!peerIsWorker) {
                throw new BadRequestException('只能与服务人员建立私聊');
            }
            return {
                userId: params.meId,
                workerUserId: params.peerUserId,
            };
        }

        if (!meIsWorker) {
            throw new ForbiddenException('当前账号不具备服务人员身份');
        }
        if (!peerIsCustomer) {
            throw new BadRequestException('服务人员端只能与普通用户私聊');
        }

        return {
            userId: params.peerUserId,
            workerUserId: params.meId,
        };
    }

    private ensureConversationRoleAccess(params: {
        requesterId: string;
        clientRole: ChatClientRole;
        conversation: ChatConversationRecord;
    }) {
        if (
            params.clientRole === 'customer' &&
            params.conversation.userId !== params.requesterId
        ) {
            throw new ForbiddenException('当前会话不属于用户端身份');
        }

        if (
            params.clientRole === 'service_personnel' &&
            params.conversation.workerUserId !== params.requesterId
        ) {
            throw new ForbiddenException('当前会话不属于服务人员端身份');
        }
    }

    async upsertConversation(params: {
        requesterId: string;
        peerUserId: string;
        clientRole: ChatClientRole;
    }): Promise<ChatConversation> {
        if (params.requesterId === params.peerUserId) {
            throw new BadRequestException('不能与自己创建会话');
        }

        const me = await this.requireUserById(params.requesterId);
        const peer = await this.requireUserById(params.peerUserId);

        const pair = this.normalizeConversationPair({
            meId: params.requesterId,
            peerUserId: params.peerUserId,
            meRoles: this.extractUserRoles(me),
            peerRoles: this.extractUserRoles(peer),
            clientRole: params.clientRole,
        });

        const existing =
            await this.chatRepository.findConversationBetween(pair);
        const conversation = existing
            ? existing
            : await this.chatRepository.createConversation(pair);
        const enriched = await this.chatRepository.getConversationForUser({
            userId: params.requesterId,
            conversationId: conversation.id,
            clientRole: params.clientRole,
        });

        if (enriched) {
            return this.toConversationDto(enriched);
        }

        return this.toConversationDto(conversation);
    }

    async listConversations(params: {
        requesterId: string;
        limit?: number;
        clientRole: ChatClientRole;
    }): Promise<ChatConversationListResponse> {
        const limit =
            typeof params.limit === 'number' && params.limit > 0
                ? Math.min(params.limit, 100)
                : 50;

        const rows = await this.chatRepository.listConversationsForUser(
            params.requesterId,
            limit,
            params.clientRole,
        );
        return {
            items: rows.map((row) => this.toConversationDto(row)),
        };
    }

    async getConversationDetail(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
    }): Promise<ChatConversation> {
        const row = await this.chatRepository.getConversationForUser({
            userId: params.requesterId,
            conversationId: params.conversationId,
            clientRole: params.clientRole,
        });
        if (!row) {
            throw new BadRequestException('会话不存在');
        }
        return this.toConversationDto(row);
    }

    /**
     * WS 自动 join 会话用：返回 conversationId 列表（按最近活跃排序）。
     * 与 REST 列表的 limit 约束分开，避免放大 REST 响应体。
     */
    async listConversationIdsForAutoJoin(params: {
        requesterId: string;
        limit?: number;
        clientRole: ChatClientRole;
    }): Promise<string[]> {
        const limit =
            typeof params.limit === 'number' && params.limit > 0
                ? Math.min(params.limit, CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT)
                : CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT;

        return await this.chatRepository.listConversationIdsForUser(
            params.requesterId,
            limit,
            params.clientRole,
        );
    }

    async listMessages(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
        cursor?: string;
        limit?: number;
    }): Promise<ChatMessageListResponse> {
        const conversation = await this.requireConversationAccessible({
            requesterId: params.requesterId,
            conversationId: params.conversationId,
            clientRole: params.clientRole,
        });

        const limit =
            typeof params.limit === 'number' && params.limit > 0
                ? Math.min(params.limit, 50)
                : 20;

        let beforeCreatedAt: Date | undefined;
        if (params.cursor) {
            const cursorMsg = await this.chatRepository.findMessageById(
                params.cursor,
            );
            if (cursorMsg?.conversationId === params.conversationId) {
                beforeCreatedAt = cursorMsg.createdAt;
            }
        }

        const messages = await this.chatRepository.listMessages({
            conversationId: params.conversationId,
            limit,
            beforeCreatedAt,
        });
        const nextCursor =
            messages.length === limit ? messages[messages.length - 1].id : null;

        return {
            items: messages.map((m) => this.toMessageDto(m)),
            nextCursor,
        };
    }

    async sendMessage(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
        content: ChatMessageContent;
        clientMsgId?: string;
    }): Promise<ChatMessage> {
        const conversation = await this.requireConversationAccessible({
            requesterId: params.requesterId,
            conversationId: params.conversationId,
            clientRole: params.clientRole,
        });

        if (
            await this.chatRepository.isBlockedBetween(
                conversation.userId,
                conversation.workerUserId,
            )
        ) {
            throw new ForbiddenException('已拉黑，无法发送消息');
        }

        // 限流（Redis 固定窗口）
        try {
            const current = await this.cacheService.increment(
                chatRateLimitKey(params.requesterId),
                1,
                CHAT_RATE_LIMIT_WINDOW_SECONDS,
            );
            if (current > this.getRateLimitMax()) {
                throw new ForbiddenException('发送过于频繁，请稍后再试');
            }
        } catch (error) {
            // Redis 出问题不阻断主流程，但需要记录
            this.logger.warn(
                'chat 限流计数失败',
                error instanceof Error ? error.message : String(error),
            );
        }

        // WS/REST 都走同一套 content 校验
        const validated = ChatMessageContentSchema.parse(params.content);

        if (validated.type === 'order_card') {
            const ok = await this.chatRepository.orderBelongsToConversation({
                orderId: validated.orderId,
                customerId: conversation.userId,
                workerUserId: conversation.workerUserId,
            });
            if (!ok) {
                throw new ForbiddenException('订单不属于当前会话，禁止发送');
            }
        }

        if (params.clientMsgId) {
            const existing = await this.chatRepository.findMessageByClientMsgId(
                {
                    conversationId: params.conversationId,
                    senderUserId: params.requesterId,
                    clientMsgId: params.clientMsgId,
                },
            );
            if (existing) {
                return this.toMessageDto(existing);
            }
        }

        try {
            const previewText = this.getMessagePreviewText(validated);
            const record =
                await this.chatRepository.createMessageAndTouchConversation({
                    conversationId: params.conversationId,
                    senderUserId: params.requesterId,
                    content: validated,
                    messageType: validated.type,
                    previewText,
                    clientMsgId: params.clientMsgId ?? null,
                });
            return this.toMessageDto(record);
        } catch (error) {
            // 幂等：并发下可能触发唯一约束冲突，回查并返回
            if (params.clientMsgId) {
                const existing =
                    await this.chatRepository.findMessageByClientMsgId({
                        conversationId: params.conversationId,
                        senderUserId: params.requesterId,
                        clientMsgId: params.clientMsgId,
                    });
                if (existing) {
                    return this.toMessageDto(existing);
                }
            }
            throw error;
        }
    }

    async createBlock(params: { requesterId: string; blockedUserId: string }) {
        if (params.requesterId === params.blockedUserId) {
            throw new BadRequestException('不能拉黑自己');
        }
        await this.requireUserById(params.blockedUserId);

        // 允许重复请求：若已存在唯一约束会报错，这里捕获后按成功处理
        try {
            await this.chatRepository.createBlock({
                blockerUserId: params.requesterId,
                blockedUserId: params.blockedUserId,
            });
        } catch (error) {
            const code = this.extractPgErrorCode(error);
            if (code !== '23505') {
                throw error;
            }
        }
        return { ok: true };
    }

    async deleteBlock(params: { requesterId: string; blockedUserId: string }) {
        await this.chatRepository.deleteBlock({
            blockerUserId: params.requesterId,
            blockedUserId: params.blockedUserId,
        });
        return { ok: true };
    }

    async createReport(params: {
        requesterId: string;
        dto: ChatCreateReportDto;
    }) {
        if (params.requesterId === params.dto.reportedUserId) {
            throw new BadRequestException('不能举报自己');
        }
        await this.requireUserById(params.dto.reportedUserId);

        if (params.dto.messageId) {
            const msg = await this.chatRepository.findMessageById(
                params.dto.messageId,
            );
            if (!msg) {
                throw new BadRequestException('messageId 不存在');
            }
        }

        await this.chatRepository.createReport({
            reporterUserId: params.requesterId,
            reportedUserId: params.dto.reportedUserId,
            messageId: params.dto.messageId ?? null,
            reason: params.dto.reason,
            detail: params.dto.detail ?? {},
        });
        return { ok: true };
    }

    async requireConversationAccessible(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
    }) {
        const conversation = await this.chatRepository.findConversationById(
            params.conversationId,
        );
        if (!conversation) {
            throw new BadRequestException('会话不存在');
        }
        const isParticipant =
            conversation.userId === params.requesterId ||
            conversation.workerUserId === params.requesterId;
        if (!isParticipant) {
            throw new ForbiddenException('无权访问该会话');
        }

        this.ensureConversationRoleAccess({
            requesterId: params.requesterId,
            clientRole: params.clientRole,
            conversation,
        });
        return conversation;
    }

    async requireConversationJoinable(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
    }) {
        // 拉黑不影响 join，只影响 send（由 sendMessage 统一拦截）
        return await this.requireConversationAccessible(params);
    }

    async markConversationRead(params: {
        requesterId: string;
        conversationId: string;
        clientRole: ChatClientRole;
        lastReadMessageId: string;
    }) {
        await this.requireConversationAccessible({
            requesterId: params.requesterId,
            conversationId: params.conversationId,
            clientRole: params.clientRole,
        });

        const message = await this.chatRepository.findMessageById(
            params.lastReadMessageId,
        );
        if (!message || message.conversationId !== params.conversationId) {
            throw new BadRequestException('lastReadMessageId 不属于当前会话');
        }

        return await this.chatRepository.markConversationRead({
            conversationId: params.conversationId,
            userId: params.requesterId,
            lastReadMessageId: params.lastReadMessageId,
        });
    }

    private toConversationDto(
        row: ChatConversationRecord | ChatConversationListRow,
    ): ChatConversation {
        const listRow = row as Partial<ChatConversationListRow>;
        const lastMessagePreview =
            row.lastMessageId && row.lastMessageAt
                ? {
                      type: row.lastMessageType ?? 'text',
                      text: row.lastMessagePreviewText ?? '暂无消息',
                      messageId: row.lastMessageId,
                      createdAt: new Date(row.lastMessageAt).toISOString(),
                      senderUserId: row.lastMessageSenderUserId ?? '',
                  }
                : null;

        return {
            id: row.id,
            userId: row.userId,
            workerUserId: row.workerUserId,
            lastMessageAt: row.lastMessageAt
                ? new Date(row.lastMessageAt).toISOString()
                : null,
            peerUserId: listRow.peerUserId,
            peerUser: listRow.peerUserId
                ? {
                      id: listRow.peerUserId,
                      name: listRow.peerUserName ?? '聊天对象',
                      image: listRow.peerUserImage ?? null,
                  }
                : undefined,
            lastMessagePreview,
            unreadCount:
                typeof listRow.myUnreadCount === 'number'
                    ? listRow.myUnreadCount
                    : undefined,
            myLastReadMessageId: listRow.myLastReadMessageId,
            myLastReadAt: listRow.myLastReadAt
                ? new Date(listRow.myLastReadAt).toISOString()
                : null,
            peerLastReadMessageId: listRow.peerLastReadMessageId,
            peerLastReadAt: listRow.peerLastReadAt
                ? new Date(listRow.peerLastReadAt).toISOString()
                : null,
            createdAt: new Date(row.createdAt).toISOString(),
            updatedAt: new Date(row.updatedAt).toISOString(),
        };
    }

    private getMessagePreviewText(content: ChatMessageContent): string {
        if (content.type === 'text') {
            const normalized = content.text.trim();
            if (normalized.length <= 80) {
                return normalized;
            }
            return `${normalized.slice(0, 80)}...`;
        }
        if (content.type === 'image') {
            return '[图片]';
        }
        if (content.type === 'video') {
            return '[视频]';
        }
        if (content.type === 'order_card') {
            return content.snapshot?.title ?? '[订单]';
        }
        return '新消息';
    }

    private toMessageDto(row: ChatMessageRecord): ChatMessage {
        return {
            id: row.id,
            conversationId: row.conversationId,
            senderUserId: row.senderUserId,
            clientMsgId: row.clientMsgId ?? null,
            content: row.content,
            createdAt: new Date(row.createdAt).toISOString(),
        };
    }

    private extractPgErrorCode(error: unknown): string | undefined {
        if (!error || typeof error !== 'object') {
            return undefined;
        }
        if (
            'code' in error &&
            typeof (error as { code?: unknown }).code === 'string'
        ) {
            return (error as { code: string }).code;
        }
        return undefined;
    }
}
