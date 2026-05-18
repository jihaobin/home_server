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
        const executePublishedItems = jest.fn((resolve) => resolve([]));
        const executePublishedTotal = jest.fn((resolve) =>
            resolve([{ total: 0 }]),
        );
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
        const publishedOffset = jest
            .fn()
            .mockReturnValue({ then: executePublishedItems });
        const publishedLimit = jest
            .fn()
            .mockReturnValue({ offset: publishedOffset });
        const publishedOrderBy = jest
            .fn()
            .mockReturnValue({ limit: publishedLimit });
        const publishedWhereItems = jest
            .fn()
            .mockReturnValue({ orderBy: publishedOrderBy });
        const publishedLeftJoinItems = jest.fn();
        publishedLeftJoinItems
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinItems })
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinItems })
            .mockReturnValueOnce({ where: publishedWhereItems });
        const publishedInnerJoinItems = jest.fn();
        publishedInnerJoinItems
            .mockReturnValueOnce({ innerJoin: publishedInnerJoinItems })
            .mockReturnValueOnce({ innerJoin: publishedInnerJoinItems })
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinItems });
        const publishedFromItems = jest
            .fn()
            .mockReturnValue({ innerJoin: publishedInnerJoinItems });
        const publishedWhereTotal = jest
            .fn()
            .mockReturnValue({ then: executePublishedTotal });
        const publishedLeftJoinTotal = jest.fn();
        publishedLeftJoinTotal
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinTotal })
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinTotal })
            .mockReturnValueOnce({ where: publishedWhereTotal });
        const publishedInnerJoinTotal = jest.fn();
        publishedInnerJoinTotal
            .mockReturnValueOnce({ innerJoin: publishedInnerJoinTotal })
            .mockReturnValueOnce({ innerJoin: publishedInnerJoinTotal })
            .mockReturnValueOnce({ leftJoin: publishedLeftJoinTotal });
        const publishedFromTotal = jest
            .fn()
            .mockReturnValue({ innerJoin: publishedInnerJoinTotal });
        const select = jest
            .fn()
            .mockReturnValueOnce({ from: fromItems })
            .mockReturnValueOnce({ from: fromTotal })
            .mockReturnValueOnce({ from: publishedFromItems })
            .mockReturnValueOnce({ from: publishedFromTotal });

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

    it('pending_review 包含当前下架轮次的 pending 申诉并带申诉摘要', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const takenDownAt = new Date('2026-05-18T01:00:00.000Z');
        const rows = [
            {
                personnelId: 'personnel_1',
                personnelName: '张师傅',
                phoneNumber: '13800000000',
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
                serviceId: 'service_1',
                serviceName: '中式按摩',
                categoryId: 'category_1',
                categoryName: '上门按摩',
                description: '专业上门按摩',
                galleryFileIds: [],
                reviewStatus: 'approved',
                publicationStatus: 'taken_down',
                takeDownReason: '资质过期',
                takenDownBy: 'admin_0',
                takenDownAt,
                lastApprovedDraftId: 'draft_1',
                lastApprovedAt: new Date('2026-05-17T01:00:00.000Z'),
                appealId: 'appeal_1',
                appealStatus: 'pending',
                appealReason: '已补充材料',
                appealReviewResultReason: null,
                appealTakeDownReasonSnapshot: '资质过期',
                appealTakenDownAtSnapshot: takenDownAt,
                appealCreatedAt: new Date('2026-05-18T02:00:00.000Z'),
                appealReviewedAt: null,
                createdAt: new Date('2026-05-17T01:00:00.000Z'),
                updatedAt: new Date('2026-05-18T02:00:00.000Z'),
            },
        ];
        const executeDraftItems = jest.fn((resolve) => resolve([]));
        const executeDraftTotal = jest.fn((resolve) => resolve([{ total: 0 }]));
        const executeItems = jest.fn((resolve) => resolve(rows));
        const executeTotal = jest.fn((resolve) => resolve([{ total: 1 }]));
        const executePricing = jest.fn((resolve) => resolve([]));
        const draftOffset = jest
            .fn()
            .mockReturnValue({ then: executeDraftItems });
        const draftLimit = jest.fn().mockReturnValue({ offset: draftOffset });
        const draftOrderBy = jest.fn().mockReturnValue({ limit: draftLimit });
        const draftWhereItems = jest.fn().mockReturnValue({ orderBy: draftOrderBy });
        const draftLeftJoinItems = jest.fn().mockReturnValue({ where: draftWhereItems });
        const draftInnerJoinItems = jest.fn();
        draftInnerJoinItems
            .mockReturnValueOnce({ innerJoin: draftInnerJoinItems })
            .mockReturnValueOnce({ innerJoin: draftInnerJoinItems })
            .mockReturnValueOnce({ leftJoin: draftLeftJoinItems });
        const draftFromItems = jest
            .fn()
            .mockReturnValue({ innerJoin: draftInnerJoinItems });
        const draftWhereTotal = jest.fn().mockReturnValue({ then: executeDraftTotal });
        const draftLeftJoinTotal = jest.fn().mockReturnValue({ where: draftWhereTotal });
        const draftInnerJoinTotal = jest.fn();
        draftInnerJoinTotal
            .mockReturnValueOnce({ innerJoin: draftInnerJoinTotal })
            .mockReturnValueOnce({ innerJoin: draftInnerJoinTotal })
            .mockReturnValueOnce({ leftJoin: draftLeftJoinTotal });
        const draftFromTotal = jest
            .fn()
            .mockReturnValue({ innerJoin: draftInnerJoinTotal });
        const offset = jest.fn().mockReturnValue({ then: executeItems });
        const limit = jest.fn().mockReturnValue({ offset });
        const orderBy = jest.fn().mockReturnValue({ limit });
        const whereItems = jest.fn().mockReturnValue({ orderBy });
        const leftJoinItems = jest.fn();
        leftJoinItems
            .mockReturnValueOnce({ leftJoin: leftJoinItems })
            .mockReturnValueOnce({ leftJoin: leftJoinItems })
            .mockReturnValueOnce({ where: whereItems });
        const innerJoinItems = jest.fn();
        innerJoinItems
            .mockReturnValueOnce({ innerJoin: innerJoinItems })
            .mockReturnValueOnce({ innerJoin: innerJoinItems })
            .mockReturnValueOnce({ leftJoin: leftJoinItems });
        const fromItems = jest.fn().mockReturnValue({ innerJoin: innerJoinItems });
        const whereTotal = jest.fn().mockReturnValue({ then: executeTotal });
        const leftJoinTotal = jest.fn();
        leftJoinTotal
            .mockReturnValueOnce({ leftJoin: leftJoinTotal })
            .mockReturnValueOnce({ leftJoin: leftJoinTotal })
            .mockReturnValueOnce({ where: whereTotal });
        const innerJoinTotal = jest.fn();
        innerJoinTotal
            .mockReturnValueOnce({ innerJoin: innerJoinTotal })
            .mockReturnValueOnce({ innerJoin: innerJoinTotal })
            .mockReturnValueOnce({ leftJoin: leftJoinTotal });
        const fromTotal = jest.fn().mockReturnValue({ innerJoin: innerJoinTotal });
        const select = jest
            .fn()
            .mockReturnValueOnce({ from: draftFromItems })
            .mockReturnValueOnce({ from: draftFromTotal })
            .mockReturnValueOnce({ from: fromItems })
            .mockReturnValueOnce({ from: fromTotal })
            .mockReturnValueOnce({
                from: jest.fn().mockReturnValue({
                    where: jest.fn().mockReturnValue({ then: executePricing }),
                }),
            });

        Object.defineProperty(repository, 'db', {
            value: {
                select,
            },
        });

        const result = await repository.list({
            lifecycle: 'pending_review',
            page: 1,
            limit: 10,
        });

        expect(result.items).toHaveLength(1);
        expect(result.items[0]).toMatchObject({
            kind: 'published',
            lifecycle: 'pending_review',
            appeal: {
                id: 'appeal_1',
                status: 'pending',
                appealReason: '已补充材料',
                takeDownReasonSnapshot: '资质过期',
            },
        });
        expect(whereItems).toHaveBeenCalled();
        expect(whereTotal).toHaveBeenCalled();
        expect(leftJoinItems).toHaveBeenCalledTimes(3);
        expect(leftJoinTotal).toHaveBeenCalledTimes(3);
        expect(leftJoinItems.mock.calls[2][1]).toBeDefined();
        expect(leftJoinTotal.mock.calls[2][1]).toBeDefined();
    });

    it('通过申诉恢复服务并清空当前下架字段', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const takenDownAt = new Date('2026-05-18T01:00:00.000Z');
        const appealUpdateSet = jest.fn().mockReturnValue({ where: jest.fn() });
        const statusUpdateWhere = jest.fn();
        const statusUpdateSet = jest
            .fn()
            .mockReturnValue({ where: statusUpdateWhere });
        const insertValues = jest.fn();
        const insert = jest.fn().mockReturnValue({ values: insertValues });
        const update = jest
            .fn()
            .mockReturnValueOnce({ set: appealUpdateSet })
            .mockReturnValueOnce({ set: statusUpdateSet });
        const tx = {
            select: jest
                .fn()
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                for: jest.fn().mockResolvedValue([
                                    {
                                        id: 'appeal_1',
                                        personnelUserId: 'personnel_1',
                                        serviceId: 'service_1',
                                        takenDownAtSnapshot: takenDownAt,
                                    },
                                ]),
                            }),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                for: jest.fn().mockResolvedValue([
                                    {
                                        publicationStatus: 'taken_down',
                                        reviewStatus: 'approved',
                                        takenDownAt,
                                    },
                                ]),
                            }),
                        }),
                    }),
                }),
            update,
            insert,
        };
        Object.defineProperty(repository, 'db', {
            value: {
                transaction: jest.fn((callback) => callback(tx)),
            },
        });

        await expect(
            repository.approveAppeal('appeal_1', 'admin_1'),
        ).resolves.toMatchObject({
            appealId: 'appeal_1',
            personnelUserId: 'personnel_1',
            serviceId: 'service_1',
            status: 'approved',
        });

        expect(appealUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'approved',
                reviewedBy: 'admin_1',
            }),
        );
        expect(statusUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                publicationStatus: 'active',
                reviewStatus: 'approved',
                takeDownReason: null,
                takenDownBy: null,
                takenDownAt: null,
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                personnelUserId: 'personnel_1',
                serviceId: 'service_1',
                type: 'restored',
                operatorId: 'admin_1',
            }),
        );
    });

    it('驳回申诉保留下架态并记录原因', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const set = jest.fn().mockReturnValue({
            where: jest.fn().mockReturnValue({
                returning: jest.fn().mockResolvedValue([
                    {
                        id: 'appeal_1',
                        personnelUserId: 'personnel_1',
                        serviceId: 'service_1',
                    },
                ]),
            }),
        });
        const update = jest.fn().mockReturnValue({ set });
        const insertValues = jest.fn();
        const insert = jest.fn().mockReturnValue({ values: insertValues });
        Object.defineProperty(repository, 'db', {
            value: {
                transaction: jest.fn((callback) =>
                    callback({
                        update,
                        insert,
                    }),
                ),
            },
        });

        await expect(
            repository.rejectAppeal('appeal_1', 'admin_1', '材料仍不符合要求'),
        ).resolves.toMatchObject({
            appealId: 'appeal_1',
            status: 'rejected',
        });

        expect(set).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'rejected',
                reviewResultReason: '材料仍不符合要求',
                reviewedBy: 'admin_1',
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                personnelUserId: 'personnel_1',
                serviceId: 'service_1',
                type: 'rejected',
                operatorId: 'admin_1',
                note: expect.stringContaining('申诉驳回'),
            }),
        );
        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                note: expect.stringContaining('材料仍不符合要求'),
            }),
        );
    });

    it('服务已通过整改上线时处理申诉会取消申诉', async () => {
        const repository = new AdminServiceOfferingsRepository();
        const takenDownAt = new Date('2026-05-18T01:00:00.000Z');
        const appealUpdateSet = jest.fn().mockReturnValue({ where: jest.fn() });
        const update = jest.fn().mockReturnValue({ set: appealUpdateSet });
        const tx = {
            select: jest
                .fn()
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                for: jest.fn().mockResolvedValue([
                                    {
                                        id: 'appeal_1',
                                        personnelUserId: 'personnel_1',
                                        serviceId: 'service_1',
                                        takenDownAtSnapshot: takenDownAt,
                                    },
                                ]),
                            }),
                        }),
                    }),
                })
                .mockReturnValueOnce({
                    from: jest.fn().mockReturnValue({
                        where: jest.fn().mockReturnValue({
                            limit: jest.fn().mockReturnValue({
                                for: jest.fn().mockResolvedValue([
                                    {
                                        publicationStatus: 'active',
                                        reviewStatus: 'approved',
                                        takenDownAt: null,
                                    },
                                ]),
                            }),
                        }),
                    }),
                }),
            update,
            insert: jest.fn(),
        };
        Object.defineProperty(repository, 'db', {
            value: {
                transaction: jest.fn((callback) => callback(tx)),
            },
        });

        await expect(
            repository.approveAppeal('appeal_1', 'admin_1'),
        ).resolves.toMatchObject({
            status: 'canceled',
            message: '服务已恢复上线，本次申诉自动取消',
        });

        expect(appealUpdateSet).toHaveBeenCalledWith(
            expect.objectContaining({
                status: 'canceled',
                reviewedBy: 'admin_1',
            }),
        );
        expect(tx.insert).not.toHaveBeenCalled();
    });
});
