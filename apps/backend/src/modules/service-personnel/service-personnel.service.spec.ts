jest.mock('../files/files.service', () => ({
    FilesService: class FilesService {},
}));

import { ServicePersonnelService } from './service-personnel.service';
import type { ServicePersonnelRepository } from './service-personnel.repository';
import type { WorkSkillService } from '../work-skill/work-skill.service';
import type { FilesService } from '../files/files.service';
import type { OrderRepository } from '../order/order.reposityro';
import type { PayService } from '../pay/pay.service';
import type { ReviewService } from '../review/review.service';

type MockServicePersonnelRepository = jest.Mocked<
    Pick<ServicePersonnelRepository, 'searchPersonnelByServiceIds'>
>;

describe('ServicePersonnelService.searchPersonnelByServiceIds', () => {
    let service: ServicePersonnelService;
    let servicePersonnelRepository: MockServicePersonnelRepository;

    beforeEach(() => {
        servicePersonnelRepository = {
            searchPersonnelByServiceIds: jest.fn(),
        };

        service = new ServicePersonnelService(
            servicePersonnelRepository as unknown as ServicePersonnelRepository,
            {} as WorkSkillService,
            {
                getFileAccessInfo: jest.fn(),
            } as unknown as FilesService,
            {} as OrderRepository,
            {} as PayService,
            {} as ReviewService,
        );
    });

    it('同一人员同一服务的多个规格只保留最低价规格', async () => {
        servicePersonnelRepository.searchPersonnelByServiceIds.mockResolvedValue(
            {
                personnel: [
                    {
                        personnelId: 'worker_1',
                        name: '收纳师',
                        avatar: null,
                        serviceId: 'svc_room',
                        serviceName: '房间收纳',
                        pricingId: 'price_high',
                        minPrice: 299,
                        distanceKm: 1.2,
                        addressText: '静安区',
                        workDays: '12345',
                        workStartTime: '09:00:00',
                        workEndTime: '18:00:00',
                        tag: '房间收纳',
                        reviewCount: 10,
                        goodRatePercentage: 99,
                        ratingValue: 4.9,
                    },
                    {
                        personnelId: 'worker_1',
                        name: '收纳师',
                        avatar: null,
                        serviceId: 'svc_room',
                        serviceName: '房间收纳',
                        pricingId: 'price_low',
                        minPrice: 199,
                        distanceKm: 1.2,
                        addressText: '静安区',
                        workDays: '12345',
                        workStartTime: '09:00:00',
                        workEndTime: '18:00:00',
                        tag: '房间收纳',
                        reviewCount: 10,
                        goodRatePercentage: 99,
                        ratingValue: 4.9,
                    },
                ],
                page: 1,
                limit: 20,
                hasMore: false,
                nextPage: null,
            },
        );

        const result = await service.searchPersonnelByServiceIds({
            serviceIds: ['svc_room'],
            page: 1,
            limit: 20,
        });

        expect(result.personnel).toHaveLength(1);
        expect(result.personnel[0]).toMatchObject({
            personnelId: 'worker_1',
            serviceId: 'svc_room',
            pricingId: 'price_low',
            minPrice: 199,
        });
    });

    it('多服务命中同一人员时按展示人员重算分页标记', async () => {
        servicePersonnelRepository.searchPersonnelByServiceIds.mockResolvedValue(
            {
                personnel: [
                    {
                        personnelId: 'worker_1',
                        name: '收纳师',
                        avatar: null,
                        serviceId: 'svc_room',
                        serviceName: '房间收纳',
                        pricingId: 'price_room',
                        minPrice: 199,
                        distanceKm: 1.2,
                        addressText: '静安区',
                        workDays: '12345',
                        workStartTime: '09:00:00',
                        workEndTime: '18:00:00',
                        tag: '房间收纳',
                        reviewCount: 10,
                        goodRatePercentage: 99,
                        ratingValue: 4.9,
                    },
                    {
                        personnelId: 'worker_1',
                        name: '收纳师',
                        avatar: null,
                        serviceId: 'svc_kitchen',
                        serviceName: '厨房收纳',
                        pricingId: 'price_kitchen',
                        minPrice: 259,
                        distanceKm: 1.2,
                        addressText: '静安区',
                        workDays: '12345',
                        workStartTime: '09:00:00',
                        workEndTime: '18:00:00',
                        tag: '厨房收纳',
                        reviewCount: 10,
                        goodRatePercentage: 99,
                        ratingValue: 4.9,
                    },
                ],
                page: 1,
                limit: 2,
                hasMore: true,
                nextPage: 2,
            },
        );

        const result = await service.searchPersonnelByServiceIds({
            serviceIds: ['svc_room', 'svc_kitchen'],
            page: 1,
            limit: 2,
        });

        expect(result.personnel).toHaveLength(1);
        expect(result.hasMore).toBe(false);
        expect(result.nextPage).toBeNull();
    });
});

type ProfileRepository = jest.Mocked<
    Pick<ServicePersonnelRepository, 'getPersonnelContactInfo'>
>;

type ProfileWorkSkillService = jest.Mocked<
    Pick<WorkSkillService, 'getPersonnelInfo' | 'getPublishedPersonnelInfo'>
>;

type ProfileFilesService = jest.Mocked<Pick<FilesService, 'getFileAccessInfo'>>;

describe('ServicePersonnelService.getPersonnelProfile', () => {
    let service: ServicePersonnelService;
    let repository: ProfileRepository;
    let workSkillService: ProfileWorkSkillService;
    let filesService: ProfileFilesService;

    beforeEach(() => {
        repository = {
            getPersonnelContactInfo: jest.fn(),
        };
        workSkillService = {
            getPersonnelInfo: jest.fn(),
            getPublishedPersonnelInfo: jest.fn(),
        };
        filesService = {
            getFileAccessInfo: jest.fn(),
        };

        service = new ServicePersonnelService(
            repository as unknown as ServicePersonnelRepository,
            workSkillService as unknown as WorkSkillService,
            filesService as unknown as FilesService,
            {} as OrderRepository,
            {} as PayService,
            {} as ReviewService,
        );
    });

    it('返回脱敏身份证号和结构化证书字段', async () => {
        workSkillService.getPublishedPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            name: '李师傅',
            avatar: null,
            bio: null,
            province: '湖北省',
            district: '黄冈市',
            county: null,
            detailedAddress: '测试路 1 号',
            geom: [114.87, 30.45],
            yearsOfExperience: 5,
            workStartTime: '09:00:00',
            workEndTime: '18:00:00',
            workDays: '1234567',
            isAvailable: true,
            currentStatus: 'available',
            lastActiveAt: new Date('2026-04-22T08:00:00.000Z'),
            merchantQualificationFileId: 'file_merchant',
            vocationalQualificationFileId: 'file_vocational',
            emergencyContactPhone: '13912345678',
            emergencyContactName: '王女士',
            skills: [
                {
                    id: 'svc_massage_1',
                    name: '上门按摩',
                    categoryId: 'wgla64hwo7zr9iz',
                    categoryName: '上门按摩',
                    serviceTagId: null,
                    imageFileId: null,
                    category: {
                        id: 'wgla64hwo7zr9iz',
                        parentId: null,
                        name: '上门按摩',
                        dep: 1,
                        description: null,
                        sortOrder: 0,
                        isActive: true,
                        commissionRate: 30,
                        iconFileId: null,
                    },
                    description: '服务描述',
                    personnelDescription: '个人描述',
                    isActive: true,
                    galleryFileIds: [],
                    specifications: [],
                    reviewStatus: 'approved',
                    publicationStatus: 'active',
                    hasOfferingStatus: true,
                    rejectionReason: null,
                    takeDownReason: null,
                    pendingDraftId: null,
                    draft: null,
                    lastApprovedAt: new Date('2026-04-22T08:00:00.000Z'),
                    takenDownAt: null,
                },
            ],
        });

        repository.getPersonnelContactInfo.mockResolvedValue({
            phoneNumber: '13812345678',
            idCardNumber: '420106199901011234',
        });

        filesService.getFileAccessInfo
            .mockResolvedValueOnce({
                fileUrl: 'https://example.com/merchant.jpg',
                fileName: 'merchant.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1,
                expiresIn: 3600,
                blurhash: 'merchant',
            })
            .mockResolvedValueOnce({
                fileUrl: 'https://example.com/vocational.jpg',
                fileName: 'vocational.jpg',
                mimeType: 'image/jpeg',
                fileSize: 1,
                expiresIn: 3600,
                blurhash: 'vocational',
            });

        const result = await service.getPersonnelProfile('worker_1');

        expect(result.maskedIdCardNumber).toBe('420***********1234');
        expect(result.merchantQualificationImage?.url).toBe(
            'https://example.com/merchant.jpg',
        );
        expect(result.vocationalQualificationImage?.url).toBe(
            'https://example.com/vocational.jpg',
        );
        expect(result.emergencyContactPhone).toBe('13912345678');
        expect(result.emergencyContactName).toBe('王女士');
        expect(result.services[0]).toMatchObject({
            categoryId: 'wgla64hwo7zr9iz',
            categoryName: '上门按摩',
            reviewStatus: 'approved',
            publicationStatus: 'active',
        });
        expect(workSkillService.getPublishedPersonnelInfo).toHaveBeenCalledWith(
            'worker_1',
        );
        expect(workSkillService.getPersonnelInfo).not.toHaveBeenCalled();
    });

    it('公开详情使用已发布服务查询，不返回 owner 可见的下架服务', async () => {
        workSkillService.getPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            skills: [
                {
                    id: 'svc_taken_down',
                    name: '下架服务',
                    reviewStatus: 'approved',
                    publicationStatus: 'taken_down',
                    takeDownReason: '资料不合规',
                },
            ],
        } as any);
        workSkillService.getPublishedPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            name: '李师傅',
            avatar: null,
            bio: null,
            province: '湖北省',
            district: '黄冈市',
            county: null,
            detailedAddress: '测试路 1 号',
            geom: [114.87, 30.45],
            yearsOfExperience: 5,
            workStartTime: '09:00:00',
            workEndTime: '18:00:00',
            workDays: '1234567',
            isAvailable: true,
            currentStatus: 'available',
            lastActiveAt: new Date('2026-04-22T08:00:00.000Z'),
            merchantQualificationFileId: null,
            vocationalQualificationFileId: null,
            emergencyContactPhone: null,
            emergencyContactName: null,
            skills: [
                {
                    id: 'svc_active',
                    name: '上架服务',
                    categoryId: null,
                    categoryName: null,
                    description: null,
                    personnelDescription: null,
                    isActive: true,
                    galleryFileIds: [],
                    specifications: [],
                    reviewStatus: 'approved',
                    publicationStatus: 'active',
                    rejectionReason: null,
                    takeDownReason: null,
                    pendingDraftId: null,
                    lastApprovedAt: null,
                    takenDownAt: null,
                },
            ],
        } as any);
        repository.getPersonnelContactInfo.mockResolvedValue({
            phoneNumber: null,
            idCardNumber: null,
        });

        const result = await service.getPersonnelProfile('worker_1');

        expect(result.services).toHaveLength(1);
        expect(result.services[0]).toMatchObject({
            serviceId: 'svc_active',
            publicationStatus: 'active',
            reviewStatus: 'approved',
        });
        expect(
            result.services.some(
                (item) => item.serviceId === 'svc_taken_down',
            ),
        ).toBe(false);
        expect(workSkillService.getPublishedPersonnelInfo).toHaveBeenCalledWith(
            'worker_1',
        );
        expect(workSkillService.getPersonnelInfo).not.toHaveBeenCalled();
    });

    it('owner 资料返回已下架服务的原信息用于整改', async () => {
        workSkillService.getPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            name: '李师傅',
            avatar: null,
            bio: null,
            province: '湖北省',
            district: '黄冈市',
            county: null,
            detailedAddress: '测试路 1 号',
            geom: [114.87, 30.45],
            yearsOfExperience: 5,
            workStartTime: '09:00:00',
            workEndTime: '18:00:00',
            workDays: '1234567',
            isAvailable: true,
            currentStatus: 'available',
            lastActiveAt: new Date('2026-04-22T08:00:00.000Z'),
            merchantQualificationFileId: null,
            vocationalQualificationFileId: null,
            emergencyContactPhone: null,
            emergencyContactName: null,
            skills: [
                {
                    id: 'svc_taken_down',
                    name: '下架服务',
                    categoryId: 'cat_1',
                    categoryName: '保洁',
                    description: '平台服务说明',
                    personnelDescription: '服务人员原描述',
                    isActive: true,
                    galleryFileIds: ['gallery_1'],
                    specifications: [
                        {
                            id: 'price_1',
                            userId: 'worker_1',
                            serviceId: 'svc_taken_down',
                            name: '标准版',
                            price: '99',
                            currency: 'CNY',
                            estimatedDurationMinutes: 60,
                        },
                    ],
                    reviewStatus: 'approved',
                    publicationStatus: 'taken_down',
                    rejectionReason: null,
                    takeDownReason: '资料不合规',
                    pendingDraftId: null,
                    lastApprovedAt: new Date('2026-05-13T00:00:00.000Z'),
                    takenDownAt: new Date('2026-05-14T00:00:00.000Z'),
                },
            ],
        } as any);
        repository.getPersonnelContactInfo.mockResolvedValue({
            phoneNumber: null,
            idCardNumber: null,
        });
        filesService.getFileAccessInfo.mockResolvedValue({
            fileUrl: 'https://example.com/gallery.jpg',
            fileName: 'gallery.jpg',
            mimeType: 'image/jpeg',
            fileSize: 1,
            expiresIn: 3600,
        });

        const result = await service.getOwnPersonnelProfile('worker_1');

        expect(result.services).toHaveLength(1);
        expect(result.services[0]).toMatchObject({
            serviceId: 'svc_taken_down',
            publicationStatus: 'taken_down',
            takeDownReason: '资料不合规',
            personnelDescription: '服务人员原描述',
            galleryFileIds: ['gallery_1'],
            specifications: [
                expect.objectContaining({
                    id: 'price_1',
                    name: '标准版',
                    price: '99',
                }),
            ],
        });
        expect(result.services[0].gallery[0]?.url).toBe(
            'https://example.com/gallery.jpg',
        );
        expect(workSkillService.getPersonnelInfo).toHaveBeenCalledWith(
            'worker_1',
        );
        expect(workSkillService.getPublishedPersonnelInfo).not.toHaveBeenCalled();
    });
});
