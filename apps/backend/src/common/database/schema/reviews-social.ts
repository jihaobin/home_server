import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    text,
    integer,
    timestamp,
    primaryKey,
    check,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { orders } from './orders';

/**
 * 评价表 (reviews)
 * 存储用户对服务人员或店铺的评价
 */
export const reviews = pgTable(
    'reviews',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 评价唯一标识
        orderId: varchar('order_id', { length: 255 })
            .notNull()
            .unique()
            .references(() => orders.id, { onDelete: 'cascade' }), // 关联的订单 ID，一个订单只能评价一次
        reviewerId: varchar('reviewer_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 评价者（客户）的用户 ID
        targetId: varchar('target_id', { length: 255 }).notNull(), // 被评价对象 ID (服务人员或店铺)
        targetType: varchar('target_type', { length: 50 }).notNull(), // 被评价对象类型 ('personnel' or 'shop')
        rating: integer('rating').notNull(), // 评分 (1-5星)
        comment: text('comment'), // 评价内容
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        check(
            'rating_check',
            sql`${table.rating} >= 1 AND ${table.rating} <= 5`,
        ),
        // 被评价对象评分索引 - 用于查询对象的评价列表，按评分和时间排序
        index('idx_reviews_target_rating').on(
            table.targetId,
            table.targetType,
            table.rating.desc(),
            table.createdAt.desc(),
        ),

        // 被评价对象的订单索引
        index('idx_reviews_order_unique').on(table.orderId),

        // 评价者时间索引 - 用于查询用户的评价历史
        index('idx_reviews_reviewer_time').on(
            table.reviewerId,
            table.createdAt.desc(),
        ),
    ],
);

/**
 * 关注表 (follows)
 * 多对多关系，记录用户之间的关注关系
 */
export const follows = pgTable(
    'follows',
    {
        followerId: varchar('follower_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 关注者的用户 ID
        followingId: varchar('following_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 被关注者的用户 ID
    },
    (table) => [
        primaryKey({
            columns: [table.followerId, table.followingId],
            name: 'follows_pkey',
        }),
        // 关注者索引 - 用于查询用户关注的人列表
        index('idx_follows_follower').on(table.followerId, table.followingId),
        // 被关注者索引 - 用于查询用户的粉丝列表
        index('idx_follows_following').on(table.followingId, table.followerId),
    ],
);

/**
 * 黑名单/屏蔽表 (blocks)
 * 多对多关系，记录用户之间的屏蔽关系
 */
export const blocks = pgTable(
    'blocks',
    {
        blockerId: varchar('blocker_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 操作屏蔽的用户 ID
        blockedId: varchar('blocked_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 被屏蔽的用户 ID
    },
    (table) => [
        primaryKey({
            columns: [table.blockerId, table.blockedId],
            name: 'blocks_pkey',
        }),
        // 屏蔽者索引 - 用于查询用户屏蔽的人列表
        index('idx_blocks_blocker').on(table.blockerId, table.blockedId),
        // 被屏蔽者索引 - 用于查询谁屏蔽了该用户
        index('idx_blocks_blocked').on(table.blockedId, table.blockerId),
    ],
);

// 评价关系定义
export const reviewsRelations = relations(reviews, ({ one }) => ({
    order: one(orders, {
        fields: [reviews.orderId],
        references: [orders.id],
    }),
    reviewer: one(users, {
        fields: [reviews.reviewerId],
        references: [users.id],
    }),
}));

// 关注关系定义
export const followsRelations = relations(follows, ({ one }) => ({
    follower: one(users, {
        fields: [follows.followerId],
        references: [users.id],
        relationName: 'follower',
    }),
    following: one(users, {
        fields: [follows.followingId],
        references: [users.id],
        relationName: 'following',
    }),
}));

// 屏蔽关系定义
export const blocksRelations = relations(blocks, ({ one }) => ({
    blocker: one(users, {
        fields: [blocks.blockerId],
        references: [users.id],
        relationName: 'blocker',
    }),
    blocked: one(users, {
        fields: [blocks.blockedId],
        references: [users.id],
        relationName: 'blocked',
    }),
}));
