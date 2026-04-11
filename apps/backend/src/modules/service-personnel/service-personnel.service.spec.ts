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
