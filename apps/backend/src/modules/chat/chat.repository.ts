import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, or, sql, lt } from 'drizzle-orm';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    chatBlocks,
    chatConversations,
    chatMessages,
    chatReports,
    orderAssignments,
    orders,
} from 'src/common/database/schema';

export type ChatConversationRecord = typeof chatConversations.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type ChatBlockRecord = typeof chatBlocks.$inferSelect;
export type ChatReportRecord = typeof chatReports.$inferSelect;

@Injectable()
export class ChatRepository {
    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async findConversationById(
        conversationId: string,
    ): Promise<ChatConversationRecord | undefined> {
        return await this.db.query.chatConversations.findFirst({
            where: eq(chatConversations.id, conversationId),
        });
    }

    async findConversationBetween(params: {
        userId: string;
        workerUserId: string;
    }): Promise<ChatConversationRecord | undefined> {
        return await this.db.query.chatConversations.findFirst({
            where: and(
                eq(chatConversations.userId, params.userId),
                eq(chatConversations.workerUserId, params.workerUserId),
            ),
        });
    }

    async createConversation(params: {
        userId: string;
        workerUserId: string;
    }): Promise<ChatConversationRecord> {
        const [row] = await this.db
            .insert(chatConversations)
            .values({
                userId: params.userId,
                workerUserId: params.workerUserId,
            })
            .returning();
        return row;
    }

    async listConversationsForUser(userId: string, limit: number) {
        return await this.db
            .select()
            .from(chatConversations)
            .where(
                or(
                    eq(chatConversations.userId, userId),
                    eq(chatConversations.workerUserId, userId),
                ),
            )
            .orderBy(
                desc(
                    sql`COALESCE(${chatConversations.lastMessageAt}, ${chatConversations.createdAt})`,
                ),
                desc(chatConversations.updatedAt),
            )
            .limit(limit);
    }

    async listConversationIdsForUser(
        userId: string,
        limit: number,
    ): Promise<string[]> {
        const rows = await this.db
            .select({ id: chatConversations.id })
            .from(chatConversations)
            .where(
                or(
                    eq(chatConversations.userId, userId),
                    eq(chatConversations.workerUserId, userId),
                ),
            )
            .orderBy(
                desc(
                    sql`COALESCE(${chatConversations.lastMessageAt}, ${chatConversations.createdAt})`,
                ),
                desc(chatConversations.updatedAt),
            )
            .limit(limit);
        return rows.map((row) => row.id);
    }

    async isBlockedBetween(userA: string, userB: string): Promise<boolean> {
        const [row] = await this.db
            .select({ id: chatBlocks.id })
            .from(chatBlocks)
            .where(
                or(
                    and(
                        eq(chatBlocks.blockerUserId, userA),
                        eq(chatBlocks.blockedUserId, userB),
                    ),
                    and(
                        eq(chatBlocks.blockerUserId, userB),
                        eq(chatBlocks.blockedUserId, userA),
                    ),
                ),
            )
            .limit(1);
        return Boolean(row?.id);
    }

    async createBlock(params: {
        blockerUserId: string;
        blockedUserId: string;
    }): Promise<ChatBlockRecord> {
        const [row] = await this.db
            .insert(chatBlocks)
            .values({
                blockerUserId: params.blockerUserId,
                blockedUserId: params.blockedUserId,
            })
            .returning();
        return row;
    }

    async deleteBlock(params: {
        blockerUserId: string;
        blockedUserId: string;
    }) {
        const result = await this.db
            .delete(chatBlocks)
            .where(
                and(
                    eq(chatBlocks.blockerUserId, params.blockerUserId),
                    eq(chatBlocks.blockedUserId, params.blockedUserId),
                ),
            );
        return Number(result.rowCount ?? 0);
    }

    async createReport(params: {
        reporterUserId: string;
        reportedUserId: string;
        messageId?: string | null;
        reason: string;
        detail?: Record<string, unknown>;
    }): Promise<ChatReportRecord> {
        const [row] = await this.db
            .insert(chatReports)
            .values({
                reporterUserId: params.reporterUserId,
                reportedUserId: params.reportedUserId,
                messageId: params.messageId ?? null,
                reason: params.reason,
                detail: params.detail ?? {},
                status: 'open',
            })
            .returning();
        return row;
    }

    async listMessages(params: {
        conversationId: string;
        limit: number;
        beforeCreatedAt?: Date;
    }): Promise<ChatMessageRecord[]> {
        const whereClause = params.beforeCreatedAt
            ? and(
                  eq(chatMessages.conversationId, params.conversationId),
                  lt(chatMessages.createdAt, params.beforeCreatedAt),
              )
            : eq(chatMessages.conversationId, params.conversationId);
        return await this.db
            .select()
            .from(chatMessages)
            .where(whereClause)
            .orderBy(desc(chatMessages.createdAt))
            .limit(params.limit);
    }

    async findMessageById(
        messageId: string,
    ): Promise<ChatMessageRecord | undefined> {
        return await this.db.query.chatMessages.findFirst({
            where: eq(chatMessages.id, messageId),
        });
    }

    async findMessageByClientMsgId(params: {
        conversationId: string;
        senderUserId: string;
        clientMsgId: string;
    }): Promise<ChatMessageRecord | undefined> {
        return await this.db.query.chatMessages.findFirst({
            where: and(
                eq(chatMessages.conversationId, params.conversationId),
                eq(chatMessages.senderUserId, params.senderUserId),
                eq(chatMessages.clientMsgId, params.clientMsgId),
            ),
        });
    }

    async createMessageAndTouchConversation(params: {
        conversationId: string;
        senderUserId: string;
        content: ChatMessageRecord['content'];
        clientMsgId?: string | null;
    }): Promise<ChatMessageRecord> {
        return await this.db.transaction(async (tx) => {
            const now = new Date();

            const [message] = await tx
                .insert(chatMessages)
                .values({
                    conversationId: params.conversationId,
                    senderUserId: params.senderUserId,
                    content: params.content,
                    clientMsgId: params.clientMsgId ?? null,
                    createdAt: now,
                })
                .returning();

            await tx
                .update(chatConversations)
                .set({
                    lastMessageAt: now,
                    updatedAt: now,
                })
                .where(eq(chatConversations.id, params.conversationId));

            return message;
        });
    }

    async orderBelongsToConversation(params: {
        orderId: string;
        customerId: string;
        workerUserId: string;
    }): Promise<boolean> {
        const [row] = await this.db
            .select({ id: orders.id })
            .from(orders)
            .innerJoin(
                orderAssignments,
                eq(orderAssignments.orderId, orders.id),
            )
            .where(
                and(
                    eq(orders.id, params.orderId),
                    eq(orders.customerId, params.customerId),
                    eq(
                        orderAssignments.servicePersonnelId,
                        params.workerUserId,
                    ),
                ),
            )
            .limit(1);
        return Boolean(row?.id);
    }
}
