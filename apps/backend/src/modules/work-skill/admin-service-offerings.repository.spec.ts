import { BadRequestException } from '@nestjs/common';

import {
    AdminServiceOfferingsRepository,
    buildPricingSyncPlan,
    getActiveRemovedServiceIds,
} from './admin-service-offerings.repository';

describe('AdminServiceOfferingsRepository helpers', () => {
    it('只将仍 active 且不在快照中的旧服务视为移除', () => {
        const removed = getActiveRemovedServiceIds(
            [
                {
                    serviceId: 'service_active_removed',
                    publicationStatus: 'active',
                },
                { serviceId: 'service_active_kept', publicationStatus: 'active' },
                {
                    serviceId: 'service_taken_down_with_audit',
                    publicationStatus: 'taken_down',
                },
            ],
            ['service_active_kept'],
        );

        expect(removed).toEqual(['service_active_removed']);
    });

    it('审核通过同步规格时保留已有规格 id 并软停用被移除规格', () => {
        const plan = buildPricingSyncPlan(
            [
                {
                    id: 'price_keep',
                    serviceId: 'service_1',
                    isActive: true,
                },
                {
                    id: 'price_remove',
                    serviceId: 'service_1',
                    isActive: true,
                },
                {
                    id: 'price_old_removed_service',
                    serviceId: 'service_2',
                    isActive: true,
                },
            ],
            [
                {
                    id: 'price_keep',
                    serviceId: 'service_1',
                },
                {
                    serviceId: 'service_1',
                },
            ],
        );

        expect(plan).toEqual({
            updateSpecIds: ['price_keep'],
            insertSpecs: [
                {
                    serviceId: 'service_1',
                },
            ],
            deactivateSpecIds: ['price_remove'],
        });
    });

    it('下架不存在 active+approved 发布关系时抛错且不 upsert', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const insert = jest.fn();
        const limit = jest.fn().mockResolvedValue([]);
        const where = jest.fn().mockReturnValue({ limit });
        const from = jest.fn().mockReturnValue({ where });
        const select = jest.fn().mockReturnValue({ from });

        Object.defineProperty(repository, 'db', {
            value: {
                select,
                insert,
            },
        });

        await expect(
            repository.takeDownOffering(
                'personnel_1',
                'service_1',
                'admin_1',
                '违规服务',
            ),
        ).rejects.toThrow(BadRequestException);

        expect(select).toHaveBeenCalled();
        expect(limit).toHaveBeenCalledWith(1);
        expect(insert).not.toHaveBeenCalled();
    });
});
