import { relations } from 'drizzle-orm';
import {
    boolean,
    pgTable,
    timestamp,
    varchar,
    text,
    decimal,
    pgEnum,
} from 'drizzle-orm/pg-core';

import { createId } from '.';

/**
 *
 * CREATE TYPE user_role AS ENUM (
    'customer',         -- 客户
    'service_personnel',-- 服务人员
    'shop_admin',       -- 店铺管理员
    'admin',            -- 平台管理员
    'super_admin'       -- 超级管理员
);
 */
/* =================================================================
-- 1. 认证与用户核心模块
-- 设计说明: 该模块负责用户的身份认证、基础信息和详细资料管理。
-- 采用 users 和 user_profiles 分离的设计，核心认证信息与非必要个人信息解耦，
-- 有利于性能优化和数据安全。
-- =================================================================
*/
export const roleEnum = pgEnum('user_role', [
    'customer',
    'service_personnel',
    'shop_admin',
    'admin',
    'super_admin',
]);

// -- 用户表 (users)
// -- 存储用户的核心认证信息和基本资料。
export const users = pgTable('users', {
    id: varchar('id', { length: 5 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    email: varchar('email', { length: 255 }).notNull().default('').unique(),
    emailVerified: boolean('email_verified')
        .$defaultFn(() => false)
        .notNull(),
    name: varchar('name', { length: 50 }).notNull().default(''),
    jobTitle: varchar('job_title', { length: 50 }).notNull().default(''),
    income: decimal('income', { precision: 10, scale: 2 })
        .notNull()
        .default('0'),
    role: roleEnum('role').default('customer'),
    isDelete: boolean('is_delete').notNull().default(false),
    image: varchar('image', { length: 255 }).notNull().default(''),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
});

// -- 第三方账户表 (accounts)
// -- 用于支持 OAuth 第三方登录。
export const accounts = pgTable('accounts', {
    id: varchar('id', { length: 15 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    accountId: varchar('account_id', { length: 255 }).notNull(),
    providerId: varchar('provider_id', { length: 255 }).notNull(),
    userId: varchar('user_id', { length: 5 })
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
    id: varchar('id', { length: 5 })
        .primaryKey()
        .$default(() => createId())
        .unique(),
    expiresAt: timestamp('expires_at').notNull(),
    token: varchar('token', { length: 255 }).notNull().unique(),
    createdAt: timestamp('created_at').notNull().defaultNow(),
    updatedAt: timestamp('updated_at').$onUpdateFn(() => new Date()),
    ipAddress: text('ip_address'),
    userAgent: text('user_agent'),
    userId: varchar('user_id', { length: 5 })
        .notNull()
        .references(() => users.id, { onDelete: 'cascade' }),
});

// -- 验证令牌表 (verification_tokens)
// -- 存储用于邮箱验证或密码重置等一次性令牌。
export const verifications = pgTable('verifications', {
    id: varchar('id', { length: 5 })
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
export const userRelations = relations(users, ({ many }) => ({
    accounts: many(accounts),
    sessions: many(sessions),
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
