import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, lt, or, sql, type SQL } from 'drizzle-orm';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    chatBlocks,
    chatConversations,
    chatConversationUserStates,
    chatMessages,
    chatReports,
    orderAssignments,
    orders,
    servicePersonnel,
    users,
} from 'src/common/database/schema';

export type ChatConversationRecord = typeof chatConversations.$inferSelect;
export type ChatMessageRecord = typeof chatMessages.$inferSelect;
export type ChatBlockRecord = typeof chatBlocks.$inferSelect;
export type ChatReportRecord = typeof chatReports.$inferSelect;
export type ChatConversationUserStateRecord =
    typeof chatConversationUserStates.$inferSelect;

export type ChatConversationListRow = ChatConversationRecord & {
    peerUserId: string;
    peerUserName: string | null;
    peerUserImage: string | null;
    myUnreadCount: number;
    myLastReadMessageId: string | null;
    myLastReadAt: Date | null;
    peerLastReadMessageId: string | null;
    peerLastReadAt: Date | null;
};

export type ChatClientRole = 'customer' | 'service_personnel';

@Injectable()
export class ChatRepository {
    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    private buildPeerUserNameExpr(params: {
        peerUserIdExpr: SQL<string>;
        clientRole: ChatClientRole;
    }): SQL<string | null> {
        if (params.clientRole === 'service_personnel') {
            return sql<string | null>`(
                SELECT NULLIF(${users.name}, '')
                FROM ${users}
                WHERE ${users.id} = ${params.peerUserIdExpr}
                LIMIT 1
            )`;
        }

        return sql<string | null>`(
            SELECT COALESCE(
                (
                    SELECT NULLIF(${servicePersonnel.name}, '')
                    FROM ${servicePersonnel}
                    WHERE ${servicePersonnel.userId} = ${params.peerUserIdExpr}
                    LIMIT 1
                ),
                (
                    SELECT NULLIF(${users.name}, '')
                    FROM ${users}
                    WHERE ${users.id} = ${params.peerUserIdExpr}
                    LIMIT 1
                )
            )
        )`;
    }

    private buildPeerUserImageExpr(params: {
        peerUserIdExpr: SQL<string>;
        clientRole: ChatClientRole;
    }): SQL<string | null> {
        if (params.clientRole === 'service_personnel') {
            return sql<string | null>`(
                SELECT NULLIF(${users.image}, '')
                FROM ${users}
                WHERE ${users.id} = ${params.peerUserIdExpr}
                LIMIT 1
            )`;
        }

        return sql<string | null>`(
            SELECT COALESCE(
                (
                    SELECT NULLIF(${servicePersonnel.avatar}, '')
                    FROM ${servicePersonnel}
                    WHERE ${servicePersonnel.userId} = ${params.peerUserIdExpr}
                    LIMIT 1
                ),
                (
                    SELECT NULLIF(${users.image}, '')
                    FROM ${users}
                    WHERE ${users.id} = ${params.peerUserIdExpr}
                    LIMIT 1
                )
            )
        )`;
    }

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
        return await this.db.transaction(async (tx) => {
            const [row] = await tx
                .insert(chatConversations)
                .values({
                    userId: params.userId,
                    workerUserId: params.workerUserId,
                })
                .returning();

            await tx.insert(chatConversationUserStates).values([
                {
                    conversationId: row.id,
                    userId: params.userId,
                    unreadCount: 0,
                },
                {
                    conversationId: row.id,
                    userId: params.workerUserId,
                    unreadCount: 0,
                },
            ]);

            return row;
        });
    }

    async listConversationsForUser(
        userId: string,
        limit: number,
        clientRole: ChatClientRole,
    ): Promise<ChatConversationListRow[]> {
        const peerUserIdExpr =
            clientRole === 'customer'
                ? sql<string>`${chatConversations.workerUserId}`
                : sql<string>`${chatConversations.userId}`;

        const participantWhere =
            clientRole === 'customer'
                ? eq(chatConversations.userId, userId)
                : eq(chatConversations.workerUserId, userId);

        const peerUserNameExpr = this.buildPeerUserNameExpr({
            peerUserIdExpr,
            clientRole,
        });

        const peerUserImageExpr = this.buildPeerUserImageExpr({
            peerUserIdExpr,
            clientRole,
        });

        const rows = await this.db
            .select({
                id: chatConversations.id,
                userId: chatConversations.userId,
                workerUserId: chatConversations.workerUserId,
                lastMessageAt: chatConversations.lastMessageAt,
                lastMessageId: chatConversations.lastMessageId,
                lastMessageSenderUserId:
                    chatConversations.lastMessageSenderUserId,
                lastMessageType: chatConversations.lastMessageType,
                lastMessagePreviewText:
                    chatConversations.lastMessagePreviewText,
                createdAt: chatConversations.createdAt,
                updatedAt: chatConversations.updatedAt,
                peerUserId: peerUserIdExpr,
                peerUserName: peerUserNameExpr,
                peerUserImage: peerUserImageExpr,
                myUnreadCount: sql<number>`COALESCE((
                    SELECT ${chatConversationUserStates.unreadCount}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${userId}
                    LIMIT 1
                ), 0)`,
                myLastReadMessageId: sql<string | null>`(
                    SELECT ${chatConversationUserStates.lastReadMessageId}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${userId}
                    LIMIT 1
                )`,
                myLastReadAt: sql<Date | null>`(
                    SELECT ${chatConversationUserStates.lastReadAt}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${userId}
                    LIMIT 1
                )`,
                peerLastReadMessageId: sql<string | null>`(
                    SELECT ${chatConversationUserStates.lastReadMessageId}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${peerUserIdExpr}
                    LIMIT 1
                )`,
                peerLastReadAt: sql<Date | null>`(
                    SELECT ${chatConversationUserStates.lastReadAt}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${peerUserIdExpr}
                    LIMIT 1
                )`,
            })
            .from(chatConversations)
            .where(participantWhere)
            .orderBy(
                desc(
                    sql`COALESCE(${chatConversations.lastMessageAt}, ${chatConversations.createdAt})`,
                ),
                desc(chatConversations.updatedAt),
            )
            .limit(limit);

        return rows;
    }

    async getConversationForUser(params: {
        userId: string;
        conversationId: string;
        clientRole: ChatClientRole;
    }): Promise<ChatConversationListRow | undefined> {
        const peerUserIdExpr =
            params.clientRole === 'customer'
                ? sql<string>`${chatConversations.workerUserId}`
                : sql<string>`${chatConversations.userId}`;

        const participantWhere =
            params.clientRole === 'customer'
                ? eq(chatConversations.userId, params.userId)
                : eq(chatConversations.workerUserId, params.userId);

        const peerUserNameExpr = this.buildPeerUserNameExpr({
            peerUserIdExpr,
            clientRole: params.clientRole,
        });

        const peerUserImageExpr = this.buildPeerUserImageExpr({
            peerUserIdExpr,
            clientRole: params.clientRole,
        });

        const rows = await this.db
            .select({
                id: chatConversations.id,
                userId: chatConversations.userId,
                workerUserId: chatConversations.workerUserId,
                lastMessageAt: chatConversations.lastMessageAt,
                lastMessageId: chatConversations.lastMessageId,
                lastMessageSenderUserId:
                    chatConversations.lastMessageSenderUserId,
                lastMessageType: chatConversations.lastMessageType,
                lastMessagePreviewText:
                    chatConversations.lastMessagePreviewText,
                createdAt: chatConversations.createdAt,
                updatedAt: chatConversations.updatedAt,
                peerUserId: peerUserIdExpr,
                peerUserName: peerUserNameExpr,
                peerUserImage: peerUserImageExpr,
                myUnreadCount: sql<number>`COALESCE((
                    SELECT ${chatConversationUserStates.unreadCount}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${params.userId}
                    LIMIT 1
                ), 0)`,
                myLastReadMessageId: sql<string | null>`(
                    SELECT ${chatConversationUserStates.lastReadMessageId}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${params.userId}
                    LIMIT 1
                )`,
                myLastReadAt: sql<Date | null>`(
                    SELECT ${chatConversationUserStates.lastReadAt}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${params.userId}
                    LIMIT 1
                )`,
                peerLastReadMessageId: sql<string | null>`(
                    SELECT ${chatConversationUserStates.lastReadMessageId}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${peerUserIdExpr}
                    LIMIT 1
                )`,
                peerLastReadAt: sql<Date | null>`(
                    SELECT ${chatConversationUserStates.lastReadAt}
                    FROM ${chatConversationUserStates}
                    WHERE ${chatConversationUserStates.conversationId} = ${chatConversations.id}
                      AND ${chatConversationUserStates.userId} = ${peerUserIdExpr}
                    LIMIT 1
                )`,
            })
            .from(chatConversations)
            .where(
                and(
                    eq(chatConversations.id, params.conversationId),
                    participantWhere,
                ),
            )
            .limit(1);

        return rows[0];
    }

    async listConversationIdsForUser(
        userId: string,
        limit: number,
        clientRole: ChatClientRole,
    ): Promise<string[]> {
        const participantWhere =
            clientRole === 'customer'
                ? eq(chatConversations.userId, userId)
                : eq(chatConversations.workerUserId, userId);

        const rows = await this.db
            .select({ id: chatConversations.id })
            .from(chatConversations)
            .where(participantWhere)
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
        messageType: string;
        previewText: string;
        clientMsgId?: string | null;
    }): Promise<ChatMessageRecord> {
        return await this.db.transaction(async (tx) => {
            const now = new Date();
            const [conversation] = await tx
                .select({
                    id: chatConversations.id,
                    userId: chatConversations.userId,
                    workerUserId: chatConversations.workerUserId,
                })
                .from(chatConversations)
                .where(eq(chatConversations.id, params.conversationId))
                .limit(1);

            const peerUserId =
                conversation?.userId === params.senderUserId
                    ? conversation?.workerUserId
                    : conversation?.userId;

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
                    lastMessageId: message.id,
                    lastMessageSenderUserId: params.senderUserId,
                    lastMessageType: params.messageType,
                    lastMessagePreviewText: params.previewText,
                    updatedAt: now,
                })
                .where(eq(chatConversations.id, params.conversationId));

            if (peerUserId) {
                await tx
                    .insert(chatConversationUserStates)
                    .values([
                        {
                            conversationId: params.conversationId,
                            userId: params.senderUserId,
                            unreadCount: 0,
                        },
                        {
                            conversationId: params.conversationId,
                            userId: peerUserId,
                            unreadCount: 0,
                        },
                    ])
                    .onConflictDoNothing({
                        target: [
                            chatConversationUserStates.conversationId,
                            chatConversationUserStates.userId,
                        ],
                    });

                await tx
                    .update(chatConversationUserStates)
                    .set({
                        unreadCount: 0,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(
                                chatConversationUserStates.conversationId,
                                params.conversationId,
                            ),
                            eq(
                                chatConversationUserStates.userId,
                                params.senderUserId,
                            ),
                        ),
                    );

                await tx
                    .update(chatConversationUserStates)
                    .set({
                        unreadCount: sql`${chatConversationUserStates.unreadCount} + 1`,
                        updatedAt: now,
                    })
                    .where(
                        and(
                            eq(
                                chatConversationUserStates.conversationId,
                                params.conversationId,
                            ),
                            eq(chatConversationUserStates.userId, peerUserId),
                        ),
                    );
            }

            return message;
        });
    }

    async markConversationRead(params: {
        conversationId: string;
        userId: string;
        lastReadMessageId: string;
    }) {
        const now = new Date();
        return await this.db.transaction(async (tx) => {
            const updated = await tx
                .update(chatConversationUserStates)
                .set({
                    unreadCount: 0,
                    lastReadMessageId: params.lastReadMessageId,
                    lastReadAt: now,
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(
                            chatConversationUserStates.conversationId,
                            params.conversationId,
                        ),
                        eq(chatConversationUserStates.userId, params.userId),
                    ),
                );

            if (Number(updated.rowCount ?? 0) === 0) {
                await tx.insert(chatConversationUserStates).values({
                    conversationId: params.conversationId,
                    userId: params.userId,
                    unreadCount: 0,
                    lastReadMessageId: params.lastReadMessageId,
                    lastReadAt: now,
                    updatedAt: now,
                });
            }

            return {
                lastReadAt: now,
                lastReadMessageId: params.lastReadMessageId,
            };
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
