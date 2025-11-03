import {
    boolean,
    index,
    integer,
    pgTable,
    timestamp,
    varchar,
} from 'drizzle-orm/pg-core';
import { createId, users } from '.';
import { relations } from 'drizzle-orm';

// 文件表 - 存储文件元数据和实现去重
export const files = pgTable(
    'files',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        // 文件基本信息
        originalName: varchar('original_name', { length: 255 }).notNull(), // 原始文件名
        fileName: varchar('file_name', { length: 255 }).notNull(), // 存储文件名（UUID）
        fileSize: integer('file_size').notNull(), // 文件大小（字节）
        mimeType: varchar('mime_type', { length: 100 }).notNull(), // MIME类型

        // 文件去重
        fileHash: varchar('file_hash', { length: 64 }).notNull().unique(), // SHA-256哈希值（唯一约束防止并发重复）

        // s3存储信息
        bucketName: varchar('bucket_name', { length: 100 }).notNull(), // 存储桶名称
        objectPath: varchar('object_path', { length: 500 }).notNull(), // 对象路径

        // 文件分类和处理
        fileType: varchar('file_type', { length: 20 }).notNull(), // image, video, document
        thumbnailPath: varchar('thumbnail_path', { length: 500 }), // 缩略图路径（图片类型）

        // 上传信息
        uploadedBy: varchar('uploaded_by').notNull(), // 上传用户ID
        uploadedAt: timestamp('uploaded_at').defaultNow().notNull(),

        // 访问控制
        isPublic: boolean('is_public').default(false), // 是否公开访问
        accessCount: integer('access_count').default(0), // 访问次数

        // 引用计数 - 用于文件去重后的引用管理
        referenceCount: integer('reference_count').default(1).notNull(), // 引用计数

        // 时间戳
        createdAt: timestamp('created_at').defaultNow().notNull(),
        updatedAt: timestamp('updated_at').defaultNow().notNull(),
        deletedAt: timestamp('deleted_at'), // 软删除标记
    },
    (table) => ([
        index('file_hash_idx').on(table.fileHash),
        index('uploader_idx').on(table.uploadedBy),
        index('file_type_idx').on(table.fileType),
    ]),
);

export const filesRelations = relations(files, ({ one }) => ({
    // 上传用户
    uploader: one(users, {
        fields: [files.uploadedBy],
        references: [users.id],
    }),
}));
