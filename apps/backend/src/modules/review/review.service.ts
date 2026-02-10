import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import type {
    CreateReviewBody,
    ReviewerTargetsQuery,
    ReviewStats,
    ReviewTargetType,
    TargetReviewsQuery,
} from '@repo/types';
import { calculateGoodRatePercentage } from '../../common/database/utils/review-stats-updater';
import { ReviewRepository } from './review.repository';
import { FilesService } from '../files/files.service';

@Injectable()
export class ReviewService {
    @Inject(ReviewRepository)
    private readonly reviewRepository: ReviewRepository;
    @Inject(FilesService)
    private readonly filesService: FilesService;

    private async decorateReviewsForPublic(items: any[]) {
        const fileIds = items
            .map((item) => item.imageIds)
            .flat()
            .filter(Boolean);

        const imageInfoMap = new Map<
            string,
            { url: string; blurhash?: string }
        >();
        if (fileIds.length > 0) {
            const imageInfoList = await Promise.all(
                fileIds.map(async (id: string) => {
                    try {
                        const image =
                            await this.filesService.getFileAccessInfo(id);
                        return {
                            id,
                            url: image.fileUrl,
                            blurhash: image.blurhash,
                        };
                    } catch (_error) {
                        return null;
                    }
                }),
            );

            imageInfoList.forEach((info) => {
                if (info) {
                    imageInfoMap.set(info.id, {
                        url: info.url,
                        blurhash: info.blurhash,
                    });
                }
            });
        }

        const isHttpUrl = (value: string) =>
            value.startsWith('http://') || value.startsWith('https://');

        const avatarFileIds = Array.from(
            new Set(
                items
                    .map((item) => (item.reviewerAvatarFileId ?? '').trim())
                    .filter((id: string) => Boolean(id) && !isHttpUrl(id)),
            ),
        );

        const avatarInfoMap = new Map<
            string,
            { url: string; blurhash?: string }
        >();
        await Promise.all(
            avatarFileIds.map(async (fileId) => {
                try {
                    const info =
                        await this.filesService.getFileAccessInfo(fileId);
                    avatarInfoMap.set(fileId, {
                        url: info.fileUrl,
                        blurhash: info.blurhash,
                    });
                } catch (_error) {
                    // ignore
                }
            }),
        );

        const maskPhone = (value: unknown): string | null => {
            if (typeof value !== 'string') return null;
            const v = value.trim();
            if (v.length < 7) return null;
            return `${v.slice(0, 3)}****${v.slice(-4)}`;
        };

        return items.map((item) => {
            const isAnonymous = Boolean(item.isAnonymous);
            const reviewerPhoneMasked = isAnonymous
                ? null
                : maskPhone(item.reviewerPhoneNumber);

            const avatarIdentifier = (item.reviewerAvatarFileId ?? '').trim();
            const reviewerAvatar = isAnonymous
                ? null
                : !avatarIdentifier
                  ? null
                  : isHttpUrl(avatarIdentifier)
                    ? { url: avatarIdentifier }
                    : (avatarInfoMap.get(avatarIdentifier) ?? null);

            // omit internal join-only fields
            const {
                reviewerAvatarFileId: _reviewerAvatarFileId,
                reviewerPhoneNumber: _reviewerPhoneNumber,
                ...rest
            } = item;

            return {
                ...rest,
                images: (item.imageIds || [])
                    .map((id: string) => imageInfoMap.get(id))
                    .filter(Boolean) as Array<{
                    url: string;
                    blurhash?: string;
                }>,
                reviewerAvatar,
                reviewerName: isAnonymous ? null : item.reviewerName || null,
                reviewerPhoneMasked,
            };
        });
    }

    /**
     * 创建评价
     * @param reviewData 评价数据
     * @param reviewerId 评价者ID（从认证信息中获取）
     * @returns 创建的评价信息
     */
    async createReview(reviewData: CreateReviewBody, reviewerId: string) {
        // 参数验证
        if (!reviewData.orderId) {
            throw new BadRequestException('订单ID不能为空');
        }

        if (!reviewData.targetId) {
            throw new BadRequestException('被评价对象ID不能为空');
        }

        if (!reviewData.rating) {
            throw new BadRequestException('评分不能为空');
        }

        try {
            // 创建评价（Repository 层会在事务中同时更新统计数据）
            const review = await this.reviewRepository.createReview({
                orderId: reviewData.orderId,
                reviewerId: reviewerId,
                targetId: reviewData.targetId,
                targetType: reviewData.targetType,
                rating: reviewData.rating,
                serviceQuality: reviewData.serviceQuality,
                attitude: reviewData.attitude,
                punctuality: reviewData.punctuality,
                comment: reviewData.comment,
                isAnonymous: reviewData.isAnonymous,
                imageIds: reviewData.imageIds,
            });

            return {
                ...review,
                images: [],
            };
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
     * 获取用户已评价的对象列表
     * @param query 查询参数
     * @param reviewerId 评价者ID（从认证信息中获取）
     * @returns 已评价对象列表和分页信息
     */
    async getReviewerTargets(query: ReviewerTargetsQuery, reviewerId: string) {
        try {
            const result = await this.reviewRepository.getReviewerTargets(
                reviewerId,
                query.page,
                query.limit,
                query.targetType,
            );

            // 获取所有图片ID
            const fileIds = result.items
                .map((item) => item.imageId)
                .flat()
                .filter(Boolean);

            // 批量获取图片访问信息
            const imageInfoMap = new Map<
                string,
                { url: string; blurhash?: string }
            >();

            if (fileIds.length > 0) {
                const imageInfoList = await Promise.all(
                    fileIds.map(async (id) => {
                        try {
                            const image =
                                await this.filesService.getFileAccessInfo(id);
                            return {
                                id,
                                url: image.fileUrl,
                                blurhash: image.blurhash,
                            };
                        } catch (_error) {
                            // 如果某个图片获取失败，返回null
                            return null;
                        }
                    }),
                );

                // 创建图片ID到图片信息的映射
                imageInfoList.forEach((info) => {
                    if (info) {
                        imageInfoMap.set(info.id, {
                            url: info.url,
                            blurhash: info.blurhash,
                        });
                    }
                });
            }

            // 将图片信息映射到评价对象中
            const itemsWithImages = result.items.map((item) => ({
                ...item,
                images: (item.imageId || [])
                    .map((id) => imageInfoMap.get(id))
                    .filter(Boolean) as Array<{
                    url: string;
                    blurhash?: string;
                }>,
            }));

            return {
                items: itemsWithImages,
                total: result.total,
                page: result.page,
                limit: result.limit,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `获取已评价对象列表失败: ${error instanceof Error ? error.message : String(error)}`,
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
            const review = await this.reviewRepository.getReviewByOrder(
                orderId,
                reviewerId,
            );

            if (!review) {
                return null;
            }

            const imageIds = review.imageIds || [];
            const images = await Promise.all(
                imageIds.map(async (id) => {
                    try {
                        const image =
                            await this.filesService.getFileAccessInfo(id);
                        return {
                            url: image.fileUrl,
                            blurhash: image.blurhash,
                        };
                    } catch (_error) {
                        return null;
                    }
                }),
            );

            const validImages = images.filter(
                (img): img is { url: string; blurhash: string | undefined } =>
                    Boolean(img),
            );

            return {
                ...review,
                images: validImages,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `获取订单评价失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取服务/服务人员的评价（公开接口）
     * @param targetId 目标对象ID
     * @param targetType 目标对象类型
     * @param query 查询参数（包含分页和可选的服务过滤）
     * @returns 评价列表和分页信息
     */
    async getReviewsByTarget(
        targetId: string,
        targetType: 'personnel' | 'shop',
        query: TargetReviewsQuery & {
            tab?: 'all' | 'latest' | 'photos' | 'positive' | 'negative';
        },
    ) {
        try {
            const result = await this.reviewRepository.getReviewsByTargetPublic(
                targetId,
                targetType,
                query.page,
                query.limit,
                query.serviceId,
                query.tab,
            );

            const items = await this.decorateReviewsForPublic(result.items);

            return {
                items,
                total: result.total,
                page: result.page,
                limit: result.limit,
            };
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `获取评价列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取 Top 评价（用于其它聚合接口）
     * 固定返回最多 limit 条，并补齐 images（预签名 URL + blurhash）与展示用 reviewer 字段。
     */
    async getTopReviewsByTarget(
        targetId: string,
        targetType: 'personnel' | 'shop',
        options: { serviceId?: string; limit?: number } = {},
    ) {
        const limit = options.limit ?? 5;

        const result = await this.reviewRepository.getTopReviewsByTargetPublic(
            targetId,
            targetType,
            limit,
            options.serviceId,
        );

        return await this.decorateReviewsForPublic(result.items);
    }

    /**
     * 获取评价统计信息
     * @param targetId 目标对象ID
     * @param targetType 目标对象类型
     * @param serviceId 可选的服务ID，不提供则返回全局统计
     * @returns 格式化的统计信息
     */
    async getReviewStats(
        targetId: string,
        targetType: ReviewTargetType,
        serviceId?: string,
    ): Promise<ReviewStats> {
        try {
            const stats = await this.reviewRepository.getReviewStats(
                targetId,
                targetType,
                serviceId,
            );

            const photoCount =
                (stats as unknown as { photoCount?: number }).photoCount ?? 0;

            // 计算好评率
            const goodRatePercentage = calculateGoodRatePercentage(
                stats.goodCount,
                stats.totalCount,
            );

            // 格式化平均评分（从整数还原为小数，保留两位小数）
            const averageRatingDisplay = (stats.averageRating / 100).toFixed(2);

            return {
                targetId: stats.targetId,
                targetType: stats.targetType,
                serviceId: stats.serviceId,
                totalCount: stats.totalCount,
                photoCount,
                goodCount: stats.goodCount,
                neutralCount: stats.neutralCount,
                badCount: stats.badCount,
                averageRating: stats.averageRating,
                averageRatingDisplay,
                averageServiceQuality: stats.averageServiceQuality,
                averageAttitude: stats.averageAttitude,
                averagePunctuality: stats.averagePunctuality,
                goodRatePercentage,
                lastReviewAt: stats.lastReviewAt,
            } as unknown as ReviewStats;
        } catch (error) {
            if (error instanceof BadRequestException) {
                throw error;
            }
            throw new BadRequestException(
                `获取评价统计失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
