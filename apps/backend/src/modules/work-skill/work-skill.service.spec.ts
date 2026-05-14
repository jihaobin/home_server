import { BadRequestException } from '@nestjs/common';
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
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
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
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
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
            submittedSnapshot: {},
            status: 'pending',
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: submittedAt,
            updatedAt: submittedAt,
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
        const result = await service.updateServiceOfferings('worker_1', payload);

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

describe('WorkSkillRepository.submitServiceOfferingsForReview', () => {
    it('已有 pending 草稿时使用原子 upsert 更新草稿', async () => {
        const repository = new WorkSkillRepository();
        jest.spyOn(repository, 'isServicePersonnelExists').mockResolvedValue(
            true,
        );

        const draft = {
            id: 'draft_1',
            personnelUserId: 'worker_1',
            submittedSnapshot: {},
            status: 'pending' as const,
            rejectionReason: null,
            reviewedBy: null,
            reviewedAt: null,
            createdAt: new Date('2026-05-13T00:00:00.000Z'),
            updatedAt: new Date('2026-05-13T00:01:00.000Z'),
        };
        const returning = jest.fn().mockResolvedValue([draft]);
        const onConflictDoUpdate = jest.fn().mockReturnValue({ returning });
        const values = jest.fn().mockReturnValue({ onConflictDoUpdate });
        const insert = jest.fn().mockReturnValue({ values });
        const select = jest.fn();

        Reflect.set(repository, 'db', {
            insert,
            select,
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

        expect(select).not.toHaveBeenCalled();
        expect(values).toHaveBeenCalledWith({
            personnelUserId: 'worker_1',
            status: 'pending',
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
        expect(result).toBe(draft);
    });
});
