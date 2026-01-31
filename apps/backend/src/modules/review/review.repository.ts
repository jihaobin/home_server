import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { and, desc, eq, getTableColumns, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    reviews,
    reviewStats,
} from 'src/common/database/schema/reviews-social';
import { orders } from 'src/common/database/schema/orders';
import type { ReviewTargetType } from '@repo/types';
import { users } from 'src/common/database/schema';

@Injectable()
export class ReviewRepository {
    @Inject(DB)
    private readonly db: DbType;

    /**
     * 创建评价（包含统计更新，使用事务保证一致性）
     * @param reviewData 评价数据
     * @returns 创建的评价信息
     */
    async createReview(reviewData: {
        orderId: string;
        reviewerId: string;
        targetId: string;
        targetType: ReviewTargetType;
        rating: number;
        serviceQuality?: number;
        attitude?: number;
        punctuality?: number;
        comment?: string;
        isAnonymous?: boolean;
        imageIds?: string[];
    }) {
        try {
            // 使用事务确保评价创建和统计更新的原子性
            return await this.db.transaction(async (tx) => {
                // 检查订单是否存在并已完成
                const [order] = await tx
                    .select()
                    .from(orders)
                    .where(eq(orders.id, reviewData.orderId))
                    .limit(1);

                if (!order) {
                    throw new BadRequestException('订单不存在');
                }

                if (order.status !== 'completed') {
                    throw new BadRequestException('只能评价已完成的订单');
                }

                if (order.customerId !== reviewData.reviewerId) {
                    throw new BadRequestException('只能评价自己的订单');
                }

                // 检查该订单是否已经评价过
                const [existingReview] = await tx
                    .select()
                    .from(reviews)
                    .where(eq(reviews.orderId, reviewData.orderId))
                    .limit(1);

                if (existingReview) {
                    throw new BadRequestException('该订单已经评价过了');
                }

                // 创建评价（从订单中获取 serviceId）
                const [review] = await tx
                    .insert(reviews)
                    .values({
                        orderId: reviewData.orderId,
                        reviewerId: reviewData.reviewerId,
                        targetId: reviewData.targetId,
                        targetType: reviewData.targetType,
                        serviceId: order.serviceId, // 从订单中获取 serviceId
                        rating: reviewData.rating,
                        serviceQuality: reviewData.serviceQuality,
                        attitude: reviewData.attitude,
                        punctuality: reviewData.punctuality,
                        comment: reviewData.comment ?? '',
                        isAnonymous: reviewData.isAnonymous ?? false,
                        imageIds: reviewData.imageIds ?? [],
                    })
                    .returning();

                // 在同一事务中更新统计数据
                await this.updateReviewStatsInTransaction(
                    tx,
                    reviewData.targetId,
                    reviewData.targetType,
                    order.serviceId || '',
                );

                return review;
            });
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `创建评价失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 在事务中更新评分统计信息
     * 同时更新全局统计（serviceId='__all__'）和按服务统计
     * @param tx 事务实例
     * @param targetId 被评价对象 ID
     * @param targetType 被评价对象类型
     */
    private async updateReviewStatsInTransaction(
        tx: DbType,
        targetId: string,
        targetType: ReviewTargetType,
        serviceId: string,
    ) {
        const globalServiceId = '__all__';

        // 1. 更新全局统计（所有服务的总和）
        await this.upsertStatsForService(
            tx,
            targetId,
            targetType,
            globalServiceId,
        );

        // 2. 更新本次订单对应服务的统计
        await this.upsertStatsForService(tx, targetId, targetType, serviceId);
    }

    /**
     * 更新或插入特定服务的统计数据
     * @param tx 事务实例
     * @param targetId 被评价对象 ID
     * @param targetType 被评价对象类型
     * @param serviceId 服务ID，null表示全局统计
     */
    private async upsertStatsForService(
        tx: DbType,
        targetId: string,
        targetType: ReviewTargetType,
        serviceId: string,
    ) {
        const globalServiceId = '__all__';

        // 构建查询条件
        const conditions = [
            eq(reviews.targetId, targetId),
            eq(reviews.targetType, targetType),
        ];

        // '__all__' 表示全局汇总，不筛 serviceId；否则按服务聚合。
        if (serviceId !== globalServiceId) {
            conditions.push(eq(reviews.serviceId, serviceId));
        }

        // 聚合查询统计数据
        const stats = await tx
            .select({
                totalCount: sql<number>`COUNT(*)::int`,
                goodCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} >= 4)::int`,
                neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 3)::int`,
                badCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} <= 2)::int`,
                avgRating: sql<number>`COALESCE(ROUND(AVG(${reviews.rating}) * 100), 0)::int`,
                avgServiceQuality: sql<number>`COALESCE(ROUND(AVG(${reviews.serviceQuality}) * 100), 0)::int`,
                avgAttitude: sql<number>`COALESCE(ROUND(AVG(${reviews.attitude}) * 100), 0)::int`,
                avgPunctuality: sql<number>`COALESCE(ROUND(AVG(${reviews.punctuality}) * 100), 0)::int`,
                lastReviewAt: sql<string>`MAX(${reviews.createdAt})::text`,
            })
            .from(reviews)
            .where(and(...conditions));

        const stat = stats[0];

        if (!stat || stat.totalCount === 0) {
            // 如果没有评价，删除统计记录
            const deleteConditions = [
                eq(reviewStats.targetId, targetId),
                eq(reviewStats.targetType, targetType),
            ];

            deleteConditions.push(eq(reviewStats.serviceId, serviceId));

            await tx.delete(reviewStats).where(and(...deleteConditions));
            return;
        }

        // 将字符串转换为 Date 对象
        const lastReviewAt = stat.lastReviewAt
            ? new Date(stat.lastReviewAt)
            : null;

        // 更新或插入统计数据
        await tx
            .insert(reviewStats)
            .values({
                targetId,
                targetType,
                serviceId,
                totalCount: stat.totalCount,
                goodCount: stat.goodCount,
                neutralCount: stat.neutralCount,
                badCount: stat.badCount,
                averageRating: stat.avgRating,
                averageServiceQuality: stat.avgServiceQuality,
                averageAttitude: stat.avgAttitude,
                averagePunctuality: stat.avgPunctuality,
                lastReviewAt,
                updatedAt: new Date(),
            })
            .onConflictDoUpdate({
                target: [
                    reviewStats.targetId,
                    reviewStats.targetType,
                    reviewStats.serviceId,
                ],
                set: {
                    totalCount: stat.totalCount,
                    goodCount: stat.goodCount,
                    neutralCount: stat.neutralCount,
                    badCount: stat.badCount,
                    averageRating: stat.avgRating,
                    averageServiceQuality: stat.avgServiceQuality,
                    averageAttitude: stat.avgAttitude,
                    averagePunctuality: stat.avgPunctuality,
                    lastReviewAt,
                    updatedAt: new Date(),
                },
            });
    }

    /**
     * 获取用户已评价的对象列表（分组聚合）
     * @param reviewerId 评价者ID
     * @param page 页码
     * @param limit 每页数量
     * @param targetType 可选的目标类型过滤
     * @returns 已评价对象列表和分页信息
     */
    async getReviewerTargets(
        reviewerId: string,
        page: number,
        limit: number,
        targetType?: ReviewTargetType,
    ) {
        try {
            // 构建查询条件
            const conditions = [eq(reviews.reviewerId, reviewerId)];

            if (targetType) {
                conditions.push(eq(reviews.targetType, targetType));
            }

            // 构建聚合查询 - 按 targetId 和 targetType 分组
            const groupByQuery = this.db
                .select({
                    targetId: reviews.targetId,
                    targetType: reviews.targetType,
                    orderId: reviews.orderId,
                    latestReviewAt: sql<string>`MAX(${reviews.createdAt})::text`,
                    reviewCount: sql<number>`COUNT(*)::int`,
                    averageRating: sql<number>`AVG(${reviews.rating})`,
                    comment: reviews.comment,
                    imageId: reviews.imageIds,
                })
                .from(reviews)
                .where(and(...conditions))
                .groupBy(
                    reviews.targetId,
                    reviews.targetType,
                    reviews.orderId,
                    reviews.comment,
                    reviews.imageIds,
                )
                .orderBy(sql`MAX(${reviews.createdAt}) DESC`)
                .limit(limit)
                .offset((page - 1) * limit);

            // 执行查询
            const items = await groupByQuery;

            // 将字符串日期转换为 Date 对象
            const formattedItems = items.map((item) => ({
                ...item,
                latestReviewAt: item.latestReviewAt
                    ? new Date(item.latestReviewAt)
                    : null,
            }));

            // 计算总数
            const countQuery = await this.db
                .select({
                    count: sql<number>`COUNT(DISTINCT (${reviews.targetId}, ${reviews.targetType}))::int`,
                })
                .from(reviews)
                .where(and(...conditions));

            const total = countQuery[0]?.count ?? 0;

            return {
                items: formattedItems,
                total,
                page,
                limit,
            };
        } catch (error) {
            throw new BadRequestException(
                `获取已评价对象列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取用户针对某个对象的所有评价
     * @param reviewerId 评价者ID
     * @param targetId 目标对象ID
     * @param targetType 目标对象类型
     * @returns 评价列表
     */
    async getReviewsByTarget(
        reviewerId: string,
        targetId: string,
        targetType: ReviewTargetType,
    ) {
        try {
            const reviewList = await this.db
                .select()
                .from(reviews)
                .where(
                    and(
                        eq(reviews.reviewerId, reviewerId),
                        eq(reviews.targetId, targetId),
                        eq(reviews.targetType, targetType),
                    ),
                )
                .orderBy(desc(reviews.createdAt));

            return reviewList;
        } catch (error) {
            throw new BadRequestException(
                `获取评价列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 根据评价ID获取单个评价详情
     * @param reviewId 评价ID
     * @returns 评价详情
     */
    async getReviewById(reviewId: string) {
        try {
            const [review] = await this.db
                .select()
                .from(reviews)
                .where(eq(reviews.id, reviewId))
                .limit(1);

            return review || null;
        } catch (error) {
            throw new BadRequestException(
                `获取评价详情失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 根据订单ID获取用户的评价
     * @param orderId 订单ID
     * @param reviewerId 评价者ID
     * @returns 评价详情
     */
    async getReviewByOrder(orderId: string, reviewerId: string) {
        try {
            const [review] = await this.db
                .select()
                .from(reviews)
                .where(
                    and(
                        eq(reviews.orderId, orderId),
                        eq(reviews.reviewerId, reviewerId),
                    ),
                )
                .limit(1);

            return review || null;
        } catch (error) {
            throw new BadRequestException(
                `获取订单评价失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取服务/服务人员的评价（公开接口）
     * @param targetId 目标对象ID
     * @param targetType 目标对象类型
     * @param page 页码
     * @param limit 每页数量
     * @param serviceId 可选的服务ID过滤
     * @returns 评价列表和分页信息
     */
    async getReviewsByTargetPublic(
        targetId: string,
        targetType: ReviewTargetType,
        page: number,
        limit: number,
        serviceId?: string,
    ) {
        try {
            // 构建查询条件
            const conditions = [
                eq(reviews.targetId, targetId),
                eq(reviews.targetType, targetType),
            ];

            // 如果指定了 serviceId，添加服务过滤条件
            if (serviceId) {
                conditions.push(eq(reviews.serviceId, serviceId));
            }

            const reviewColumns = getTableColumns(reviews);
            const userColumns = getTableColumns(users);

            // 查询评价列表
            const reviewList = await this.db
                .select({
                    ...reviewColumns,
                    reviewerName: userColumns.name,
                    reviewerAvatar: userColumns.image,
                })
                .from(reviews)
                .leftJoin(users, eq(reviews.reviewerId, users.id))
                .where(and(...conditions))
                .orderBy(desc(reviews.createdAt))
                .limit(limit)
                .offset((page - 1) * limit);

            // 计算总数
            const totalCount = await this.db.$count(
                reviews,
                and(...conditions),
            );

            return {
                items: reviewList,
                total: totalCount,
                page,
                limit,
            };
        } catch (error) {
            throw new BadRequestException(
                `获取评价列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取评价统计信息
     * @param targetId 目标对象ID
     * @param targetType 目标对象类型
     * @param serviceId 可选的服务ID，不提供则返回全局统计
     * @returns 统计信息
     */
    async getReviewStats(
        targetId: string,
        targetType: ReviewTargetType,
        serviceId?: string,
    ) {
        try {
            // 构建查询条件
            const conditions = [
                eq(reviewStats.targetId, targetId),
                eq(reviewStats.targetType, targetType),
            ];

            if (serviceId) {
                conditions.push(eq(reviewStats.serviceId, serviceId));
            } else {
                conditions.push(sql`${reviewStats.serviceId} IS NULL`);
            }

            const [stats] = await this.db
                .select()
                .from(reviewStats)
                .where(and(...conditions));

            return (
                stats || {
                    targetId: '',
                    targetType: 'personnel',
                    serviceId: null,
                    totalCount: 0,
                    goodCount: 0,
                    neutralCount: 0,
                    badCount: 0,
                    averageRating: 0,
                    averageServiceQuality: null,
                    averageAttitude: null,
                    averagePunctuality: null,
                    lastReviewAt: null,
                    updatedAt: null,
                }
            );
        } catch (error) {
            throw new BadRequestException(
                `获取评价统计失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取评分等级（好评/中评/差评）
     * @param rating - 评分（1-5）
     * @returns 'good' | 'neutral' | 'bad'
     */
    private getRatingLevel(rating: number): 'good' | 'neutral' | 'bad' | null {
        if (rating >= 4) return 'good';
        if (rating === 3) return 'neutral';
        if (rating >= 1 && rating <= 2) return 'bad';
        return null;
    }
}
