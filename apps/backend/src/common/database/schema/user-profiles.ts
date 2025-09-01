import { relations } from 'drizzle-orm';
import {
    pgTable,
    varchar,
    text,
    timestamp,
    index,
    primaryKey,
} from 'drizzle-orm/pg-core';

import { users } from './auth-user';
import { createId } from '.';

/**
 * 用户资料表 (user_profiles)
 * 存储用户的扩展信息，如实名认证资料
 */
export const userProfiles = pgTable(
    'user_profiles',
    {
        id: varchar('id', { length: 255 })
            .$default(() => createId())
            .unique(), // 地址唯一标识
        userId: varchar('user_id', { length: 255 })
            .references(() => users.id, {
                onDelete: 'cascade',
            })
            .unique(), // 关联到 users 表的主键
        realName: varchar('real_name', { length: 50 }), // 真实姓名
        idCardNumber: varchar('id_card_number', { length: 18 }).unique(), // 身份证号码，唯一约束
        faceRecognitionData: text('face_recognition_data'), // 面部识别数据（加密存储或存储特征值）
        createdAt: timestamp('created_at', { withTimezone: true }).defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .defaultNow()
            .$onUpdateFn(() => new Date()), // 记录最后更新时间
    },
    (table) => [
        // 用户id索引
        index('users_email_idx').on(table.userId),
        // 用户身份证号索引 - 用于查询用户
        index('idx_user_profiles_user_id').on(table.userId, table.idCardNumber),
        // 用户人脸信息索引
        index('idx_user_profiles_face_info').on(
            table.faceRecognitionData,
            table.userId,
        ),
        primaryKey({ columns: [table.id, table.userId] }),
    ],
);

// 用户资料关系定义
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
    user: one(users, {
        fields: [userProfiles.userId],
        references: [users.id],
    }),
}));
