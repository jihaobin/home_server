import { relations } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    text,
    boolean,
    timestamp,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { notificationTypeEnum } from './enums';

/**
 * 通知表 (notifications)
 * 存储发送给用户的各类通知
 */
export const notifications = pgTable(
    'notifications',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 通知唯一标识
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 接收通知的用户 ID
        type: notificationTypeEnum('type').notNull(), // 通知类型
        title: varchar('title', { length: 255 }).notNull(), // 通知标题
        message: text('message'), // 通知内容
        isRead: boolean('is_read').default(false), // 是否已读
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 用户未读通知索引 - 用于查询用户的未读通知列表
        index('idx_notifications_user_unread').on(
            table.userId,
            table.isRead,
            table.createdAt.desc(),
        ),
        // 通知类型时间索引 - 用于按类型查询通知
        index('idx_notifications_type_time').on(
            table.type,
            table.createdAt.desc(),
        ),
        // 用户通知类型索引 - 用于查询用户特定类型的通知
        index('idx_notifications_user_type').on(
            table.userId,
            table.type,
            table.isRead,
        ),
    ],
);

// 通知关系定义
export const notificationsRelations = relations(notifications, ({ one }) => ({
    user: one(users, {
        fields: [notifications.userId],
        references: [users.id],
    }),
}));
