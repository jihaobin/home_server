import { Injectable, NotFoundException } from '@nestjs/common';
import Decimal from 'decimal.js';
import { WorkerCategoryCommissionRepository } from './worker-category-commission.repository';

type CommissionRuleType = 'fixed' | 'dynamic' | 'beginner-protection';

export interface ResolveCommissionSnapshotInput {
    orderId: string;
    workerId?: string | null;
    settlementAt: Date;
    settlementAmount: number;
    originalOrderPrice: number;
}

export interface CommissionSnapshot {
    commissionRate: number;
    settlementAmount: number;
    originalOrderPrice: number;
    commissionAmount: number;
    commissionRuleType: CommissionRuleType;
    commissionThreshold: number | null;
    commissionStrategyVersionId: string | null;
    monthlyIncomeSnapshot: number | null;
}

@Injectable()
export class WorkerCategoryCommissionService {
    constructor(
        private readonly repository: WorkerCategoryCommissionRepository,
    ) {}

    async resolveCommissionSnapshot(
        input: ResolveCommissionSnapshotInput,
    ): Promise<CommissionSnapshot> {
        const context = await this.repository.findOrderCommissionContext(
            input.orderId,
        );

        if (!context) {
            throw new NotFoundException('订单抽成上下文不存在');
        }

        const publishedStrategy =
            await this.repository.findPublishedStrategyByCategoryId(
                context.categoryId,
            );

        if (!publishedStrategy) {
            return this.buildSnapshot({
                fixedCommissionRate: context.fixedCommissionRate,
                settlementAmount: input.settlementAmount,
                originalOrderPrice: input.originalOrderPrice,
                commissionRuleType: 'fixed',
                commissionThreshold: null,
                commissionStrategyVersionId: null,
                monthlyIncomeSnapshot: null,
            });
        }

        if (!input.workerId) {
            return this.buildSnapshot({
                fixedCommissionRate: context.fixedCommissionRate,
                settlementAmount: input.settlementAmount,
                originalOrderPrice: input.originalOrderPrice,
                commissionRuleType: 'fixed',
                commissionThreshold: null,
                commissionStrategyVersionId: publishedStrategy.id,
                monthlyIncomeSnapshot: null,
            });
        }

        const monthlyIncomeSnapshot =
            await this.repository.sumWorkerMonthlyIncomeBeforeSettlement(
                input.workerId,
                context.categoryId,
                input.settlementAt,
                input.orderId,
            );
        const workerCreatedAt = await this.repository.findWorkerCreatedAt(
            input.workerId,
        );

        if (!this.isValidDate(workerCreatedAt)) {
            return this.buildSnapshot({
                fixedCommissionRate: context.fixedCommissionRate,
                settlementAmount: input.settlementAmount,
                originalOrderPrice: input.originalOrderPrice,
                commissionRuleType: 'fixed',
                commissionThreshold: null,
                commissionStrategyVersionId: publishedStrategy.id,
                monthlyIncomeSnapshot,
            });
        }

        if (
            publishedStrategy.beginnerProtection.isEnabled &&
            this.isWithinBeginnerProtection(
                workerCreatedAt,
                input.settlementAt,
                publishedStrategy.beginnerProtection.protectionDays,
            ) &&
            monthlyIncomeSnapshot <=
                publishedStrategy.beginnerProtection.monthlyIncomeThreshold
        ) {
            return this.buildSnapshot({
                fixedCommissionRate:
                    publishedStrategy.beginnerProtection.fixedCommissionRate,
                settlementAmount: input.settlementAmount,
                originalOrderPrice: input.originalOrderPrice,
                commissionRuleType: 'beginner-protection',
                commissionThreshold:
                    publishedStrategy.beginnerProtection.monthlyIncomeThreshold,
                commissionStrategyVersionId: publishedStrategy.id,
                monthlyIncomeSnapshot,
            });
        }

        const matchedRule = [...publishedStrategy.rules]
            .filter((rule) => rule.isEnabled)
            .sort(
                (left, right) =>
                    right.threshold - left.threshold ||
                    left.sortOrder - right.sortOrder,
            )
            .find((rule) => monthlyIncomeSnapshot >= rule.threshold);

        if (!matchedRule) {
            return this.buildSnapshot({
                fixedCommissionRate: context.fixedCommissionRate,
                settlementAmount: input.settlementAmount,
                originalOrderPrice: input.originalOrderPrice,
                commissionRuleType: 'fixed',
                commissionThreshold: null,
                commissionStrategyVersionId: publishedStrategy.id,
                monthlyIncomeSnapshot,
            });
        }

        return this.buildSnapshot({
            fixedCommissionRate: matchedRule.commissionRate,
            settlementAmount: input.settlementAmount,
            originalOrderPrice: input.originalOrderPrice,
            commissionRuleType: 'dynamic',
            commissionThreshold: matchedRule.threshold,
            commissionStrategyVersionId: publishedStrategy.id,
            monthlyIncomeSnapshot,
        });
    }

    private buildSnapshot({
        fixedCommissionRate,
        settlementAmount,
        originalOrderPrice,
        commissionRuleType,
        commissionThreshold,
        commissionStrategyVersionId,
        monthlyIncomeSnapshot,
    }: {
        fixedCommissionRate: number;
        settlementAmount: number;
        originalOrderPrice: number;
        commissionRuleType: CommissionRuleType;
        commissionThreshold: number | null;
        commissionStrategyVersionId: string | null;
        monthlyIncomeSnapshot: number | null;
    }): CommissionSnapshot {
        const roundedSettlementAmount = this.roundAmount(settlementAmount);
        const roundedOriginalOrderPrice = this.roundAmount(originalOrderPrice);
        const commissionAmount = this.roundAmount(
            new Decimal(roundedSettlementAmount)
                .mul(fixedCommissionRate)
                .div(100)
                .toNumber(),
        );

        return {
            commissionRate: fixedCommissionRate,
            settlementAmount: roundedSettlementAmount,
            originalOrderPrice: roundedOriginalOrderPrice,
            commissionAmount,
            commissionRuleType,
            commissionThreshold,
            commissionStrategyVersionId,
            monthlyIncomeSnapshot,
        };
    }

    private roundAmount(value: number) {
        return new Decimal(value)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toNumber();
    }

    private isValidDate(value: Date | null): value is Date {
        return Boolean(value && Number.isFinite(value.getTime()));
    }

    private isWithinBeginnerProtection(
        workerCreatedAt: Date,
        settlementAt: Date,
        protectionDays: number,
    ) {
        const deadline = new Date(workerCreatedAt.getTime());
        deadline.setDate(deadline.getDate() + protectionDays);
        return settlementAt.getTime() <= deadline.getTime();
    }
}
