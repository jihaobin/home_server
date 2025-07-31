import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    decimal,
    timestamp,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { orders } from './orders';
import { withdrawalStatusEnum } from './enums';

/**
 * 收入记录表 (earnings)
 * 记录服务人员或店铺因完成订单而产生的收入
 */
export const earnings = pgTable(
    'earnings',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 收入记录唯一标识
        orderId: varchar('order_id', { length: 15 })
            .notNull()
            .references(() => orders.id, { onDelete: 'restrict' }), // 关联的订单 ID
        userId: varchar('user_id', { length: 15 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 收入归属者（服务人员或店主）的用户 ID
        amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // 收入金额
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 用户收入时间索引 - 用于查询用户的收入历史
        index('idx_earnings_user_time').on(
            table.userId,
            table.createdAt.desc(),
        ),
        // 订单用户索引 - 用于查询特定订单的收入分配
        index('idx_earnings_order_user').on(table.orderId, table.userId),
        // 收入金额时间索引 - 用于统计有效收入
        index('idx_earnings_amount_time')
            .on(table.createdAt.desc(), table.amount)
            .where(sql`amount > 0`),
    ],
);

/**
 * 提现记录表 (withdrawals)
 * 记录用户的提现请求和处理状态
 * 对应 SQL: CREATE TABLE withdrawals (...)
 */
export const withdrawals = pgTable(
    'withdrawals',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 提现请求唯一标识
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 发起提现的用户 ID
        amount: decimal('amount', { precision: 10, scale: 2 }).notNull(), // 提现金额
        status: withdrawalStatusEnum('status').notNull().default('pending'), // 提现状态
        requestedAt: timestamp('requested_at', {
            withTimezone: true,
        }).defaultNow(), // 请求时间
        processedAt: timestamp('processed_at', { withTimezone: true }), // 处理时间
    },
    (table) => [
        // 用户提现状态索引 - 用于查询用户的提现记录
        index('idx_withdrawals_user_status').on(
            table.userId,
            table.status,
            table.requestedAt.desc(),
        ),
        // 提现状态时间索引 - 用于管理员查询待处理的提现
        index('idx_withdrawals_status_time')
            .on(table.status, table.requestedAt.desc())
            .where(sql`status IN ('pending', 'approved')`),
    ],
);

// 收入记录关系定义
export const earningsRelations = relations(earnings, ({ one }) => ({
    order: one(orders, {
        fields: [earnings.orderId],
        references: [orders.id],
    }),
    user: one(users, {
        fields: [earnings.userId],
        references: [users.id],
    }),
}));

// 提现记录关系定义
export const withdrawalsRelations = relations(withdrawals, ({ one }) => ({
    user: one(users, {
        fields: [withdrawals.userId],
        references: [users.id],
    }),
}));
