import type {
    AdminCommissionStrategyDetail,
    AdminCommissionStrategyVersion,
    SaveAdminCommissionStrategyDraftInput,
} from '@repo/types';
import { AdminServiceCategoryCommissionStrategyService } from './admin-service-category-commission-strategy.service';
import { AdminServiceCategoryCommissionStrategyRepository } from './admin-service-category-commission-strategy.repository';
import type { AdminServiceCategoryCommissionStrategyRepository as AdminServiceCategoryCommissionStrategyRepositoryType } from './admin-service-category-commission-strategy.repository';
import {
    categoryCommissionStrategies,
    categoryCommissionStrategyRules,
    categoryCommissionStrategyVersions,
} from 'src/common/database/schema';

type MockRepository = jest.Mocked<
    Pick<
        AdminServiceCategoryCommissionStrategyRepositoryType,
        | 'findCategoryById'
        | 'findStrategyCategoryId'
        | 'findStrategyDetailByCategoryId'
        | 'saveDraft'
        | 'findDraftVersionByCategoryId'
        | 'findCurrentPublishedVersionByCategoryId'
        | 'publishDraftVersion'
    >
>;

describe('AdminServiceCategoryCommissionStrategyService', () => {
    let service: AdminServiceCategoryCommissionStrategyService;
    let repository: MockRepository;

    beforeEach(() => {
        repository = {
            findCategoryById: jest.fn(),
            findStrategyCategoryId: jest.fn(),
            findStrategyDetailByCategoryId: jest.fn(),
            saveDraft: jest.fn(),
            findDraftVersionByCategoryId: jest.fn(),
            findCurrentPublishedVersionByCategoryId: jest.fn(),
            publishDraftVersion: jest.fn(),
        };

        repository.findCategoryById.mockResolvedValue({
            id: 'cat_massage',
            name: '上门按摩',
            commissionRate: 30,
        });
        repository.findStrategyCategoryId.mockResolvedValue(null);

        service = new AdminServiceCategoryCommissionStrategyService(
            repository as unknown as AdminServiceCategoryCommissionStrategyRepository,
        );
    });

    it('rejects publish when all dynamic rules are disabled', async () => {
        repository.findDraftVersionByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_draft',
                status: 'draft',
                rules: [
                    {
                        id: 'rule_disabled',
                        threshold: 0,
                        commissionRate: 18,
                        isEnabled: false,
                        sortOrder: 0,
                    },
                ],
            }),
        );

        await expect(
            service.publishDraft({
                categoryId: 'cat_massage',
                operatorId: 'admin_1',
                publishReason: 'manual publish',
            }),
        ).rejects.toThrow('至少保留一条启用的动态规则');
    });

    it('rejects publish when enabled rules do not cover threshold 0', async () => {
        repository.findDraftVersionByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_draft',
                status: 'draft',
                rules: [
                    {
                        id: 'rule_5000',
                        threshold: 5000,
                        commissionRate: 35,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                    {
                        id: 'rule_10000',
                        threshold: 10000,
                        commissionRate: 25,
                        isEnabled: true,
                        sortOrder: 1,
                    },
                ],
            }),
        );

        await expect(
            service.publishDraft({
                categoryId: 'cat_massage',
                operatorId: 'admin_1',
                publishReason: 'manual publish',
            }),
        ).rejects.toThrow('启用规则必须覆盖 0 门槛，否则低收入会回退固定抽成');
    });

    it('returns beginner protection rate when income is within threshold', async () => {
        repository.findCurrentPublishedVersionByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_published',
                status: 'published',
                beginnerProtection: {
                    isEnabled: true,
                    protectionDays: 30,
                    monthlyIncomeThreshold: 5000,
                    fixedCommissionRate: 20,
                },
                rules: [
                    {
                        id: 'rule_base',
                        threshold: 0,
                        commissionRate: 30,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                ],
            }),
        );

        const result = await service.simulate({
            categoryId: 'cat_massage',
            workerId: 'worker_1',
            settlementDate: '2026-04-10T10:00:00.000Z',
            monthlyIncomeBeforeSettlement: 5000,
            isWithinBeginnerProtection: true,
        });

        expect(result.ruleType).toBe('beginner-protection');
        expect(result.commissionRate).toBe(20);
    });

    it('falls back to fixed category rate when no enabled rule matches', async () => {
        repository.findCurrentPublishedVersionByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_published',
                status: 'published',
                rules: [
                    {
                        id: 'rule_high_threshold',
                        threshold: 5000,
                        commissionRate: 15,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                ],
            }),
        );

        const result = await service.simulate({
            categoryId: 'cat_massage',
            workerId: 'worker_1',
            settlementDate: '2026-04-10T10:00:00.000Z',
            monthlyIncomeBeforeSettlement: 1000,
            isWithinBeginnerProtection: false,
        });

        expect(result.ruleType).toBe('fixed');
        expect(result.commissionRate).toBe(30);
    });

    it('allows existing strategy records even if the category name has changed', async () => {
        repository.findCategoryById.mockResolvedValue({
            id: 'cat_massage',
            name: '高端上门按摩',
            commissionRate: 30,
        });
        repository.findStrategyDetailByCategoryId.mockResolvedValue({
            categoryId: 'cat_massage',
            categoryName: '高端上门按摩',
            fixedCommissionRate: 30,
            strategyId: 'strategy_existing',
            strategyName: '上门按摩抽成策略',
            status: 'published',
            draftVersion: null,
            currentPublishedVersion: createVersion({
                id: 'ver_published',
                status: 'published',
            }),
        });
        repository.findCurrentPublishedVersionByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_published',
                status: 'published',
                rules: [
                    {
                        id: 'rule_base',
                        threshold: 0,
                        commissionRate: 25,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                ],
            }),
        );

        const result = await service.simulate({
            categoryId: 'cat_massage',
            workerId: 'worker_renamed',
            settlementDate: '2026-04-10T10:00:00.000Z',
            monthlyIncomeBeforeSettlement: 6000,
            isWithinBeginnerProtection: false,
        });

        expect(result.ruleType).toBe('dynamic');
        expect(result.commissionRate).toBe(25);
    });

    it('allows first draft creation even if the category has already been renamed', async () => {
        repository.findCategoryById.mockResolvedValue({
            id: 'cat_massage',
            name: '高端上门按摩',
            commissionRate: 30,
        });
        repository.findStrategyDetailByCategoryId.mockResolvedValue(null);
        repository.findStrategyCategoryId.mockResolvedValue(null);
        repository.saveDraft.mockResolvedValue({
            categoryId: 'cat_massage',
            categoryName: '高端上门按摩',
            fixedCommissionRate: 30,
            strategyId: 'strategy_new',
            strategyName: '上门按摩抽成策略',
            status: 'draft',
            draftVersion: createVersion({
                id: 'ver_draft',
                status: 'draft',
            }),
            currentPublishedVersion: null,
        });

        const result = await service.saveDraft({
            categoryId: 'cat_massage',
            operatorId: 'admin_1',
            payload: {
                categoryId: 'cat_massage',
                beginnerProtection: {
                    isEnabled: true,
                    protectionDays: 30,
                    monthlyIncomeThreshold: 5000,
                    fixedCommissionRate: 20,
                },
                rules: [
                    {
                        id: 'rule_base',
                        threshold: 0,
                        commissionRate: 30,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                ],
            },
        });

        expect(result.strategyId).toBe('strategy_new');
        expect(repository.saveDraft).toHaveBeenCalled();
    });
});

describe('AdminServiceCategoryCommissionStrategyRepository.saveDraft', () => {
    it('copies published version as initial draft when only published exists', async () => {
        const selectResultsQueue: unknown[] = [
            [
                {
                    id: 'strategy_1',
                    status: 'published',
                    currentVersionId: 'ver_published_1',
                },
            ],
            [],
            [
                {
                    id: 'ver_published_1',
                    versionNo: 3,
                    beginnerProtectionIsEnabled: true,
                    beginnerProtectionDays: 45,
                    beginnerProtectionMonthlyIncomeThreshold: 8888,
                    beginnerProtectionFixedCommissionRate: 12,
                },
            ],
            [
                {
                    id: 'rule_from_published',
                    threshold: 3000,
                    commissionRate: 18,
                    isEnabled: true,
                    sortOrder: 0,
                },
            ],
            [{ versionNo: 3 }],
        ];
        const versionInsertValues: unknown[] = [];
        const versionUpdateValues: unknown[] = [];
        const rulesInsertValues: unknown[] = [];
        const popSelectResult = () => {
            const next = selectResultsQueue.shift();
            if (!next) {
                throw new Error('select queue exhausted');
            }
            return next;
        };

        const tx = {
            select: jest.fn(() => ({
                from: jest.fn(() => ({
                    where: jest.fn(() => ({
                        orderBy: jest.fn(() => {
                            const next = popSelectResult();
                            return {
                                limit: jest.fn(() => next),
                                then: (resolve: (value: unknown) => unknown) =>
                                    Promise.resolve(resolve(next)),
                            };
                        }),
                        limit: jest.fn(() => popSelectResult()),
                    })),
                })),
            })),
            insert: jest.fn((table) => ({
                values: jest.fn((values) => {
                    if (table === categoryCommissionStrategyVersions) {
                        versionInsertValues.push(values);
                        return {
                            returning: jest.fn(() => [{ id: 'ver_draft_new' }]),
                        };
                    }

                    if (table === categoryCommissionStrategyRules) {
                        rulesInsertValues.push(values);
                    }

                    if (table === categoryCommissionStrategies) {
                        return {
                            returning: jest.fn(() => [
                                {
                                    id: 'strategy_new',
                                    status: 'draft',
                                    currentVersionId: null,
                                },
                            ]),
                        };
                    }

                    return undefined;
                }),
            })),
            update: jest.fn((table) => ({
                set: jest.fn((values) => ({
                    where: jest.fn(() => {
                        if (table === categoryCommissionStrategyVersions) {
                            versionUpdateValues.push(values);
                        }
                        return undefined;
                    }),
                })),
            })),
            delete: jest.fn(() => ({
                where: jest.fn(() => undefined),
            })),
        };

        const db = {
            transaction: jest.fn((callback) => callback(tx)),
        };

        const repository = new AdminServiceCategoryCommissionStrategyRepository(
            db as any,
        );

        const detail: AdminCommissionStrategyDetail = {
            categoryId: 'cat_massage',
            categoryName: '上门按摩',
            fixedCommissionRate: 30,
            strategyId: 'strategy_1',
            strategyName: '上门按摩抽成策略',
            status: 'published',
            draftVersion: createVersion({
                id: 'ver_draft_new',
                status: 'draft',
                versionNo: 4,
            }),
            currentPublishedVersion: createVersion({
                id: 'ver_published_1',
                status: 'published',
                versionNo: 3,
            }),
        };

        jest.spyOn(
            repository,
            'findStrategyDetailByCategoryId',
        ).mockResolvedValue(detail);

        const payload: SaveAdminCommissionStrategyDraftInput = {
            categoryId: 'cat_massage',
            beginnerProtection: {
                isEnabled: false,
                protectionDays: 30,
                monthlyIncomeThreshold: 5000,
                fixedCommissionRate: 20,
            },
            rules: [
                {
                    id: 'rule_from_payload',
                    threshold: 1000,
                    commissionRate: 22,
                    isEnabled: true,
                    sortOrder: 0,
                },
            ],
        };

        await repository.saveDraft({
            categoryId: 'cat_massage',
            categoryName: '上门按摩',
            operatorId: 'admin_1',
            payload,
        });

        expect(versionInsertValues).toEqual([
            expect.objectContaining({
                strategyId: 'strategy_1',
                status: 'draft',
                beginnerProtectionIsEnabled: true,
                beginnerProtectionDays: 45,
                beginnerProtectionMonthlyIncomeThreshold: 8888,
                beginnerProtectionFixedCommissionRate: 12,
            }),
        ]);
        expect(versionUpdateValues).toEqual([
            expect.objectContaining({
                beginnerProtectionIsEnabled: false,
                beginnerProtectionDays: 30,
                beginnerProtectionMonthlyIncomeThreshold: 5000,
                beginnerProtectionFixedCommissionRate: 20,
            }),
        ]);
        expect(rulesInsertValues).toHaveLength(2);
        expect(rulesInsertValues[0]).toEqual([
            expect.objectContaining({
                strategyVersionId: 'ver_draft_new',
                id: expect.any(String),
                threshold: 3000,
                commissionRate: 18,
                isEnabled: true,
                sortOrder: 0,
            }),
        ]);
        expect(rulesInsertValues[1]).toEqual([
            expect.objectContaining({
                strategyVersionId: 'ver_draft_new',
                id: 'rule_from_payload',
                threshold: 1000,
                commissionRate: 22,
                isEnabled: true,
                sortOrder: 0,
            }),
        ]);
    });
});

function createVersion(
    overrides: Partial<AdminCommissionStrategyVersion> = {},
): AdminCommissionStrategyVersion {
    return {
        id: 'ver_default',
        strategyId: 'strategy_1',
        versionNo: 1,
        status: 'draft',
        versionNote: null,
        effectiveFrom: null,
        effectiveTo: null,
        beginnerProtection: {
            isEnabled: false,
            protectionDays: 30,
            monthlyIncomeThreshold: 3000,
            fixedCommissionRate: 20,
        },
        publishedAt: null,
        createdAt: '2026-04-07T00:00:00.000Z',
        updatedAt: '2026-04-07T00:00:00.000Z',
        rules: [
            {
                id: 'rule_default',
                threshold: 0,
                commissionRate: 30,
                isEnabled: true,
                sortOrder: 0,
            },
        ],
        ...overrides,
    };
}
