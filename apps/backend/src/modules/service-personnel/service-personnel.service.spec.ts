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
});

type ProfileRepository = jest.Mocked<
    Pick<ServicePersonnelRepository, 'getPersonnelContactInfo'>
>;

type ProfileWorkSkillService = jest.Mocked<
    Pick<WorkSkillService, 'getPersonnelInfo'>
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
            merchantQualificationFileId: 'file_merchant',
            vocationalQualificationFileId: 'file_vocational',
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
        expect(result.services[0]).toMatchObject({
            categoryId: 'wgla64hwo7zr9iz',
            categoryName: '上门按摩',
        });
    });
});
