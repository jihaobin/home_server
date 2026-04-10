import { Inject, Injectable } from '@nestjs/common';
import type {
    AdminCommissionStrategyRule,
    AdminCommissionStrategyVersion,
} from '@repo/types';
import { and, asc, desc, eq, gte, inArray, lt, ne, sql } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    categoryCommissionStrategies,
    categoryCommissionStrategyRules,
    categoryCommissionStrategyVersions,
    financialTransactions,
    orders,
    serviceCategories,
    services,
    users,
} from 'src/common/database/schema';

type Executor = DbType;

type VersionRow = typeof categoryCommissionStrategyVersions.$inferSelect;
type RuleRow = typeof categoryCommissionStrategyRules.$inferSelect;

export interface OrderCommissionContextRecord {
    orderId: string;
    categoryId: string;
    fixedCommissionRate: number;
}

@Injectable()
export class WorkerCategoryCommissionRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    private getExecutor(executor?: Executor) {
        return executor ?? this.db;
    }

    async findOrderCommissionContext(
        orderId: string,
        executor?: Executor,
    ): Promise<OrderCommissionContextRecord | null> {
        const db = this.getExecutor(executor);
        const [row] = await db
            .select({
                orderId: orders.id,
                categoryId: serviceCategories.id,
                fixedCommissionRate: serviceCategories.commissionRate,
            })
            .from(orders)
            .innerJoin(services, eq(orders.serviceId, services.id))
            .innerJoin(
                serviceCategories,
                eq(services.categoryId, serviceCategories.id),
            )
            .where(eq(orders.id, orderId))
            .limit(1);

        if (!row) {
            return null;
        }

        return {
            orderId: row.orderId,
            categoryId: row.categoryId,
            fixedCommissionRate: row.fixedCommissionRate ?? 30,
        };
    }

    async findPublishedStrategyByCategoryId(
        categoryId: string,
        executor?: Executor,
    ): Promise<AdminCommissionStrategyVersion | null> {
        const db = this.getExecutor(executor);
        const [strategy] = await db
            .select({
                id: categoryCommissionStrategies.id,
                currentVersionId: categoryCommissionStrategies.currentVersionId,
            })
            .from(categoryCommissionStrategies)
            .where(eq(categoryCommissionStrategies.categoryId, categoryId))
            .limit(1);

        if (!strategy) {
            return null;
        }

        const versionWhere = strategy.currentVersionId
            ? and(
                  eq(
                      categoryCommissionStrategyVersions.strategyId,
                      strategy.id,
                  ),
                  eq(categoryCommissionStrategyVersions.status, 'published'),
                  eq(
                      categoryCommissionStrategyVersions.id,
                      strategy.currentVersionId,
                  ),
              )
            : and(
                  eq(
                      categoryCommissionStrategyVersions.strategyId,
                      strategy.id,
                  ),
                  eq(categoryCommissionStrategyVersions.status, 'published'),
              );

        const [versionRow] = await db
            .select({
                id: categoryCommissionStrategyVersions.id,
                strategyId: categoryCommissionStrategyVersions.strategyId,
                versionNo: categoryCommissionStrategyVersions.versionNo,
                status: categoryCommissionStrategyVersions.status,
                versionNote: categoryCommissionStrategyVersions.versionNote,
                effectiveFrom: categoryCommissionStrategyVersions.effectiveFrom,
                effectiveTo: categoryCommissionStrategyVersions.effectiveTo,
                beginnerProtectionIsEnabled:
                    categoryCommissionStrategyVersions.beginnerProtectionIsEnabled,
                beginnerProtectionDays:
                    categoryCommissionStrategyVersions.beginnerProtectionDays,
                beginnerProtectionMonthlyIncomeThreshold:
                    categoryCommissionStrategyVersions.beginnerProtectionMonthlyIncomeThreshold,
                beginnerProtectionFixedCommissionRate:
                    categoryCommissionStrategyVersions.beginnerProtectionFixedCommissionRate,
                publishedAt: categoryCommissionStrategyVersions.publishedAt,
                createdAt: categoryCommissionStrategyVersions.createdAt,
                updatedAt: categoryCommissionStrategyVersions.updatedAt,
            })
            .from(categoryCommissionStrategyVersions)
            .where(versionWhere)
            .orderBy(desc(categoryCommissionStrategyVersions.versionNo))
            .limit(1);

        if (!versionRow) {
            return null;
        }

        const ruleRows = await db
            .select({
                id: categoryCommissionStrategyRules.id,
                strategyVersionId:
                    categoryCommissionStrategyRules.strategyVersionId,
                threshold: categoryCommissionStrategyRules.threshold,
                commissionRate: categoryCommissionStrategyRules.commissionRate,
                isEnabled: categoryCommissionStrategyRules.isEnabled,
                sortOrder: categoryCommissionStrategyRules.sortOrder,
            })
            .from(categoryCommissionStrategyRules)
            .where(
                eq(
                    categoryCommissionStrategyRules.strategyVersionId,
                    versionRow.id,
                ),
            )
            .orderBy(
                asc(categoryCommissionStrategyRules.sortOrder),
                desc(categoryCommissionStrategyRules.threshold),
                asc(categoryCommissionStrategyRules.id),
            );

        return this.mapVersion(
            versionRow,
            ruleRows.map((row) => this.mapRule(row)),
        );
    }

    async findWorkerCreatedAt(
        workerId: string,
        executor?: Executor,
    ): Promise<Date | null> {
        const db = this.getExecutor(executor);
        const [row] = await db
            .select({
                createdAt: users.createdAt,
            })
            .from(users)
            .where(eq(users.id, workerId))
            .limit(1);

        return row?.createdAt ?? null;
    }

    async sumWorkerMonthlyIncomeBeforeSettlement(
        workerId: string,
        categoryId: string,
        settlementAt: Date,
        excludeOrderId?: string,
        executor?: Executor,
    ): Promise<number> {
        const db = this.getExecutor(executor);
        const startOfMonth = new Date(
            settlementAt.getFullYear(),
            settlementAt.getMonth(),
            1,
            0,
            0,
            0,
            0,
        );
        const conditions = [
            eq(financialTransactions.userId, workerId),
            gte(financialTransactions.createdAt, startOfMonth),
            lt(financialTransactions.createdAt, settlementAt),
            eq(serviceCategories.id, categoryId),
            inArray(financialTransactions.transactionType, [
                'service_earning',
                'adjustment',
            ]),
            sql`${financialTransactions.orderId} IS NOT NULL`,
        ];

        if (excludeOrderId) {
            conditions.push(ne(financialTransactions.orderId, excludeOrderId));
        }

        const [row] = await db
            .select({
                totalAmount: sql<string>`COALESCE(SUM(${financialTransactions.amount}), 0)`,
            })
            .from(financialTransactions)
            .innerJoin(orders, eq(financialTransactions.orderId, orders.id))
            .innerJoin(services, eq(orders.serviceId, services.id))
            .innerJoin(
                serviceCategories,
                eq(services.categoryId, serviceCategories.id),
            )
            .where(and(...conditions));

        return Number(row?.totalAmount ?? 0);
    }

    private mapVersion(
        versionRow: Pick<
            VersionRow,
            | 'id'
            | 'strategyId'
            | 'versionNo'
            | 'status'
            | 'versionNote'
            | 'effectiveFrom'
            | 'effectiveTo'
            | 'beginnerProtectionIsEnabled'
            | 'beginnerProtectionDays'
            | 'beginnerProtectionMonthlyIncomeThreshold'
            | 'beginnerProtectionFixedCommissionRate'
            | 'publishedAt'
            | 'createdAt'
            | 'updatedAt'
        >,
        rules: AdminCommissionStrategyRule[],
    ): AdminCommissionStrategyVersion {
        return {
            id: versionRow.id,
            strategyId: versionRow.strategyId,
            versionNo: versionRow.versionNo,
            status: versionRow.status,
            versionNote: versionRow.versionNote ?? null,
            effectiveFrom: this.toIsoString(versionRow.effectiveFrom),
            effectiveTo: this.toIsoString(versionRow.effectiveTo),
            beginnerProtection: {
                isEnabled: versionRow.beginnerProtectionIsEnabled,
                protectionDays: versionRow.beginnerProtectionDays,
                monthlyIncomeThreshold:
                    versionRow.beginnerProtectionMonthlyIncomeThreshold,
                fixedCommissionRate:
                    versionRow.beginnerProtectionFixedCommissionRate,
            },
            publishedAt: this.toIsoString(versionRow.publishedAt),
            createdAt: this.toRequiredIsoString(versionRow.createdAt),
            updatedAt: this.toRequiredIsoString(versionRow.updatedAt),
            rules,
        };
    }

    private mapRule(
        ruleRow: Pick<
            RuleRow,
            'id' | 'threshold' | 'commissionRate' | 'isEnabled' | 'sortOrder'
        >,
    ): AdminCommissionStrategyRule {
        return {
            id: ruleRow.id,
            threshold: ruleRow.threshold,
            commissionRate: ruleRow.commissionRate,
            isEnabled: ruleRow.isEnabled,
            sortOrder: ruleRow.sortOrder,
        };
    }

    private toIsoString(value: Date | null | undefined): string | null {
        return value ? value.toISOString() : null;
    }

    private toRequiredIsoString(value: Date | null | undefined): string {
        if (!value) {
            throw new Error('抽成策略时间字段缺失');
        }

        return value.toISOString();
    }
}
