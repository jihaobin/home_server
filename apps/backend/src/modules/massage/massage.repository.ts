import { Inject, Injectable } from '@nestjs/common';
import type {
    MassageLandingPersonnelCard,
    MassageLandingQuery,
    MassagePersonnelDetailQuery,
    ServiceTagEntry,
} from '@repo/types';
import { and, asc, count, eq, inArray, sql } from 'drizzle-orm';
import { alias } from 'drizzle-orm/pg-core';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    follows,
    homeBanners,
    serviceCategories,
    serviceTags,
    services,
} from 'src/common/database/schema';
import { HomeRepository } from '../home/home.repository';
import { OrderRepository } from '../order/order.reposityro';
import { ServicePersonnelService } from '../service-personnel/service-personnel.service';

const MASSAGE_CATEGORY_NAME_KEYWORD = '按摩';

type LandingBannerRow = {
    title: string | null;
    imageFileId: string | null;
    linkType: string;
    linkTarget: string | null;
};

type PersonnelDetailBase = {
    personnelId: string;
    personnelName: string;
    avatarFileId: string | null;
    avatarUrl: string | null;
    avatarBlurhash: string | null;
    selectedServiceId: string | null;
    selectedPricingId: string | null;
    addressText: string;
    distanceText: string | null;
    availableTimeText: string | null;
    description: string | null;
    guaranteeItems: string[];
    stats: {
        yearsOfExperience: number;
        averageServiceQuality: number | null;
        repurchaseRate: number | null;
        goodRatePercentage: number;
    };
    reviewSummary?: {
        averageRating: number;
        totalReviews: number;
        averageAttitude: number | null;
        averageSkill: number | null;
        customerSatisfactionRate: number;
    };
    services: Array<{
        serviceId: string;
        serviceName: string;
        pricingId: string | null;
        tags: string[];
        durationMinutes: number | null;
        price: number | null;
        originalPrice: number | null;
        imageFileId: string | null;
        imageUrl: string | null;
        imageBlurhash: string | null;
        galleryFileIds: string[];
        actionLabel: string;
        highlightLabel: string | null;
    }>;
};

@Injectable()
export class MassageRepository {
    constructor(
        @Inject(DB) private readonly db: DbType,
        private readonly homeRepository: HomeRepository,
        private readonly servicePersonnelService: ServicePersonnelService,
        private readonly orderRepository: OrderRepository,
    ) {}

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

    private formatDistanceText(distanceKm?: number | null) {
        if (!distanceKm || distanceKm <= 0) {
            return null;
        }

        const meters = distanceKm * 1000;
        if (meters < 1000) {
            return `直线 ${Math.round(meters)}m`;
        }

        return `直线 ${distanceKm < 10 ? distanceKm.toFixed(1) : distanceKm.toFixed(0)}km`;
    }

    private isMassageCategoryName(categoryName?: string | null): boolean {
        return (categoryName ?? '').includes(MASSAGE_CATEGORY_NAME_KEYWORD);
    }

    async getLandingBanner(): Promise<LandingBannerRow | null> {
        const now = new Date();

        const [banner] = await this.db
            .select({
                title: homeBanners.title,
                imageFileId: homeBanners.imageFileId,
                linkType: homeBanners.linkType,
                linkTarget: homeBanners.linkTarget,
            })
            .from(homeBanners)
            .where(
                and(
                    eq(homeBanners.isActive, true),
                    eq(homeBanners.scene, 'massage'),
                    sql`(${homeBanners.startsAt} IS NULL OR ${homeBanners.startsAt} <= ${now})`,
                    sql`(${homeBanners.endsAt} IS NULL OR ${homeBanners.endsAt} >= ${now})`,
                ),
            )
            .orderBy(asc(homeBanners.sortOrder), asc(homeBanners.id))
            .limit(1);

        return banner ?? null;
    }

    async getLandingTagEntries(): Promise<ServiceTagEntry[]> {
        const rows = await this.db
            .select({
                tagId: serviceTags.id,
                tagName: serviceTags.name,
                tagSlug: serviceTags.slug,
                domain: serviceTags.domain,
                serviceCount: count(services.id),
            })
            .from(serviceTags)
            .leftJoin(
                services,
                and(
                    eq(services.serviceTagId, serviceTags.id),
                    eq(services.isActive, true),
                ),
            )
            .where(
                and(
                    eq(serviceTags.domain, 'massage'),
                    eq(serviceTags.isActive, true),
                ),
            )
            .groupBy(
                serviceTags.id,
                serviceTags.name,
                serviceTags.slug,
                serviceTags.domain,
                serviceTags.sortOrder,
            )
            .orderBy(asc(serviceTags.sortOrder), asc(serviceTags.id));

        return rows.map((row) => ({
            tagId: row.tagId,
            tagName: row.tagName,
            tagSlug: row.tagSlug,
            domain: 'massage',
            serviceCount: Number(row.serviceCount ?? 0),
        }));
    }

    async getPersonnelYearlyOrderCount(personnelId: string): Promise<number> {
        const now = new Date();
        const startOfYear = new Date(now.getFullYear(), 0, 1);

        return await this.orderRepository.countOrdersByStaff({
            servicePersonnelId: personnelId,
            status: 'completed',
            startTime: startOfYear,
            endTime: now,
        });
    }

    async getLandingPersonnelBuckets(
        userId: string | undefined,
        query: MassageLandingQuery,
    ): Promise<{
        newcomerPersonnel: MassageLandingPersonnelCard[];
        recommendedPersonnel: MassageLandingPersonnelCard[];
    }> {
        const recommendedSourceRaw =
            query.lat !== undefined && query.lng !== undefined
                ? await this.homeRepository.getRecommendedPersonnelWithCenter({
                      center: [query.lng, query.lat],
                      maxDistanceKm: 10,
                      limit: 12,
                      offset: 0,
                      excludePersonnelUserId: userId,
                  })
                : await this.homeRepository.getRecommendedPersonnelGlobal({
                      limit: 12,
                      offset: 0,
                      excludePersonnelUserId: userId,
                  });

        const serviceIds = Array.from(
            new Set(
                recommendedSourceRaw
                    .map((item) => item.serviceId)
                    .filter((id): id is string => Boolean(id)),
            ),
        );

        if (!serviceIds.length) {
            return {
                newcomerPersonnel: [],
                recommendedPersonnel: [],
            };
        }

        const parentCategory = alias(serviceCategories, 'parent_category');
        const serviceCategoryRows = await this.db
            .select({
                serviceId: services.id,
                categoryName: serviceCategories.name,
                parentCategoryName: parentCategory.name,
            })
            .from(services)
            .innerJoin(
                serviceCategories,
                eq(serviceCategories.id, services.categoryId),
            )
            .leftJoin(
                parentCategory,
                eq(parentCategory.id, serviceCategories.parentId),
            )
            .where(inArray(services.id, serviceIds));

        const massageServiceIds = new Set(
            serviceCategoryRows
                .filter(
                    (row) =>
                        this.isMassageCategoryName(row.parentCategoryName) ||
                        this.isMassageCategoryName(row.categoryName),
                )
                .map((row) => row.serviceId),
        );

        const massageRecommendedSourceRaw = recommendedSourceRaw.filter(
            (item) => item.serviceId && massageServiceIds.has(item.serviceId),
        );

        if (!massageRecommendedSourceRaw.length) {
            return {
                newcomerPersonnel: [],
                recommendedPersonnel: [],
            };
        }

        const recommendedSource = Array.from(
            new Map(
                massageRecommendedSourceRaw.map((item) => [
                    item.personnelId,
                    item,
                ]),
            ).values(),
        );

        const personnelIds = Array.from(
            new Set(recommendedSource.map((item) => item.personnelId)),
        );

        const favoriteRows = await this.db
            .select({
                personnelId: follows.followingId,
                favoriteCount: count(follows.followingId),
            })
            .from(follows)
            .where(inArray(follows.followingId, personnelIds))
            .groupBy(follows.followingId);

        const favoriteCountMap = new Map(
            favoriteRows.map((row) => [
                row.personnelId,
                Number(row.favoriteCount ?? 0),
            ]),
        );

        const yearlyOrderEntries: Array<[string, number]> = await Promise.all(
            personnelIds.map(
                async (personnelId): Promise<[string, number]> => [
                    personnelId,
                    await this.getPersonnelYearlyOrderCount(personnelId),
                ],
            ),
        );
        const yearlyOrderMap = new Map(yearlyOrderEntries);

        const cards = recommendedSource.map((item) => {
            const yearlyOrderCount = yearlyOrderMap.get(item.personnelId) ?? 0;

            return {
                personnelId: item.personnelId,
                name: item.name,
                avatarUrl: item.avatarUrl ?? null,
                avatarBlurhash: item.avatarBlurhash ?? null,
                serviceId: item.serviceId ?? null,
                pricingId: item.pricingId ?? null,
                serviceName: item.tag ?? null,
                ratingValue: item.ratingValue,
                reviewCount: item.reviewCount,
                orderCountLabel:
                    yearlyOrderCount > 0 ? `一年${yearlyOrderCount}单` : null,
                favoriteCount: favoriteCountMap.get(item.personnelId) ?? 0,
                distanceText: this.formatDistanceText(item.distanceKm),
                availableTimeText: this.formatTimeHHmm(item.workStartTime)
                    ? `最早可约${this.formatTimeHHmm(item.workStartTime)}`
                    : null,
            };
        });

        const distanceMap = new Map(
            recommendedSource.map((item) => [
                item.personnelId,
                item.distanceKm ?? 0,
            ]),
        );

        const sortByDistance = (
            leftPersonnelId: string,
            rightPersonnelId: string,
        ) =>
            (distanceMap.get(leftPersonnelId) ?? 0) -
            (distanceMap.get(rightPersonnelId) ?? 0);

        const newcomerPersonnel = [...cards]
            .sort((left, right) => {
                const leftOrders = yearlyOrderMap.get(left.personnelId) ?? 0;
                const rightOrders = yearlyOrderMap.get(right.personnelId) ?? 0;

                return (
                    leftOrders - rightOrders ||
                    right.ratingValue - left.ratingValue ||
                    right.reviewCount - left.reviewCount ||
                    sortByDistance(left.personnelId, right.personnelId)
                );
            })
            .slice(0, 4);

        const recommendedPersonnel = [...cards]
            .sort((left, right) => {
                const leftOrders = yearlyOrderMap.get(left.personnelId) ?? 0;
                const rightOrders = yearlyOrderMap.get(right.personnelId) ?? 0;

                return (
                    right.ratingValue - left.ratingValue ||
                    rightOrders - leftOrders ||
                    right.reviewCount - left.reviewCount ||
                    sortByDistance(left.personnelId, right.personnelId)
                );
            })
            .slice(0, 3);

        return {
            newcomerPersonnel,
            recommendedPersonnel,
        };
    }

    async getPersonnelDetailBase(
        personnelId: string,
        query: MassagePersonnelDetailQuery,
    ): Promise<PersonnelDetailBase | null> {
        const profile =
            await this.servicePersonnelService.getPersonnelProfile(personnelId);
        const activeServices = (profile.services ?? []).filter(
            (service) => service.isActive,
        );

        if (!activeServices.length) {
            return null;
        }

        const serviceIds = activeServices.map((service) => service.serviceId);
        const parentCategory = alias(serviceCategories, 'parent_category');
        const serviceMetaRows = await this.db
            .select({
                serviceId: services.id,
                imageFileId: services.imageFileId,
                tagName: serviceTags.name,
            })
            .from(services)
            .innerJoin(
                serviceCategories,
                eq(serviceCategories.id, services.categoryId),
            )
            .leftJoin(
                parentCategory,
                eq(parentCategory.id, serviceCategories.parentId),
            )
            .leftJoin(serviceTags, eq(serviceTags.id, services.serviceTagId))
            .where(
                and(
                    inArray(services.id, serviceIds),
                    eq(services.isActive, true),
                    sql`(${serviceCategories.name} LIKE ${`%${MASSAGE_CATEGORY_NAME_KEYWORD}%`} OR ${parentCategory.name} LIKE ${`%${MASSAGE_CATEGORY_NAME_KEYWORD}%`})`,
                ),
            );

        const serviceMetaMap = new Map(
            serviceMetaRows.map((row) => [row.serviceId, row]),
        );
        const massageServiceIds = new Set(
            serviceMetaRows.map((row) => row.serviceId),
        );

        const normalizedServices = activeServices
            .filter((service) => massageServiceIds.has(service.serviceId))
            .map((service) => {
                const specs = [...(service.specifications ?? [])].sort(
                    (left, right) => Number(left.price) - Number(right.price),
                );
                const firstSpec = specs[0];
                const meta = serviceMetaMap.get(service.serviceId);

                return {
                    serviceId: service.serviceId,
                    serviceName: service.serviceName,
                    pricingId: firstSpec?.id ?? null,
                    tags: meta?.tagName ? [meta.tagName] : [],
                    durationMinutes:
                        firstSpec?.estimatedDurationMinutes ?? null,
                    price: firstSpec ? Number(firstSpec.price) : null,
                    originalPrice: null,
                    imageFileId: meta?.imageFileId ?? null,
                    imageUrl: null,
                    imageBlurhash: null,
                    galleryFileIds: service.galleryFileIds ?? [],
                    actionLabel: '去预约',
                    highlightLabel: null,
                };
            });

        if (!normalizedServices.length) {
            return null;
        }

        const selectedService =
            normalizedServices.find(
                (service) => service.serviceId === query.serviceId,
            ) ?? normalizedServices[0];

        return {
            personnelId: profile.userId,
            personnelName: profile.name?.trim() || '服务人员',
            avatarFileId: null,
            avatarUrl: profile.avatar?.url ?? null,
            avatarBlurhash: profile.avatar?.blurhash ?? null,
            selectedServiceId: selectedService?.serviceId ?? null,
            selectedPricingId:
                query.pricingId ?? selectedService?.pricingId ?? null,
            addressText:
                profile.detailedAddress?.trim() ||
                [profile.province, profile.district, profile.county]
                    .filter(Boolean)
                    .join(''),
            distanceText: null,
            availableTimeText: this.formatTimeHHmm(profile.workStartTime)
                ? `最早可约${this.formatTimeHHmm(profile.workStartTime)}`
                : null,
            description: profile.bio ?? null,
            guaranteeItems: ['契约包退', '实名认证', '资质证书'],
            stats: {
                yearsOfExperience: profile.yearsOfExperience ?? 0,
                averageServiceQuality: null,
                repurchaseRate: null,
                goodRatePercentage: 0,
            },
            services: normalizedServices,
        };
    }
}
