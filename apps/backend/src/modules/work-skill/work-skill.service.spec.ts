import { BadRequestException } from '@nestjs/common';
import { UpdateServiceNonSensitiveFieldsRequestSchema } from '@repo/types';
import {
    resolveOfferingVisibilityState,
    WorkSkillRepository,
} from './work-skill.repository';
import { WorkSkillService } from './work-skill.service';

type MockWorkSkillRepository = jest.Mocked<
    Pick<
        WorkSkillRepository,
        | 'findServicesByIds'
        | 'getPersonnelInfo'
        | 'getPublishedPersonnelInfo'
        | 'updateServiceOfferings'
        | 'submitServiceOfferingsForReview'
        | 'listWorkerServices'
        | 'withdrawServiceDraft'
        | 'updateServiceNonSensitiveFields'
        | 'selfTakedownService'
        | 'deleteWorkerService'
        | 'getWorkerServiceName'
    >
>;

describe('resolveOfferingVisibilityState', () => {
    it('缺少状态行时不默认成 approved/active', () => {
        expect(resolveOfferingVisibilityState({})).toEqual({
            reviewStatus: 'pending',
            publicationStatus: 'taken_down',
        });
    });

    it('优先使用最新草稿审核状态，发布状态仍来自状态行', () => {
        expect(
            resolveOfferingVisibilityState({
                draftStatus: 'rejected',
                statusReviewStatus: 'approved',
                statusPublicationStatus: 'active',
            }),
        ).toEqual({
            reviewStatus: 'rejected',
            publicationStatus: 'active',
        });
    });
});

describe('WorkSkillService.updateServiceOfferings', () => {
    let service: WorkSkillService;
    let repository: MockWorkSkillRepository;

    beforeEach(() => {
        repository = {
            findServicesByIds: jest.fn(),
            getPersonnelInfo: jest.fn(),
            getPublishedPersonnelInfo: jest.fn(),
            updateServiceOfferings: jest.fn(),
            submitServiceOfferingsForReview: jest.fn(),
            listWorkerServices: jest.fn(),
            withdrawServiceDraft: jest.fn(),
            updateServiceNonSensitiveFields: jest.fn(),
            selfTakedownService: jest.fn(),
            deleteWorkerService: jest.fn(),
            getWorkerServiceName: jest.fn(),
        };

        service = new WorkSkillService();
        Reflect.set(service, 'workSkillRepository', repository);
    });

    it('命中按摩分类且两类证书都为空时抛出 BadRequestException', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '上门按摩',
            },
        ]);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
            }),
        ).rejects.toThrow(BadRequestException);
    });

    it('命中按摩分类且商家资质存在时允许保存', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '精油按摩',
            },
        ]);
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');
        repository.submitServiceOfferingsForReview.mockResolvedValue({
            id: 'draft_merchant',
            personnelUserId: 'worker_1',
            serviceId: 'svc_massage_1',
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
            submittedAt,
        });

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: 'file_merchant',
                vocationalQualificationFileId: null,
            }),
        ).resolves.toEqual({
            draftId: 'draft_merchant',
            status: 'pending',
            submittedAt,
            message: '已提交审核，等待管理员审核',
        });
        expect(repository.updateServiceOfferings).not.toHaveBeenCalled();
    });

    it('命中按摩分类且从业资格证书存在时允许保存', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_massage_1',
                categoryId: 'cat_child_massage',
                categoryName: '按摩子分类',
            },
        ]);
        const submittedAt = new Date('2026-05-13T01:00:00.000Z');
        repository.submitServiceOfferingsForReview.mockResolvedValue({
            id: 'draft_vocational',
            personnelUserId: 'worker_1',
            serviceId: 'svc_massage_1',
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
            submittedAt,
        });

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_massage_1',
                        description: null,
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '199',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: 'file_vocational',
            }),
        ).resolves.toEqual({
            draftId: 'draft_vocational',
            status: 'pending',
            submittedAt,
            message: '已提交审核，等待管理员审核',
        });
        expect(repository.updateServiceOfferings).not.toHaveBeenCalled();
    });

    it('提交服务信息时创建待审核稿而不是直接发布', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_clean_1',
                categoryId: 'cat_cleaning',
                categoryName: '家庭保洁',
            },
        ]);
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');
        repository.submitServiceOfferingsForReview.mockResolvedValue({
            id: 'draft_1',
            personnelUserId: 'worker_1',
            serviceId: 'svc_clean_1',
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
            submittedAt,
        });

        const payload = {
            services: [
                {
                    serviceId: 'svc_clean_1',
                    description: '深度保洁',
                    galleryFileIds: [],
                    specifications: [
                        {
                            name: '标准版',
                            price: '99',
                            currency: 'CNY',
                            estimatedDurationMinutes: 60,
                        },
                    ],
                },
            ],
            merchantQualificationFileId: null,
            vocationalQualificationFileId: null,
        };
        const result = await service.updateServiceOfferings(
            'worker_1',
            payload,
        );

        expect(repository.submitServiceOfferingsForReview).toHaveBeenCalledWith(
            'worker_1',
            payload,
        );
        expect(repository.updateServiceOfferings).not.toHaveBeenCalled();
        expect(result).toEqual({
            draftId: 'draft_1',
            status: 'pending',
            submittedAt,
            message: '已提交审核，等待管理员审核',
        });
    });

    it('一次审核请求只能提交单个服务', async () => {
        repository.findServicesByIds.mockResolvedValue([
            {
                id: 'svc_clean_1',
                categoryId: 'cat_cleaning',
                categoryName: '家庭保洁',
            },
            {
                id: 'svc_clean_2',
                categoryId: 'cat_cleaning',
                categoryName: '日常保洁',
            },
        ]);

        await expect(
            service.updateServiceOfferings('worker_1', {
                services: [
                    {
                        serviceId: 'svc_clean_1',
                        description: '深度保洁',
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '99',
                                currency: 'CNY',
                                estimatedDurationMinutes: 60,
                            },
                        ],
                    },
                    {
                        serviceId: 'svc_clean_2',
                        description: '日常保洁',
                        galleryFileIds: [],
                        specifications: [
                            {
                                name: '标准版',
                                price: '59',
                                currency: 'CNY',
                                estimatedDurationMinutes: 45,
                            },
                        ],
                    },
                ],
                merchantQualificationFileId: null,
                vocationalQualificationFileId: null,
            }),
        ).rejects.toThrow(BadRequestException);

        expect(
            repository.submitServiceOfferingsForReview,
        ).not.toHaveBeenCalled();
    });
});

describe('WorkSkillService.getPersonnelInfo visibility', () => {
    let service: WorkSkillService;
    let repository: MockWorkSkillRepository;

    beforeEach(() => {
        repository = {
            findServicesByIds: jest.fn(),
            getPersonnelInfo: jest.fn(),
            getPublishedPersonnelInfo: jest.fn(),
            updateServiceOfferings: jest.fn(),
            submitServiceOfferingsForReview: jest.fn(),
            listWorkerServices: jest.fn(),
            withdrawServiceDraft: jest.fn(),
            updateServiceNonSensitiveFields: jest.fn(),
            selfTakedownService: jest.fn(),
            deleteWorkerService: jest.fn(),
            getWorkerServiceName: jest.fn(),
        };

        service = new WorkSkillService();
        Reflect.set(service, 'workSkillRepository', repository);
    });

    it('owner 路径保留 taken_down/rejected/pending 状态和原因', async () => {
        repository.getPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            skills: [
                {
                    id: 'svc_taken_down',
                    reviewStatus: 'approved',
                    publicationStatus: 'taken_down',
                    takeDownReason: '资料不合规',
                },
                {
                    id: 'svc_rejected',
                    reviewStatus: 'rejected',
                    publicationStatus: 'active',
                    rejectionReason: '价格不合理',
                },
                {
                    id: 'svc_pending',
                    reviewStatus: 'pending',
                    publicationStatus: 'active',
                    pendingDraftId: 'draft_pending',
                },
            ],
        } as any);

        const result = await service.getPersonnelInfo('worker_1');

        expect(result?.skills).toEqual(
            expect.arrayContaining([
                expect.objectContaining({
                    id: 'svc_taken_down',
                    publicationStatus: 'taken_down',
                    takeDownReason: '资料不合规',
                }),
                expect.objectContaining({
                    id: 'svc_rejected',
                    reviewStatus: 'rejected',
                    rejectionReason: '价格不合理',
                }),
                expect.objectContaining({
                    id: 'svc_pending',
                    reviewStatus: 'pending',
                    pendingDraftId: 'draft_pending',
                }),
            ]),
        );
        expect(repository.getPublishedPersonnelInfo).not.toHaveBeenCalled();
    });

    it('public 路径调用公开过滤查询', async () => {
        repository.getPublishedPersonnelInfo.mockResolvedValue({
            userId: 'worker_1',
            skills: [{ id: 'svc_active', publicationStatus: 'active' }],
        } as any);

        const result = await service.getPublishedPersonnelInfo('worker_1');

        expect(repository.getPublishedPersonnelInfo).toHaveBeenCalledWith(
            'worker_1',
            undefined,
        );
        expect(result?.skills).toEqual([
            expect.objectContaining({ id: 'svc_active' }),
        ]);
        expect(repository.getPersonnelInfo).not.toHaveBeenCalled();
    });
});

describe('WorkSkillService worker service audit aggregation', () => {
    let service: WorkSkillService;
    let repository: MockWorkSkillRepository;

    beforeEach(() => {
        repository = {
            findServicesByIds: jest.fn(),
            getPersonnelInfo: jest.fn(),
            getPublishedPersonnelInfo: jest.fn(),
            updateServiceOfferings: jest.fn(),
            submitServiceOfferingsForReview: jest.fn(),
            listWorkerServices: jest.fn(),
            withdrawServiceDraft: jest.fn(),
            updateServiceNonSensitiveFields: jest.fn(),
            selfTakedownService: jest.fn(),
            deleteWorkerService: jest.fn(),
            getWorkerServiceName: jest.fn(),
        };

        service = new WorkSkillService();
        Reflect.set(service, 'workSkillRepository', repository);
    });

    it('active offering 有 pending draft 时返回 active_with_pending_update', async () => {
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');
        repository.listWorkerServices.mockResolvedValue([
            {
                serviceId: 'svc_1',
                serviceName: '家庭保洁',
                serviceIconUrl: null,
                derivedStatus: 'active_with_pending_update',
                current: {
                    description: '当前描述',
                    categoryId: 'cat_cleaning',
                    categoryName: '保洁',
                    galleryFileIds: [],
                    gallery: [],
                    specifications: [],
                    pricing: null,
                },
                draft: {
                    id: 'draft_1',
                    status: 'pending',
                    submittedAt,
                    reviewedAt: null,
                    rejectionReason: null,
                    snapshot: {
                        services: [
                            {
                                serviceId: 'svc_1',
                                description: '待审核描述',
                                galleryFileIds: [],
                                gallery: [],
                                specifications: [],
                            },
                        ],
                        merchantQualificationFileId: null,
                        vocationalQualificationFileId: null,
                    },
                },
                auditLogs: [],
                statusReason: null,
                lastSubmittedAt: submittedAt,
                lastReviewedAt: null,
                takenDownReason: null,
                updatedAt: submittedAt,
            },
        ]);

        const result = await service.listWorkerServices('worker_1');

        expect(result[0]).toMatchObject({
            serviceId: 'svc_1',
            derivedStatus: 'active_with_pending_update',
            draft: { id: 'draft_1' },
        });
        expect(repository.listWorkerServices).toHaveBeenCalledWith('worker_1');
    });

    it('只撤回当前服务人员自己的 pending draft', async () => {
        const response = {
            serviceId: 'svc_1',
            withdrawn: true,
            message: '已撤回提交',
        };
        repository.withdrawServiceDraft.mockResolvedValue(response);

        await expect(
            service.withdrawServiceDraft('worker_1', 'svc_1'),
        ).resolves.toBe(response);
        expect(repository.withdrawServiceDraft).toHaveBeenCalledWith(
            'worker_1',
            'svc_1',
        );
    });

    it('非敏感字段硬下线时透传固定拒绝', async () => {
        repository.updateServiceNonSensitiveFields.mockRejectedValue(
            new BadRequestException(
                '暂无可直接保存的非敏感字段，请使用提交审核',
            ),
        );

        await expect(
            service.updateServiceNonSensitiveFields('worker_1', {
                serviceId: 'svc_1',
            }),
        ).rejects.toThrow('暂无可直接保存的非敏感字段，请使用提交审核');
        expect(repository.updateServiceNonSensitiveFields).toHaveBeenCalledWith(
            'worker_1',
            {
                serviceId: 'svc_1',
            },
        );
    });

    it('服务人员主动下架时委托 repository 并记录当前人员', async () => {
        const response = { serviceId: 'svc_1', takenDown: true as const };
        repository.selfTakedownService.mockResolvedValue(response);

        await expect(
            service.selfTakedownService('worker_1', 'svc_1'),
        ).resolves.toBe(response);
        expect(repository.selfTakedownService).toHaveBeenCalledWith(
            'worker_1',
            'svc_1',
        );
    });

    it('删除整个服务时 confirmName 不匹配则拒绝', async () => {
        repository.getWorkerServiceName.mockResolvedValue('家庭保洁');

        await expect(
            service.deleteWorkerService('worker_1', 'svc_1', '搬家服务'),
        ).rejects.toThrow('服务名称不匹配');
        expect(repository.deleteWorkerService).not.toHaveBeenCalled();
    });

    it('删除整个服务时 confirmName 匹配则委托 repository', async () => {
        const response = { serviceId: 'svc_1', deleted: true as const };
        repository.getWorkerServiceName.mockResolvedValue('家庭保洁');
        repository.deleteWorkerService.mockResolvedValue(response);

        await expect(
            service.deleteWorkerService('worker_1', 'svc_1', '家庭保洁'),
        ).resolves.toBe(response);
        expect(repository.deleteWorkerService).toHaveBeenCalledWith(
            'worker_1',
            'svc_1',
        );
    });
});

describe('WorkSkillRepository worker service aggregation mapping', () => {
    const baseService = {
        id: 'svc_1',
        name: '家庭保洁',
        serviceIconUrl: null,
        categoryId: 'cat_cleaning',
        categoryName: '保洁',
        personnelDescription: '当前描述',
        galleryFileIds: [],
        specifications: [],
        lastApprovedAt: null,
        takenDownAt: null,
        takeDownReason: null,
        pendingDraftId: null,
        draft: null,
    };

    it('没有真实状态行且有 pending draft 时返回 pending 且 current 为 null', async () => {
        const repository = new WorkSkillRepository();
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');

        const result = await (repository as any).toWorkerServiceItem(
            {
                ...baseService,
                hasOfferingStatus: false,
                publicationStatus: 'taken_down',
                reviewStatus: 'pending',
                pendingDraftId: 'draft_pending',
                rejectionReason: null,
                draft: {
                    id: 'draft_pending',
                    status: 'pending',
                    submittedAt,
                    reviewedAt: null,
                    rejectionReason: null,
                    submittedSnapshot: {
                        services: [
                            {
                                serviceId: 'svc_1',
                                description: '待审核描述',
                                galleryFileIds: [],
                                gallery: [],
                                specifications: [],
                            },
                        ],
                        merchantQualificationFileId: null,
                        vocationalQualificationFileId: null,
                    },
                    createdAt: submittedAt,
                    updatedAt: submittedAt,
                },
            },
            [],
        );

        expect(result).toMatchObject({
            derivedStatus: 'pending',
            current: null,
            draft: { id: 'draft_pending', status: 'pending' },
        });
    });

    it('没有真实状态行且有 rejected draft 时返回 rejected 且 current 为 null', async () => {
        const repository = new WorkSkillRepository();
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');
        const reviewedAt = new Date('2026-05-13T01:00:00.000Z');

        const result = await (repository as any).toWorkerServiceItem(
            {
                ...baseService,
                hasOfferingStatus: false,
                publicationStatus: 'taken_down',
                reviewStatus: 'rejected',
                rejectionReason: '材料不完整',
                draft: {
                    id: 'draft_rejected',
                    status: 'rejected',
                    submittedAt,
                    reviewedAt,
                    rejectionReason: '材料不完整',
                    submittedSnapshot: {
                        services: [
                            {
                                serviceId: 'svc_1',
                                description: '待审核描述',
                                galleryFileIds: [],
                                gallery: [],
                                specifications: [],
                            },
                        ],
                        merchantQualificationFileId: null,
                        vocationalQualificationFileId: null,
                    },
                    createdAt: submittedAt,
                    updatedAt: reviewedAt,
                },
            },
            [],
        );

        expect(result).toMatchObject({
            derivedStatus: 'rejected',
            current: null,
            statusReason: '材料不完整',
            draft: { id: 'draft_rejected', status: 'rejected' },
        });
    });

    it('为当前服务和待审核草稿补齐图片访问地址', async () => {
        const repository = new WorkSkillRepository();
        const submittedAt = new Date('2026-05-13T00:00:00.000Z');
        const getFileAccessInfo = jest.fn(async (fileId: string) => ({
            fileUrl: `https://cdn.example.com/${fileId}.jpg`,
            fileName: `${fileId}.jpg`,
            mimeType: 'image/jpeg',
            fileSize: 1024,
            expiresIn: 3600,
            blurhash: `blur-${fileId}`,
        }));
        Reflect.set(repository, 'filesService', { getFileAccessInfo });

        const result = await (repository as any).toWorkerServiceItem(
            {
                ...baseService,
                hasOfferingStatus: true,
                publicationStatus: 'active',
                reviewStatus: 'pending',
                galleryFileIds: ['current_file'],
                pendingDraftId: 'draft_pending',
                rejectionReason: null,
                draft: {
                    id: 'draft_pending',
                    status: 'pending',
                    submittedAt,
                    reviewedAt: null,
                    rejectionReason: null,
                    submittedSnapshot: {
                        services: [
                            {
                                serviceId: 'svc_1',
                                description: '待审核描述',
                                galleryFileIds: ['draft_file'],
                                gallery: [],
                                specifications: [],
                            },
                        ],
                        merchantQualificationFileId: null,
                        vocationalQualificationFileId: null,
                    },
                    createdAt: submittedAt,
                    updatedAt: submittedAt,
                },
            },
            [],
        );

        expect(result.current?.gallery).toEqual([
            expect.objectContaining({
                fileId: 'current_file',
                url: 'https://cdn.example.com/current_file.jpg',
            }),
        ]);
        expect(result.draft?.snapshot.services[0]).toEqual(
            expect.objectContaining({
                galleryFileIds: ['draft_file'],
                gallery: [
                    expect.objectContaining({
                        fileId: 'draft_file',
                        url: 'https://cdn.example.com/draft_file.jpg',
                    }),
                ],
            }),
        );
        expect(getFileAccessInfo).toHaveBeenCalledWith('current_file');
        expect(getFileAccessInfo).toHaveBeenCalledWith('draft_file');
    });
});

describe('WorkSkillRepository.withdrawServiceDraft', () => {
    it('先写入审计日志再删除 pending draft，避免 FK 违规', async () => {
        const repository = new WorkSkillRepository();
        const draft = {
            id: 'draft_1',
            personnelUserId: 'worker_1',
            serviceId: 'svc_1',
            status: 'pending',
        };
        const order: string[] = [];
        const topLimit = jest.fn().mockResolvedValue([draft]);
        const topOrderBy = jest.fn().mockReturnValue({ limit: topLimit });
        const topWhere = jest.fn().mockReturnValue({ orderBy: topOrderBy });
        const topFrom = jest.fn().mockReturnValue({ where: topWhere });
        const topSelect = jest.fn().mockReturnValue({ from: topFrom });
        const insertValues = jest.fn().mockImplementation(() => {
            order.push('insert_audit');
            return undefined;
        });
        const insert = jest.fn().mockReturnValue({ values: insertValues });
        const deleteReturning = jest.fn().mockImplementation(() => {
            order.push('delete_draft');
            return [{ id: 'draft_1' }];
        });
        const deleteWhere = jest.fn().mockImplementation(() => {
            return { returning: deleteReturning };
        });
        const deleteDraft = jest.fn().mockReturnValue({ where: deleteWhere });
        const transaction = jest.fn(async (callback) =>
            callback({ select: topSelect, insert, delete: deleteDraft }),
        );

        Reflect.set(repository, 'db', {
            transaction,
        });

        await expect(
            repository.withdrawServiceDraft('worker_1', 'svc_1'),
        ).resolves.toEqual({
            serviceId: 'svc_1',
            withdrawn: true,
            message: '已撤回提交',
        });

        expect(insertValues).toHaveBeenCalledWith(
            expect.objectContaining({
                personnelUserId: 'worker_1',
                serviceId: 'svc_1',
                draftId: 'draft_1',
                type: 'withdrawn',
                note: '服务人员撤回提交',
            }),
        );
        expect(deleteWhere).toHaveBeenCalledWith(expect.anything());
        expect(deleteReturning).toHaveBeenCalledWith({ id: expect.anything() });
        expect(order).toEqual(['insert_audit', 'delete_draft']);
    });

    it('条件删除未返回 pending 草稿时抛错', async () => {
        const repository = new WorkSkillRepository();
        const draft = {
            id: 'draft_1',
            personnelUserId: 'worker_1',
            serviceId: 'svc_1',
            status: 'pending',
        };
        const topLimit = jest.fn().mockResolvedValue([draft]);
        const topOrderBy = jest.fn().mockReturnValue({ limit: topLimit });
        const topWhere = jest.fn().mockReturnValue({ orderBy: topOrderBy });
        const topFrom = jest.fn().mockReturnValue({ where: topWhere });
        const topSelect = jest.fn().mockReturnValue({ from: topFrom });
        const insert = jest.fn().mockReturnValue({ values: jest.fn() });
        const deleteReturning = jest.fn().mockReturnValue([]);
        const deleteWhere = jest
            .fn()
            .mockReturnValue({ returning: deleteReturning });
        const deleteDraft = jest.fn().mockReturnValue({ where: deleteWhere });
        const transaction = jest.fn(async (callback) =>
            callback({ select: topSelect, insert, delete: deleteDraft }),
        );

        Reflect.set(repository, 'db', { transaction });

        await expect(
            repository.withdrawServiceDraft('worker_1', 'svc_1'),
        ).rejects.toThrow('当前服务没有可撤回的审核提交');
    });
});

describe('WorkSkillRepository service audit timeline mapping', () => {
    it('保留 withdrawn 类型且继续将 restored 映射为 updated', async () => {
        const repository = new WorkSkillRepository();
        const withdrawnAt = new Date('2026-05-13T02:00:00.000Z');
        const restoredAt = new Date('2026-05-13T03:00:00.000Z');
        const findMany = jest.fn().mockResolvedValue([
            {
                id: 'log_withdrawn',
                serviceId: 'svc_1',
                type: 'withdrawn',
                occurredAt: withdrawnAt,
                operatorId: null,
                note: '服务人员撤回提交',
            },
            {
                id: 'log_restored',
                serviceId: 'svc_1',
                type: 'restored',
                occurredAt: restoredAt,
                operatorId: 'admin_1',
                note: null,
            },
        ]);

        Reflect.set(repository, 'db', {
            query: {
                serviceOfferingAuditLogs: {
                    findMany,
                },
            },
        });

        const logs = await (repository as any).listServiceAuditLogs('worker_1');

        expect(logs.get('svc_1')).toEqual([
            {
                id: 'log_withdrawn',
                type: 'withdrawn',
                occurredAt: withdrawnAt,
                operatorId: null,
                note: '服务人员撤回提交',
            },
            {
                id: 'log_restored',
                type: 'updated',
                occurredAt: restoredAt,
                operatorId: 'admin_1',
                note: null,
            },
        ]);
    });
});

describe('WorkSkillRepository.updateServiceNonSensitiveFields', () => {
    it('接受默认规格作为非敏感字段', () => {
        expect(
            UpdateServiceNonSensitiveFieldsRequestSchema.safeParse({
                serviceId: 'svc_1',
                defaultSpecId: 'pricing_1',
            }).success,
        ).toBe(true);
    });

    it('未提供非敏感字段时拒绝请求', () => {
        expect(
            UpdateServiceNonSensitiveFieldsRequestSchema.safeParse({
                serviceId: 'svc_1',
            }).success,
        ).toBe(false);
    });

    it('非敏感字段请求不接受 categoryId', () => {
        expect(
            UpdateServiceNonSensitiveFieldsRequestSchema.safeParse({
                serviceId: 'svc_1',
                categoryId: 'cat_1',
            }).success,
        ).toBe(false);
    });
});

describe('WorkSkillRepository.submitServiceOfferingsForReview', () => {
    it('已有 pending 草稿时使用原子 upsert 更新草稿', async () => {
        const repository = new WorkSkillRepository();
        jest.spyOn(repository, 'isServicePersonnelExists').mockResolvedValue(
            true,
        );

        const draft = {
            id: 'draft_1',
            personnelUserId: 'worker_1',
            serviceId: 'svc_clean_1',
            submittedSnapshot: {},
            status: 'pending' as const,
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            submittedAt: new Date('2026-05-13T00:00:00.000Z'),
            createdAt: new Date('2026-05-13T00:00:00.000Z'),
            updatedAt: new Date('2026-05-13T00:01:00.000Z'),
        };
        const returning = jest.fn().mockResolvedValue([draft]);
        const onConflictDoUpdate = jest.fn().mockReturnValue({ returning });
        const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
        const insertDraft = jest.fn().mockReturnValue({ values });
        const pendingLimit = jest.fn().mockResolvedValue([]);
        const rejectedLimit = jest.fn().mockResolvedValue([]);
        const orderBy = jest.fn().mockReturnValue({ limit: rejectedLimit });
        const where = jest
            .fn()
            .mockReturnValueOnce({ limit: pendingLimit })
            .mockReturnValueOnce({ orderBy });
        const from = jest.fn().mockReturnValue({ where });
        const select = jest.fn().mockReturnValue({ from });
        const insertAuditValues = jest.fn().mockResolvedValue(undefined);
        const insert = jest
            .fn()
            .mockReturnValueOnce({ values })
            .mockReturnValueOnce({ values: insertAuditValues });
        const transaction = jest.fn(async (callback) =>
            callback({ select, insert }),
        );

        Reflect.set(repository, 'db', {
            select,
            insert: insertDraft,
            transaction,
        });

        const payload = {
            services: [
                {
                    serviceId: 'svc_clean_1',
                    description: '深度保洁',
                    galleryFileIds: ['file_1', 'file_1'],
                    specifications: [
                        {
                            name: '标准版',
                            price: '99',
                            currency: 'CNY',
                            estimatedDurationMinutes: 60,
                        },
                    ],
                },
            ],
            merchantQualificationFileId: null,
            vocationalQualificationFileId: null,
        };

        const result = await repository.submitServiceOfferingsForReview(
            'worker_1',
            payload,
        );

        expect(values).toHaveBeenCalledWith({
            personnelUserId: 'worker_1',
            serviceId: 'svc_clean_1',
            status: 'pending',
            submittedAt: expect.any(Date),
            submittedSnapshot: {
                ...payload,
                services: [
                    {
                        ...payload.services[0],
                        galleryFileIds: ['file_1'],
                    },
                ],
            },
        });
        expect(onConflictDoUpdate).toHaveBeenCalledWith(
            expect.objectContaining({
                target: expect.anything(),
                targetWhere: expect.anything(),
                set: expect.objectContaining({
                    rejectionReason: null,
                    reviewedBy: null,
                    reviewedAt: null,
                    submittedAt: expect.any(Date),
                    submittedSnapshot: {
                        ...payload,
                        services: [
                            {
                                ...payload.services[0],
                                galleryFileIds: ['file_1'],
                            },
                        ],
                    },
                    updatedAt: expect.any(Date),
                }),
            }),
        );
        expect(insertAuditValues).toHaveBeenCalledWith({
            personnelUserId: 'worker_1',
            serviceId: 'svc_clean_1',
            draftId: 'draft_1',
            type: 'submitted',
            occurredAt: expect.any(Date),
            note: null,
        });
        expect(result).toBe(draft);
    });
});
