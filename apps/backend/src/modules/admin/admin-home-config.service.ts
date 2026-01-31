import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
    AdminHomeConfig,
    AdminHomeConfigUpdate,
    HomeBanner,
    HomeGuarantee,
    HomePromo,
} from '@repo/types';
import { AdminHomeConfigUpdateSchema } from '@repo/types';
import { FilesService } from '../files/files.service';
import { AdminHomeConfigRepository } from './admin-home-config.repository';
import { eq, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    homeBanners,
    homeGuarantees,
    homePromos,
    servicePersonnelPricing,
    servicePersonnel,
    services,
} from 'src/common/database/schema';
import { randomUUID } from 'crypto';

@Injectable()
export class AdminHomeConfigService {
    constructor(
        private readonly repository: AdminHomeConfigRepository,
        private readonly filesService: FilesService,
        // 用于 promos 的聚合查询
        @Inject(DB) private readonly db: DbType,
    ) {}

    private async resolveFileUrl(fileId?: string | null) {
        if (!fileId) return null;
        try {
            const info = await this.filesService.getFileAccessInfo(fileId);
            return info.fileUrl;
        } catch {
            return null;
        }
    }

    async getConfig(): Promise<AdminHomeConfig> {
        const [banners, guarantees, promos] = await Promise.all([
            this.repository.listBanners(),
            this.repository.listGuarantees(),
            this.repository.listPromos(),
        ]);

        const bannerDtos: HomeBanner[] = (
            await Promise.all(
                banners
                    .filter((b) => b.isActive)
                    .map(async (b) => {
                        const imageUrl = await this.resolveFileUrl(
                            b.imageFileId,
                        );
                        if (!imageUrl) {
                            return null;
                        }
                        return {
                            id: b.id,
                            title: b.title ?? '',
                            imageUrl,
                            linkType:
                                (b.linkType as HomeBanner['linkType']) ??
                                'none',
                            linkTarget: b.linkTarget ?? null,
                            sortOrder: b.sortOrder ?? 0,
                        } satisfies HomeBanner;
                    }),
            )
        ).filter((item): item is HomeBanner => Boolean(item));

        const guaranteeDtos: HomeGuarantee[] = (
            await Promise.all(
                guarantees
                    .filter((g) => g.isActive)
                    .map(async (g) => {
                        const iconUrl = await this.resolveFileUrl(g.iconFileId);
                        if (!iconUrl) {
                            return null;
                        }
                        return {
                            id: g.id,
                            label: g.label,
                            iconUrl,
                            sortOrder: g.sortOrder ?? 0,
                        } satisfies HomeGuarantee;
                    }),
            )
        ).filter((item): item is HomeGuarantee => Boolean(item));

        // promos 需要补齐 pricing -> personnel/service
        const promoDtos: HomePromo[] = await Promise.all(
            promos
                .filter((p) => p.isActive)
                .map(async (p) => {
                    const [row] = await this.db
                        .select({
                            promoId: homePromos.id,
                            pricingId: servicePersonnelPricing.id,
                            personnelId: servicePersonnelPricing.userId,
                            personnelName: servicePersonnel.name,
                            serviceName: services.name,
                            price: servicePersonnelPricing.price,
                            currency: servicePersonnelPricing.currency,
                            overrideTitle: homePromos.overrideTitle,
                            overrideImageFileId: homePromos.overrideImageFileId,
                        })
                        .from(homePromos)
                        .innerJoin(
                            servicePersonnelPricing,
                            eq(
                                servicePersonnelPricing.id,
                                homePromos.pricingId,
                            ),
                        )
                        .innerJoin(
                            servicePersonnel,
                            eq(
                                servicePersonnel.userId,
                                servicePersonnelPricing.userId,
                            ),
                        )
                        .innerJoin(
                            services,
                            eq(services.id, servicePersonnelPricing.serviceId),
                        )
                        .where(eq(homePromos.id, p.id))
                        .limit(1);

                    if (!row) {
                        throw new BadRequestException(
                            `特惠位绑定的定价不存在: ${p.pricingId}`,
                        );
                    }

                    const imageUrl = row.overrideImageFileId
                        ? await this.resolveFileUrl(row.overrideImageFileId)
                        : null;

                    return {
                        id: p.id,
                        pricingId: row.pricingId,
                        sortOrder: p.sortOrder ?? 0,
                        personnelId: row.personnelId,
                        personnelName:
                            row.overrideTitle ??
                            row.personnelName ??
                            '服务人员',
                        tag: row.serviceName,
                        price: Number(row.price),
                        currency: row.currency,
                        imageUrl,
                    };
                }),
        );

        return {
            banners: bannerDtos,
            guarantees: guaranteeDtos,
            promos: promoDtos,
        };
    }

    async updateConfig(
        payload: AdminHomeConfigUpdate,
    ): Promise<AdminHomeConfig> {
        const parsed = AdminHomeConfigUpdateSchema.parse(payload);

        await this.db.transaction(async (tx) => {
            // 生成 id：允许 admin 省略 id
            const banners = parsed.banners.map((b) => ({
                id: b.id ?? randomUUID(),
                title: b.title,
                imageFileId: b.imageFileId,
                linkType: b.linkType,
                linkTarget: b.linkTarget,
                sortOrder: b.sortOrder,
                isActive: b.isActive,
                startsAt: b.startsAt ? new Date(b.startsAt) : null,
                endsAt: b.endsAt ? new Date(b.endsAt) : null,
            }));

            const guarantees = parsed.guarantees.map((g) => ({
                id: g.id ?? randomUUID(),
                label: g.label,
                iconFileId: g.iconFileId,
                sortOrder: g.sortOrder,
                isActive: g.isActive,
            }));

            const promos = parsed.promos.map((p) => ({
                id: p.id ?? randomUUID(),
                pricingId: p.pricingId,
                sortOrder: p.sortOrder,
                isActive: p.isActive,
                overrideTitle: p.overrideTitle ?? null,
                overrideImageFileId: p.overrideImageFileId ?? null,
            }));

            // 使用同一事务的 repo（复用 tx：简单起见直接用 tx 执行）
            if (banners.length > 0) {
                await tx
                    .insert(homeBanners)
                    .values(banners)
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

            if (guarantees.length > 0) {
                await tx
                    .insert(homeGuarantees)
                    .values(guarantees)
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

            if (promos.length > 0) {
                await tx
                    .insert(homePromos)
                    .values(promos)
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

            // 全量覆盖：删除未包含 id
            await tx.delete(homeBanners).where(
                banners.length > 0
                    ? sql`${homeBanners.id} NOT IN (${sql.join(
                          banners.map((b) => sql`${b.id}`),
                          sql`,`,
                      )})`
                    : sql`true`,
            );
            await tx.delete(homeGuarantees).where(
                guarantees.length > 0
                    ? sql`${homeGuarantees.id} NOT IN (${sql.join(
                          guarantees.map((g) => sql`${g.id}`),
                          sql`,`,
                      )})`
                    : sql`true`,
            );
            await tx.delete(homePromos).where(
                promos.length > 0
                    ? sql`${homePromos.id} NOT IN (${sql.join(
                          promos.map((p) => sql`${p.id}`),
                          sql`,`,
                      )})`
                    : sql`true`,
            );
        });

        return await this.getConfig();
    }
}
