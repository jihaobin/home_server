import { Injectable, NotFoundException } from '@nestjs/common';
import type {
    MassageLandingQuery,
    MassageLandingResponse,
    MassagePersonnelDetailQuery,
    MassagePersonnelDetailResponse,
} from '@repo/types';
import { FilesService } from '../files/files.service';
import { FollowService } from '../follow/follow.service';
import { ReviewService } from '../review/review.service';
import { MassageRepository } from './massage.repository';

@Injectable()
export class MassageService {
    constructor(
        private readonly repository: MassageRepository,
        private readonly filesService: FilesService,
        private readonly followService: FollowService,
        private readonly reviewService: ReviewService,
    ) {}

    private normalizeScore(value?: number | null) {
        if (value === null || value === undefined) {
            return null;
        }

        return value > 10 ? Number((value / 100).toFixed(2)) : value;
    }

    private async resolveFile(
        fileId?: string | null,
        fallback?: { url?: string | null; blurhash?: string | null },
    ) {
        if (!fileId) {
            return fallback?.url
                ? {
                      url: fallback.url,
                      blurhash: fallback.blurhash ?? null,
                  }
                : null;
        }

        try {
            const info = await this.filesService.getFileAccessInfo(fileId);
            return {
                url: info.fileUrl,
                blurhash: info.blurhash ?? null,
            };
        } catch {
            return fallback?.url
                ? {
                      url: fallback.url,
                      blurhash: fallback.blurhash ?? null,
                  }
                : null;
        }
    }

    private async resolveGalleryImages(
        services: Array<{
            serviceId: string;
            galleryFileIds: string[];
        }>,
        selectedServiceId?: string | null,
    ) {
        const candidateServices = [
            ...services.filter((service) => service.serviceId === selectedServiceId),
            ...services.filter((service) => service.serviceId !== selectedServiceId),
        ];
        const gallerySource =
            candidateServices.find((service) => service.galleryFileIds.length > 0)
                ?.galleryFileIds ?? [];

        const images = await Promise.all(
            gallerySource.map((fileId) => this.resolveFile(fileId)),
        );

        return images.filter(Boolean) as Array<{
            url: string;
            blurhash: string | null;
        }>;
    }

    async getLanding(
        userId: string | undefined,
        query: MassageLandingQuery,
    ): Promise<MassageLandingResponse> {
        const [banner, tagEntries, personnelBuckets] = await Promise.all([
            this.repository.getLandingBanner(),
            this.repository.getLandingTagEntries(),
            this.repository.getLandingPersonnelBuckets(userId, query),
        ]);

        const bannerImage = banner?.imageFileId
            ? await this.resolveFile(banner.imageFileId)
            : null;

        return {
            banner: banner
                ? {
                      title: banner.title ?? null,
                      imageUrl: bannerImage?.url ?? null,
                      imageBlurhash: bannerImage?.blurhash ?? null,
                      linkType:
                          banner.linkType === 'url'
                              ? 'url'
                              : banner.linkType === 'none'
                                ? 'none'
                                : 'route',
                      linkTarget: banner.linkTarget ?? null,
                  }
                : null,
            tagEntries,
            newcomerPersonnel: personnelBuckets.newcomerPersonnel,
            recommendedPersonnel: personnelBuckets.recommendedPersonnel,
        };
    }

    async getTags() {
        return await this.repository.getLandingTagEntries();
    }

    async getPersonnelDetail(
        userId: string | undefined,
        personnelId: string,
        query: MassagePersonnelDetailQuery,
    ): Promise<MassagePersonnelDetailResponse> {
        const base = await this.repository.getPersonnelDetailBase(
            personnelId,
            query,
        );

        if (!base) {
            throw new NotFoundException('按摩服务人员不存在');
        }

        const [yearlyOrderCount, favoriteSummary, topReviews, reviewStats] =
            await Promise.all([
                this.repository.getPersonnelYearlyOrderCount(personnelId),
                this.followService.getPersonnelFavoriteSummary(
                    personnelId,
                    userId,
                ),
                this.reviewService.getTopReviewsByTarget(
                    personnelId,
                    'personnel',
                    {
                        serviceId: query.serviceId,
                        limit: 5,
                    },
                ),
                base.reviewSummary
                    ? Promise.resolve(null)
                    : this.reviewService.getReviewStats(
                          personnelId,
                          'personnel',
                          query.serviceId,
                      ),
            ]);

        const [avatar, galleryImages, services] = await Promise.all([
            this.resolveFile(base.avatarFileId, {
                url: base.avatarUrl,
                blurhash: base.avatarBlurhash,
            }),
            this.resolveGalleryImages(base.services, query.serviceId),
            Promise.all(
                base.services.map(async (service) => {
                    const image = await this.resolveFile(service.imageFileId, {
                        url: service.imageUrl,
                        blurhash: service.imageBlurhash,
                    });

                    return {
                        serviceId: service.serviceId,
                        serviceName: service.serviceName,
                        pricingId: service.pricingId,
                        tags: service.tags,
                        durationMinutes: service.durationMinutes,
                        price: service.price,
                        originalPrice: service.originalPrice,
                        imageUrl: image?.url ?? null,
                        imageBlurhash: image?.blurhash ?? null,
                        actionLabel: service.actionLabel,
                        highlightLabel: service.highlightLabel ?? null,
                    };
                }),
            ),
        ]);

        const resolvedReviewSummary = base.reviewSummary
            ? base.reviewSummary
            : {
                  averageRating:
                      this.normalizeScore(reviewStats?.averageRating) ?? 5,
                  totalReviews: reviewStats?.totalCount ?? 0,
                  averageAttitude:
                      this.normalizeScore(reviewStats?.averageAttitude) ?? null,
                  averageSkill:
                      this.normalizeScore(reviewStats?.averageServiceQuality) ??
                      null,
                  customerSatisfactionRate:
                      reviewStats?.goodRatePercentage ?? 0,
              };

        return {
            personnelId: base.personnelId,
            personnelName: base.personnelName,
            avatarUrl: avatar?.url ?? null,
            avatarBlurhash: avatar?.blurhash ?? null,
            galleryImages,
            addressText: base.addressText,
            distanceText: base.distanceText,
            availableTimeText: base.availableTimeText,
            yearlyOrderCount,
            favoriteCount: favoriteSummary.favoriteCount,
            isFavorited: favoriteSummary.isFavorited,
            description: base.description,
            guaranteeItems: base.guaranteeItems,
            stats: {
                yearsOfExperience: base.stats.yearsOfExperience,
                averageServiceQuality:
                    base.stats.averageServiceQuality ??
                    resolvedReviewSummary.averageSkill,
                repurchaseRate: base.stats.repurchaseRate,
                goodRatePercentage:
                    base.stats.goodRatePercentage ||
                    resolvedReviewSummary.customerSatisfactionRate,
            },
            reviewSummary: resolvedReviewSummary,
            services,
            topReviews: topReviews.map((review: any) => ({
                id: review.id,
                rating: this.normalizeScore(review.rating) ?? 5,
                ratingLabel: review.ratingLabel ?? null,
                comment: review.comment ?? '',
                reviewerName: review.reviewerName ?? null,
                createdAt:
                    review.createdAt instanceof Date
                        ? review.createdAt.toISOString()
                        : String(review.createdAt ?? ''),
                images: (review.images ?? []).map((image: any) => ({
                    url: image.url,
                    blurhash: image.blurhash ?? null,
                })),
            })),
        };
    }
}
