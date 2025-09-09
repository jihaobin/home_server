import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    timestamp,
    varchar,
    text,
    integer,
    boolean,
    time,
    index,
    decimal,
    geometry,
} from 'drizzle-orm/pg-core';

import { createId, users } from '.';
import { servicePersonnelSkills, services } from './server';

// =================================================================
// 店铺与服务人员模块
// 设计说明: 此模块定义了服务的提供方，包括店铺和独立的服务人员。
// 服务人员可以隶属于某个店铺，也可以是独立提供服务。
// =================================================================

// // 店铺表
// export const shops = pgTable(
//     'shops',
//     {
//         id: varchar('id', { length: 255 })
//             .primaryKey()
//             .$default(() => createId())
//             .unique(),
//         ownerId: varchar('owner_id', { length: 255 })
//             .notNull()
//             .references(() => users.id, { onDelete: 'cascade' }), // 店铺所有者的用户 ID
//         name: varchar('name', { length: 100 }).notNull(), // 店铺名称
//         description: text('description'), // 店铺描述
//         detailedAddress: varchar('address', { length: 255 }), // 店铺的详细地址
//         homeNumber: varchar('home_number', { length: 50 }).notNull(), // 门牌号
//         province: varchar('province', { length: 100 }), // 省份
//         district: varchar('district', { length: 100 }), // 市区
//         county: varchar('county', { length: 100 }), // 区县
//         geom: geometry('geom', {
//             type: 'point',
//             mode: 'tuple',
//             srid: 4326,
//         }), // 店铺地理位置（PostGIS Point 类型）
//         createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
//         updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
//     },
//     (table) => [
//         // 店铺地理位置空间索引 - 用于附近店铺查询
//         index('idx_shops_location')
//             .using('gist', table.geom)
//             .where(sql`geom IS NOT NULL`),
//         // 店铺名称PGroonga全文搜索索引
//         index('idx_shops_name_search').using('pgroonga', table.name),
//         // 店铺描述PGroonga全文搜索索引 - 仅为有描述的店铺建立索引
//         index('idx_shops_desc_search')
//             .using('pgroonga', table.description)
//             .where(sql`description IS NOT NULL`),
//         // 店铺多字段组合搜索索引 - 包含名称、描述和地址信息
//         index('idx_shops_search_combined')
//             .using(
//                 'pgroonga',
//                 sql`(ARRAY[${table.name}, ${table.description}, ${table.detailedAddress}])`,
//             )
//             .where(sql`description IS NOT NULL`),
//         // 店主创建时间索引 - 用于查询店主的店铺列表
//         index('idx_shops_owner_active').on(
//             table.ownerId,
//             table.createdAt.desc(),
//         ),
//         // 省份索引 - 用于按省份筛选店铺
//         index('idx_shops_province').on(table.province),
//         // 市区索引 - 用于按市区筛选店铺
//         index('idx_shops_district').on(table.district),
//         // 区县索引 - 用于按区县筛选店铺
//         index('idx_shops_county').on(table.county),
//         // 省市区组合索引 - 用于按地理位置层级查询
//         index('idx_shops_geo_hierarchy').on(
//             table.province,
//             table.district,
//             table.county,
//         ),
//     ],
// );

// 服务人员表 (service_personnel)
export const servicePersonnel = pgTable(
    'service_personnel',
    {
        userId: varchar('user_id', { length: 255 })
            .primaryKey()
            .unique()
            .references(() => users.id, { onDelete: 'cascade' }), // 关联到 users 表的主键
        // MVP阶段注释店铺关联字段
        // shopId: varchar('shop_id', { length: 255 }).references(() => shops.id, {
        //     onDelete: 'set null',
        // }), // 所属店铺 ID，可以为空（表示独立服务人员）
        bio: text('bio'), // 个人简介
        province: varchar('province', { length: 100 }).notNull(), // 省份
        district: varchar('district', { length: 100 }), // 市区
        county: varchar('county', { length: 100 }), // 区县
        geom: geometry('geom', {
            type: 'point',
            mode: 'tuple',
            srid: 4326,
        }), // 地理位置（PostGIS Point 类型）
        yearsOfExperience: integer('years_of_experience').default(0).notNull(), // 从业年限
        workStartTime: time('work_start_time').notNull(), // 可工作开始时间
        workEndTime: time('work_end_time').notNull(), // 可工作结束时间
        isAvailable: boolean('is_available').default(true).notNull(), // 是否当前可接受派单
    },
    (table) => [
        // 可用服务人员索引 - 用于快速查找可接单的服务人员
        index('idx_service_personnel_available')
            // .on(table.isAvailable, table.shopId, table.userId)
            .on(table.isAvailable, table.userId)
            .where(sql`is_available = true`),
        // 服务人员简介PGroonga全文搜索索引 - 仅为可用且有简介的服务人员建立索引
        index('idx_service_personnel_bio_available')
            .using('pgroonga', table.bio)
            .where(sql`is_available = true AND bio IS NOT NULL`),
        // 店铺可用服务人员索引 - 用于查找特定店铺的可用服务人员
        // index('idx_service_personnel_shop_available')
        //     .on(table.shopId, table.isAvailable)
        //     .where(sql`shop_id IS NOT NULL`),
        // 工作时间索引 - 用于根据时间段查找可用服务人员
        index('idx_service_personnel_work_time')
            .on(table.workStartTime, table.workEndTime, table.isAvailable)
            .where(sql`is_available = true`),
        // 地理位置索引 - 用于地域筛选
        index('idx_service_personnel_location')
            .on(table.province, table.district, table.county, table.isAvailable)
            .where(sql`is_available = true`),
    ],
);

// 服务人员定价表 (service_personnel_pricing) - MVP纯个人模式
export const servicePersonnelPricing = pgTable(
    'service_personnel_pricing',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => servicePersonnel.userId, { onDelete: 'cascade' }), // 服务人员ID
        serviceId: varchar('service_id', { length: 255 })
            .notNull()
            .references(() => services.id, { onDelete: 'cascade' }), // 服务项目ID
        price: decimal('price', { precision: 18, scale: 2 }).notNull(), // 个人定价
        currency: varchar('currency', { length: 3 }).default('CNY').notNull(), // 币种代码
        isActive: boolean('is_active').default(true).notNull(), // 定价是否有效
        effectiveFrom: timestamp('effective_from', {
            withTimezone: true,
        }).defaultNow(), // 定价生效时间
        effectiveTo: timestamp('effective_to', { withTimezone: true }), // 定价失效时间
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(),
    },
    (table) => [
        // 服务人员服务定价查询索引
        index('idx_personnel_pricing_user_service')
            .on(table.userId, table.serviceId, table.isActive)
            .where(sql`is_active = true`),
        // 服务项目定价查询索引 - 用于查找某个服务的所有定价
        index('idx_personnel_pricing_service_price')
            .on(table.serviceId, table.price, table.isActive)
            .where(sql`is_active = true`),
        // 定价生效时间索引
        index('idx_personnel_pricing_effective')
            .on(table.effectiveFrom, table.effectiveTo, table.isActive)
            .where(sql`is_active = true`),
    ],
);

// export const shopRelations = relations(shops, ({ many, one }) => ({
//     owner: one(users, {
//         fields: [shops.ownerId],
//         references: [users.id],
//     }),
//     sessions: many(servicePersonnel),
// }));

export const servicePersonnelRelations = relations(
    servicePersonnel,
    ({ one, many }) => ({
        user: one(users, {
            fields: [servicePersonnel.userId],
            references: [users.id],
        }),
        // MVP阶段注释店铺关系
        // shop: one(shops, {
        //     fields: [servicePersonnel.shopId],
        //     references: [shops.id],
        // }),
        skills: many(servicePersonnelSkills),
        pricing: many(servicePersonnelPricing),
    }),
);

// 服务人员定价关系定义
export const servicePersonnelPricingRelations = relations(
    servicePersonnelPricing,
    ({ one }) => ({
        personnel: one(servicePersonnel, {
            fields: [servicePersonnelPricing.userId],
            references: [servicePersonnel.userId],
        }),
        service: one(services, {
            fields: [servicePersonnelPricing.serviceId],
            references: [services.id],
        }),
    }),
);
