import { Inject, Injectable } from '@nestjs/common';
import type {
    PersonnelSkill,
    ServicePersonnelFilterRequest,
} from '@repo/types';
import {
    and,
    asc,
    between,
    desc,
    eq,
    gte,
    inArray,
    like,
    lte,
    type SQL,
    sql,
} from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    serviceCategories,
    servicePersonnel,
    servicePersonnelPricing,
    servicePersonnelSkills,
    services,
    users,
} from 'src/common/database/schema';
import { GeoLocationService } from 'src/common/services/geo-location.service';
import { extractParams } from 'src/lib/utlis';

@Injectable()
export class ServicePersonnelRepository {
    constructor(
        @Inject(DB) private readonly db: DbType,
        private readonly geoService: GeoLocationService,
    ) {}

    /**
     * 🚀 智能匹配服务人员 - 优化版本
     * 使用 CTE 和窗口函数优化查询性能，单次查询获取所有数据
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

        // 基础筛选条件
        const baseConditions = [
            eq(servicePersonnelPricing.serviceId, serviceId),
            eq(servicePersonnelPricing.isActive, true),
            eq(servicePersonnel.isAvailable, true), // 恢复可用性检查
            sql`${servicePersonnel.geom} IS NOT NULL`, // 恢复地理位置检查
        ];

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

        // 价格区间筛选
        if (minPrice !== undefined && maxPrice !== undefined) {
            baseConditions.push(
                between(
                    servicePersonnelPricing.price,
                    minPrice.toString(),
                    maxPrice.toString(),
                ),
            );
        } else if (minPrice !== undefined) {
            baseConditions.push(
                gte(servicePersonnelPricing.price, minPrice.toString()),
            );
        } else if (maxPrice !== undefined) {
            baseConditions.push(
                lte(servicePersonnelPricing.price, maxPrice.toString()),
            );
        }

        // 地理位置筛选
        if (maxDistance) {
            baseConditions.push(distancePreFilter, exactFilter);
        }

        // 构建排序表达式
        const orderByColumn = this.getOrderByColumn(sortBy, exactDistance);
        const orderExpression =
            sortOrder === 'desc' ? desc(orderByColumn) : asc(orderByColumn);

        // 使用 CTE (Common Table Expression) 优化查询
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
                    price: servicePersonnelPricing.price,
                    currency: servicePersonnelPricing.currency,
                    name: users.name,
                    avatarUrl: users.image,
                    distance: exactDistance.as('distance'),
                    // 使用窗口函数计算总数
                    totalCount: sql<number>`COUNT(*) OVER()`.as('total_count'),
                })
                .from(servicePersonnel)
                .innerJoin(users, eq(users.id, servicePersonnel.userId))
                .innerJoin(
                    servicePersonnelPricing,
                    eq(servicePersonnelPricing.userId, servicePersonnel.userId),
                )
                .where(and(...baseConditions))
                .orderBy(orderExpression),
        );

        // 主查询：获取分页数据
        const paginatedResults = await this.db
            .with(filteredPersonnelCTE)
            .select()
            .from(filteredPersonnelCTE)
            .limit(pageSize)
            .offset((page - 1) * pageSize);

        const total = paginatedResults[0]?.totalCount || 0;
        const userIds = paginatedResults.map((r) => r.userId);

        // 批量获取技能信息
        const allSkillsMap = await this.getBatchPersonnelSkills(userIds);

        // 组装最终结果
        const personnel = paginatedResults.map((result) => ({
            name: result.name,
            userId: result.userId,
            province: result.province,
            district: result.district,
            county: result.county,
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
            skills: allSkillsMap.get(result.userId) ?? [],
            avatarUrl: result.avatarUrl || undefined,
        }));

        return {
            items: personnel,
            total: Number(total),
            page,
            limit: pageSize,
        };
    }

    /**
     * 排序逻辑 - 针对 CTE 内部使用优化
     */
    private getOrderByColumn(sortBy: string, exactDistance: SQL) {
        switch (sortBy) {
            case 'distance':
                return exactDistance;
            case 'price':
                // 使用 COALESCE 处理空值，DECIMAL 字段转换为数值进行排序
                return sql`COALESCE(CAST(${servicePersonnelPricing.price} AS DECIMAL(18,2)), 999999)`.as(
                    'price_sort',
                );
            case 'experience':
                return servicePersonnel.yearsOfExperience;
            case 'rating':
                // TODO: 当评分系统实现后，这里应该关联评分表
                return servicePersonnel.lastActiveAt;
            default:
                return exactDistance;
        }
    }

    /**
     * 批量获取服务人员技能信息
     */
    private async getBatchPersonnelSkills(userIds: string[]) {
        if (userIds.length === 0) {
            return new Map<string, PersonnelSkill[]>();
        }

        // 一次查询获取所有技能信息
        const allSkills = await this.db
            .select({
                userId: servicePersonnelSkills.userId,
                serviceId: servicePersonnelSkills.serviceId,
                category: serviceCategories.name,
                serviceName: services.name,
                serviceDescription: services.description,
                serviceBasePrice: services.basePrice,
                serviceCurrency: services.currency,
                serviceDuration: services.estimatedDurationMinutes,
                serviceActive: services.isActive,
            })
            .from(servicePersonnelSkills)
            .innerJoin(
                services,
                eq(services.id, servicePersonnelSkills.serviceId),
            )
            .innerJoin(
                serviceCategories,
                eq(services.categoryId, serviceCategories.id),
            )
            .where(inArray(servicePersonnelSkills.userId, userIds));

        // 在内存中按用户ID分组
        const skillsMap = new Map<string, PersonnelSkill[]>();

        for (const skill of allSkills) {
            const userId = skill.userId;
            if (!skillsMap.has(userId)) {
                skillsMap.set(userId, []);
            }

            skillsMap.get(userId)!.push({
                id: skill.serviceId,
                category: skill.category,
                name: skill.serviceName,
                description: skill.serviceDescription,
                basePrice: skill.serviceBasePrice,
                currency: skill.serviceCurrency,
                estimatedDurationMinutes: skill.serviceDuration || 0,
                isActive: skill.serviceActive,
            });
        }

        return skillsMap;
    }
}
