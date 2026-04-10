import type { AdminCommissionStrategyVersion } from '@repo/types';
import { WorkerCategoryCommissionService } from './worker-category-commission.service';
import type { WorkerCategoryCommissionRepository } from './worker-category-commission.repository';

type MockRepository = jest.Mocked<
    Pick<
        WorkerCategoryCommissionRepository,
        | 'findOrderCommissionContext'
        | 'findPublishedStrategyByCategoryId'
        | 'findWorkerCreatedAt'
        | 'sumWorkerMonthlyIncomeBeforeSettlement'
    >
>;

describe('WorkerCategoryCommissionService', () => {
    let service: WorkerCategoryCommissionService;
    let repository: MockRepository;

    beforeEach(() => {
        repository = {
            findOrderCommissionContext: jest.fn(),
            findPublishedStrategyByCategoryId: jest.fn(),
            findWorkerCreatedAt: jest.fn(),
            sumWorkerMonthlyIncomeBeforeSettlement: jest.fn(),
        };

        service = new WorkerCategoryCommissionService(
            repository as unknown as WorkerCategoryCommissionRepository,
        );
    });

    it('在没有已发布动态策略时回退固定抽成', async () => {
        repository.findOrderCommissionContext.mockResolvedValue({
            orderId: 'order_1',
            categoryId: 'cat_cleaning',
            fixedCommissionRate: 35,
        });
        repository.findPublishedStrategyByCategoryId.mockResolvedValue(null);

        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_1',
            workerId: 'worker_1',
            settlementAt: new Date('2026-04-10T10:00:00.000Z'),
            settlementAmount: 200,
            originalOrderPrice: 220,
        });

        expect(result).toEqual({
            commissionRate: 35,
            settlementAmount: 200,
            originalOrderPrice: 220,
            commissionAmount: 70,
            commissionRuleType: 'fixed',
            commissionThreshold: null,
            commissionStrategyVersionId: null,
            monthlyIncomeSnapshot: null,
        });
    });

    it('在上门按摩分类命中动态阶梯规则时返回动态抽成快照', async () => {
        repository.findOrderCommissionContext.mockResolvedValue({
            orderId: 'order_2',
            categoryId: 'cat_massage',
            fixedCommissionRate: 30,
        });
        repository.findPublishedStrategyByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_dynamic',
                status: 'published',
                beginnerProtection: {
                    isEnabled: false,
                    protectionDays: 30,
                    monthlyIncomeThreshold: 3000,
                    fixedCommissionRate: 20,
                },
                rules: [
                    {
                        id: 'rule_high',
                        threshold: 5000,
                        commissionRate: 18,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                    {
                        id: 'rule_mid',
                        threshold: 3000,
                        commissionRate: 22,
                        isEnabled: true,
                        sortOrder: 1,
                    },
                ],
            }),
        );
        repository.findWorkerCreatedAt.mockResolvedValue(
            new Date('2026-01-01T00:00:00.000Z'),
        );
        repository.sumWorkerMonthlyIncomeBeforeSettlement.mockResolvedValue(
            5200,
        );

        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_2',
            workerId: 'worker_2',
            settlementAt: new Date('2026-04-10T10:00:00.000Z'),
            settlementAmount: 300,
            originalOrderPrice: 300,
        });

        expect(result).toEqual({
            commissionRate: 18,
            settlementAmount: 300,
            originalOrderPrice: 300,
            commissionAmount: 54,
            commissionRuleType: 'dynamic',
            commissionThreshold: 5000,
            commissionStrategyVersionId: 'ver_dynamic',
            monthlyIncomeSnapshot: 5200,
        });
        expect(
            repository.sumWorkerMonthlyIncomeBeforeSettlement,
        ).toHaveBeenCalledWith(
            'worker_2',
            'cat_massage',
            new Date('2026-04-10T10:00:00.000Z'),
            'order_2',
        );
    });

    it('在新人保护期内且月收入未超过门槛时命中新人保护固定抽成', async () => {
        repository.findOrderCommissionContext.mockResolvedValue({
            orderId: 'order_3',
            categoryId: 'cat_massage',
            fixedCommissionRate: 30,
        });
        repository.findPublishedStrategyByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_beginner',
                status: 'published',
                beginnerProtection: {
                    isEnabled: true,
                    protectionDays: 30,
                    monthlyIncomeThreshold: 5000,
                    fixedCommissionRate: 20,
                },
                rules: [
                    {
                        id: 'rule_default',
                        threshold: 0,
                        commissionRate: 30,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                ],
            }),
        );
        repository.findWorkerCreatedAt.mockResolvedValue(
            new Date('2026-03-20T00:00:00.000Z'),
        );
        repository.sumWorkerMonthlyIncomeBeforeSettlement.mockResolvedValue(
            4800,
        );

        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_3',
            workerId: 'worker_3',
            settlementAt: new Date('2026-04-10T10:00:00.000Z'),
            settlementAmount: 250,
            originalOrderPrice: 250,
        });

        expect(result).toEqual({
            commissionRate: 20,
            settlementAmount: 250,
            originalOrderPrice: 250,
            commissionAmount: 50,
            commissionRuleType: 'beginner-protection',
            commissionThreshold: 5000,
            commissionStrategyVersionId: 'ver_beginner',
            monthlyIncomeSnapshot: 4800,
        });
    });

    it('按退款发生月扣减后的月收入命中更低档位规则', async () => {
        repository.findOrderCommissionContext.mockResolvedValue({
            orderId: 'order_4',
            categoryId: 'cat_massage',
            fixedCommissionRate: 30,
        });
        repository.findPublishedStrategyByCategoryId.mockResolvedValue(
            createVersion({
                id: 'ver_refund_adjusted',
                status: 'published',
                beginnerProtection: {
                    isEnabled: false,
                    protectionDays: 30,
                    monthlyIncomeThreshold: 5000,
                    fixedCommissionRate: 20,
                },
                rules: [
                    {
                        id: 'rule_high',
                        threshold: 5000,
                        commissionRate: 18,
                        isEnabled: true,
                        sortOrder: 0,
                    },
                    {
                        id: 'rule_lower',
                        threshold: 3000,
                        commissionRate: 22,
                        isEnabled: true,
                        sortOrder: 1,
                    },
                ],
            }),
        );
        repository.findWorkerCreatedAt.mockResolvedValue(
            new Date('2025-12-01T00:00:00.000Z'),
        );
        repository.sumWorkerMonthlyIncomeBeforeSettlement.mockResolvedValue(
            3200,
        );

        const result = await service.resolveCommissionSnapshot({
            orderId: 'order_4',
            workerId: 'worker_4',
            settlementAt: new Date('2026-04-25T10:00:00.000Z'),
            settlementAmount: 400,
            originalOrderPrice: 400,
        });

        expect(result.commissionRuleType).toBe('dynamic');
        expect(result.commissionRate).toBe(22);
        expect(result.commissionThreshold).toBe(3000);
        expect(result.monthlyIncomeSnapshot).toBe(3200);
    });
});

function createVersion(
    overrides: Partial<AdminCommissionStrategyVersion> = {},
): AdminCommissionStrategyVersion {
    return {
        id: 'ver_default',
        strategyId: 'strategy_1',
        versionNo: 1,
        status: 'published',
        versionNote: null,
        effectiveFrom: null,
        effectiveTo: null,
        beginnerProtection: {
            isEnabled: false,
            protectionDays: 30,
            monthlyIncomeThreshold: 3000,
            fixedCommissionRate: 20,
        },
        publishedAt: '2026-04-07T00:00:00.000Z',
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
