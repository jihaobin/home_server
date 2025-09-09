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
import { services } from './server';
import { userAddresses } from './addresses';
import { servicePersonnel } from './shops-service';
import { couponUsageRecords } from './coupons';
import {
    orderStatusEnum,
    paymentStatusEnum,
    assignmentTypeEnum,
    paymentMethodEnum,
} from './enums';

/**
 * 订单表 (orders)
 * 核心订单信息表，记录了订单的基本数据
 */
export const orders = pgTable(
    'orders',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 订单唯一标识
        orderSerial: varchar('order_serial', { length: 50 }).notNull().unique(), // 订单流水号，便于用户查询
        customerId: varchar('customer_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 下单客户的用户 ID
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'restrict' }), // 购买的服务项目 ID
        addressId: varchar('address_id', { length: 255 })
            .notNull()
            .references(() => userAddresses.id, { onDelete: 'restrict' }), // 服务地址 ID
        status: orderStatusEnum('status').notNull().default('pending_payment'), // 订单当前状态
        originalAmount: decimal('original_amount', {
            precision: 18,
            scale: 2,
        }).notNull(), // 原始订单金额（使用优惠券前）
        discountAmount: decimal('discount_amount', {
            precision: 18,
            scale: 2,
        }).default('0'), // 优惠券折扣金额
        totalAmount: decimal('total_amount', {
            precision: 18,
            scale: 2,
        }).notNull(), // 订单总金额（使用优惠券后）
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        couponCode: varchar('coupon_code', { length: 50 }), // 使用的优惠券代码
        appointmentTime: timestamp('appointment_time', {
            withTimezone: true,
        }).notNull(), // 预约服务时间
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 客户订单状态时间复合索引 - 用于客户订单列表查询
        index('idx_orders_customer_status_time').on(
            table.customerId,
            table.status,
            table.createdAt.desc(),
        ),
        // 订单流水号PGroonga搜索索引 - 支持模糊查询订单号
        index('idx_orders_serial_search').using('pgroonga', table.orderSerial),
        // 优惠券代码PGroonga搜索索引 - 仅为使用了优惠券的订单建立索引
        index('idx_orders_coupon_search')
            .using('pgroonga', table.couponCode)
            .where(sql`coupon_code IS NOT NULL`),
        // 待分配和进行中订单的预约时间索引
        index('idx_orders_status_appointment')
            .on(table.status, table.appointmentTime)
            .where(
                sql`status IN ('pending_assignment', 'service_in_progress')`,
            ),
        // 服务项目时间索引 - 用于服务统计
        index('idx_orders_service_time')
            .on(table.serviceId, table.createdAt.desc())
            .with({ fillfactor: '70' }),
        // 订单流水号查询索引
        index('idx_orders_serial_lookup').on(table.orderSerial),
    ],
);

/**
 * 订单分配表 (order_assignments)
 * 记录订单被分配给哪个服务人员或店铺
 */
export const orderAssignments = pgTable(
    'order_assignments',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 分配记录唯一标识
        orderId: varchar('order_id', { length: 255 })
            .notNull()
            .unique()
            .references(() => orders.id, { onDelete: 'cascade' }), // 关联的订单 ID，一个订单只应有一个最终分配
        servicePersonnelId: varchar('service_personnel_id', {
            length: 255,
        }).references(() => servicePersonnel.userId, { onDelete: 'cascade' }), // 分配的服务人员 ID
        // MVP阶段注释店铺分配字段
        // shopId: varchar('shop_id', { length: 255 }).references(() => shops.id, {
        //     onDelete: 'cascade',
        // }), // 分配的店铺 ID (如果按店铺分配)
        assignmentType: assignmentTypeEnum('assignment_type').notNull(), // 分配方式
        assignedAt: timestamp('assigned_at').defaultNow(), // 分配时间
    },
    (table) => [
        // 服务人员分配时间索引 - 用于查询服务人员的订单历史
        index('idx_order_assignments_personnel_time').on(
            table.servicePersonnelId,
            table.assignedAt.desc(),
        ),
        // 店铺分配时间索引 - 用于查询店铺的订单历史
        // index('idx_order_assignments_shop_time')
        //     .on(table.shopId, table.assignedAt.desc())
        //     .where(sql`shop_id IS NOT NULL`),
        // 分配类型时间索引 - 用于统计不同分配方式的效果
        index('idx_order_assignments_type_time').on(
            table.assignmentType,
            table.assignedAt.desc(),
        ),
    ],
);

/**
 * 支付记录表 (payments)
 * 记录与订单相关的支付信息
 */
export const payments = pgTable(
    'payments',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 支付记录唯一标识
        orderId: varchar('order_id', { length: 255 })
            .notNull()
            .references(() => orders.id, { onDelete: 'cascade' }), // 关联的订单 ID
        amount: decimal('amount', { precision: 18, scale: 2 }).notNull(), // 支付金额
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        paymentMethod: paymentMethodEnum('payment_method').notNull(), // 支付方式 (如 'wechat_pay', 'alipay')
        transactionId: varchar('transaction_id', { length: 255 }), // 第三方支付平台的交易号
        status: paymentStatusEnum('status').notNull().default('pending'), // 支付状态
        paidAt: timestamp('paid_at', { withTimezone: true }), // 支付完成时间
    },
    (table) => [
        // 订单支付状态索引 - 用于查询订单的支付情况
        index('idx_payments_order_status').on(table.orderId, table.status),
        // 支付状态时间索引 - 用于查询已完成的支付记录
        index('idx_payments_status_time')
            .on(table.status, table.paidAt)
            .where(sql`paid_at IS NOT NULL`),
        // 第三方交易号索引 - 用于支付回调查询
        index('idx_payments_transaction_id')
            .on(table.transactionId)
            .where(sql`transaction_id IS NOT NULL`),
    ],
);

// 订单关系定义
export const ordersRelations = relations(orders, ({ one, many }) => ({
    customer: one(users, {
        fields: [orders.customerId],
        references: [users.id],
    }),
    service: one(services, {
        fields: [orders.serviceId],
        references: [services.id],
    }),
    address: one(userAddresses, {
        fields: [orders.addressId],
        references: [userAddresses.id],
    }),
    assignment: one(orderAssignments, {
        fields: [orders.id],
        references: [orderAssignments.orderId],
    }),
    payments: many(payments),
    couponUsageRecords: many(couponUsageRecords),
}));

// 订单分配关系定义
export const orderAssignmentsRelations = relations(
    orderAssignments,
    ({ one }) => ({
        order: one(orders, {
            fields: [orderAssignments.orderId],
            references: [orders.id],
        }),
        servicePersonnel: one(servicePersonnel, {
            fields: [orderAssignments.servicePersonnelId],
            references: [servicePersonnel.userId],
        }),
        // MVP阶段注释店铺关系
        // shop: one(shops, {
        //     fields: [orderAssignments.shopId],
        //     references: [shops.id],
        // }),
    }),
);

// 支付记录关系定义
export const paymentsRelations = relations(payments, ({ one }) => ({
    order: one(orders, {
        fields: [payments.orderId],
        references: [orders.id],
    }),
}));
