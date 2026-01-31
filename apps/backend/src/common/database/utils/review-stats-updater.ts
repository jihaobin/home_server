import { eq, and, sql } from 'drizzle-orm';
import type { NodePgDatabase } from 'drizzle-orm/node-postgres';
import type { ReviewTargetType } from '@repo/types';
import { reviews, reviewStats } from '../schema';

/**
 * 评分统计更新工具
 * 用于在添加、更新或删除评价时，自动更新 review_stats 表
 */

/**
 * 更新指定目标的评分统计信息
 * @param db - 数据库连接实例
 * @param targetId - 被评价对象 ID
 * @param targetType - 被评价对象类型
 */
export async function updateReviewStats(
    db: NodePgDatabase<any>,
    targetId: string,
    targetType: ReviewTargetType,
    serviceId: string = '__all__',
) {
    const globalServiceId = '__all__';

    const conditions = [
        eq(reviews.targetId, targetId),
        eq(reviews.targetType, targetType),
    ];
    if (serviceId !== globalServiceId) {
        conditions.push(eq(reviews.serviceId, serviceId));
    }

    // 聚合查询该目标的所有评价数据
    const stats = await db
        .select({
            totalCount: sql<number>`COUNT(*)::int`,
            goodCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} >= 4)::int`,
            neutralCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} = 3)::int`,
            badCount: sql<number>`COUNT(*) FILTER (WHERE ${reviews.rating} <= 2)::int`,
            avgRating: sql<number>`COALESCE(ROUND(AVG(${reviews.rating}) * 100), 0)::int`,
            avgServiceQuality: sql<number>`COALESCE(ROUND(AVG(${reviews.serviceQuality}) * 100), 0)::int`,
            avgAttitude: sql<number>`COALESCE(ROUND(AVG(${reviews.attitude}) * 100), 0)::int`,
            avgPunctuality: sql<number>`COALESCE(ROUND(AVG(${reviews.punctuality}) * 100), 0)::int`,
            lastReviewAt: sql<Date>`MAX(${reviews.createdAt})`,
        })
        .from(reviews)
        .where(and(...conditions));

    const stat = stats[0];

    if (!stat || stat.totalCount === 0) {
        // 如果没有评价，删除统计记录
        await db
            .delete(reviewStats)
            .where(
                and(
                    eq(reviewStats.targetId, targetId),
                    eq(reviewStats.targetType, targetType),
                    eq(reviewStats.serviceId, serviceId),
                ),
            );
        return;
    }

    // 更新或插入统计数据
    await db
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
            lastReviewAt: stat.lastReviewAt,
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
                lastReviewAt: stat.lastReviewAt,
                updatedAt: new Date(),
            },
        });
}

/**
 * 批量更新多个目标的评分统计
 * @param db - 数据库连接实例
 * @param targets - 目标列表
 */
export async function batchUpdateReviewStats(
    db: NodePgDatabase<any>,
    targets: Array<{ targetId: string; targetType: ReviewTargetType }>,
    serviceId: string = '__all__',
) {
    for (const target of targets) {
        await updateReviewStats(
            db,
            target.targetId,
            target.targetType,
            serviceId,
        );
    }
}

/**
 * 计算好评率（百分比）
 * @param goodCount - 好评数
 * @param totalCount - 总评价数
 * @returns 好评率百分比（0-100）
 */
export function calculateGoodRatePercentage(
    goodCount: number,
    totalCount: number,
): number {
    if (totalCount === 0) return 0;
    return Math.round((goodCount / totalCount) * 100);
}
