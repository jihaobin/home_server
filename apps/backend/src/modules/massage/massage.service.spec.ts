import { MassageService } from './massage.service';
import type { MassageRepository } from './massage.repository';
import type { FilesService } from '../files/files.service';
import type { FollowService } from '../follow/follow.service';
import type { ReviewService } from '../review/review.service';

type MockMassageRepository = jest.Mocked<
    Pick<
        MassageRepository,
        | 'getLandingBanner'
        | 'getLandingTagEntries'
        | 'getLandingPersonnelBuckets'
        | 'getPersonnelDetailBase'
        | 'getPersonnelYearlyOrderCount'
    >
>;

describe('MassageService', () => {
    let service: MassageService;
    let repository: MockMassageRepository;
    let filesService: jest.Mocked<Pick<FilesService, 'getFileAccessInfo'>>;
    let followService: jest.Mocked<
        Pick<FollowService, 'getPersonnelFavoriteSummary'>
    >;
    let reviewService: jest.Mocked<
        Pick<ReviewService, 'getReviewStats' | 'getTopReviewsByTarget'>
    >;

    beforeEach(() => {
        repository = {
            getLandingBanner: jest.fn(),
            getLandingTagEntries: jest.fn(),
            getLandingPersonnelBuckets: jest.fn(),
            getPersonnelDetailBase: jest.fn(),
            getPersonnelYearlyOrderCount: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
        };
        followService = {
            getPersonnelFavoriteSummary: jest.fn(),
        };
        reviewService = {
            getReviewStats: jest.fn(),
            getTopReviewsByTarget: jest.fn(),
        };

        service = new MassageService(
            repository as unknown as MassageRepository,
            filesService as unknown as FilesService,
            followService as unknown as FollowService,
            reviewService as unknown as ReviewService,
        );
    });

    it('getLanding 返回真实 tagEntries 而不是旧 categories', async () => {
        repository.getLandingBanner.mockResolvedValue(null);
        repository.getLandingTagEntries.mockResolvedValue([
            {
                tagId: 'service_tag_massage_health',
                tagName: '保健',
                tagSlug: 'health',
                domain: 'massage',
                serviceCount: 2,
            },
        ]);
        repository.getLandingPersonnelBuckets.mockResolvedValue({
            newcomerPersonnel: [],
            recommendedPersonnel: [],
        });

        const result = await service.getLanding(undefined, {});

        expect(result.tagEntries).toEqual([
            expect.objectContaining({
                tagId: 'service_tag_massage_health',
                tagName: '保健',
            }),
        ]);
        expect(result).not.toHaveProperty('categories');
    });

    it('detail 在当前服务没有 gallery 时回退到同技师其他服务的 gallery', async () => {
        repository.getPersonnelDetailBase.mockResolvedValue({
            personnelId: 'personnel_1',
            personnelName: '王师傅',
            avatarFileId: null,
            avatarUrl: null,
            avatarBlurhash: null,
            selectedServiceId: 'svc_1',
            selectedPricingId: 'price_1',
            addressText: '黄冈市',
            distanceText: null,
            availableTimeText: null,
            description: '擅长中式推拿',
            guaranteeItems: [],
            stats: {
                yearsOfExperience: 1,
                averageServiceQuality: null,
                repurchaseRate: null,
                goodRatePercentage: 100,
            },
            reviewSummary: {
                averageRating: 5,
                totalReviews: 1,
                averageAttitude: 5,
                averageSkill: 5,
                customerSatisfactionRate: 100,
            },
            services: [
                {
                    serviceId: 'svc_1',
                    serviceName: '中式推拿',
                    pricingId: 'price_1',
                    tags: ['保健'],
                    durationMinutes: 60,
                    price: 168,
                    originalPrice: null,
                    imageFileId: null,
                    imageUrl: null,
                    imageBlurhash: null,
                    galleryFileIds: [],
                    actionLabel: '去预约',
                    highlightLabel: null,
                },
                {
                    serviceId: 'svc_2',
                    serviceName: '泰式按摩',
                    pricingId: 'price_2',
                    tags: ['调理'],
                    durationMinutes: 90,
                    price: 268,
                    originalPrice: null,
                    imageFileId: null,
                    imageUrl: null,
                    imageBlurhash: null,
                    galleryFileIds: ['file_gallery_1'],
                    actionLabel: '去预约',
                    highlightLabel: null,
                },
            ],
        } as any);
        repository.getPersonnelYearlyOrderCount.mockResolvedValue(20);
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'https://example.com/gallery.jpg',
            blurhash: 'LEHV6nWB2yk8pyo0adR*.7kCMdnj',
        } as any);
        followService.getPersonnelFavoriteSummary.mockResolvedValue({
            personnelId: 'personnel_1',
            favoriteCount: 9,
            isFavorited: false,
        } as any);
        reviewService.getTopReviewsByTarget.mockResolvedValue([]);

        const result = await service.getPersonnelDetail(undefined, 'personnel_1', {
            serviceId: 'svc_1',
        });

        expect(result.galleryImages).toEqual([
            expect.objectContaining({
                url: 'https://example.com/gallery.jpg',
            }),
        ]);
        expect(result.favoriteCount).toBe(9);
    });
});
