import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type {
    AdminServiceOfferingListQuery,
    AdminServiceOfferingListResponse,
} from '@repo/types';

import { NotificationPublisher } from '../notification/notification.publisher';
import {
    AdminServiceOfferingsRepository,
    type ServiceOfferingReviewResult,
    type ServiceOfferingTakeDownResult,
} from './admin-service-offerings.repository';

@Injectable()
export class AdminServiceOfferingsService {
    private readonly logger = new Logger(AdminServiceOfferingsService.name);

    constructor(
        private readonly repository: AdminServiceOfferingsRepository,
        private readonly notificationPublisher: NotificationPublisher,
    ) {}

    async list(
        query: AdminServiceOfferingListQuery,
    ): Promise<AdminServiceOfferingListResponse> {
        return this.repository.list(query);
    }

    async approveDraft(
        draftId: string,
        adminUserId: string,
    ): Promise<ServiceOfferingReviewResult> {
        const result = await this.repository.approveDraft(draftId, adminUserId);
        await this.publishServiceOfferingNotification(
            'service_offering_review_approved',
            result.personnelUserId,
            {
                title: '服务上架审核已通过',
                message: '你提交的服务信息已审核通过',
                draftId: result.draftId,
                personnelId: result.personnelUserId,
                action: 'approved',
                serviceIds: result.serviceIds.join(','),
                operatorId: adminUserId,
            },
        );
        return result;
    }

    async rejectDraft(
        draftId: string,
        adminUserId: string,
        reason: string,
    ): Promise<ServiceOfferingReviewResult> {
        const normalizedReason = this.normalizeRequiredReason(reason);
        const result = await this.repository.rejectDraft(
            draftId,
            adminUserId,
            normalizedReason,
        );
        await this.publishServiceOfferingNotification(
            'service_offering_review_rejected',
            result.personnelUserId,
            {
                title: '服务上架审核未通过',
                message: normalizedReason,
                draftId: result.draftId,
                personnelId: result.personnelUserId,
                action: 'rejected',
                serviceIds: result.serviceIds.join(','),
                reason: normalizedReason,
                operatorId: adminUserId,
            },
        );
        return result;
    }

    async takeDownOffering(
        personnelId: string,
        serviceId: string,
        adminUserId: string,
        reason: string,
    ): Promise<ServiceOfferingTakeDownResult> {
        const normalizedReason = this.normalizeRequiredReason(reason);
        const result = await this.repository.takeDownOffering(
            personnelId,
            serviceId,
            adminUserId,
            normalizedReason,
        );
        await this.publishServiceOfferingNotification(
            'service_offering_taken_down',
            result.personnelUserId,
            {
                title: '服务已被管理员下架',
                message: normalizedReason,
                personnelId: result.personnelUserId,
                action: 'taken_down',
                serviceId: result.serviceId,
                reason: normalizedReason,
                operatorId: adminUserId,
            },
        );
        return result;
    }

    private normalizeRequiredReason(reason: string): string {
        const normalized = reason?.trim();
        if (!normalized) {
            throw new BadRequestException('原因不能为空');
        }
        return normalized;
    }

    private async publishServiceOfferingNotification(
        event: string,
        personnelUserId: string,
        payload: Record<string, string>,
    ): Promise<void> {
        try {
            await this.notificationPublisher.publish({
                event,
                payload: {
                    event,
                    userId: personnelUserId,
                    targetId: personnelUserId,
                    triggeredAt: new Date().toISOString(),
                    ...payload,
                },
                targets: [
                    {
                        targetId: personnelUserId,
                        userId: personnelUserId,
                        targetType: 'service_personnel',
                        metadata: {
                            scene: event,
                        },
                    },
                ],
                priority: 'normal',
                deliveryMode: 'best-effort',
            });
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            this.logger.warn(`服务上架审核通知发送失败: ${message}`);
        }
    }
}
