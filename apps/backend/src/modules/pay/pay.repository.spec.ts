import { PayRepository } from './pay.repository';

describe('PayRepository earnings record mapping', () => {
    let repository: PayRepository;

    beforeEach(() => {
        repository = new PayRepository();
    });

    const mapFinancialRecord = (overrides: Record<string, unknown> = {}) =>
        (repository as any).mapFinancialTransactionRecord({
            id: 'ft_1',
            amount: '88.00',
            currency: 'CNY',
            description: '订单收益入账',
            referenceId: 'ref_1',
            metadata: JSON.stringify({
                commissionRate: 20,
                settlementAmount: 108,
                originalOrderPrice: 128,
                commissionAmount: 20,
                commissionRuleType: 'fixed',
            }),
            customerName: '张三',
            customerPhone: '13800000000',
            transactionType: 'service_earning',
            createdAt: new Date('2026-04-09T12:00:00.000Z'),
            withdrawalId: null,
            withdrawalStatus: null,
            withdrawalReviewNote: null,
            withdrawalFailureReason: null,
            withdrawalProviderState: null,
            withdrawalProviderAppId: null,
            withdrawalProviderBillNo: null,
            withdrawalProviderPackageInfo: null,
            withdrawalProviderMeta: null,
            withdrawalRemark: null,
            withdrawalMethod: null,
            withdrawalRequestedAt: null,
            withdrawalReviewedAt: null,
            withdrawalProcessedAt: null,
            withdrawalPayoutReferenceId: null,
            serviceName: '联表服务名',
            specificationName: '联表规格名',
            ...overrides,
        });

    it('优先返回 metadata 中的服务名称与规格快照', () => {
        const result = mapFinancialRecord({
            metadata: JSON.stringify({
                commissionRate: 20,
                settlementAmount: 108,
                originalOrderPrice: 128,
                commissionAmount: 20,
                commissionRuleType: 'fixed',
                serviceName: '肩颈按摩',
                specificationName: '90分钟',
            }),
        });

        expect((result as any).serviceName).toBe('肩颈按摩');
        expect((result as any).specificationName).toBe('90分钟');
    });

    it('metadata 缺失时回退联表服务名称与规格', () => {
        const result = mapFinancialRecord({
            serviceName: '深度保洁',
            specificationName: '3小时',
        });

        expect((result as any).serviceName).toBe('深度保洁');
        expect((result as any).specificationName).toBe('3小时');
    });

    it('非服务收益记录不返回服务名称与规格', () => {
        const result = mapFinancialRecord({
            transactionType: 'bonus',
            serviceName: '不应暴露的服务',
            specificationName: '不应暴露的规格',
        });

        expect((result as any).serviceName).toBeNull();
        expect((result as any).specificationName).toBeNull();
    });
});
