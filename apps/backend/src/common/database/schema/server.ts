import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    foreignKey,
    index,
    integer,
    pgTable,
    primaryKey,
    text,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';
import { createId } from '.';
import { servicePersonnel } from './shops-service';
import { files } from './file';

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
        sortOrder: integer('sort_order').default(0).notNull(),
        commissionRate: integer('commission_rate').default(30).notNull(),
        iconFileId: varchar('icon_file_id', { length: 255 }).references(
            () => files.id,
            { onDelete: 'set null' },
        ),
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
        // 分类排序索引
        index('idx_service_categories_order').on(
            table.dep,
            table.sortOrder,
            table.id,
        ),
    ],
);

export const serviceTags = pgTable(
    'service_tags',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        name: varchar('name', { length: 100 }).notNull(),
        slug: varchar('slug', { length: 100 }).notNull(),
        domain: varchar('domain', { length: 50 }).notNull(),
        sortOrder: integer('sort_order').default(0).notNull(),
        isActive: boolean('is_active').default(true).notNull(),
        description: text('description'),
    },
    (table) => [
        index('idx_service_tags_domain_order').on(
            table.domain,
            table.sortOrder,
            table.id,
        ),
        uniqueIndex('uq_service_tags_domain_slug').on(
            table.domain,
            table.slug,
        ),
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
        serviceTagId: varchar('service_tag_id', { length: 255 }).references(
            () => serviceTags.id,
            { onDelete: 'set null' },
        ),
        name: varchar('name', { length: 100 }).notNull(), // 服务名称
        description: text('description'), // 服务详细描述
        imageFileId: varchar('image_file_id', { length: 255 }).references(
            () => files.id,
            { onDelete: 'set null' },
        ),
        isActive: boolean('is_active').default(true).notNull(), // 服务是否上架
    },
    (table) => [
        index('idx_services_service_tag').on(table.serviceTagId, table.id),
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
        description: text('description'), // 用于用户自定义服务详情页中的信息
        galleryFileIds: varchar('gallery_file_ids', { length: 255 })
            .array()
            .notNull()
            .default(sql`'{}'::varchar[]`),
        // 服务了多少个订单
        servicedCount: integer('serviced_count').default(0).notNull(),
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
        iconFile: one(files, {
            fields: [serviceCategories.iconFileId],
            references: [files.id],
        }),
        services: many(services),
    }),
);

export const serviceTagsRelations = relations(serviceTags, ({ many }) => ({
    services: many(services),
}));

// 服务关系定义
export const servicesRelations = relations(services, ({ one, many }) => ({
    category: one(serviceCategories, {
        fields: [services.categoryId],
        references: [serviceCategories.id],
    }),
    imageFile: one(files, {
        fields: [services.imageFileId],
        references: [files.id],
    }),
    serviceTag: one(serviceTags, {
        fields: [services.serviceTagId],
        references: [serviceTags.id],
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
