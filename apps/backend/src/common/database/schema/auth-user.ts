import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    pgTable,
    timestamp,
    varchar,
    text,
    uniqueIndex,
    index,
    uuid,
    jsonb,
} from 'drizzle-orm/pg-core';

import { createId, files } from '.';
import { roleEnum } from './enums';
import { servicePersonnel } from './shops-service';
import { userProfiles } from './user-profiles';
import { userAddresses } from './addresses';
import { orders } from './orders';
import { notificationTargets } from './notifications';
import { userCoupons } from './coupons';
import type { NotificationDeviceInfo } from '@repo/types';

// -- 用户表 (users)
// -- 存储用户的核心认证信息和基本资料。
export const users = pgTable(
    'users',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        email: varchar('email', { length: 255 }).notNull().default('').unique(),
        emailVerified: boolean('email_verified')
            .$defaultFn(() => false)
            .notNull(),
        phoneNumberVerified: boolean('phone_number_verified')
            .$defaultFn(() => false)
            .notNull(),
        name: varchar('name', { length: 50 }).default(''),
        sex: boolean('sex').default(true).notNull(), // true-男，false-女
        phoneNumber: varchar('phone_number', { length: 20 }).unique(), // 手机号码
        role: roleEnum('role')
            .array()
            .default(sql`ARRAY['customer']::user_role[]`),
        isActive: boolean('is_active').default(true), // 账户是否激活
        image: varchar('image', { length: 255 }).notNull().default(''),
        devices: jsonb('devices')
            .$type<NotificationDeviceInfo[]>()
            .notNull()
            .default(sql`'[]'::jsonb`),
        createdAt: timestamp('created_at').notNull().defaultNow(),
        updatedAt: timestamp('updated_at')
            .$onUpdateFn(() => new Date())
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('idx_users_email_active')
            .on(table.email)
            .where(sql`is_active = true`),
        uniqueIndex('idx_users_phone_active')
            .on(table.phoneNumber)
            .where(sql`phone_number IS NOT NULL AND is_active = true`),
        index('idx_users_role_active').on(
            table.role,
            table.isActive,
            table.createdAt,
        ),
    ],
);

// -- 第三方账户表 (accounts)
// -- 用于支持 OAuth 第三方登录。
export const accounts = pgTable('accounts', {
    id: varchar('id', { length: 255 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 255 })
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
    accessToken: text('access_token'),
    refreshToken: text('refresh_token'),
    idToken: text('id_token'),
    accessTokenExpiresAt: timestamp('access_token_expires_at'),
    refreshTokenExpiresAt: timestamp('refresh_token_expires_at'),
    scope: text('scope'),
    password: text('password'),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
});

// -- 会话表 (sessions)
// -- 存储用户的登录会话信息。
export const sessions = pgTable('sessions', {
    id: varchar('id', { length: 255 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    expiresAt: timestamp('expires_at').notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: varchar('user_id', { length: 255 })
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
});

// -- 验证令牌表 (verification_tokens)
// -- 存储用于邮箱验证或密码重置等一次性令牌。
export const verifications = pgTable('verifications', {
    id: varchar('id', { length: 255 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    identifier: text('identifier').notNull(),
    value: text('value').notNull(),
    expiresAt: timestamp('expires_at').notNull(),
    createdAt: timestamp('created_at').defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
});

// 表关系
export const userRelations = relations(users, ({ many, one }) => ({
    accounts: many(accounts),
    sessions: many(sessions),
    // MVP阶段注释店铺关系
    // shops: many(shops),
    servicePersonnelInfo: one(servicePersonnel, {
        fields: [users.id],
        references: [servicePersonnel.userId],
    }),
    profile: one(userProfiles, {
        fields: [users.id],
        references: [userProfiles.userId],
    }),
    addresses: many(userAddresses),
    orders: many(orders),
    notifications: many(notificationTargets),
    userCoupons: many(userCoupons),
    image: one(files, {
        fields: [users.id],
        references: [files.id],
    }),
}));

export const accountsRelations = relations(accounts, ({ one }) => ({
    user: one(users, {
        fields: [accounts.userId],
        references: [users.id],
    }),
}));

export const sessionsRelations = relations(sessions, ({ one }) => ({
    user: one(users, {
        fields: [sessions.userId],
        references: [users.id],
    }),
}));
