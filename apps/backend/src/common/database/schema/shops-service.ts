import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    timestamp,
    varchar,
    text,
    integer,
    boolean,
    time,
    geometry,
    index,
} from 'drizzle-orm/pg-core';

import { createId, users } from '.';
import { servicePersonnelSkills } from './server';

// =================================================================
// 店铺与服务人员模块
// 设计说明: 此模块定义了服务的提供方，包括店铺和独立的服务人员。
// 服务人员可以隶属于某个店铺，也可以是独立提供服务。
// =================================================================

// 店铺表
export const shops = pgTable(
    'shops',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        ownerId: varchar('owner_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 店铺所有者的用户 ID
        name: varchar('name', { length: 100 }).notNull(), // 店铺名称
        description: text('description'), // 店铺描述
        detailedAddress: varchar('address', { length: 255 }), // 店铺的详细地址
        homeNumber: varchar('home_number', { length: 50 }).notNull(), // 门牌号
        province: varchar('province', { length: 100 }), // 省份
        district: varchar('district', { length: 100 }), // 市区
        county: varchar('county', { length: 100 }), // 区县
        geom: geometry('geom', {
            type: 'point',
            mode: 'tuple',
            srid: 4326,
        }), // 店铺地理位置（PostGIS Point 类型）
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 店铺地理位置空间索引 - 用于附近店铺查询
        index('idx_shops_location')
            .using('gist', table.geom)
            .where(sql`geom IS NOT NULL`),
        // 店主创建时间索引 - 用于查询店主的店铺列表
        index('idx_shops_owner_active').on(
            table.ownerId,
            table.createdAt.desc(),
        ),
        // 省份索引 - 用于按省份筛选店铺
        index('idx_shops_province').on(table.province),
        // 市区索引 - 用于按市区筛选店铺
        index('idx_shops_district').on(table.district),
        // 区县索引 - 用于按区县筛选店铺
        index('idx_shops_county').on(table.county),
        // 省市区组合索引 - 用于按地理位置层级查询
        index('idx_shops_geo_hierarchy').on(
            table.province,
            table.district,
            table.county,
        ),
    ],
);

// 服务人员表 (service_personnel)
export const servicePersonnel = pgTable(
    'service_personnel',
    {
        userId: varchar('user_id', { length: 255 })
            .primaryKey()
            .unique()
            .references(() => users.id, { onDelete: 'cascade' }), // 关联到 users 表的主键
        shopId: varchar('shop_id', { length: 255 }).references(() => shops.id, {
            onDelete: 'set null',
        }), // 所属店铺 ID，可以为空（表示独立服务人员）
        bio: text('bio'), // 个人简介
        yearsOfExperience: integer('years_of_experience').default(0), // 从业年限
        workStartTime: time('work_start_time'), // 可工作开始时间
        workEndTime: time('work_end_time'), // 可工作结束时间
        isAvailable: boolean('is_available').default(true), // 是否当前可接受派单
    },
    (table) => [
        // 可用服务人员索引 - 用于快速查找可接单的服务人员
        index('idx_service_personnel_available')
            .on(table.isAvailable, table.shopId, table.userId)
            .where(sql`is_available = true`),
        // 店铺可用服务人员索引 - 用于查找特定店铺的可用服务人员
        index('idx_service_personnel_shop_available')
            .on(table.shopId, table.isAvailable)
            .where(sql`shop_id IS NOT NULL`),
        // 工作时间索引 - 用于根据时间段查找可用服务人员
        index('idx_service_personnel_work_time')
            .on(table.workStartTime, table.workEndTime, table.isAvailable)
            .where(sql`is_available = true`),
    ],
);

export const shopRelations = relations(shops, ({ many, one }) => ({
    owner: one(users, {
        fields: [shops.ownerId],
        references: [users.id],
    }),
    sessions: many(servicePersonnel),
}));

export const servicePersonnelRelations = relations(
    servicePersonnel,
    ({ one, many }) => ({
        user: one(users, {
            fields: [servicePersonnel.userId],
            references: [users.id],
        }),
        shop: one(shops, {
            fields: [servicePersonnel.shopId],
            references: [shops.id],
        }),
        skills: many(servicePersonnelSkills),
    }),
);
