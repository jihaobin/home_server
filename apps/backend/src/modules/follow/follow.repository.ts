import { Inject, Injectable } from '@nestjs/common';
import { and, asc, eq, gte, lte, sql } from 'drizzle-orm';
import type { FavoritePersonnelListItem } from '@repo/types';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    follows,
    orderAssignments,
    orders,
    reviews,
    servicePersonnel,
    servicePersonnelPricing,
    services,
    userAddresses,
} from 'src/common/database/schema';

@Injectable()
export class FollowRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    private formatTimeHHmm(value?: string | null): string | null {
        if (!value) {
            return null;
        }

        const [hh, mm] = value.split(':');
        if (!hh || !mm) {
            return value;
        }

        return `${hh.padStart(2, '0')}:${mm.padStart(2, '0')}`;
    }

    private formatDistanceText(distanceKm?: number | null): string | null {
        if (
            distanceKm === null ||
            distanceKm === undefined ||
            Number.isNaN(distanceKm) ||
            distanceKm <= 0
        ) {
            return null;
        }

        const meters = distanceKm * 1000;
        if (meters < 1000) {
            return `直线 ${Math.round(meters)}m`;
        }

        return `直线 ${distanceKm < 10 ? distanceKm.toFixed(1) : distanceKm.toFixed(0)}km`;
    }

    async countFavoritesByPersonnelId(personnelId: string): Promise<number> {
        const [row] = await this.db
            .select({
                count: sql<number>`count(*)`,
            })
            .from(follows)
            .where(eq(follows.followingId, personnelId));

        return Number(row?.count ?? 0);
    }

    async existsActiveFavorite(
        userId: string,
        personnelId: string,
    ): Promise<boolean> {
        const [row] = await this.db
            .select({
                followingId: follows.followingId,
            })
            .from(follows)
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(follows.followingId, personnelId),
                ),
            )
            .limit(1);

        return Boolean(row);
    }

    async ensureFavoritablePersonnelExists(
        personnelId: string,
    ): Promise<boolean> {
        const [row] = await this.db
            .select({
                userId: servicePersonnel.userId,
            })
            .from(servicePersonnel)
            .where(
                and(
                    eq(servicePersonnel.userId, personnelId),
                    eq(servicePersonnel.isAvailable, true),
                ),
            )
            .limit(1);

        return Boolean(row);
    }

    async ensurePersonnelExists(personnelId: string): Promise<boolean> {
        const [row] = await this.db
            .select({
                userId: servicePersonnel.userId,
            })
            .from(servicePersonnel)
            .where(eq(servicePersonnel.userId, personnelId))
            .limit(1);

        return Boolean(row);
    }

    async createFavorite(userId: string, personnelId: string): Promise<void> {
        await this.db
            .insert(follows)
            .values({
                followerId: userId,
                followingId: personnelId,
            })
            .onConflictDoNothing();
    }

    async deleteFavorite(userId: string, personnelId: string): Promise<void> {
        await this.db
            .delete(follows)
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(follows.followingId, personnelId),
                ),
            );
    }

    async countFavoritesByUserId(userId: string): Promise<number> {
        const [row] = await this.db
            .select({
                count: sql<number>`count(*)::int`,
            })
            .from(follows)
            .innerJoin(
                servicePersonnel,
                eq(servicePersonnel.userId, follows.followingId),
            )
            .where(
                and(
                    eq(follows.followerId, userId),
                    eq(servicePersonnel.isAvailable, true),
                ),
            );

        return Number(row?.count ?? 0);
    }

    async listFavoritePersonnel(
        userId: string,
        page: number,
        pageSize: number,
    ): Promise<{ items: FavoritePersonnelListItem[]; total: number }> {
        const offset = (page - 1) * pageSize;
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        const userDefaultAddress = this.db
            .select({
                geom: userAddresses.geom,
            })
            .from(userAddresses)
            .where(
                and(
                    eq(userAddresses.userId, userId),
                    eq(userAddresses.isDefault, true),
                ),
            )
            .limit(1)
            .as('user_default_address');

        const visibleFavoritesCTE = this.db.$with('visible_favorites').as(
            this.db
                .select({
                    personnelId: servicePersonnel.userId,
                    personnelName:
                        sql<string>`COALESCE(NULLIF(TRIM(${servicePersonnel.name}), ''), '服务人员')`.as(
                            'personnel_name',
                        ),
                    avatarIdentifier:
                        sql<string | null>`NULLIF(TRIM(${servicePersonnel.avatar}), '')`.as(
                            'avatar_identifier',
                        ),
                    addressText:
                        sql<string>`COALESCE(${servicePersonnel.detailedAddress}, '')`.as(
                            'address_text',
                        ),
                    workStartTime: servicePersonnel.workStartTime,
                    distanceKm: sql<number | null>`
                        CASE
                            WHEN ${userDefaultAddress.geom} IS NULL THEN NULL
                            ELSE ST_DistanceSphere(${servicePersonnel.geom}, ${userDefaultAddress.geom}) / 1000.0
                        END
                    `.as('distance_km'),
                })
                .from(follows)
                .innerJoin(
                    servicePersonnel,
                    eq(servicePersonnel.userId, follows.followingId),
                )
                .leftJoinLateral(userDefaultAddress, sql`true`)
                .where(
                    and(
                        eq(follows.followerId, userId),
                        eq(servicePersonnel.isAvailable, true),
                    ),
                ),
        );

        const favoriteStatsCTE = this.db.$with('favorite_stats').as(
            this.db
                .select({
                    personnelId: follows.followingId,
                    favoriteCount:
                        sql<number>`COUNT(*)::int`.as('favorite_count'),
                })
                .from(follows)
                .innerJoin(
                    visibleFavoritesCTE,
                    eq(visibleFavoritesCTE.personnelId, follows.followingId),
                )
                .groupBy(follows.followingId),
        );

        const reviewStatsCTE = this.db.$with('review_stats').as(
            this.db
                .select({
                    personnelId: reviews.targetId,
                    reviewCount: sql<number>`COUNT(*)::int`.as('review_count'),
                    ratingValue:
                        sql<number>`ROUND(AVG(${reviews.rating})::numeric, 2)::float`.as(
                            'rating_value',
                        ),
                })
                .from(reviews)
                .innerJoin(
                    visibleFavoritesCTE,
                    eq(visibleFavoritesCTE.personnelId, reviews.targetId),
                )
                .where(sql`${reviews.targetType} = 'personnel'`)
                .groupBy(reviews.targetId),
        );

        const yearlyOrderStatsCTE = this.db.$with('yearly_order_stats').as(
            this.db
                .select({
                    personnelId: orderAssignments.servicePersonnelId,
                    yearlyOrderCount:
                        sql<number>`COUNT(*)::int`.as('yearly_order_count'),
                })
                .from(orders)
                .innerJoin(
                    orderAssignments,
                    eq(orderAssignments.orderId, orders.id),
                )
                .innerJoin(
                    visibleFavoritesCTE,
                    eq(
                        visibleFavoritesCTE.personnelId,
                        orderAssignments.servicePersonnelId,
                    ),
                )
                .where(
                    and(
                        eq(orders.status, 'completed'),
                        gte(orders.createdAt, startOfYear),
                        lte(orders.createdAt, now),
                    ),
                )
                .groupBy(orderAssignments.servicePersonnelId),
        );

        const primaryServiceCandidatesCTE =
            this.db.$with('primary_service_candidates').as(
                this.db
                    .select({
                        personnelId: servicePersonnelPricing.userId,
                        primaryServiceId: servicePersonnelPricing.serviceId,
                        primaryPricingId: servicePersonnelPricing.id,
                        primaryServiceName: services.name,
                        rowNum: sql<number>`ROW_NUMBER() OVER (
                            PARTITION BY ${servicePersonnelPricing.userId}
                            ORDER BY CAST(${servicePersonnelPricing.price} AS DECIMAL(18, 2)) ASC,
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
                        visibleFavoritesCTE,
                        eq(
                            visibleFavoritesCTE.personnelId,
                            servicePersonnelPricing.userId,
                        ),
                    )
                    .where(
                        and(
                            eq(servicePersonnelPricing.isActive, true),
                            eq(services.isActive, true),
                        ),
                    ),
            );

        const primaryServiceCTE = this.db.$with('primary_service').as(
            this.db
                .select({
                    personnelId: primaryServiceCandidatesCTE.personnelId,
                    primaryServiceId: primaryServiceCandidatesCTE.primaryServiceId,
                    primaryPricingId: primaryServiceCandidatesCTE.primaryPricingId,
                    primaryServiceName:
                        primaryServiceCandidatesCTE.primaryServiceName,
                })
                .from(primaryServiceCandidatesCTE)
                .where(sql`${primaryServiceCandidatesCTE.rowNum} = 1`),
        );

        const rows = await this.db
            .with(
                visibleFavoritesCTE,
                favoriteStatsCTE,
                reviewStatsCTE,
                yearlyOrderStatsCTE,
                primaryServiceCandidatesCTE,
                primaryServiceCTE,
            )
            .select({
                personnelId: visibleFavoritesCTE.personnelId,
                personnelName: visibleFavoritesCTE.personnelName,
                avatarIdentifier: visibleFavoritesCTE.avatarIdentifier,
                addressText: visibleFavoritesCTE.addressText,
                workStartTime: visibleFavoritesCTE.workStartTime,
                distanceKm: visibleFavoritesCTE.distanceKm,
                totalCount: sql<number>`COUNT(*) OVER()::int`.as('total_count'),
                favoriteCount:
                    sql<number>`COALESCE(${favoriteStatsCTE.favoriteCount}, 0)`.as(
                        'favorite_count',
                    ),
                reviewCount:
                    sql<number>`COALESCE(${reviewStatsCTE.reviewCount}, 0)`.as(
                        'review_count',
                    ),
                ratingValue:
                    sql<number>`COALESCE(${reviewStatsCTE.ratingValue}, 0)::float`.as(
                        'rating_value',
                    ),
                yearlyOrderCount:
                    sql<number>`COALESCE(${yearlyOrderStatsCTE.yearlyOrderCount}, 0)`.as(
                        'yearly_order_count',
                    ),
                primaryServiceId: primaryServiceCTE.primaryServiceId,
                primaryPricingId: primaryServiceCTE.primaryPricingId,
                primaryServiceName: primaryServiceCTE.primaryServiceName,
            })
            .from(visibleFavoritesCTE)
            .leftJoin(
                favoriteStatsCTE,
                eq(
                    favoriteStatsCTE.personnelId,
                    visibleFavoritesCTE.personnelId,
                ),
            )
            .leftJoin(
                reviewStatsCTE,
                eq(reviewStatsCTE.personnelId, visibleFavoritesCTE.personnelId),
            )
            .leftJoin(
                yearlyOrderStatsCTE,
                eq(
                    yearlyOrderStatsCTE.personnelId,
                    visibleFavoritesCTE.personnelId,
                ),
            )
            .leftJoin(
                primaryServiceCTE,
                eq(
                    primaryServiceCTE.personnelId,
                    visibleFavoritesCTE.personnelId,
                ),
            )
            .orderBy(asc(visibleFavoritesCTE.personnelId))
            .limit(pageSize)
            .offset(offset);

        const items: FavoritePersonnelListItem[] = rows.map((row) => {
            const availableFrom = this.formatTimeHHmm(row.workStartTime);
            const distanceText = this.formatDistanceText(
                row.distanceKm === null || row.distanceKm === undefined
                    ? null
                    : Number(row.distanceKm),
            );

            return {
                personnelId: row.personnelId,
                personnelName: row.personnelName?.trim() || '服务人员',
                avatarUrl: row.avatarIdentifier?.trim() || null,
                avatarBlurhash: null,
                addressText: row.addressText?.trim() || '',
                distanceText,
                availableTimeText: availableFrom
                    ? `最早可约${availableFrom}`
                    : null,
                favoriteCount: Number(row.favoriteCount ?? 0),
                reviewCount: Number(row.reviewCount ?? 0),
                ratingValue: Number(row.ratingValue ?? 0),
                yearlyOrderCount: Number(row.yearlyOrderCount ?? 0),
                primaryServiceId: row.primaryServiceId ?? null,
                primaryPricingId: row.primaryPricingId ?? null,
                primaryServiceName: row.primaryServiceName?.trim() || null,
                favoritedAt: null,
            };
        });

        const total = rows.length
            ? Number(rows[0]?.totalCount ?? 0)
            : await this.countFavoritesByUserId(userId);

        return {
            items,
            total,
        };
    }
}
