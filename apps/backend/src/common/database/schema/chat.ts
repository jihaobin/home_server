import { relations, sql } from 'drizzle-orm';
import {
    index,
    jsonb,
    pgTable,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

import type { ChatMessageContent } from '@repo/types';

import { createId } from '.';
import { users } from './auth-user';

export const chatConversations = pgTable(
    'chat_conversations',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        workerUserId: varchar('worker_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        lastMessageAt: timestamp('last_message_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        uniqueIndex('chat_conversations_user_worker_unique').on(
            table.userId,
            table.workerUserId,
        ),
        index('idx_chat_conversations_user_last_message').on(
            table.userId,
            table.lastMessageAt.desc(),
            table.updatedAt.desc(),
        ),
        index('idx_chat_conversations_worker_last_message').on(
            table.workerUserId,
            table.lastMessageAt.desc(),
            table.updatedAt.desc(),
        ),
    ],
);

export const chatMessages = pgTable(
    'chat_messages',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        conversationId: varchar('conversation_id', { length: 255 })
            .notNull()
            .references(() => chatConversations.id, { onDelete: 'cascade' }),
        senderUserId: varchar('sender_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        content: jsonb('content').$type<ChatMessageContent>().notNull(),
        clientMsgId: varchar('client_msg_id', { length: 128 }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('idx_chat_messages_conversation_time').on(
            table.conversationId,
            table.createdAt.desc(),
        ),
        uniqueIndex('chat_messages_idempotency_unique')
            .on(table.conversationId, table.senderUserId, table.clientMsgId)
            .where(sql`client_msg_id IS NOT NULL`),
    ],
);

export const chatBlocks = pgTable(
    'chat_blocks',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        blockerUserId: varchar('blocker_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        blockedUserId: varchar('blocked_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('chat_blocks_blocker_blocked_unique').on(
            table.blockerUserId,
            table.blockedUserId,
        ),
        index('idx_chat_blocks_blocker_time').on(
            table.blockerUserId,
            table.createdAt.desc(),
        ),
    ],
);

export type ChatReportStatus = 'open' | 'reviewing' | 'resolved' | 'rejected';

export const chatReports = pgTable(
    'chat_reports',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        reporterUserId: varchar('reporter_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        reportedUserId: varchar('reported_user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }),
        messageId: varchar('message_id', { length: 255 }).references(
            () => chatMessages.id,
            { onDelete: 'set null' },
        ),
        reason: varchar('reason', { length: 200 }).notNull(),
        detail: jsonb('detail')
            .$type<Record<string, unknown>>()
            .notNull()
            .default(sql`'{}'::jsonb`),
        status: varchar('status', { length: 32 })
            .$type<ChatReportStatus>()
            .notNull()
            .default('open'),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .$onUpdateFn(() => new Date())
            .defaultNow()
            .notNull(),
    },
    (table) => [
        index('idx_chat_reports_status_time').on(
            table.status,
            table.createdAt.desc(),
        ),
        index('idx_chat_reports_reporter_time').on(
            table.reporterUserId,
            table.createdAt.desc(),
        ),
        index('idx_chat_reports_reported_time').on(
            table.reportedUserId,
            table.createdAt.desc(),
        ),
    ],
);

export const chatConversationsRelations = relations(
    chatConversations,
    ({ one, many }) => ({
        user: one(users, {
            fields: [chatConversations.userId],
            references: [users.id],
        }),
        worker: one(users, {
            fields: [chatConversations.workerUserId],
            references: [users.id],
        }),
        messages: many(chatMessages),
    }),
);

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
    conversation: one(chatConversations, {
        fields: [chatMessages.conversationId],
        references: [chatConversations.id],
    }),
    sender: one(users, {
        fields: [chatMessages.senderUserId],
        references: [users.id],
    }),
}));

export const chatBlocksRelations = relations(chatBlocks, ({ one }) => ({
    blocker: one(users, {
        fields: [chatBlocks.blockerUserId],
        references: [users.id],
    }),
    blocked: one(users, {
        fields: [chatBlocks.blockedUserId],
        references: [users.id],
    }),
}));

export const chatReportsRelations = relations(chatReports, ({ one }) => ({
    reporter: one(users, {
        fields: [chatReports.reporterUserId],
        references: [users.id],
    }),
    reported: one(users, {
        fields: [chatReports.reportedUserId],
        references: [users.id],
    }),
    message: one(chatMessages, {
        fields: [chatReports.messageId],
        references: [chatMessages.id],
    }),
}));
