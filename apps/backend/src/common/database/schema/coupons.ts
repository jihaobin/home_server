import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    text,
    decimal,
    integer,
    boolean,
    timestamp,
    pgEnum,
    check,
    index,
    uniqueIndex,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { orders } from './orders';
import { services, serviceCategories } from './server';

/**
 * 优惠券类型枚举
 */
export const couponTypeEnum = pgEnum('coupon_type', [
    'fixed_amount', // 固定金额折扣
    'percentage', // 百分比折扣
    'free_shipping', // 免费配送
]);

/**
 * 优惠券状态枚举
 */
export const couponStatusEnum = pgEnum('coupon_status', [
    'active', // 激活状态
    'inactive', // 未激活
    'expired', // 已过期
    'disabled', // 已禁用
]);

/**
 * 用户优惠券状态枚举
 */
export const userCouponStatusEnum = pgEnum('user_coupon_status', [
    'available', // 可用
    'used', // 已使用
    'expired', // 已过期
]);

/**
 * 优惠券主表 (coupons)
 * 存储优惠券的基本信息和规则
 */
export const coupons = pgTable(
    'coupons',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 优惠券唯一标识
        code: varchar('code', { length: 50 }).notNull().unique(), // 优惠码，用户输入的兑换码
        name: varchar('name', { length: 100 }).notNull(), // 优惠券名称
        description: text('description'), // 优惠券描述
        type: couponTypeEnum('type').notNull(), // 优惠券类型
        discountValue: decimal('discount_value', {
            precision: 18,
            scale: 2,
        }).notNull(), // 折扣值（金额或百分比）
        minOrderAmount: decimal('min_order_amount', {
            precision: 18,
            scale: 2,
        }).default('0'), // 最低订单金额要求
        maxDiscountAmount: decimal('max_discount_amount', {
            precision: 18,
            scale: 2,
        }), // 最大折扣金额（用于百分比折扣）
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        usageLimit: integer('usage_limit').default(1), // 单个用户使用次数限制，null表示无限制
        totalUsageLimit: integer('total_usage_limit'), // 优惠券总使用次数限制，null表示无限制
        isMultiUse: boolean('is_multi_use').default(false), // 是否可多次使用
        validFrom: timestamp('valid_from', { withTimezone: true }).notNull(), // 有效期开始时间
        validUntil: timestamp('valid_until', { withTimezone: true }).notNull(), // 有效期结束时间
        status: couponStatusEnum('status').default('active'), // 优惠券状态
        createdBy: varchar('created_by', { length: 15 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ), // 创建者（管理员）
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 确保折扣值为正数
        check('discount_value_positive', sql`${table.discountValue} > 0`),
        // 确保最低订单金额不为负数
        check(
            'min_order_amount_non_negative',
            sql`${table.minOrderAmount} >= 0`,
        ),
        // 确保有效期逻辑正确
        check(
            'valid_period_check',
            sql`${table.validFrom} < ${table.validUntil}`,
        ),
        // 为优惠码创建唯一索引
        uniqueIndex('idx_coupons_code').on(table.code),
        // 为状态和有效期创建复合索引，用于查询可用优惠券
        index('idx_coupons_status_valid').on(
            table.status,
            table.validFrom,
            table.validUntil,
        ),
    ],
);

/**
 * 优惠券服务分类限制表 (coupon_category_restrictions)
 * 定义优惠券适用的服务分类
 */
export const couponCategoryRestrictions = pgTable(
    'coupon_category_restrictions',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        couponId: varchar('coupon_id', { length: 255 })
            .notNull()
            .references(() => coupons.id, { onDelete: 'cascade' }), // 关联优惠券
        categoryId: varchar('category_id', { length: 255 })
            .notNull()
            .references(() => serviceCategories.id, { onDelete: 'cascade' }), // 关联服务分类
    },
    (table) => [
        // 为优惠券ID创建索引
        index('idx_coupon_category_coupon_id').on(table.couponId),
        // 防止重复关联
        uniqueIndex('idx_coupon_category_unique').on(
            table.couponId,
            table.categoryId,
        ),
    ],
);

/**
 * 优惠券服务限制表 (coupon_service_restrictions)
 * 定义优惠券适用的具体服务
 */
export const couponServiceRestrictions = pgTable(
    'coupon_service_restrictions',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        couponId: varchar('coupon_id', { length: 255 })
            .notNull()
            .references(() => coupons.id, { onDelete: 'cascade' }), // 关联优惠券
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'cascade' }), // 关联具体服务
    },
    (table) => [
        // 为优惠券ID创建索引
        index('idx_coupon_service_coupon_id').on(table.couponId),
        // 防止重复关联
        uniqueIndex('idx_coupon_service_unique').on(
            table.couponId,
            table.serviceId,
        ),
    ],
);

/**
 * 用户优惠券关联表 (user_coupons)
 * 记录用户获得的优惠券
 */
export const userCoupons = pgTable(
    'user_coupons',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 用户优惠券关联唯一标识
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 关联用户
        couponId: varchar('coupon_id', { length: 255 })
            .notNull()
            .references(() => coupons.id, { onDelete: 'cascade' }), // 关联优惠券
        status: userCouponStatusEnum('status').default('available'), // 用户优惠券状态
        usedCount: integer('used_count').default(0), // 已使用次数
        obtainedAt: timestamp('obtained_at', {
            withTimezone: true,
        }).defaultNow(), // 获得时间
        firstUsedAt: timestamp('first_used_at', { withTimezone: true }), // 首次使用时间
        lastUsedAt: timestamp('last_used_at', { withTimezone: true }), // 最后使用时间
    },
    (table) => [
        // 为用户ID创建索引，用于查询用户的优惠券
        index('idx_user_coupons_user_id').on(table.userId),
        // 为优惠券ID创建索引
        index('idx_user_coupons_coupon_id').on(table.couponId),
        // 为状态创建索引，用于查询可用优惠券
        index('idx_user_coupons_status').on(table.status),
        // 复合索引，用于查询用户的可用优惠券
        index('idx_user_coupons_user_status').on(table.userId, table.status),
    ],
);

/**
 * 优惠券使用记录表 (coupon_usage_records)
 * 记录优惠券的具体使用情况
 */
export const couponUsageRecords = pgTable(
    'coupon_usage_records',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 使用记录唯一标识
        userCouponId: varchar('user_coupon_id', { length: 255 })
            .notNull()
            .references(() => userCoupons.id, { onDelete: 'cascade' }), // 关联用户优惠券
        orderId: varchar('order_id', { length: 255 })
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }), // 关联订单
        discountAmount: decimal('discount_amount', {
            precision: 18,
            scale: 2,
        }).notNull(), // 实际折扣金额
        originalAmount: decimal('original_amount', {
            precision: 18,
            scale: 2,
        }).notNull(), // 原始订单金额
        finalAmount: decimal('final_amount', {
            precision: 18,
            scale: 2,
        }).notNull(), // 使用优惠券后的最终金额
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        usedAt: timestamp('used_at', { withTimezone: true }).defaultNow(), // 使用时间
    },
    (table) => [
        // 为用户优惠券ID创建索引
        index('idx_coupon_usage_user_coupon').on(table.userCouponId),
        // 为订单ID创建索引
        index('idx_coupon_usage_order').on(table.orderId),
        // 为使用时间创建索引，用于统计分析
        index('idx_coupon_usage_used_at').on(table.usedAt),
        // 确保折扣金额为正数
        check('discount_amount_positive', sql`${table.discountAmount} >= 0`),
        // 确保最终金额不为负数
        check('final_amount_non_negative', sql`${table.finalAmount} >= 0`),
    ],
);

// 优惠券关系定义
export const couponsRelations = relations(coupons, ({ one, many }) => ({
    creator: one(users, {
        fields: [coupons.createdBy],
        references: [users.id],
    }),
    categoryRestrictions: many(couponCategoryRestrictions),
    serviceRestrictions: many(couponServiceRestrictions),
    userCoupons: many(userCoupons),
}));

// 优惠券分类限制关系定义
export const couponCategoryRestrictionsRelations = relations(
    couponCategoryRestrictions,
    ({ one }) => ({
        coupon: one(coupons, {
            fields: [couponCategoryRestrictions.couponId],
            references: [coupons.id],
        }),
        category: one(serviceCategories, {
            fields: [couponCategoryRestrictions.categoryId],
            references: [serviceCategories.id],
        }),
    }),
);

// 优惠券服务限制关系定义
export const couponServiceRestrictionsRelations = relations(
    couponServiceRestrictions,
    ({ one }) => ({
        coupon: one(coupons, {
            fields: [couponServiceRestrictions.couponId],
            references: [coupons.id],
        }),
        service: one(services, {
            fields: [couponServiceRestrictions.serviceId],
            references: [services.id],
        }),
    }),
);

// 用户优惠券关系定义
export const userCouponsRelations = relations(userCoupons, ({ one, many }) => ({
    user: one(users, {
        fields: [userCoupons.userId],
        references: [users.id],
    }),
    coupon: one(coupons, {
        fields: [userCoupons.couponId],
        references: [coupons.id],
    }),
    usageRecords: many(couponUsageRecords),
}));

// 优惠券使用记录关系定义
export const couponUsageRecordsRelations = relations(
    couponUsageRecords,
    ({ one }) => ({
        userCoupon: one(userCoupons, {
            fields: [couponUsageRecords.userCouponId],
            references: [userCoupons.id],
        }),
        order: one(orders, {
            fields: [couponUsageRecords.orderId],
            references: [orders.id],
        }),
    }),
);
