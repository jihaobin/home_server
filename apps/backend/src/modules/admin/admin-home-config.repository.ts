import { Inject, Injectable } from '@nestjs/common';
import { asc, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    homeBanners,
    homeGuarantees,
    homePromos,
} from 'src/common/database/schema';

@Injectable()
export class AdminHomeConfigRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async listBanners() {
        return await this.db
            .select()
            .from(homeBanners)
            .orderBy(asc(homeBanners.sortOrder), asc(homeBanners.id));
    }

    async listGuarantees() {
        return await this.db
            .select()
            .from(homeGuarantees)
            .orderBy(asc(homeGuarantees.sortOrder), asc(homeGuarantees.id));
    }

    async listPromos() {
        return await this.db
            .select()
            .from(homePromos)
            .orderBy(asc(homePromos.sortOrder), asc(homePromos.id));
    }

    async upsertBanners(rows: Array<typeof homeBanners.$inferInsert>) {
        if (rows.length === 0) return;
        await this.db
            .insert(homeBanners)
            .values(rows)
            .onConflictDoUpdate({
                target: [homeBanners.id],
                set: {
                    title: sql`excluded.title`,
                    imageFileId: sql`excluded.image_file_id`,
                    linkType: sql`excluded.link_type`,
                    linkTarget: sql`excluded.link_target`,
                    sortOrder: sql`excluded.sort_order`,
                    isActive: sql`excluded.is_active`,
                    startsAt: sql`excluded.starts_at`,
                    endsAt: sql`excluded.ends_at`,
                    updatedAt: sql`now()`,
                },
            });
    }

    async upsertGuarantees(rows: Array<typeof homeGuarantees.$inferInsert>) {
        if (rows.length === 0) return;
        await this.db
            .insert(homeGuarantees)
            .values(rows)
            .onConflictDoUpdate({
                target: [homeGuarantees.id],
                set: {
                    label: sql`excluded.label`,
                    iconFileId: sql`excluded.icon_file_id`,
                    sortOrder: sql`excluded.sort_order`,
                    isActive: sql`excluded.is_active`,
                    updatedAt: sql`now()`,
                },
            });
    }

    async upsertPromos(rows: Array<typeof homePromos.$inferInsert>) {
        if (rows.length === 0) return;
        await this.db
            .insert(homePromos)
            .values(rows)
            .onConflictDoUpdate({
                target: [homePromos.id],
                set: {
                    pricingId: sql`excluded.pricing_id`,
                    sortOrder: sql`excluded.sort_order`,
                    isActive: sql`excluded.is_active`,
                    overrideTitle: sql`excluded.override_title`,
                    overrideImageFileId: sql`excluded.override_image_file_id`,
                    updatedAt: sql`now()`,
                },
            });
    }

    async deleteMissing(payload: {
        bannerIds: string[];
        guaranteeIds: string[];
        promoIds: string[];
    }) {
        // 以“全量配置”为语义：PUT 未包含的条目会被删除。
        await this.db.delete(homeBanners).where(
            payload.bannerIds.length > 0
                ? sql`${homeBanners.id} NOT IN (${sql.join(
                      payload.bannerIds.map((id) => sql`${id}`),
                      sql`,`,
                  )})`
                : sql`true`,
        );

        await this.db.delete(homeGuarantees).where(
            payload.guaranteeIds.length > 0
                ? sql`${homeGuarantees.id} NOT IN (${sql.join(
                      payload.guaranteeIds.map((id) => sql`${id}`),
                      sql`,`,
                  )})`
                : sql`true`,
        );

        await this.db.delete(homePromos).where(
            payload.promoIds.length > 0
                ? sql`${homePromos.id} NOT IN (${sql.join(
                      payload.promoIds.map((id) => sql`${id}`),
                      sql`,`,
                  )})`
                : sql`true`,
        );
    }
}
