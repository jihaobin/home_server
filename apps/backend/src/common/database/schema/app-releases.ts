import { relations, sql } from 'drizzle-orm';
import {
    boolean,
    check,
    foreignKey,
    index,
    integer,
    pgTable,
    text,
    timestamp,
    uniqueIndex,
    varchar,
} from 'drizzle-orm/pg-core';

import { createId, files, users } from '.';
import {
    appReleaseAppEnum,
    appReleaseChannelEnum,
    appReleasePlatformEnum,
    appReleaseStatusEnum,
} from './enums';

export const appReleases = pgTable(
    'app_releases',
    {
        id: varchar('id', { length: 255 })
            .primaryKey()
            .$default(() => createId())
            .unique(),
        app: appReleaseAppEnum('app').notNull(), // 应用标识：mobile-user / mobile-worker
        platform: appReleasePlatformEnum('platform').notNull(), // 平台：android / ios
        version: varchar('version', { length: 64 }).notNull(), // 语义化版本
        buildNumber: integer('build_number'), // 构建号（平台自增）

        // 状态与发布属性
        releaseStatus: appReleaseStatusEnum('release_status')
            .notNull()
            .default('draft'),
        isActive: boolean('is_active').notNull().default(false), // 当前是否作为生效版本
        forceUpdate: boolean('force_update').notNull().default(false), // 是否强制更新
        minSupportedVersion: varchar('min_supported_version', {
            length: 64,
        }), // 低于该版本视为强更

        // 文案与渠道
        changelog: text('changelog'), // 更新日志
        downloadUrlOverride: varchar('download_url_override', { length: 1024 }), // iOS 外链/TestFlight
        releaseChannel: appReleaseChannelEnum('release_channel')
            .notNull()
            .default('production'), // 预留环境/渠道
        rolloutPercent: integer('rollout_percent').notNull().default(100), // 灰度比例 0-100

        // 文件关联
        fileId: varchar('file_id', { length: 255 }).references(() => files.id, {
            onDelete: 'set null',
        }), // 关联文件元数据

        // 审计与回滚
        createdBy: varchar('created_by', { length: 255 })
            .notNull()
            .references(() => users.id, { onDelete: 'restrict' }),
        publishedBy: varchar('published_by', { length: 255 }).references(
            () => users.id,
            { onDelete: 'set null' },
        ),
        publishedAt: timestamp('published_at', { withTimezone: true }),
        rollbackFromId: varchar('rollback_from_id', { length: 255 }),

        // 统计
        downloadCount: integer('download_count').notNull().default(0),
        forceUpdateCount: integer('force_update_count').notNull().default(0),

        // 时间戳
        createdAt: timestamp('created_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
        updatedAt: timestamp('updated_at', { withTimezone: true })
            .notNull()
            .defaultNow(),
    },
    (table) => [
        uniqueIndex('app_release_version_unique').on(
            table.app,
            table.platform,
            table.version,
        ),
        index('app_release_active_idx').on(
            table.app,
            table.platform,
            table.isActive,
            table.releaseStatus,
        ),
        index('app_release_published_idx')
            .on(table.app, table.platform, table.publishedAt)
            .where(sql`published_at IS NOT NULL`),
        check(
            'app_release_rollout_percent_range',
            sql`${table.rolloutPercent} BETWEEN 0 AND 100`,
        ),
        foreignKey({
            columns: [table.rollbackFromId],
            foreignColumns: [table.id],
            name: 'app_releases_rollback_from_fk',
        }).onDelete('set null'),
    ],
);

export const appReleasesRelations = relations(appReleases, ({ one, many }) => ({
    file: one(files, {
        fields: [appReleases.fileId],
        references: [files.id],
    }),
    creator: one(users, {
        fields: [appReleases.createdBy],
        references: [users.id],
        relationName: 'appReleaseCreator',
    }),
    publisher: one(users, {
        fields: [appReleases.publishedBy],
        references: [users.id],
        relationName: 'appReleasePublisher',
    }),
    rollbackFrom: one(appReleases, {
        fields: [appReleases.rollbackFromId],
        references: [appReleases.id],
        relationName: 'appReleaseRollbackSource',
    }),
    rollbackTargets: many(appReleases, {
        relationName: 'appReleaseRollbackSource',
    }),
}));
