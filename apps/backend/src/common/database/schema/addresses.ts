import { relations, sql } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    boolean,
    geometry,
    index,
} from 'drizzle-orm/pg-core';

import { createId } from '.';
import { users } from './auth-user';

/**
 * 用户地址表 (user_addresses)
 * 管理用户的收货地址或服务地址
 */
export const userAddresses = pgTable(
    'user_addresses',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(), // 地址唯一标识
        userId: varchar('user_id', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'cascade' }), // 关联的用户 ID
        detailedAddress: varchar('address_line1', { length: 255 }).notNull(), // 详细地址
        homeNumber: varchar('home_number', { length: 50 }).notNull(), // 门牌号
        province: varchar('province', { length: 100 }).notNull(), // 省份
        district: varchar('district', { length: 100 }).notNull(), // 市区
        county: varchar('county', { length: 100 }).notNull(), // 区县
        geom: geometry('geom', { type: 'point' }), // 地址地理位置（PostGIS Point 类型）
        recipientName: varchar('recipient_name', { length: 50 }).notNull(), // 收货人姓名
        recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(), // 收货人电话
        isDefault: boolean('is_default').default(false), // 是否为默认地址
    },
    (table) => [
        // 地理位置空间索引 - 用于附近地址查询
        index('idx_user_addresses_location')
            .using('gist', table.geom)
            .where(sql`geom IS NOT NULL`),
        // 用户默认地址索引 - 用于快速查找用户的默认地址
        index('idx_user_addresses_user_default').on(
            table.userId,
            table.isDefault,
        ),
        // 省份索引 - 用于按省份筛选地址
        index('idx_user_addresses_province').on(table.province),
        // 市区索引 - 用于按市区筛选地址
        index('idx_user_addresses_district').on(table.district),
        // 区县索引 - 用于按区县筛选地址
        index('idx_user_addresses_county').on(table.county),
        // 省市区组合索引 - 用于按地理位置层级查询
        index('idx_user_addresses_geo_hierarchy').on(
            table.province,
            table.district,
            table.county,
        ),
    ],
);

// 用户地址关系定义
export const userAddressesRelations = relations(userAddresses, ({ one }) => ({
    user: one(users, {
        fields: [userAddresses.userId],
        references: [users.id],
    }),
}));
