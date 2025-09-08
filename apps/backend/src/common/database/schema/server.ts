import {
    pgTable,
    varchar,
    text,
    integer,
    foreignKey,
    decimal,
    boolean,
    primaryKey,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { relations, sql } from 'drizzle-orm';
import { servicePersonnel } from './shops-service';

// =================================================================
// 服务与分类模块
// 设计说明: 定义了平台可提供的具体服务项目及其分类。
// 采用无限级分类设计，支持灵活的服务目录结构。
// =================================================================

// 服务分类表 (service_categories)
export const serviceCategories = pgTable(
    'service_categories',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        parentId: varchar('parent_id', { length: 255 }), // 父分类 ID，用于实现无限级分类
        name: varchar('name', { length: 100 }).notNull(), // 分类名称
        dep: integer('dep').notNull(), // 分类层级深度
        description: text('description'), // 分类描述
        isActive: boolean('is_active').default(true).notNull(),
    },
    (table) => [
        foreignKey({
            name: 'fk_sc_parent',
            columns: [table.parentId],
            foreignColumns: [table.id],
        }).onDelete('set null'),
        // 父分类索引 - 用于查询子分类
        index('idx_service_categories_parent')
            .on(table.parentId, table.id)
            .where(sql`parent_id IS NOT NULL`),
        // 分类名称PGroonga全文搜索索引 - 仅为激活的分类建立索引
        index('idx_service_categories_name_active')
            .using('pgroonga', table.name)
            .where(sql`is_active = true`),
        // 分类描述PGroonga全文搜索索引 - 仅为激活且有描述的分类建立索引
        index('idx_service_categories_desc_active')
            .using('pgroonga', table.description)
            .where(sql`is_active = true AND description IS NOT NULL`),
    ],
);

export const services = pgTable(
    'services',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        categoryId: varchar('category_id', { length: 255 })
            .notNull()
            .references(() => serviceCategories.id, { onDelete: 'restrict' }), // 所属分类 ID
        name: varchar('name', { length: 100 }).notNull(), // 服务名称
        description: text('description'), // 服务详细描述
        basePrice: decimal('base_price', { precision: 18, scale: 2 }).notNull(), // 基础价格
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        estimatedDurationMinutes: integer(
            'estimated_duration_minutes',
        ).notNull(), // 预计服务时长（分钟）
        isActive: boolean('is_active').default(true).notNull(), // 服务是否上架
    },
    (table) => [
        // 分类活跃服务索引 - 用于按分类查询上架的服务
        index('idx_services_category_active')
            .on(table.categoryId, table.isActive, table.basePrice)
            .where(sql`is_active = true`),
        // 价格范围索引 - 用于价格筛选
        index('idx_services_price_range')
            .on(table.basePrice, table.isActive)
            .where(sql`is_active = true`),
        // 服务名称PGroonga全文搜索索引 - 仅为激活的服务建立索引
        index('idx_services_name_active')
            .using('pgroonga', table.name)
            .where(sql`is_active = true`),
        // 服务描述PGroonga全文搜索索引 - 仅为激活且有描述的服务建立索引
        index('idx_services_desc_active')
            .using('pgroonga', table.description)
            .where(sql`is_active = true AND description IS NOT NULL`),
        // 服务多字段组合搜索索引 - 仅为激活的服务建立索引
        index('idx_services_search_active')
            .using('pgroonga', sql`(ARRAY[name, description])`)
            .where(sql`is_active = true AND description IS NOT NULL`),
        // 服务时长索引 - 用于按时长筛选服务
        index('idx_services_duration')
            .on(table.estimatedDurationMinutes, table.isActive)
            .where(
                sql`is_active = true AND estimated_duration_minutes IS NOT NULL`,
            ),
    ],
);

export const servicePersonnelSkills = pgTable(
    'service_personnel_skills',
    {
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => servicePersonnel.userId, { onDelete: 'cascade' }), // 服务人员的用户 ID
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'cascade' }), // 服务项目 ID
    },
    (table) => [
        primaryKey({
            columns: [table.userId, table.serviceId],
            name: 'service_personnel_skills_pkey',
        }),
        // 服务技能索引 - 用于查询掌握特定服务的人员
        index('idx_service_personnel_skills_service').on(
            table.serviceId,
            table.userId,
        ),
        // 人员技能索引 - 用于查询人员掌握的服务
        index('idx_service_personnel_skills_user').on(
            table.userId,
            table.serviceId,
        ),
    ],
);

// 服务分类关系定义
export const serviceCategoriesRelations = relations(
    serviceCategories,
    ({ one, many }) => ({
        parent: one(serviceCategories, {
            fields: [serviceCategories.parentId],
            references: [serviceCategories.id],
            relationName: 'parent',
        }),
        children: many(serviceCategories, {
            relationName: 'parent',
        }),
        services: many(services),
    }),
);

// 服务关系定义
export const servicesRelations = relations(services, ({ one, many }) => ({
    category: one(serviceCategories, {
        fields: [services.categoryId],
        references: [serviceCategories.id],
    }),
    personnelSkills: many(servicePersonnelSkills),
}));

// 服务人员技能关系定义
export const servicePersonnelSkillsRelations = relations(
    servicePersonnelSkills,
    ({ one }) => ({
        personnel: one(servicePersonnel, {
            fields: [servicePersonnelSkills.userId],
            references: [servicePersonnel.userId],
        }),
        service: one(services, {
            fields: [servicePersonnelSkills.serviceId],
            references: [services.id],
        }),
    }),
);
