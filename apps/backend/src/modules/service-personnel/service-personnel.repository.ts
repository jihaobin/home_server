import { Inject, Injectable } from '@nestjs/common';
import type {
    ServicePersonnelFilterRequest,
    UpdateServicePersonnelProfileRequest,
} from '@repo/types';
import {
    and,
    asc,
    desc,
    eq,
    gte,
    inArray,
    like,
    ne,
    type SQL,
    sql,
} from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import {
    reviewStats,
    servicePersonnel,
    servicePersonnelPricing,
    servicePersonnelSkills,
    services,
    userProfiles,
    users,
} from 'src/common/database/schema';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import { extractParams } from 'src/lib/utlis';
import { OrderRepository } from '../order/order.reposityro';

@Injectable()
export class ServicePersonnelRepository {
    constructor(
        @Inject(DB) private readonly db: DbType,
        private readonly geoService: GeoLocationService,
        private readonly orderRepository: OrderRepository,
    ) {}

    /**
     * 🚀 智能匹配服务人员 - 优化版本
     * 使用 CTE 和窗口函数优化查询性能，单次查询获取所有数据
     * 针对有多个定价的服务人员，选择预计时间最短且价格最低的定价
     */
    async findMatchedPersonnel({
        serviceId,
        userLat,
        userLng,
        maxDistance = 50,
        minPrice,
        maxPrice,
        minYearsOfExperience,
        needServiceTime,
        sortBy = 'distance',
        sortOrder = 'asc',
        page = 1,
        pageSize = 20,
        currentUserId,
    }: ServicePersonnelFilterRequest) {
        const userPoint = this.geoService.createUserPoint(userLng, userLat);
        const {
            fastFilter: distancePreFilter,
            exactDistance,
            exactFilter,
        } = this.geoService.createOptimizedDistanceCondition(
            sql`${servicePersonnel.geom}`,
            userPoint,
            maxDistance,
        );

        // 第一步：使用 CTE 为每个服务人员选择最优定价
        // 最优定价规则：1) 预计时间最短 2) 价格最低
        const optimalPricingCTE = this.db.$with('optimal_pricing').as(
            this.db
                .select({
                    userId: servicePersonnelPricing.userId,
                    pricingId: servicePersonnelPricing.id,
                    price: servicePersonnelPricing.price,
                    currency: servicePersonnelPricing.currency,
                    estimatedDurationMinutes:
                        servicePersonnelPricing.estimatedDurationMinutes,
                    // 使用窗口函数按时间和价格排序，为每个用户选择最优定价
                    rowNum: sql<number>`ROW_NUMBER() OVER (
                        PARTITION BY ${servicePersonnelPricing.userId}
                        ORDER BY ${servicePersonnelPricing.estimatedDurationMinutes} ASC,
                                 CAST(${servicePersonnelPricing.price} AS DECIMAL(18,2)) ASC
                    )`.as('row_num'),
                })
                .from(servicePersonnelPricing)
                .where(
                    and(
                        eq(servicePersonnelPricing.serviceId, serviceId),
                        eq(servicePersonnelPricing.isActive, true),
                    ),
                ),
        );

        // 基础筛选条件（不再包含 servicePersonnelPricing 的条件）
        const baseConditions = [
            eq(servicePersonnel.isAvailable, true),
            sql`${servicePersonnel.geom} IS NOT NULL`,
        ];

        // 如果提供了当前用户ID，则排除自己
        if (currentUserId) {
            baseConditions.push(
                sql`${servicePersonnel.userId} != ${currentUserId}`,
            );
        }

        // 工作时间筛选
        if (needServiceTime) {
            const { weekday, timeStr } = extractParams(needServiceTime);
            baseConditions.push(
                like(servicePersonnel.workDays, `%${weekday}%`),
                sql`${timeStr} BETWEEN ${servicePersonnel.workStartTime} AND ${servicePersonnel.workEndTime}`,
            );
        }

        // 工作经验筛选
        if (minYearsOfExperience) {
            baseConditions.push(
                gte(servicePersonnel.yearsOfExperience, minYearsOfExperience),
            );
        }

        // 地理位置筛选
        if (maxDistance) {
            baseConditions.push(distancePreFilter, exactFilter);
        }

        // 第二步：构建主查询 CTE，关联最优定价和评论统计
        const filteredPersonnelCTE = this.db.$with('filtered_personnel').as(
            this.db
                .select({
                    userId: servicePersonnel.userId,
                    workDays: servicePersonnel.workDays,
                    workStartTime: servicePersonnel.workStartTime,
                    workEndTime: servicePersonnel.workEndTime,
                    yearsOfExperience: servicePersonnel.yearsOfExperience,
                    isAvailable: servicePersonnel.isAvailable,
                    lastActiveAt: servicePersonnel.lastActiveAt,
                    province: servicePersonnel.province,
                    district: servicePersonnel.district,
                    county: servicePersonnel.county,
                    bio: servicePersonnel.bio,
                    detailedAddress: servicePersonnel.detailedAddress,
                    name: servicePersonnel.name,
                    avatarUrl: servicePersonnel.avatar,
                    distance: exactDistance.as('distance'),
                    price: sql<string>`${optimalPricingCTE.price}`.as('price'),
                    currency: sql<string>`${optimalPricingCTE.currency}`.as(
                        'currency',
                    ),
                    estimatedDurationMinutes:
                        sql<number>`${optimalPricingCTE.estimatedDurationMinutes}`.as(
                            'estimated_duration_minutes',
                        ),
                    // 评论统计数据
                    reviewCount:
                        sql<number>`COALESCE(${reviewStats.totalCount}, 0)`.as(
                            'review_count',
                        ),
                    goodReviewCount:
                        sql<number>`COALESCE(${reviewStats.goodCount}, 0)`.as(
                            'good_review_count',
                        ),
                    // 计算好评率(好评数/总评价数 * 100)，如果没有评价则为0
                    goodReviewRate: sql<number>`
                        CASE
                            WHEN COALESCE(${reviewStats.totalCount}, 0) = 0 THEN 0
                            ELSE ROUND(COALESCE(${reviewStats.goodCount}, 0)::decimal / ${reviewStats.totalCount} * 100, 2)
                        END
                    `.as('good_review_rate'),
                    // 使用窗口函数计算总数
                    totalCount: sql<number>`COUNT(*) OVER()`.as('total_count'),
                })
                .from(servicePersonnel)
                // 关联最优定价 CTE，只选择 row_num = 1 的记录
                .innerJoin(
                    optimalPricingCTE,
                    and(
                        eq(optimalPricingCTE.userId, servicePersonnel.userId),
                        sql`${optimalPricingCTE.rowNum} = 1`,
                    ),
                )
                // 左连接评论统计表，获取针对该服务的评价统计
                .leftJoin(
                    reviewStats,
                    and(
                        eq(reviewStats.targetId, servicePersonnel.userId),
                        sql`${reviewStats.targetType} = 'personnel'`,
                        eq(reviewStats.serviceId, serviceId),
                    ),
                )
                .where(and(...baseConditions)),
        );

        // 价格区间筛选条件（需要在使用 CTE 时应用）
        const priceFilterConditions: SQL[] = [];
        if (minPrice !== undefined && maxPrice !== undefined) {
            priceFilterConditions.push(
                sql`CAST(${filteredPersonnelCTE.price} AS DECIMAL(18,2)) >= ${minPrice}`,
                sql`CAST(${filteredPersonnelCTE.price} AS DECIMAL(18,2)) <= ${maxPrice}`,
            );
        } else if (minPrice !== undefined) {
            priceFilterConditions.push(
                sql`CAST(${filteredPersonnelCTE.price} AS DECIMAL(18,2)) >= ${minPrice}`,
            );
        } else if (maxPrice !== undefined) {
            priceFilterConditions.push(
                sql`CAST(${filteredPersonnelCTE.price} AS DECIMAL(18,2)) <= ${maxPrice}`,
            );
        }

        // 构建排序表达式 - 默认按距离、评价数量、好评率排序
        const orderExpressions = this.getOrderExpressions(
            sortBy,
            sortOrder,
            filteredPersonnelCTE,
        );

        // 第三步：获取分页数据
        let finalQuery = this.db
            .with(optimalPricingCTE, filteredPersonnelCTE)
            .select()
            .from(filteredPersonnelCTE);

        // 应用价格筛选（如果有）
        if (priceFilterConditions.length > 0) {
            finalQuery = finalQuery.where(and(...priceFilterConditions)) as any;
        }

        const paginatedResults = await finalQuery
            .orderBy(...orderExpressions)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const total = paginatedResults[0]?.totalCount || 0;

        // 组装最终结果
        const personnel = paginatedResults.map((result) => ({
            name: result.name || '服务人员',
            userId: result.userId,
            province: result.province,
            district: result.district,
            county: result.county,
            detailedAddress: result.detailedAddress,
            yearsOfExperience: result.yearsOfExperience,
            workStartTime: result.workStartTime,
            workEndTime: result.workEndTime,
            isAvailable: result.isAvailable,
            workDays: result.workDays,
            currentStatus: result.isAvailable
                ? ('available' as const)
                : ('offline' as const),
            lastActiveAt: result.lastActiveAt,
            bio: result.bio || '',
            distance: result.distance,
            price: result.price,
            avatarUrl: result.avatarUrl || undefined,
            // 评价相关字段
            reviewCount: result.reviewCount || 0,
            goodReviewCount: result.goodReviewCount || 0,
            goodReviewRate: result.goodReviewRate || 0,
        }));

        return {
            items: personnel,
            total: Number(total),
            page,
            limit: pageSize,
        };
    }

    /**
     * 构建排序表达式
     * 默认排序规则：距离最近 > 评价数量最多 > 好评率最高
     */
    private getOrderExpressions(
        sortBy: string,
        sortOrder: 'asc' | 'desc',
        personnelCTE: any,
    ) {
        const expressions: SQL[] = [];

        switch (sortBy) {
            case 'distance':
                // 距离优先，然后按评价数量和好评率
                expressions.push(
                    sortOrder === 'asc'
                        ? asc(sql`${personnelCTE.distance}`)
                        : desc(sql`${personnelCTE.distance}`),
                    desc(sql`${personnelCTE.reviewCount}`),
                    desc(sql`${personnelCTE.goodReviewRate}`),
                );
                break;
            case 'price':
                // 价格优先，然后按距离、评价数量和好评率
                expressions.push(
                    sortOrder === 'asc'
                        ? asc(sql`CAST(${personnelCTE.price} AS DECIMAL(18,2))`)
                        : desc(
                              sql`CAST(${personnelCTE.price} AS DECIMAL(18,2))`,
                          ),
                    asc(sql`${personnelCTE.distance}`),
                    desc(sql`${personnelCTE.reviewCount}`),
                    desc(sql`${personnelCTE.goodReviewRate}`),
                );
                break;
            case 'experience':
                // 经验优先，然后按距离、评价数量和好评率
                expressions.push(
                    sortOrder === 'asc'
                        ? asc(sql`${personnelCTE.yearsOfExperience}`)
                        : desc(sql`${personnelCTE.yearsOfExperience}`),
                    asc(sql`${personnelCTE.distance}`),
                    desc(sql`${personnelCTE.reviewCount}`),
                    desc(sql`${personnelCTE.goodReviewRate}`),
                );
                break;
            case 'rating':
                // 评价优先：评价数量 > 好评率 > 距离
                expressions.push(
                    desc(sql`${personnelCTE.reviewCount}`),
                    desc(sql`${personnelCTE.goodReviewRate}`),
                    asc(sql`${personnelCTE.distance}`),
                );
                break;
            default:
                // 默认排序：距离 > 评价数量 > 好评率
                expressions.push(
                    asc(sql`${personnelCTE.distance}`),
                    desc(sql`${personnelCTE.reviewCount}`),
                    desc(sql`${personnelCTE.goodReviewRate}`),
                );
        }

        return expressions;
    }

    /**
     * 获取服务人员的用户信息（名称、手机号、头像）
     */
    async getPersonnelContactInfo(
        personnelId: string,
    ): Promise<{ phoneNumber: string | null; idCardNumber: string | null } | null> {
        const rows = await this.db
            .select({
                phoneNumber: users.phoneNumber,
                idCardNumber: userProfiles.idCardNumber,
            })
            .from(users)
            .leftJoin(userProfiles, eq(userProfiles.userId, users.id))
            .where(eq(users.id, personnelId))
            .limit(1);

        return rows[0] ?? null;
    }

    async findSearchPersonnelSuggestions(keyword: string, limit = 5) {
        const normalizedKeyword = keyword.trim();
        if (!normalizedKeyword) {
            return [];
        }

        return await this.db
            .select({
                id: servicePersonnel.userId,
                name: servicePersonnel.name,
            })
            .from(servicePersonnel)
            .where(
                and(
                    eq(servicePersonnel.isAvailable, true),
                    like(servicePersonnel.name, `%${normalizedKeyword}%`),
                ),
            )
            .orderBy(asc(servicePersonnel.name), asc(servicePersonnel.userId))
            .limit(limit);
    }

    async findExactPersonnelByName(keyword: string) {
        const normalizedKeyword = keyword.trim().replace(/\s+/g, ' ');
        if (!normalizedKeyword) {
            return null;
        }

        const rows = await this.db
            .select({
                id: servicePersonnel.userId,
                name: servicePersonnel.name,
            })
            .from(servicePersonnel)
            .where(
                and(
                    eq(servicePersonnel.isAvailable, true),
                    sql`regexp_replace(trim(${servicePersonnel.name}), '\s+', ' ', 'g') = ${normalizedKeyword}`,
                ),
            )
            .limit(2);

        return rows.length === 1 ? rows[0] : null;
    }

    async searchPersonnelByServiceIds({
        serviceIds,
        page,
        limit,
        lat,
        lng,
        excludePersonnelUserId,
    }: {
        serviceIds: string[];
        page: number;
        limit: number;
        lat?: number;
        lng?: number;
        excludePersonnelUserId?: string;
    }) {
        const normalizedServiceIds = Array.from(
            new Set(serviceIds.map((item) => item.trim()).filter(Boolean)),
        );

        if (!normalizedServiceIds.length) {
            return {
                personnel: [],
                page,
                limit,
                hasMore: false,
                nextPage: null,
            };
        }

        const offset = (page - 1) * limit;
        const distanceSelect =
            lat !== undefined && lng !== undefined
                ? this.geoService.createDistanceCalculation(
                      sql`${servicePersonnel.geom}`,
                      this.geoService.createUserPoint(lng, lat),
                  )
                : sql<number>`0`.as('distance_km');

        const optimalPricingCTE = this.db.$with('optimal_pricing').as(
            this.db
                .select({
                    userId: servicePersonnelPricing.userId,
                    serviceId: servicePersonnelPricing.serviceId,
                    pricingId: servicePersonnelPricing.id,
                    price: servicePersonnelPricing.price,
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
                .where(
                    and(
                        inArray(
                            servicePersonnelPricing.serviceId,
                            normalizedServiceIds,
                        ),
                        eq(servicePersonnelPricing.isActive, true),
                        eq(services.isActive, true),
                    ),
                ),
        );

        const rows = await this.db
            .with(optimalPricingCTE)
            .select({
                personnelId: servicePersonnel.userId,
                name: servicePersonnel.name,
                avatar: servicePersonnel.avatar,
                serviceId: optimalPricingCTE.serviceId,
                serviceName: optimalPricingCTE.serviceName,
                pricingId: optimalPricingCTE.pricingId,
                minPrice:
                    sql<number>`CAST(${optimalPricingCTE.price} AS DECIMAL(18,2))`.as(
                        'min_price',
                    ),
                distanceKm: distanceSelect,
                addressText: servicePersonnel.detailedAddress,
                workDays: servicePersonnel.workDays,
                workStartTime: servicePersonnel.workStartTime,
                workEndTime: servicePersonnel.workEndTime,
                reviewCount:
                    sql<number>`COALESCE(${reviewStats.totalCount}, 0)`.as(
                        'review_count',
                    ),
                goodRatePercentage: sql<number>`CASE
                        WHEN COALESCE(${reviewStats.totalCount}, 0) = 0 THEN 0
                        ELSE ROUND(COALESCE(${reviewStats.goodCount}, 0)::decimal / ${reviewStats.totalCount} * 100, 2)
                    END`.as('good_rate_percentage'),
                ratingValue:
                    sql<number>`COALESCE(${reviewStats.averageRating}, 0) / 100.0`.as(
                        'rating_value',
                    ),
            })
            .from(servicePersonnel)
            .innerJoin(
                optimalPricingCTE,
                and(
                    eq(optimalPricingCTE.userId, servicePersonnel.userId),
                    sql`${optimalPricingCTE.rowNum} = 1`,
                ),
            )
            .leftJoin(
                reviewStats,
                and(
                    eq(reviewStats.targetId, servicePersonnel.userId),
                    sql`${reviewStats.targetType} = 'personnel'`,
                    eq(reviewStats.serviceId, optimalPricingCTE.serviceId),
                ),
            )
            .where(
                and(
                    eq(servicePersonnel.isAvailable, true),
                    ...(excludePersonnelUserId
                        ? [ne(servicePersonnel.userId, excludePersonnelUserId)]
                        : []),
                ),
            )
            .orderBy(asc(distanceSelect), asc(servicePersonnel.userId))
            .limit(limit + 1)
            .offset(offset);

        const hasMore = rows.length > limit;

        return {
            personnel: rows.slice(0, limit).map((row) => ({
                personnelId: row.personnelId,
                name: row.name ?? '服务人员',
                avatar: row.avatar?.trim() || null,
                serviceId: row.serviceId,
                serviceName: row.serviceName,
                pricingId: row.pricingId ?? undefined,
                minPrice: Number(row.minPrice ?? 0),
                distanceKm: Number(row.distanceKm ?? 0),
                addressText: row.addressText ?? '',
                workDays: row.workDays,
                workStartTime: row.workStartTime,
                workEndTime: row.workEndTime,
                tag: row.serviceName,
                reviewCount: Number(row.reviewCount ?? 0),
                goodRatePercentage: Number(row.goodRatePercentage ?? 0),
                ratingValue: Number(row.ratingValue ?? 0),
            })),
            page,
            limit,
            hasMore,
            nextPage: hasMore ? page + 1 : null,
        };
    }

    async updatePersonnelProfile(
        personnelId: string,
        payload: UpdateServicePersonnelProfileRequest,
    ) {
        const updates: Partial<typeof servicePersonnel.$inferInsert> = {};

        if (payload.name !== undefined) {
            const normalizedName = payload.name?.trim();
            updates.name = normalizedName ? normalizedName : null;
        }

        if (payload.avatar !== undefined) {
            const normalizedAvatar =
                typeof payload.avatar === 'string'
                    ? payload.avatar.trim()
                    : payload.avatar;
            updates.avatar = normalizedAvatar ? normalizedAvatar : null;
        }

        if (payload.emergencyContactPhone !== undefined) {
            const normalizedPhone =
                typeof payload.emergencyContactPhone === 'string'
                    ? payload.emergencyContactPhone.trim()
                    : payload.emergencyContactPhone;
            updates.emergencyContactPhone = normalizedPhone || null;
        }

        if (payload.emergencyContactName !== undefined) {
            const normalizedName =
                typeof payload.emergencyContactName === 'string'
                    ? payload.emergencyContactName.trim()
                    : payload.emergencyContactName;
            updates.emergencyContactName = normalizedName || null;
        }

        if (Object.keys(updates).length === 0) {
            return null;
        }

        const result = await this.db
            .update(servicePersonnel)
            .set(updates)
            .where(eq(servicePersonnel.userId, personnelId))
            .returning();

        return result[0] ?? null;
    }

    // /**
    //  * 批量获取服务人员技能信息
    //  */
    // private async getBatchPersonnelSkills(userIds: string[]) {
    //     if (userIds.length === 0) {
    //         return new Map<string, PersonnelSkill[]>();
    //     }

    //     // 一次查询获取所有技能信息，包含定价信息
    //     const allSkills = await this.db
    //         .select({
    //             userId: servicePersonnelSkills.userId,
    //             serviceId: servicePersonnelSkills.serviceId,
    //             category: serviceCategories.name,
    //             serviceName: services.name,
    //             serviceDescription: services.description,
    //             serviceCurrency: sql<string>`COALESCE(${servicePersonnelPricing.currency}, 'CNY')`,
    //             serviceActive: services.isActive,
    //             // 从servicePersonnelPricing表获取价格和时长
    //             pricingId: servicePersonnelPricing.id,
    //             price: servicePersonnelPricing.price,
    //             estimatedDurationMinutes:
    //                 servicePersonnelPricing.estimatedDurationMinutes,
    //         })
    //         .from(servicePersonnelSkills)
    //         .innerJoin(
    //             services,
    //             eq(services.id, servicePersonnelSkills.serviceId),
    //         )
    //         .innerJoin(
    //             serviceCategories,
    //             eq(services.categoryId, serviceCategories.id),
    //         )
    //         .leftJoin(
    //             servicePersonnelPricing,
    //             and(
    //                 eq(
    //                     servicePersonnelPricing.userId,
    //                     servicePersonnelSkills.userId,
    //                 ),
    //                 eq(
    //                     servicePersonnelPricing.serviceId,
    //                     servicePersonnelSkills.serviceId,
    //                 ),
    //                 eq(servicePersonnelPricing.isActive, true),
    //             ),
    //         )
    //         .where(inArray(servicePersonnelSkills.userId, userIds));

    //     // 在内存中按用户ID分组
    //     const skillsMap = new Map<string, PersonnelSkill[]>();

    //     for (const skill of allSkills) {
    //         const userId = skill.userId;
    //         if (!skillsMap.has(userId)) {
    //             skillsMap.set(userId, []);
    //         }

    //         skillsMap.get(userId)?.push({
    //             id: skill.serviceId,
    //             category: skill.category,
    //             name: skill.serviceName,
    //             description: skill.serviceDescription,
    //             basePrice: skill.price || '0', // 使用pricing表中的价格
    //             currency: skill.serviceCurrency || 'CNY',
    //             estimatedDurationMinutes: skill.estimatedDurationMinutes || 0,
    //             isActive: skill.serviceActive,
    //         });
    //     }

    //     return skillsMap;
    // }

    async getPersonnelServiceDetails(personnelId: string, serviceId: string) {
        const now = new Date();
        const query = await this.db.query.servicePersonnel.findFirst({
            where: and(eq(servicePersonnel.userId, personnelId)),
            columns: {
                geom: false,
            },
            with: {
                skills: {
                    where: eq(servicePersonnelSkills.serviceId, serviceId),
                },
                pricing: {
                    columns: {
                        createdAt: false,
                        updatedAt: false,
                        effectiveFrom: false,
                        effectiveTo: false,
                        isActive: false,
                    },
                    where: and(
                        eq(servicePersonnelPricing.serviceId, serviceId),
                        eq(servicePersonnelPricing.isActive, true),
                        // 有效期：from <= now 且 (to is null 或 to >= now)
                        sql`(${servicePersonnelPricing.effectiveFrom} IS NULL OR ${servicePersonnelPricing.effectiveFrom} <= ${now})`,
                        sql`(${servicePersonnelPricing.effectiveTo} IS NULL OR ${servicePersonnelPricing.effectiveTo} >= ${now})`,
                    ),
                },
            },
        });

        if (!query) {
            return null;
        }

        // 获取该用户已经被占用的时间段
        const occupiedTimeSlots =
            await this.orderRepository.getPersonnelOccupiedTimeSlots(
                personnelId,
            );

        // 安全地访问skills数组
        const firstSkill = query?.skills?.[0];

        // 人员存在但未提供该服务
        if (!firstSkill) {
            return null;
        }

        return {
            userId: query.userId,
            name: query.name?.trim() || null,
            avatar: query.avatar?.trim() || null,
            bio: query.bio,
            province: query.province,
            district: query.district,
            county: query.county,
            detailedAddress: query.detailedAddress,
            yearsOfExperience: query.yearsOfExperience,
            workStartTime: query.workStartTime,
            workEndTime: query.workEndTime,
            isAvailable: query.isAvailable,
            workDays: query.workDays,
            currentStatus: query.currentStatus,
            lastActiveAt: query.lastActiveAt,
            specifications: query.pricing ?? [],
            description: firstSkill.description || null,
            servicedCount: firstSkill.servicedCount || 0,
            galleryFileIds: firstSkill.galleryFileIds ?? [],
            occupiedTimeSlots,
        };
    }

}
