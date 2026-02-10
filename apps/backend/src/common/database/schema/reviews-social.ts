import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    text,
    integer,
    boolean,
    timestamp,
    primaryKey,
    check,
    index,
    jsonb,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { orders } from './orders';
import { reviewTargetTypeEnum } from './enums';

/**
 * 评价表 (reviews)
 * 存储用户对服务人员，订单或店铺的评价
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
        targetType: reviewTargetTypeEnum('target_type').notNull(), // 被评价对象类型
        serviceId: varchar('service_id', { length: 255 }).notNull(), // 服务 ID，冗余存储用于高效查询
        rating: integer('rating').notNull().default(1).notNull(), // 总体评分 (1-5星)
        serviceQuality: integer('service_quality').default(1).notNull(), // 服务质量评分 (1-5星)
        attitude: integer('attitude').default(1).notNull(), // 服务态度评分 (1-5星)
        punctuality: integer('punctuality').default(1).notNull(), // 时间准时性评分 (1-5星)
        comment: text('comment').notNull(), // 评价内容
        isAnonymous: boolean('is_anonymous').default(false).notNull(), // 是否匿名评价
        helpfulCount: integer('helpful_count').default(0).notNull(), // 有用评价数
        unhelpfulCount: integer('unhelpful_count').default(0).notNull(), // 无用评价数
        imageIds: jsonb('image_ids')
            .$type<string[]>()
            .notNull()
            .default(sql`'[]'::jsonb`), // 评价图片文件ID列表
        createdAt: timestamp('created_at', { withTimezone: true })
            .defaultNow()
            .notNull(),
    },
    (table) => [
        // 评分范围检查
        check(
            'rating_check',
            sql`${table.rating} >= 1 AND ${table.rating} <= 5`,
        ),
        check(
            'service_quality_check',
            sql`${table.serviceQuality} IS NULL OR (${table.serviceQuality} >= 1 AND ${table.serviceQuality} <= 5)`,
        ),
        check(
            'attitude_check',
            sql`${table.attitude} IS NULL OR (${table.attitude} >= 1 AND ${table.attitude} <= 5)`,
        ),
        check(
            'punctuality_check',
            sql`${table.punctuality} IS NULL OR (${table.punctuality} >= 1 AND ${table.punctuality} <= 5)`,
        ),
        // 被评价对象评分索引 - 用于查询对象的评价列表，按评分和时间排序
        index('idx_reviews_target_rating').on(
            table.targetId,
            table.targetType,
            table.rating.desc(),
            table.createdAt.desc(),
        ),
        // 评分筛选索引 - 用于按好评/中评/差评快速筛选（好评4-5星，中评3星，差评1-2星）
        index('idx_reviews_rating_filter').on(
            table.targetId,
            table.targetType,
            table.rating,
        ),
        // 服务人员+服务索引 - 用于查询服务人员提供某个服务的评价
        index('idx_reviews_target_service').on(
            table.targetId,
            table.targetType,
            table.serviceId,
            table.createdAt.desc(),
        ),
        // 好评索引 - 用于快速查询好评（4-5星）
        index('idx_reviews_good_rating')
            .on(table.targetId, table.targetType, table.createdAt.desc())
            .where(sql`${table.rating} >= 4`),
        // 差评索引 - 用于快速查询差评（1-2星）
        index('idx_reviews_bad_rating')
            .on(table.targetId, table.targetType, table.createdAt.desc())
            .where(sql`${table.rating} <= 2`),
        // 评价内容PGroonga全文搜索索引 - 仅为有评价内容的记录建立索引
        index('idx_reviews_comment_search')
            .using('pgroonga', table.comment)
            .where(sql`comment IS NOT NULL AND comment != ''`),

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
 * 评分统计表 (review_stats)
 * 存储被评价对象的评分统计信息，用于快速查询和展示
 * 通过触发器或应用层逻辑实时更新
 */
export const reviewStats = pgTable(
    'review_stats',
    {
        targetId: varchar('target_id', { length: 255 }).notNull(), // 被评价对象 ID
        targetType: reviewTargetTypeEnum('target_type').notNull(), // 被评价对象类型
        serviceId: varchar('service_id', { length: 255 }).notNull(), // 服务 ID；'__all__' 表示全部服务汇总
        totalCount: integer('total_count').default(0).notNull(), // 总评价数
        photoCount: integer('photo_count').default(0).notNull(), // 晒图评价数（有图评价条数）
        goodCount: integer('good_count').default(0).notNull(), // 好评数（4-5星）
        neutralCount: integer('neutral_count').default(0).notNull(), // 中评数（3星）
        badCount: integer('bad_count').default(0).notNull(), // 差评数（1-2星）
        averageRating: integer('average_rating').default(0).notNull(), // 平均评分 * 100（存储为整数，如 450 表示 4.50 星）
        averageServiceQuality: integer('average_service_quality').default(0), // 平均服务质量评分 * 100
        averageAttitude: integer('average_attitude').default(0), // 平均态度评分 * 100
        averagePunctuality: integer('average_punctuality').default(0), // 平均准时性评分 * 100
        lastReviewAt: timestamp('last_review_at', { withTimezone: true }), // 最后评价时间
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()),
    },
    (table) => [
        primaryKey({
            columns: [table.targetId, table.targetType, table.serviceId],
            name: 'review_stats_pkey',
        }),
        // 评分排序索引 - 用于按平均评分排序展示
        index('idx_review_stats_rating').on(
            table.targetType,
            table.averageRating.desc(),
            table.totalCount.desc(),
        ),
        // 好评率索引 - 用于按好评数排序
        index('idx_review_stats_good').on(
            table.targetType,
            table.goodCount.desc(),
            table.totalCount.desc(),
        ),
        // 最新评价索引 - 用于查找最近被评价的对象
        index('idx_review_stats_recent').on(
            table.targetType,
            table.lastReviewAt.desc(),
        ),
        // 服务人员+服务统计索引 - 用于查询服务人员提供某个服务的统计
        index('idx_review_stats_target_service').on(
            table.targetId,
            table.targetType,
            table.serviceId,
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

// 评分统计关系定义
export const reviewStatsRelations = relations(reviewStats, () => ({
    // 注意：这里不直接关联到具体表，因为 targetId 可能指向不同类型的对象
    // 在应用层根据 targetType 来确定关联的表
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
