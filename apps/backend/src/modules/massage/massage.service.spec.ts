jest.mock('../files/files.service', () => ({
    FilesService: class FilesService {},
}));

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
> & {
    createMerchantJoinRequest: jest.Mock<
        Promise<{
            id: string;
            createdAt: Date;
        }>,
        [
            {
                merchantName: string;
                gender: 'male' | 'female';
                phone: string;
                age: number;
                intentCity: string;
                photoFileId?: string | null;
            },
        ]
    >;
};

describe('MassageService', () => {
    let service: MassageService;
    let repository: MockMassageRepository;
    let filesService: jest.Mocked<
        Pick<FilesService, 'getFileAccessInfo' | 'getFileById'>
    >;
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
            createMerchantJoinRequest: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
            getFileById: jest.fn(),
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

    it('getTags 返回按摩标签列表', async () => {
        repository.getLandingTagEntries.mockResolvedValue([
            {
                tagId: 'service_tag_massage_neck',
                tagName: '肩颈舒缓',
                tagSlug: 'neck',
                domain: 'massage',
                serviceCount: 3,
            },
        ]);

        const result = await service.getTags();

        expect(result).toEqual([
            expect.objectContaining({
                tagId: 'service_tag_massage_neck',
                tagName: '肩颈舒缓',
            }),
        ]);
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

    it('createMerchantJoinRequest 会规范化字段并写入 repository', async () => {
        repository.createMerchantJoinRequest.mockResolvedValue({
            id: 'join_123',
            createdAt: new Date('2026-04-21T08:00:00.000Z'),
        });

        const createMerchantJoinRequest = Reflect.get(
            service,
            'createMerchantJoinRequest',
        ) as
            | ((input: {
                  merchantName: string;
                  gender: 'male' | 'female';
                  phone: string;
                  age: number;
                  intentCity: string;
                  photoFileId?: string | null;
              }) => Promise<{ id: string; createdAt: string }>)
            | undefined;

        expect(createMerchantJoinRequest).toBeDefined();

        const result = await createMerchantJoinRequest?.call(service, {
            merchantName: '  王小美  ',
            gender: 'female',
            phone: ' 138 0013 8000 ',
            age: 29,
            intentCity: '  武汉  ',
            photoFileId: '   ',
        }, 'user_1');

        expect(repository.createMerchantJoinRequest).toHaveBeenCalledWith({
            merchantName: '王小美',
            gender: 'female',
            phone: '13800138000',
            age: 29,
            intentCity: '武汉',
            photoFileId: null,
        });
        expect(result).toEqual({
            id: 'join_123',
            createdAt: '2026-04-21T08:00:00.000Z',
        });
    });

    it('createMerchantJoinRequest 保留有效 photoFileId', async () => {
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'file_merchant_photo_1',
            fileName: 'photo.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1024,
            expiresIn: 600,
        } as any);
        filesService.getFileById.mockResolvedValue({
            id: 'file_merchant_photo_1',
            uploadedBy: 'user_1',
            fileType: 'image',
        } as any);
        repository.createMerchantJoinRequest.mockResolvedValue({
            id: 'join_456',
            createdAt: new Date('2026-04-21T09:00:00.000Z'),
        });

        const createMerchantJoinRequest = Reflect.get(
            service,
            'createMerchantJoinRequest',
        ) as
            | ((input: {
                  merchantName: string;
                  gender: 'male' | 'female';
                  phone: string;
                  age: number;
                  intentCity: string;
                  photoFileId?: string | null;
              }) => Promise<{ id: string; createdAt: string }>)
            | undefined;

        expect(createMerchantJoinRequest).toBeDefined();

        await createMerchantJoinRequest?.call(service, {
            merchantName: '李先生',
            gender: 'male',
            phone: '13800138001',
            age: 35,
            intentCity: '杭州',
            photoFileId: ' file_merchant_photo_1 ',
        }, 'user_1');

        expect(repository.createMerchantJoinRequest).toHaveBeenCalledWith({
            merchantName: '李先生',
            gender: 'male',
            phone: '13800138001',
            age: 35,
            intentCity: '杭州',
            photoFileId: 'file_merchant_photo_1',
        });
    });

    it('createMerchantJoinRequest 遇到非图片 photoFileId 会拒绝写库', async () => {
        filesService.getFileById.mockResolvedValue({
            id: 'file_document_1',
            uploadedBy: 'user_1',
            fileType: 'document',
        } as any);

        await expect(
            service.createMerchantJoinRequest({
                merchantName: '赵女士',
                gender: 'female',
                phone: '13800138002',
                age: 30,
                intentCity: '南京',
                photoFileId: 'file_document_1',
            }, 'user_1'),
        ).rejects.toThrow('近期照需为图片文件');

        expect(repository.createMerchantJoinRequest).not.toHaveBeenCalled();
    });

    it('createMerchantJoinRequest 遇到非本人图片会拒绝写库', async () => {
        filesService.getFileById.mockResolvedValue({
            id: 'file_photo_other',
            uploadedBy: 'user_other',
            fileType: 'image',
        } as any);

        await expect(
            service.createMerchantJoinRequest({
                merchantName: '孙女士',
                gender: 'female',
                phone: '13800138003',
                age: 28,
                intentCity: '苏州',
                photoFileId: 'file_photo_other',
            }, 'user_1'),
        ).rejects.toThrow('近期照文件无效，请重新上传');

        expect(repository.createMerchantJoinRequest).not.toHaveBeenCalled();
    });
});
