import { BadRequestException } from '@nestjs/common';

import { NotificationPublisher } from '../notification/notification.publisher';
import {
    AdminServiceOfferingsRepository,
    type ServiceOfferingReviewResult,
    type ServiceOfferingTakeDownResult,
} from './admin-service-offerings.repository';
import { AdminServiceOfferingsService } from './admin-service-offerings.service';

type MockRepository = jest.Mocked<
    Pick<
        AdminServiceOfferingsRepository,
        | 'list'
        | 'approveDraft'
        | 'rejectDraft'
        | 'takeDownOffering'
    >
>;

type MockNotificationPublisher = jest.Mocked<
    Pick<NotificationPublisher, 'publish'>
>;

const reviewResult: ServiceOfferingReviewResult = {
    draftId: 'draft_1',
    personnelUserId: 'personnel_1',
    serviceIds: ['service_1', 'service_2'],
};

const takeDownResult: ServiceOfferingTakeDownResult = {
    personnelUserId: 'personnel_1',
    serviceId: 'service_1',
};

describe('AdminServiceOfferingsService', () => {
    let service: AdminServiceOfferingsService;
    let repository: MockRepository;
    let notificationPublisher: MockNotificationPublisher;

    beforeEach(() => {
        repository = {
            list: jest.fn(),
            approveDraft: jest.fn(),
            rejectDraft: jest.fn(),
            takeDownOffering: jest.fn(),
        };
        notificationPublisher = {
            publish: jest.fn(),
        };

        service = new AdminServiceOfferingsService(
            repository as unknown as AdminServiceOfferingsRepository,
            notificationPublisher as unknown as NotificationPublisher,
        );
    });

    it('通过审核时调用 repository 并发布通知', async () => {
        repository.approveDraft.mockResolvedValue(reviewResult);

        await expect(
            service.approveDraft('draft_1', 'admin_1'),
        ).resolves.toEqual(reviewResult);

        expect(repository.approveDraft).toHaveBeenCalledWith(
            'draft_1',
            'admin_1',
        );
        expect(notificationPublisher.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'service_offering_review_approved',
                payload: expect.objectContaining({
                    event: 'service_offering_review_approved',
                    userId: 'personnel_1',
                    personnelId: 'personnel_1',
                    action: 'approved',
                    draftId: 'draft_1',
                    serviceIds: 'service_1,service_2',
                    operatorId: 'admin_1',
                }),
            }),
        );
    });

    it('拒绝审核原因为空时抛 BadRequestException 且不调用 repository', async () => {
        await expect(
            service.rejectDraft('draft_1', 'admin_1', '   '),
        ).rejects.toThrow(BadRequestException);

        expect(repository.rejectDraft).not.toHaveBeenCalled();
        expect(notificationPublisher.publish).not.toHaveBeenCalled();
    });

    it('拒绝审核成功时 trim reason、调用 repository 并发布通知', async () => {
        repository.rejectDraft.mockResolvedValue(reviewResult);

        await expect(
            service.rejectDraft('draft_1', 'admin_1', '  资料不完整  '),
        ).resolves.toEqual(reviewResult);

        expect(repository.rejectDraft).toHaveBeenCalledWith(
            'draft_1',
            'admin_1',
            '资料不完整',
        );
        expect(notificationPublisher.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'service_offering_review_rejected',
                payload: expect.objectContaining({
                    event: 'service_offering_review_rejected',
                    userId: 'personnel_1',
                    personnelId: 'personnel_1',
                    action: 'rejected',
                    draftId: 'draft_1',
                    serviceIds: 'service_1,service_2',
                    reason: '资料不完整',
                    operatorId: 'admin_1',
                }),
            }),
        );
    });

    it('下架原因为空时抛 BadRequestException 且不调用 repository', async () => {
        await expect(
            service.takeDownOffering(
                'personnel_1',
                'service_1',
                'admin_1',
                '\n\t ',
            ),
        ).rejects.toThrow(BadRequestException);

        expect(repository.takeDownOffering).not.toHaveBeenCalled();
        expect(notificationPublisher.publish).not.toHaveBeenCalled();
    });

    it('下架成功时 trim reason、调用 repository 并发布通知', async () => {
        repository.takeDownOffering.mockResolvedValue(takeDownResult);

        await expect(
            service.takeDownOffering(
                'personnel_1',
                'service_1',
                'admin_1',
                '  平台规则调整  ',
            ),
        ).resolves.toEqual(takeDownResult);

        expect(repository.takeDownOffering).toHaveBeenCalledWith(
            'personnel_1',
            'service_1',
            'admin_1',
            '平台规则调整',
        );
        expect(notificationPublisher.publish).toHaveBeenCalledWith(
            expect.objectContaining({
                event: 'service_offering_taken_down',
                payload: expect.objectContaining({
                    event: 'service_offering_taken_down',
                    userId: 'personnel_1',
                    personnelId: 'personnel_1',
                    action: 'taken_down',
                    serviceId: 'service_1',
                    reason: '平台规则调整',
                    operatorId: 'admin_1',
                }),
            }),
        );
    });

    it('通知失败不阻断审核通过结果', async () => {
        repository.approveDraft.mockResolvedValue(reviewResult);
        notificationPublisher.publish.mockRejectedValue(
            new Error('notification down'),
        );

        await expect(
            service.approveDraft('draft_1', 'admin_1'),
        ).resolves.toEqual(reviewResult);

        expect(repository.approveDraft).toHaveBeenCalledWith(
            'draft_1',
            'admin_1',
        );
    });

    it('通知失败不阻断下架结果', async () => {
        repository.takeDownOffering.mockResolvedValue(takeDownResult);
        notificationPublisher.publish.mockRejectedValue(
            new Error('notification down'),
        );

        await expect(
            service.takeDownOffering(
                'personnel_1',
                'service_1',
                'admin_1',
                '平台规则调整',
            ),
        ).resolves.toEqual(takeDownResult);

        expect(repository.takeDownOffering).toHaveBeenCalledWith(
            'personnel_1',
            'service_1',
            'admin_1',
            '平台规则调整',
        );
    });
});
