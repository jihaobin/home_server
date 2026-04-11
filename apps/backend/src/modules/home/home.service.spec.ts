import { HomeService } from './home.service';
import type { HomeRepository } from './home.repository';
import type { ServiceService } from '../service/service.service';
import type { ServicePersonnelService } from '../service-personnel/service-personnel.service';

type MockHomeRepository = jest.Mocked<Pick<HomeRepository, 'getOpsConfig'>>;

type MockServiceService = jest.Mocked<
    Pick<
        ServiceService,
        | 'searchActiveServicesByKeyword'
        | 'findActiveServiceById'
        | 'findExactActiveServiceByName'
    >
>;

type MockServicePersonnelService = jest.Mocked<
    Pick<
        ServicePersonnelService,
        | 'findSearchPersonnelSuggestions'
        | 'getPersonnelServicesSummary'
        | 'searchPersonnelByServiceIds'
        | 'findExactPersonnelByName'
    >
>;

describe('HomeService.search', () => {
    let service: HomeService;
    let homeRepository: MockHomeRepository;
    let serviceService: MockServiceService;
    let servicePersonnelService: MockServicePersonnelService;

    beforeEach(() => {
        homeRepository = {
            getOpsConfig: jest.fn(),
        };
        serviceService = {
            searchActiveServicesByKeyword: jest.fn(),
            findActiveServiceById: jest.fn(),
            findExactActiveServiceByName: jest.fn(),
        };
        servicePersonnelService = {
            findSearchPersonnelSuggestions: jest.fn(),
            getPersonnelServicesSummary: jest.fn(),
            searchPersonnelByServiceIds: jest.fn(),
            findExactPersonnelByName: jest.fn(),
        };

        service = new HomeService(
            homeRepository as unknown as HomeRepository,
            serviceService as unknown as ServiceService,
            servicePersonnelService as unknown as ServicePersonnelService,
        );
    });

    it('传 personnelId 时返回 personnel_services', async () => {
        servicePersonnelService.getPersonnelServicesSummary.mockResolvedValue({
            matchedPersonnel: {
                id: 'personnel_1',
                name: '王师傅',
                avatarUrl: null,
                avatarBlurhash: null,
            },
            services: [
                {
                    serviceId: 'svc_1',
                    serviceName: '肩颈按摩',
                    pricingId: 'price_1',
                    price: 168,
                    estimatedDurationMinutes: 60,
                    categoryId: 'cat_massage',
                },
            ],
        });

        const result = await service.search(undefined, {
            keyword: '王师傅',
            page: 1,
            limit: 20,
            personnelId: 'personnel_1',
        });

        expect(result.mode).toBe('personnel_services');
        if (result.mode !== 'personnel_services') {
            throw new Error('expected personnel_services');
        }
        expect(
            servicePersonnelService.getPersonnelServicesSummary,
        ).toHaveBeenCalledWith('personnel_1');
        expect(serviceService.findActiveServiceById).not.toHaveBeenCalled();
    });

    it('serviceId 命中时返回 personnel_list', async () => {
        serviceService.findActiveServiceById.mockResolvedValue({
            id: 'svc_cleaning',
            name: '家庭保洁',
            categoryId: 'cat_cleaning',
        });
        servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
            personnel: [],
            page: 1,
            limit: 20,
            hasMore: false,
            nextPage: null,
        });

        const result = await service.search(undefined, {
            keyword: '家庭保洁',
            serviceId: 'svc_cleaning',
            page: 1,
            limit: 20,
        });

        expect(result.mode).toBe('personnel_list');
        if (result.mode !== 'personnel_list') {
            throw new Error('expected personnel_list');
        }
        expect(result.serviceHint?.serviceId).toBe('svc_cleaning');
        expect(serviceService.findActiveServiceById).toHaveBeenCalledWith(
            'svc_cleaning',
        );
        expect(
            servicePersonnelService.searchPersonnelByServiceIds,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                serviceIds: ['svc_cleaning'],
                page: 1,
                limit: 20,
            }),
        );
    });

    it('关键词唯一命中人员姓名时返回 personnel_services', async () => {
        servicePersonnelService.findExactPersonnelByName.mockResolvedValue({
            id: 'personnel_2',
            name: '李阿姨',
        });
        servicePersonnelService.getPersonnelServicesSummary.mockResolvedValue({
            matchedPersonnel: {
                id: 'personnel_2',
                name: '李阿姨',
                avatarUrl: null,
                avatarBlurhash: null,
            },
            services: [],
        });

        const result = await service.search(undefined, {
            keyword: '李阿姨',
            page: 1,
            limit: 20,
        });

        expect(result.mode).toBe('personnel_services');
        if (result.mode !== 'personnel_services') {
            throw new Error('expected personnel_services');
        }
        expect(
            servicePersonnelService.findExactPersonnelByName,
        ).toHaveBeenCalledWith('李阿姨');
        expect(
            servicePersonnelService.getPersonnelServicesSummary,
        ).toHaveBeenCalledWith('personnel_2');
    });

    it('候选词接口同时返回人员与服务候选', async () => {
        servicePersonnelService.findSearchPersonnelSuggestions.mockResolvedValue(
            [
                {
                    id: 'personnel_1',
                    name: '王师傅',
                },
            ],
        );
        serviceService.searchActiveServicesByKeyword.mockResolvedValue([
            {
                id: 'svc_1',
                name: '肩颈按摩',
                categoryId: 'cat_massage',
            },
        ]);

        const result = await service.searchSuggestions({
            keyword: '按摩',
            limit: 10,
        });

        expect(result.suggestions).toEqual([
            {
                type: 'personnel',
                label: '王师傅',
                personnelId: 'personnel_1',
            },
            {
                type: 'service',
                label: '肩颈按摩',
                serviceId: 'svc_1',
            },
        ]);
    });

    it('关键词未命中唯一人员时根据服务结果返回 personnel_list', async () => {
        servicePersonnelService.findExactPersonnelByName.mockResolvedValue(
            null,
        );
        serviceService.findExactActiveServiceByName.mockResolvedValue(null);
        serviceService.searchActiveServicesByKeyword.mockResolvedValue([
            {
                id: 'svc_cleaning',
                name: '家庭保洁',
                categoryId: 'cat_cleaning',
            },
        ]);
        servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
            personnel: [
                {
                    personnelId: 'worker_1',
                    name: '陈阿姨',
                    avatarUrl: null,
                    avatarBlurhash: null,
                    serviceId: 'svc_cleaning',
                    serviceName: '家庭保洁',
                    pricingId: 'price_1',
                    minPrice: 129,
                    distanceKm: 1.2,
                    addressText: '浦东新区',
                    workDays: '12345',
                    workStartTime: '09:00:00',
                    workEndTime: '18:00:00',
                    tag: '家庭保洁',
                    reviewCount: 5,
                    goodRatePercentage: 100,
                    ratingValue: 5,
                },
            ],
            page: 1,
            limit: 20,
            hasMore: false,
            nextPage: null,
        });

        const result = await service.search(undefined, {
            keyword: '保洁',
            page: 1,
            limit: 20,
        });

        expect(result.mode).toBe('personnel_list');
        if (result.mode !== 'personnel_list') {
            throw new Error('expected personnel_list');
        }
        expect(result.personnel).toHaveLength(1);
        expect(
            servicePersonnelService.searchPersonnelByServiceIds,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                serviceIds: ['svc_cleaning'],
            }),
        );
    });

    it('关键词精确命中服务名时仅返回该服务对应的人员结果', async () => {
        servicePersonnelService.findExactPersonnelByName.mockResolvedValue(
            null,
        );
        serviceService.findExactActiveServiceByName.mockResolvedValue({
            id: 'svc_room',
            name: '房间收纳',
            categoryId: 'cat_housekeeping',
        });
        servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
            personnel: [
                {
                    personnelId: 'worker_room',
                    name: '收纳师',
                    avatarUrl: null,
                    avatarBlurhash: null,
                    serviceId: 'svc_room',
                    serviceName: '房间收纳',
                    pricingId: 'price_room',
                    minPrice: 199,
                    distanceKm: 1.5,
                    addressText: '静安区',
                    workDays: '12345',
                    workStartTime: '09:00:00',
                    workEndTime: '18:00:00',
                    tag: '房间收纳',
                    reviewCount: 8,
                    goodRatePercentage: 98,
                    ratingValue: 4.9,
                },
            ],
            page: 1,
            limit: 20,
            hasMore: false,
            nextPage: null,
        });

        const result = await service.search(undefined, {
            keyword: '房间收纳',
            page: 1,
            limit: 20,
        });

        expect(
            serviceService.findExactActiveServiceByName,
        ).toHaveBeenCalledWith('房间收纳');
        expect(
            serviceService.searchActiveServicesByKeyword,
        ).not.toHaveBeenCalled();
        expect(
            servicePersonnelService.searchPersonnelByServiceIds,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                serviceIds: ['svc_room'],
            }),
        );
        expect(result.mode).toBe('personnel_list');
        if (result.mode !== 'personnel_list') {
            throw new Error('expected personnel_list');
        }
        expect(result.serviceHint).toEqual({
            serviceId: 'svc_room',
            serviceName: '房间收纳',
        });
        expect(result.personnel).toHaveLength(1);
        expect(result.personnel[0]?.serviceId).toBe('svc_room');
    });

    it('关键词模糊命中多个服务时不设置单一 serviceHint', async () => {
        servicePersonnelService.findExactPersonnelByName.mockResolvedValue(
            null,
        );
        serviceService.findExactActiveServiceByName.mockResolvedValue(null);
        serviceService.searchActiveServicesByKeyword.mockResolvedValue([
            {
                id: 'svc_room',
                name: '房间收纳',
                categoryId: 'cat_housekeeping',
            },
            {
                id: 'svc_trash',
                name: '垃圾清理',
                categoryId: 'cat_housekeeping',
            },
        ]);
        servicePersonnelService.searchPersonnelByServiceIds.mockResolvedValue({
            personnel: [],
            page: 1,
            limit: 20,
            hasMore: false,
            nextPage: null,
        });

        const result = await service.search(undefined, {
            keyword: '收纳清理',
            page: 1,
            limit: 20,
        });

        expect(result.mode).toBe('personnel_list');
        if (result.mode !== 'personnel_list') {
            throw new Error('expected personnel_list');
        }
        expect(result.serviceHint).toBeUndefined();
        expect(
            servicePersonnelService.searchPersonnelByServiceIds,
        ).toHaveBeenCalledWith(
            expect.objectContaining({
                serviceIds: ['svc_room', 'svc_trash'],
            }),
        );
    });
});
