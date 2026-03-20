import { Inject, Injectable } from '@nestjs/common';
import { and, asc, desc, eq, inArray, ne, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    homeBanners,
    homeGuarantees,
    homePromos,
    reviewStats,
    serviceCategories,
    servicePersonnel,
    servicePersonnelPricing,
    services,
    userAddresses,
} from 'src/common/database/schema';
import { FilesService } from '../files/files.service';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import type {
    HomeBanner,
    HomeGuarantee,
    HomePromo,
    HomeRecommendedPersonnel,
} from '@repo/types';

type DefaultAddressRow = {
    id: string;
    geom: [number, number];
    province: string;
    city: string | null;
    district: string | null;
    detailedAddress: string;
};

@Injectable()
export class HomeRepository {
    constructor(
        @Inject(DB) private readonly db: DbType,
        private readonly filesService: FilesService,
        private readonly geoLocationService: GeoLocationService,
    ) {}

    private async fileInfoOrNull(fileId?: string | null) {
        if (!fileId) {
            return null;
        }
        try {
            const info = await this.filesService.getFileAccessInfo(fileId);
            return {
                url: info.fileUrl,
                blurhash: info.blurhash ?? null,
            };
        } catch {
            return null;
        }
    }

    private async getCategoryDescendantIds(
        categoryId: string,
    ): Promise<string[]> {
        const normalized = categoryId.trim();
        if (!normalized) return [];

        // include self + descendants (service_categories.parent_id)
        // Use raw SQL names here to avoid alias/column rendering mismatches.
        const s = sql`
            WITH RECURSIVE category_tree AS (
                SELECT id
                FROM service_categories
                WHERE id = ${normalized}

                UNION ALL

                SELECT sc.id
                FROM service_categories sc
                INNER JOIN category_tree ct ON sc.parent_id = ct.id
            )
            SELECT id FROM category_tree
        `;

        const result = await this.db.execute<{ id: string }>(s);
        return result.rows.map((r) => r.id);
    }

    private async getFullyActiveCategoryIds(
        categoryId?: string,
    ): Promise<string[]> {
        const categories = await this.db.select().from(serviceCategories);
        const categoryById = new Map(
            categories.map((category) => [category.id, category]),
        );
        const candidateIds = categoryId
            ? await this.getCategoryDescendantIds(categoryId)
            : categories.map((category) => category.id);

        const validityCache = new Map<string, boolean>();

        const hasFullyActiveChain = (id: string): boolean => {
            if (validityCache.has(id)) {
                return validityCache.get(id) ?? false;
            }

            const chain: string[] = [];
            const visited = new Set<string>();
            let current = categoryById.get(id);
            let valid = true;

            while (current) {
                if (validityCache.has(current.id)) {
                    valid = validityCache.get(current.id) ?? false;
                    break;
                }

                if (visited.has(current.id)) {
                    valid = false;
                    break;
                }

                visited.add(current.id);

                if (current.isActive === false) {
                    valid = false;
                    break;
                }

                chain.push(current.id);

                if (!current.parentId) {
                    break;
                }

                const next = categoryById.get(current.parentId);
                if (!next) {
                    valid = false;
                    break;
                }

                current = next;
            }

            for (const chainId of chain) {
                validityCache.set(chainId, valid);
            }

            if (!chain.length) {
                validityCache.set(id, valid);
            }

            return valid;
        };

        return candidateIds.filter((id) => hasFullyActiveChain(id));
    }

    async getUserDefaultAddress(
        userId: string,
    ): Promise<DefaultAddressRow | null> {
        const [row] = await this.db
            .select({
                id: userAddresses.id,
                geom: userAddresses.geom,
                province: userAddresses.province,
                city: userAddresses.city,
                district: userAddresses.district,
                detailedAddress: userAddresses.detailedAddress,
            })
            .from(userAddresses)
            .where(
                and(
                    eq(userAddresses.userId, userId),
                    eq(userAddresses.isDefault, true),
                ),
            )
            .limit(1);

        if (!row) return null;
        return {
            ...row,
            city: row.city ?? null,
            district: row.district ?? null,
        } as unknown as DefaultAddressRow;
    }

    async getOpsConfig(): Promise<{
        banners: HomeBanner[];
        guarantees: HomeGuarantee[];
        promos: HomePromo[];
    }> {
        const now = new Date();

        const [bannerRows, guaranteeRows, promoRows] = await Promise.all([
            this.db
                .select()
                .from(homeBanners)
                .where(eq(homeBanners.isActive, true))
                .orderBy(asc(homeBanners.sortOrder), asc(homeBanners.id)),
            this.db
                .select()
                .from(homeGuarantees)
                .where(eq(homeGuarantees.isActive, true))
                .orderBy(asc(homeGuarantees.sortOrder), asc(homeGuarantees.id)),
            this.db
                .select()
                .from(homePromos)
                .where(eq(homePromos.isActive, true))
                .orderBy(asc(homePromos.sortOrder), asc(homePromos.id)),
        ]);

        const banners = (
            await Promise.all(
                bannerRows.map(async (b): Promise<HomeBanner | null> => {
                    // 时间窗过滤（可选但推荐）
                    if (b.startsAt && b.startsAt > now) return null;
                    if (b.endsAt && b.endsAt < now) return null;

                    const imageInfo = await this.fileInfoOrNull(b.imageFileId);
                    if (!imageInfo?.url) return null;

                    return {
                        id: b.id,
                        title: b.title ?? '',
                        imageUrl: imageInfo.url,
                        imageBlurhash: imageInfo.blurhash,
                        linkType:
                            (b.linkType as HomeBanner['linkType']) ?? 'none',
                        linkTarget: b.linkTarget ?? null,
                        sortOrder: b.sortOrder ?? 0,
                    };
                }),
            )
        ).filter(Boolean) as HomeBanner[];

        const guarantees = (
            await Promise.all(
                guaranteeRows.map(async (g): Promise<HomeGuarantee | null> => {
                    const iconInfo = await this.fileInfoOrNull(g.iconFileId);
                    if (!iconInfo?.url) return null;
                    return {
                        id: g.id,
                        label: g.label,
                        iconUrl: iconInfo.url,
                        iconBlurhash: iconInfo.blurhash,
                        sortOrder: g.sortOrder ?? 0,
                    };
                }),
            )
        ).filter(Boolean) as HomeGuarantee[];

        // promos：补齐 pricing -> personnel/service；override 优先。
        const promos = (
            await Promise.all(
                promoRows.map(async (p): Promise<HomePromo | null> => {
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

                    if (!row) return null;

                    const imageInfo = row.overrideImageFileId
                        ? await this.fileInfoOrNull(row.overrideImageFileId)
                        : null;

                    const imageUrl = imageInfo?.url ?? null;

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
                        imageBlurhash: imageInfo?.blurhash ?? null,
                    };
                }),
            )
        ).filter(Boolean) as HomePromo[];

        return { banners, guarantees, promos };
    }

    async getRecommendedPersonnelWithCenter(params: {
        center: [number, number];
        maxDistanceKm: number;
        limit: number;
        offset?: number;
        categoryId?: string;
        excludePersonnelUserId?: string;
    }): Promise<HomeRecommendedPersonnel[]> {
        const now = new Date();
        const centerGeom = params.center;

        const categoryIds = await this.getFullyActiveCategoryIds(
            params.categoryId,
        );
        if (categoryIds.length === 0) {
            return [];
        }
        if (params.categoryId && (!categoryIds || categoryIds.length === 0)) {
            return [];
        }

        const userPoint = this.geoLocationService.createUserPoint(
            centerGeom[0],
            centerGeom[1],
        );
        const {
            fastFilter: distancePreFilter,
            exactDistance,
            exactFilter,
        } = this.geoLocationService.createOptimizedDistanceCondition(
            sql`${servicePersonnel.geom}`,
            userPoint,
            params.maxDistanceKm,
        );

        const personnelBaseConditions = [
            eq(servicePersonnel.isAvailable, true),
        ];
        if (params.excludePersonnelUserId) {
            personnelBaseConditions.push(
                ne(servicePersonnel.userId, params.excludePersonnelUserId),
            );
        }

        const optimalPricingConditions = [
            eq(servicePersonnelPricing.isActive, true),
            eq(services.isActive, true),
            eq(serviceCategories.isActive, true),
            inArray(services.categoryId, categoryIds),
            sql`(${servicePersonnelPricing.effectiveFrom} IS NULL OR ${servicePersonnelPricing.effectiveFrom} <= ${now})`,
            sql`(${servicePersonnelPricing.effectiveTo} IS NULL OR ${servicePersonnelPricing.effectiveTo} >= ${now})`,
        ];

        const optimalPricingCTE = this.db.$with('optimal_pricing').as(
            this.db
                .select({
                    userId: servicePersonnelPricing.userId,
                    pricingId: servicePersonnelPricing.id,
                    serviceId: servicePersonnelPricing.serviceId,
                    price: servicePersonnelPricing.price,
                    currency: servicePersonnelPricing.currency,
                    estimatedDurationMinutes:
                        servicePersonnelPricing.estimatedDurationMinutes,
                    serviceName: services.name,
                    rowNum: sql<number>`ROW_NUMBER() OVER (
                        PARTITION BY ${servicePersonnelPricing.userId}, ${servicePersonnelPricing.serviceId}
                        ORDER BY CAST(${servicePersonnelPricing.price} AS DECIMAL(18,2)) ASC,
                                 ${servicePersonnelPricing.estimatedDurationMinutes} ASC,
                                 ${servicePersonnelPricing.id} ASC
                    )`.as('row_num'),
                })
                .from(servicePersonnelPricing)
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelPricing.serviceId),
                )
                .innerJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(and(...optimalPricingConditions)),
        );

        // 2) 关联人员基础信息、最优定价、全局评分统计与距离。
        const recommendedPersonnelCTE = this.db
            .$with('recommended_personnel')
            .as(
                this.db
                    .select({
                        personnelId: servicePersonnel.userId,
                        name: servicePersonnel.name,
                        avatarFileId: servicePersonnel.avatar,
                        serviceId: optimalPricingCTE.serviceId,
                        pricingId: optimalPricingCTE.pricingId,
                        province: servicePersonnel.province,
                        district: servicePersonnel.district,
                        county: servicePersonnel.county,
                        detailedAddress: servicePersonnel.detailedAddress,
                        workDays: servicePersonnel.workDays,
                        workStartTime: servicePersonnel.workStartTime,
                        workEndTime: servicePersonnel.workEndTime,
                        distanceKm: exactDistance.as('distance_km'),
                        tag: sql<string>`${optimalPricingCTE.serviceName}`.as(
                            'tag',
                        ),
                        minPrice: sql<string>`${optimalPricingCTE.price}`.as(
                            'min_price',
                        ),
                        currency: sql<string>`${optimalPricingCTE.currency}`.as(
                            'currency',
                        ),
                        reviewCount:
                            sql<number>`COALESCE(${reviewStats.totalCount}, 0)`.as(
                                'review_count',
                            ),
                        goodCount:
                            sql<number>`COALESCE(${reviewStats.goodCount}, 0)`.as(
                                'good_count',
                            ),
                        averageRating:
                            sql<number>`COALESCE(${reviewStats.averageRating}, 0)`.as(
                                'average_rating',
                            ),
                        goodRatePercentage: sql<number>`
                            CASE
                                WHEN COALESCE(${reviewStats.totalCount}, 0) = 0 THEN 0
                                ELSE ROUND(COALESCE(${reviewStats.goodCount}, 0)::decimal / ${reviewStats.totalCount} * 100, 0)
                            END
                        `.as('good_rate_percentage'),
                    })
                    .from(servicePersonnel)
                    .innerJoin(
                        optimalPricingCTE,
                        and(
                            eq(
                                optimalPricingCTE.userId,
                                servicePersonnel.userId,
                            ),
                            sql`${optimalPricingCTE.rowNum} = 1`,
                        ),
                    )
                    .leftJoin(
                        reviewStats,
                        and(
                            eq(reviewStats.targetId, servicePersonnel.userId),
                            sql`${reviewStats.targetType} = 'personnel'`,
                            eq(reviewStats.serviceId, '__all__'),
                        ),
                    )
                    .where(
                        and(
                            ...personnelBaseConditions,
                            distancePreFilter,
                            exactFilter,
                        ),
                    ),
            );

        const rows = await this.db
            .with(optimalPricingCTE, recommendedPersonnelCTE)
            .select()
            .from(recommendedPersonnelCTE)
            .orderBy(
                asc(recommendedPersonnelCTE.distanceKm),
                desc(recommendedPersonnelCTE.averageRating),
                desc(recommendedPersonnelCTE.goodRatePercentage),
                desc(recommendedPersonnelCTE.reviewCount),
                asc(recommendedPersonnelCTE.personnelId),
                asc(recommendedPersonnelCTE.serviceId),
            )
            .offset(params.offset ?? 0)
            .limit(params.limit);

        // 批量解析头像 URL/blurhash（去重）
        const avatarIds = Array.from(
            new Set(
                rows.map((r) => r.avatarFileId).filter(Boolean) as string[],
            ),
        );
        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash: string | null }
        >();
        await Promise.all(
            avatarIds.map(async (id) => {
                const info = await this.fileInfoOrNull(id);
                if (!info?.url) return;
                avatarInfoMap.set(id, {
                    url: info.url,
                    blurhash: info.blurhash,
                });
            }),
        );

        return rows.map((r) => {
            const avatarInfo = r.avatarFileId
                ? (avatarInfoMap.get(r.avatarFileId) ?? null)
                : null;

            // 首页卡片地址：仅返回 service_personnel.detailed_address（不拼省市区全称）
            const addressText = (r.detailedAddress ?? '').trim();

            const ratingValue = Number((r.averageRating ?? 0) / 100);

            return {
                personnelId: r.personnelId,
                name: r.name ?? '服务人员',
                avatarUrl: avatarInfo?.url ?? null,
                avatarBlurhash: avatarInfo?.blurhash ?? null,
                tag: r.tag,
                minPrice: Number(r.minPrice),
                serviceId: r.serviceId,
                pricingId: r.pricingId,
                distanceKm: Number(r.distanceKm),
                addressText,
                workDays: r.workDays,
                workStartTime: r.workStartTime,
                workEndTime: r.workEndTime,
                ratingValue,
                goodRatePercentage: Number(r.goodRatePercentage ?? 0),
                reviewCount: Number(r.reviewCount ?? 0),
            } satisfies HomeRecommendedPersonnel;
        });
    }

    async getRecommendedPersonnelGlobal(params: {
        limit: number;
        offset?: number;
        categoryId?: string;
        excludePersonnelUserId?: string;
    }): Promise<HomeRecommendedPersonnel[]> {
        const now = new Date();

        const categoryIds = await this.getFullyActiveCategoryIds(
            params.categoryId,
        );
        if (categoryIds.length === 0) {
            return [];
        }
        if (params.categoryId && (!categoryIds || categoryIds.length === 0)) {
            return [];
        }

        const optimalPricingConditions = [
            eq(servicePersonnelPricing.isActive, true),
            eq(services.isActive, true),
            eq(serviceCategories.isActive, true),
            inArray(services.categoryId, categoryIds),
            sql`(${servicePersonnelPricing.effectiveFrom} IS NULL OR ${servicePersonnelPricing.effectiveFrom} <= ${now})`,
            sql`(${servicePersonnelPricing.effectiveTo} IS NULL OR ${servicePersonnelPricing.effectiveTo} >= ${now})`,
        ];

        const personnelBaseConditions = [
            eq(servicePersonnel.isAvailable, true),
        ];
        if (params.excludePersonnelUserId) {
            personnelBaseConditions.push(
                ne(servicePersonnel.userId, params.excludePersonnelUserId),
            );
        }

        const optimalPricingCTE = this.db.$with('optimal_pricing').as(
            this.db
                .select({
                    userId: servicePersonnelPricing.userId,
                    pricingId: servicePersonnelPricing.id,
                    serviceId: servicePersonnelPricing.serviceId,
                    price: servicePersonnelPricing.price,
                    currency: servicePersonnelPricing.currency,
                    estimatedDurationMinutes:
                        servicePersonnelPricing.estimatedDurationMinutes,
                    serviceName: services.name,
                    rowNum: sql<number>`ROW_NUMBER() OVER (
                        PARTITION BY ${servicePersonnelPricing.userId}, ${servicePersonnelPricing.serviceId}
                        ORDER BY CAST(${servicePersonnelPricing.price} AS DECIMAL(18,2)) ASC,
                                 ${servicePersonnelPricing.estimatedDurationMinutes} ASC,
                                 ${servicePersonnelPricing.id} ASC
                    )`.as('row_num'),
                })
                .from(servicePersonnelPricing)
                .innerJoin(
                    services,
                    eq(services.id, servicePersonnelPricing.serviceId),
                )
                .innerJoin(
                    serviceCategories,
                    eq(serviceCategories.id, services.categoryId),
                )
                .where(and(...optimalPricingConditions)),
        );

        // 2) 关联人员基础信息、最优定价、全局评分统计。
        // 需求：无坐标时不计算距离、不做距离过滤；排序去掉距离优先级。
        const recommendedPersonnelCTE = this.db
            .$with('recommended_personnel')
            .as(
                this.db
                    .select({
                        personnelId: servicePersonnel.userId,
                        name: servicePersonnel.name,
                        avatarFileId: servicePersonnel.avatar,
                        serviceId: optimalPricingCTE.serviceId,
                        pricingId: optimalPricingCTE.pricingId,
                        province: servicePersonnel.province,
                        district: servicePersonnel.district,
                        county: servicePersonnel.county,
                        detailedAddress: servicePersonnel.detailedAddress,
                        workDays: servicePersonnel.workDays,
                        workStartTime: servicePersonnel.workStartTime,
                        workEndTime: servicePersonnel.workEndTime,
                        distanceKm: sql<number>`0`.as('distance_km'),
                        tag: sql<string>`${optimalPricingCTE.serviceName}`.as(
                            'tag',
                        ),
                        minPrice: sql<string>`${optimalPricingCTE.price}`.as(
                            'min_price',
                        ),
                        currency: sql<string>`${optimalPricingCTE.currency}`.as(
                            'currency',
                        ),
                        reviewCount:
                            sql<number>`COALESCE(${reviewStats.totalCount}, 0)`.as(
                                'review_count',
                            ),
                        goodCount:
                            sql<number>`COALESCE(${reviewStats.goodCount}, 0)`.as(
                                'good_count',
                            ),
                        averageRating:
                            sql<number>`COALESCE(${reviewStats.averageRating}, 0)`.as(
                                'average_rating',
                            ),
                        goodRatePercentage: sql<number>`
                            CASE
                                WHEN COALESCE(${reviewStats.totalCount}, 0) = 0 THEN 0
                                ELSE ROUND(COALESCE(${reviewStats.goodCount}, 0)::decimal / ${reviewStats.totalCount} * 100, 0)
                            END
                        `.as('good_rate_percentage'),
                    })
                    .from(servicePersonnel)
                    .innerJoin(
                        optimalPricingCTE,
                        and(
                            eq(
                                optimalPricingCTE.userId,
                                servicePersonnel.userId,
                            ),
                            sql`${optimalPricingCTE.rowNum} = 1`,
                        ),
                    )
                    .leftJoin(
                        reviewStats,
                        and(
                            eq(reviewStats.targetId, servicePersonnel.userId),
                            sql`${reviewStats.targetType} = 'personnel'`,
                            eq(reviewStats.serviceId, '__all__'),
                        ),
                    )
                    .where(and(...personnelBaseConditions)),
            );

        const rows = await this.db
            .with(optimalPricingCTE, recommendedPersonnelCTE)
            .select()
            .from(recommendedPersonnelCTE)
            .orderBy(
                desc(recommendedPersonnelCTE.averageRating),
                desc(recommendedPersonnelCTE.goodRatePercentage),
                desc(recommendedPersonnelCTE.reviewCount),
                asc(recommendedPersonnelCTE.personnelId),
                asc(recommendedPersonnelCTE.serviceId),
            )
            .offset(params.offset ?? 0)
            .limit(params.limit);

        // 批量解析头像 URL/blurhash（去重）
        const avatarIds = Array.from(
            new Set(
                rows.map((r) => r.avatarFileId).filter(Boolean) as string[],
            ),
        );
        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash: string | null }
        >();
        await Promise.all(
            avatarIds.map(async (id) => {
                const info = await this.fileInfoOrNull(id);
                if (!info?.url) return;
                avatarInfoMap.set(id, {
                    url: info.url,
                    blurhash: info.blurhash,
                });
            }),
        );

        return rows.map((r) => {
            const avatarInfo = r.avatarFileId
                ? (avatarInfoMap.get(r.avatarFileId) ?? null)
                : null;

            // 首页卡片地址：仅返回 service_personnel.detailed_address（不拼省市区全称）
            const addressText = (r.detailedAddress ?? '').trim();

            const ratingValue = Number((r.averageRating ?? 0) / 100);

            return {
                personnelId: r.personnelId,
                name: r.name ?? '服务人员',
                avatarUrl: avatarInfo?.url ?? null,
                avatarBlurhash: avatarInfo?.blurhash ?? null,
                tag: r.tag,
                minPrice: Number(r.minPrice),
                serviceId: r.serviceId,
                pricingId: r.pricingId,
                distanceKm: 0,
                addressText,
                workDays: r.workDays,
                workStartTime: r.workStartTime,
                workEndTime: r.workEndTime,
                ratingValue,
                goodRatePercentage: Number(r.goodRatePercentage ?? 0),
                reviewCount: Number(r.reviewCount ?? 0),
            } satisfies HomeRecommendedPersonnel;
        });
    }
}
