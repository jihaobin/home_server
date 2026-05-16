import { BadRequestException } from '@nestjs/common';

import {
    AdminServiceOfferingsRepository,
    buildPricingSyncPlan,
} from './admin-service-offerings.repository';

describe('AdminServiceOfferingsRepository helpers', () => {
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

    it('审核通过只同步本次提交服务的规格，不停用其他服务规格', () => {
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
                    id: 'price_other_service',
                    serviceId: 'service_2',
                    isActive: true,
                },
            ],
            [
                {
                    id: 'price_keep',
                    serviceId: 'service_1',
                },
            ],
        );

        expect(plan.deactivateSpecIds).toEqual(['price_remove']);
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

    it('管理端草稿列表补充服务名称和分类信息', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const draftRows = [
            {
                draftId: 'draft_1',
                serviceId: 'service_1',
                serviceName: '中式按摩',
                categoryId: 'category_1',
                categoryName: '上门按摩',
                personnelId: 'personnel_1',
                personnelName: '张师傅',
                phoneNumber: '13800000000',
                merchantQualificationFileId: null,
                vocationalQualificationFileId: 'vocational_file_1',
                reviewStatus: 'pending',
                rejectionReason: null,
                submittedSnapshot: {
                    services: [
                        {
                            serviceId: 'service_1',
                            description: '专业上门按摩',
                            galleryFileIds: [],
                            specifications: [
                                {
                                    id: 'spec_1',
                                    name: '60 分钟',
                                    price: '199',
                                    currency: 'CNY',
                                    estimatedDurationMinutes: 60,
                                },
                            ],
                        },
                    ],
                },
                reviewedBy: null,
                reviewedAt: null,
                createdAt: new Date('2026-05-14T01:00:00.000Z'),
                updatedAt: new Date('2026-05-14T01:00:00.000Z'),
            },
        ];
        const executeItems = jest.fn((resolve) => resolve(draftRows));
        const executeTotal = jest.fn((resolve) => resolve([{ total: 1 }]));
        const offset = jest.fn().mockReturnValue({ then: executeItems });
        const limit = jest.fn().mockReturnValue({ offset });
        const orderBy = jest.fn().mockReturnValue({ limit });
        const whereItems = jest.fn().mockReturnValue({ orderBy });
        const leftJoinItems = jest.fn().mockReturnValue({ where: whereItems });
        const innerJoinItems = jest.fn();
        innerJoinItems
            .mockReturnValueOnce({ innerJoin: innerJoinItems })
            .mockReturnValueOnce({ innerJoin: innerJoinItems })
            .mockReturnValueOnce({ leftJoin: leftJoinItems });
        const fromItems = jest.fn().mockReturnValue({ innerJoin: innerJoinItems });
        const whereTotal = jest.fn().mockReturnValue({ then: executeTotal });
        const leftJoinTotal = jest.fn().mockReturnValue({ where: whereTotal });
        const innerJoinTotal = jest.fn();
        innerJoinTotal
            .mockReturnValueOnce({ innerJoin: innerJoinTotal })
            .mockReturnValueOnce({ innerJoin: innerJoinTotal })
            .mockReturnValueOnce({ leftJoin: leftJoinTotal });
        const fromTotal = jest.fn().mockReturnValue({ innerJoin: innerJoinTotal });
        const select = jest
            .fn()
            .mockReturnValueOnce({ from: fromItems })
            .mockReturnValueOnce({ from: fromTotal });

        Object.defineProperty(repository, 'db', {
            value: {
                select,
            },
        });
        Object.defineProperty(repository, 'filesService', {
            value: {
                getFileAccessInfo: jest.fn().mockResolvedValue({
                    fileUrl: 'https://example.com/vocational.jpg',
                    fileName: 'vocational.jpg',
                    mimeType: 'image/jpeg',
                    fileSize: 1024,
                    expiresIn: 600,
                    blurhash: 'blurhash',
                }),
            },
        });

        const result = await repository.list({
            lifecycle: 'pending_review',
            page: 1,
            limit: 10,
        });

        expect(result.items[0]).toMatchObject({
            kind: 'draft',
            personnel: {
                vocationalQualificationFileId: 'vocational_file_1',
                vocationalQualification: {
                    fileId: 'vocational_file_1',
                    url: 'https://example.com/vocational.jpg',
                    fileName: 'vocational.jpg',
                },
            },
            submittedSnapshot: {
                services: [
                    {
                        serviceId: 'service_1',
                        serviceName: '中式按摩',
                        categoryId: 'category_1',
                        categoryName: '上门按摩',
                    },
                ],
            },
        });
    });
});
