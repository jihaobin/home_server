import { relations, sql } from 'drizzle-orm';
import {
    AnyPgColumn,
    boolean,
    check,
    index,
    integer,
    numeric,
    pgEnum,
    pgTable,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';
import { serviceCategories } from './server';

export const categoryCommissionStrategyStatusEnum = pgEnum(
    'category_commission_strategy_status',
    ['draft', 'published', 'archived'],
);

export const categoryCommissionStrategies = pgTable(
    'category_commission_strategies',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        categoryId: varchar('category_id', { length: 255 })
            .notNull()
            .references(() => serviceCategories.id, { onDelete: 'restrict' }),
        strategyName: varchar('strategy_name', { length: 100 }).notNull(),
        status: categoryCommissionStrategyStatusEnum('status')
            .notNull()
            .default('draft'),
        // 当前版本需要真实外键约束，避免仅靠 relations 映射导致脏数据
        currentVersionId: varchar('current_version_id', { length: 255 }).references(
            (): AnyPgColumn => categoryCommissionStrategyVersions.id,
            { onDelete: 'set null' },
        ),
        createdBy: varchar('created_by', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        updatedBy: varchar('updated_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        publishedBy: varchar('published_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('category_commission_strategy_category_unique').on(
            table.categoryId,
        ),
        index('category_commission_strategy_status_idx').on(
            table.status,
            table.updatedAt.desc(),
        ),
    ],
);

export const categoryCommissionStrategyVersions = pgTable(
    'category_commission_strategy_versions',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        strategyId: varchar('strategy_id', { length: 255 })
            .notNull()
            .references(() => categoryCommissionStrategies.id, {
                onDelete: 'cascade',
            }),
        versionNo: integer('version_no').notNull(),
        status: categoryCommissionStrategyStatusEnum('status')
            .notNull()
            .default('draft'),
        versionNote: varchar('version_note', { length: 500 }),
        effectiveFrom: timestamp('effective_from', { withTimezone: true }),
        effectiveTo: timestamp('effective_to', { withTimezone: true }),
        beginnerProtectionIsEnabled: boolean('beginner_protection_is_enabled')
            .notNull()
            .default(false),
        beginnerProtectionDays: integer('beginner_protection_days')
            .notNull()
            .default(1),
        beginnerProtectionMonthlyIncomeThreshold: numeric(
            'beginner_protection_monthly_income_threshold',
            { precision: 18, scale: 2, mode: 'number' },
        )
            .notNull()
            .default(0),
        beginnerProtectionFixedCommissionRate: integer(
            'beginner_protection_fixed_commission_rate',
        )
            .notNull()
            .default(0),
        createdBy: varchar('created_by', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        publishedBy: varchar('published_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('category_commission_strategy_version_unique').on(
            table.strategyId,
            table.versionNo,
        ),
        index('category_commission_strategy_version_status_idx').on(
            table.strategyId,
            table.status,
            table.versionNo.desc(),
        ),
        check(
            'category_commission_strategy_version_no_check',
            sql`${table.versionNo} > 0`,
        ),
        check(
            'category_commission_strategy_version_protection_days_check',
            sql`${table.beginnerProtectionDays} >= 1`,
        ),
        check(
            'category_commission_strategy_version_protection_threshold_check',
            sql`${table.beginnerProtectionMonthlyIncomeThreshold} >= 0`,
        ),
        check(
            'category_commission_strategy_version_protection_rate_check',
            sql`${table.beginnerProtectionFixedCommissionRate} BETWEEN 0 AND 100`,
        ),
    ],
);

export const categoryCommissionStrategyRules = pgTable(
    'category_commission_strategy_rules',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        strategyVersionId: varchar('strategy_version_id', { length: 255 })
            .notNull()
            .references(() => categoryCommissionStrategyVersions.id, {
                onDelete: 'cascade',
            }),
        threshold: numeric('threshold', {
            precision: 18,
            scale: 2,
            mode: 'number',
        })
            .notNull()
            .default(0),
        commissionRate: integer('commission_rate').notNull(),
        isEnabled: boolean('is_enabled').notNull().default(true),
        sortOrder: integer('sort_order').notNull().default(0),
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        index('category_commission_strategy_rule_version_idx').on(
            table.strategyVersionId,
            table.sortOrder,
            table.threshold,
        ),
        check(
            'category_commission_strategy_rule_threshold_check',
            sql`${table.threshold} >= 0`,
        ),
        check(
            'category_commission_strategy_rule_rate_check',
            sql`${table.commissionRate} BETWEEN 0 AND 100`,
        ),
    ],
);

export const categoryCommissionStrategiesRelations = relations(
    categoryCommissionStrategies,
    ({ one, many }) => ({
        category: one(serviceCategories, {
            fields: [categoryCommissionStrategies.categoryId],
            references: [serviceCategories.id],
        }),
        currentVersion: one(categoryCommissionStrategyVersions, {
            fields: [categoryCommissionStrategies.currentVersionId],
            references: [categoryCommissionStrategyVersions.id],
        }),
        versions: many(categoryCommissionStrategyVersions),
        creator: one(users, {
            fields: [categoryCommissionStrategies.createdBy],
            references: [users.id],
            relationName: 'categoryCommissionStrategyCreator',
        }),
        updater: one(users, {
            fields: [categoryCommissionStrategies.updatedBy],
            references: [users.id],
            relationName: 'categoryCommissionStrategyUpdater',
        }),
        publisher: one(users, {
            fields: [categoryCommissionStrategies.publishedBy],
            references: [users.id],
            relationName: 'categoryCommissionStrategyPublisher',
        }),
    }),
);

export const categoryCommissionStrategyVersionsRelations = relations(
    categoryCommissionStrategyVersions,
    ({ one, many }) => ({
        strategy: one(categoryCommissionStrategies, {
            fields: [categoryCommissionStrategyVersions.strategyId],
            references: [categoryCommissionStrategies.id],
        }),
        rules: many(categoryCommissionStrategyRules),
        creator: one(users, {
            fields: [categoryCommissionStrategyVersions.createdBy],
            references: [users.id],
            relationName: 'categoryCommissionStrategyVersionCreator',
        }),
        publisher: one(users, {
            fields: [categoryCommissionStrategyVersions.publishedBy],
            references: [users.id],
            relationName: 'categoryCommissionStrategyVersionPublisher',
        }),
    }),
);

export const categoryCommissionStrategyRulesRelations = relations(
    categoryCommissionStrategyRules,
    ({ one }) => ({
        version: one(categoryCommissionStrategyVersions, {
            fields: [categoryCommissionStrategyRules.strategyVersionId],
            references: [categoryCommissionStrategyVersions.id],
        }),
    }),
);
