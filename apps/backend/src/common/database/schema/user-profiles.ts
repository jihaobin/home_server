import { relations } from 'drizzle-orm';
import { pgTable, varchar, text, timestamp } from 'drizzle-orm/pg-core';

import { users } from './auth-user';

/**
 * 用户资料表 (user_profiles)
 * 存储用户的扩展信息，如实名认证资料
 */
export const userProfiles = pgTable('user_profiles', {
    userId: varchar('user_id', { length: 255 })
        .primaryKey()
        .references(() => users.id, { onDelete: 'cascade' }), // 关联到 users 表的主键
    realName: varchar('real_name', { length: 50 }), // 真实姓名
    idCardNumber: varchar('id_card_number', { length: 18 }).unique(), // 身份证号码，唯一约束
    faceRecognitionData: text('face_recognition_data'), // 面部识别数据（加密存储或存储特征值）
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow(), // 记录最后更新时间
});

// 用户资料关系定义
export const userProfilesRelations = relations(userProfiles, ({ one }) => ({
    user: one(users, {
        fields: [userProfiles.userId],
        references: [users.id],
    }),
}));
