import { Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, ne, sql, type SQL } from 'drizzle-orm';

import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { appReleases, files } from 'src/common/database/schema';

export type AppReleaseRecord = typeof appReleases.$inferSelect;
export type NewAppReleaseRecord = typeof appReleases.$inferInsert;
export type AppReleaseApp = (typeof appReleases.app.enumValues)[number];
export type AppReleasePlatform =
    (typeof appReleases.platform.enumValues)[number];
export type AppReleaseStatus =
    (typeof appReleases.releaseStatus.enumValues)[number];
export type AppReleaseChannel =
    (typeof appReleases.releaseChannel.enumValues)[number];
export type AppReleaseWithFile = AppReleaseRecord & {
    file: typeof files.$inferSelect | null;
};

export interface ListAppReleaseFilter {
    app?: AppReleaseApp;
    platform?: AppReleasePlatform;
    status?: AppReleaseStatus;
    isActive?: boolean;
}

@Injectable()
export class AppReleaseRepository {
    constructor(
        @Inject(DB)
        private readonly db: DbType,
    ) {}

    async findById(id: string): Promise<AppReleaseWithFile | null> {
        const record = await this.db.query.appReleases.findFirst({
            where: eq(appReleases.id, id),
            with: { file: true },
        });
        return record ?? null;
    }

    async findByVersion(
        app: AppReleaseApp,
        platform: AppReleasePlatform,
        version: string,
    ): Promise<AppReleaseWithFile | null> {
        const record = await this.db.query.appReleases.findFirst({
            where: and(
                eq(appReleases.app, app),
                eq(appReleases.platform, platform),
                eq(appReleases.version, version),
            ),
            with: { file: true },
        });
        return record ?? null;
    }

    async listReleases(
        filter: ListAppReleaseFilter,
    ): Promise<AppReleaseWithFile[]> {
        const conditions: SQL[] = [];
        if (filter.app) {
            conditions.push(eq(appReleases.app, filter.app));
        }
        if (filter.platform) {
            conditions.push(eq(appReleases.platform, filter.platform));
        }
        if (filter.status) {
            conditions.push(eq(appReleases.releaseStatus, filter.status));
        }
        if (typeof filter.isActive === 'boolean') {
            conditions.push(eq(appReleases.isActive, filter.isActive));
        }

        return this.db.query.appReleases.findMany({
            where: conditions.length ? and(...conditions) : undefined,
            with: { file: true },
            orderBy: [
                desc(appReleases.publishedAt),
                desc(appReleases.createdAt),
            ],
        });
    }

    async getActiveRelease(
        app: AppReleaseApp,
        platform: AppReleasePlatform,
    ): Promise<AppReleaseWithFile | null> {
        const record = await this.db.query.appReleases.findFirst({
            where: and(
                eq(appReleases.app, app),
                eq(appReleases.platform, platform),
                eq(appReleases.isActive, true),
            ),
            orderBy: [
                desc(appReleases.publishedAt),
                desc(appReleases.createdAt),
            ],
            with: { file: true },
        });
        return record ?? null;
    }

    async findLatestPublished(
        app: AppReleaseApp,
        platform: AppReleasePlatform,
    ): Promise<AppReleaseWithFile | null> {
        const record = await this.db.query.appReleases.findFirst({
            where: and(
                eq(appReleases.app, app),
                eq(appReleases.platform, platform),
                eq(appReleases.isActive, true),
            ),
            orderBy: [
                desc(appReleases.publishedAt),
                desc(appReleases.createdAt),
            ],
            with: { file: true },
        });
        return record ?? null;
    }

    async createRelease(
        data: NewAppReleaseRecord,
        options?: { activate?: boolean },
    ): Promise<AppReleaseRecord> {
        const now = data.updatedAt ?? new Date();
        const payload = {
            ...data,
            createdAt: data.createdAt ?? now,
            updatedAt: now,
        };

        if (options?.activate) {
            return this.db.transaction(async (tx) => {
                await tx
                    .update(appReleases)
                    .set({ isActive: false, updatedAt: now })
                    .where(
                        and(
                            eq(appReleases.app, payload.app),
                            eq(appReleases.platform, payload.platform),
                            eq(appReleases.isActive, true),
                        ),
                    );

                const [created] = await tx
                    .insert(appReleases)
                    .values(payload)
                    .returning();
                return created;
            });
        }

        const [created] = await this.db
            .insert(appReleases)
            .values(payload)
            .returning();
        return created;
    }

    async updateRelease(
        id: string,
        updates: Partial<AppReleaseRecord>,
        options?: { activate?: boolean },
    ): Promise<AppReleaseRecord | null> {
        const now = updates.updatedAt ?? new Date();
        const payload = {
            ...updates,
            updatedAt: now,
        };

        if (options?.activate) {
            return this.db.transaction(async (tx) => {
                const [updated] = await tx
                    .update(appReleases)
                    .set(payload)
                    .where(eq(appReleases.id, id))
                    .returning();

                if (!updated) {
                    return null;
                }

                await tx
                    .update(appReleases)
                    .set({ isActive: false, updatedAt: now })
                    .where(
                        and(
                            eq(appReleases.app, updated.app),
                            eq(appReleases.platform, updated.platform),
                            eq(appReleases.isActive, true),
                            ne(appReleases.id, updated.id),
                        ),
                    );

                return updated;
            });
        }

        const [updated] = await this.db
            .update(appReleases)
            .set(payload)
            .where(eq(appReleases.id, id))
            .returning();

        return updated ?? null;
    }

    async incrementDownloadCount(
        id: string,
        options?: { forceUpdate?: boolean },
    ): Promise<AppReleaseRecord | null> {
        const updates: Partial<AppReleaseRecord> = {
            downloadCount:
                sql`${appReleases.downloadCount} + 1` as unknown as number,
            updatedAt: new Date(),
        };

        if (options?.forceUpdate) {
            updates.forceUpdateCount =
                sql`${appReleases.forceUpdateCount} + 1` as unknown as number;
        }

        const [updated] = await this.db
            .update(appReleases)
            .set(updates)
            .where(eq(appReleases.id, id))
            .returning();

        return updated ?? null;
    }
}
