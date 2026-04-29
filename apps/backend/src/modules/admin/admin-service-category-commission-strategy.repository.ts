import { Inject, Injectable } from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import type {
    AdminCommissionStrategyDetail,
    AdminCommissionStrategyRule,
    AdminCommissionStrategyVersion,
    SaveAdminCommissionStrategyDraftInput,
} from '@repo/types';
import { and, asc, desc, eq, inArray, ne } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    categoryCommissionStrategies,
    categoryCommissionStrategyRules,
    categoryCommissionStrategyVersions,
    serviceCategories,
} from 'src/common/database/schema';

type StrategyRow = typeof categoryCommissionStrategies.$inferSelect;
type VersionRow = typeof categoryCommissionStrategyVersions.$inferSelect;
type RuleRow = typeof categoryCommissionStrategyRules.$inferSelect;

export type AdminServiceCategoryCommissionStrategyCategoryRecord = {
    id: string;
    name: string;
    commissionRate: number;
};

export type AdminServiceCategoryCommissionStrategyDetailRecord =
    AdminCommissionStrategyDetail;

export interface SaveAdminServiceCategoryCommissionStrategyDraftParams {
    categoryId: string;
    categoryName: string;
    operatorId: string;
    payload: SaveAdminCommissionStrategyDraftInput;
}

export interface PublishAdminServiceCategoryCommissionStrategyDraftParams {
    categoryId: string;
    operatorId: string;
    publishReason?: string;
}

@Injectable()
export class AdminServiceCategoryCommissionStrategyRepository {
    constructor(@Inject(DB) private readonly db: DbType) {}

    async findStrategyCategoryId(): Promise<string | null> {
        const [row] = await this.db
            .select({
                categoryId: categoryCommissionStrategies.categoryId,
            })
            .from(categoryCommissionStrategies)
            .limit(1);

        return row?.categoryId ?? null;
    }

    async findCategoryById(
        categoryId: string,
    ): Promise<AdminServiceCategoryCommissionStrategyCategoryRecord | null> {
        const [row] = await this.db
            .select({
                id: serviceCategories.id,
                name: serviceCategories.name,
                commissionRate: serviceCategories.commissionRate,
            })
            .from(serviceCategories)
            .where(eq(serviceCategories.id, categoryId))
            .limit(1);

        if (!row) {
            return null;
        }

        return {
            id: row.id,
            name: row.name,
            commissionRate: row.commissionRate ?? 30,
        };
    }

    async findStrategyDetailByCategoryId(
        categoryId: string,
    ): Promise<AdminServiceCategoryCommissionStrategyDetailRecord | null> {
        const category = await this.findCategoryById(categoryId);

        if (!category) {
            return null;
        }

        const [strategy] = await this.db
            .select({
                id: categoryCommissionStrategies.id,
                categoryId: categoryCommissionStrategies.categoryId,
                strategyName: categoryCommissionStrategies.strategyName,
                status: categoryCommissionStrategies.status,
                currentVersionId: categoryCommissionStrategies.currentVersionId,
            })
            .from(categoryCommissionStrategies)
            .where(eq(categoryCommissionStrategies.categoryId, categoryId))
            .limit(1);

        if (!strategy) {
            return null;
        }

        const versions = await this.loadVersions(strategy.id);
        const draftVersion =
            versions.find((version) => version.status === 'draft') ?? null;

        const currentPublishedVersion = strategy.currentVersionId
            ? (versions.find(
                  (version) => version.id === strategy.currentVersionId,
              ) ?? null)
            : (versions.find((version) => version.status === 'published') ??
              null);

        return {
            categoryId: category.id,
            categoryName: category.name,
            fixedCommissionRate: category.commissionRate,
            strategyId: strategy.id,
            strategyName: strategy.strategyName,
            status: strategy.status,
            draftVersion,
            currentPublishedVersion,
        };
    }

    async findDraftVersionByCategoryId(
        categoryId: string,
    ): Promise<AdminCommissionStrategyVersion | null> {
        const detail = await this.findStrategyDetailByCategoryId(categoryId);
        return detail?.draftVersion ?? null;
    }

    async findCurrentPublishedVersionByCategoryId(
        categoryId: string,
    ): Promise<AdminCommissionStrategyVersion | null> {
        const detail = await this.findStrategyDetailByCategoryId(categoryId);
        return detail?.currentPublishedVersion ?? null;
    }

    async saveDraft(
        input: SaveAdminServiceCategoryCommissionStrategyDraftParams,
    ): Promise<AdminServiceCategoryCommissionStrategyDetailRecord> {
        const now = new Date();

        await this.db.transaction(async (tx: any) => {
            let [strategy] = await tx
                .select({
                    id: categoryCommissionStrategies.id,
                    status: categoryCommissionStrategies.status,
                    currentVersionId:
                        categoryCommissionStrategies.currentVersionId,
                })
                .from(categoryCommissionStrategies)
                .where(
                    eq(
                        categoryCommissionStrategies.categoryId,
                        input.categoryId,
                    ),
                )
                .limit(1);

            if (!strategy) {
                [strategy] = await tx
                    .insert(categoryCommissionStrategies)
                    .values({
                        categoryId: input.categoryId,
                        strategyName: `${input.categoryName}抽成策略`,
                        status: 'draft',
                        createdBy: input.operatorId,
                        updatedBy: input.operatorId,
                        createdAt: now,
                        updatedAt: now,
                    })
                    .returning({
                        id: categoryCommissionStrategies.id,
                        status: categoryCommissionStrategies.status,
                        currentVersionId:
                            categoryCommissionStrategies.currentVersionId,
                    });
            }

            let [draftVersion] = await tx
                .select({
                    id: categoryCommissionStrategyVersions.id,
                })
                .from(categoryCommissionStrategyVersions)
                .where(
                    and(
                        eq(
                            categoryCommissionStrategyVersions.strategyId,
                            strategy.id,
                        ),
                        eq(categoryCommissionStrategyVersions.status, 'draft'),
                    ),
                )
                .orderBy(desc(categoryCommissionStrategyVersions.versionNo))
                .limit(1);

            if (!draftVersion) {
                let initialBeginnerProtection = {
                    beginnerProtectionIsEnabled:
                        input.payload.beginnerProtection.isEnabled,
                    beginnerProtectionDays:
                        input.payload.beginnerProtection.protectionDays,
                    beginnerProtectionMonthlyIncomeThreshold:
                        input.payload.beginnerProtection.monthlyIncomeThreshold,
                    beginnerProtectionFixedCommissionRate:
                        input.payload.beginnerProtection.fixedCommissionRate,
                };
                let initialRules: Array<{
                    id: string;
                    threshold: number;
                    commissionRate: number;
                    isEnabled: boolean;
                    sortOrder: number;
                }> = input.payload.rules.map((rule, index) => ({
                    id: rule.id,
                    threshold: rule.threshold,
                    commissionRate: rule.commissionRate,
                    isEnabled: rule.isEnabled,
                    sortOrder: rule.sortOrder ?? index,
                }));

                const publishedVersionWhere = strategy.currentVersionId
                    ? and(
                          eq(
                              categoryCommissionStrategyVersions.strategyId,
                              strategy.id,
                          ),
                          eq(
                              categoryCommissionStrategyVersions.status,
                              'published',
                          ),
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
                          eq(
                              categoryCommissionStrategyVersions.status,
                              'published',
                          ),
                      );

                const [publishedVersion] = await tx
                    .select({
                        id: categoryCommissionStrategyVersions.id,
                        beginnerProtectionIsEnabled:
                            categoryCommissionStrategyVersions.beginnerProtectionIsEnabled,
                        beginnerProtectionDays:
                            categoryCommissionStrategyVersions.beginnerProtectionDays,
                        beginnerProtectionMonthlyIncomeThreshold:
                            categoryCommissionStrategyVersions.beginnerProtectionMonthlyIncomeThreshold,
                        beginnerProtectionFixedCommissionRate:
                            categoryCommissionStrategyVersions.beginnerProtectionFixedCommissionRate,
                    })
                    .from(categoryCommissionStrategyVersions)
                    .where(publishedVersionWhere)
                    .orderBy(desc(categoryCommissionStrategyVersions.versionNo))
                    .limit(1);

                if (publishedVersion) {
                    initialBeginnerProtection = {
                        beginnerProtectionIsEnabled:
                            publishedVersion.beginnerProtectionIsEnabled,
                        beginnerProtectionDays:
                            publishedVersion.beginnerProtectionDays,
                        beginnerProtectionMonthlyIncomeThreshold:
                            publishedVersion.beginnerProtectionMonthlyIncomeThreshold,
                        beginnerProtectionFixedCommissionRate:
                            publishedVersion.beginnerProtectionFixedCommissionRate,
                    };

                    const publishedRules = await tx
                        .select({
                            id: categoryCommissionStrategyRules.id,
                            threshold:
                                categoryCommissionStrategyRules.threshold,
                            commissionRate:
                                categoryCommissionStrategyRules.commissionRate,
                            isEnabled:
                                categoryCommissionStrategyRules.isEnabled,
                            sortOrder:
                                categoryCommissionStrategyRules.sortOrder,
                        })
                        .from(categoryCommissionStrategyRules)
                        .where(
                            eq(
                                categoryCommissionStrategyRules.strategyVersionId,
                                publishedVersion.id,
                            ),
                        )
                        .orderBy(
                            asc(categoryCommissionStrategyRules.sortOrder),
                            desc(categoryCommissionStrategyRules.threshold),
                            asc(categoryCommissionStrategyRules.id),
                        );

                    initialRules = publishedRules.map((rule, index) => ({
                        id: createId(),
                        threshold: rule.threshold,
                        commissionRate: rule.commissionRate,
                        isEnabled: rule.isEnabled,
                        sortOrder: rule.sortOrder ?? index,
                    }));
                }

                const [latestVersion] = await tx
                    .select({
                        versionNo: categoryCommissionStrategyVersions.versionNo,
                    })
                    .from(categoryCommissionStrategyVersions)
                    .where(
                        eq(
                            categoryCommissionStrategyVersions.strategyId,
                            strategy.id,
                        ),
                    )
                    .orderBy(desc(categoryCommissionStrategyVersions.versionNo))
                    .limit(1);

                const nextVersionNo = Number(latestVersion?.versionNo ?? 0) + 1;

                [draftVersion] = await tx
                    .insert(categoryCommissionStrategyVersions)
                    .values({
                        strategyId: strategy.id,
                        versionNo: nextVersionNo,
                        status: 'draft',
                        beginnerProtectionIsEnabled:
                            initialBeginnerProtection.beginnerProtectionIsEnabled,
                        beginnerProtectionDays:
                            initialBeginnerProtection.beginnerProtectionDays,
                        beginnerProtectionMonthlyIncomeThreshold:
                            initialBeginnerProtection.beginnerProtectionMonthlyIncomeThreshold,
                        beginnerProtectionFixedCommissionRate:
                            initialBeginnerProtection.beginnerProtectionFixedCommissionRate,
                        createdBy: input.operatorId,
                        createdAt: now,
                        updatedAt: now,
                    })
                    .returning({
                        id: categoryCommissionStrategyVersions.id,
                    });

                if (initialRules.length > 0) {
                    await tx.insert(categoryCommissionStrategyRules).values(
                        initialRules.map((rule) => ({
                            ...rule,
                            strategyVersionId: draftVersion.id,
                            createdAt: now,
                            updatedAt: now,
                        })),
                    );
                }
            }

            await tx
                .update(categoryCommissionStrategyVersions)
                .set({
                    beginnerProtectionIsEnabled:
                        input.payload.beginnerProtection.isEnabled,
                    beginnerProtectionDays:
                        input.payload.beginnerProtection.protectionDays,
                    beginnerProtectionMonthlyIncomeThreshold:
                        input.payload.beginnerProtection.monthlyIncomeThreshold,
                    beginnerProtectionFixedCommissionRate:
                        input.payload.beginnerProtection.fixedCommissionRate,
                    updatedAt: now,
                })
                .where(
                    eq(categoryCommissionStrategyVersions.id, draftVersion.id),
                );

            await tx
                .delete(categoryCommissionStrategyRules)
                .where(
                    eq(
                        categoryCommissionStrategyRules.strategyVersionId,
                        draftVersion.id,
                    ),
                );

            if (input.payload.rules.length > 0) {
                await tx.insert(categoryCommissionStrategyRules).values(
                    input.payload.rules.map((rule, index) => ({
                        id: createId(),
                        strategyVersionId: draftVersion.id,
                        threshold: rule.threshold,
                        commissionRate: rule.commissionRate,
                        isEnabled: rule.isEnabled,
                        sortOrder: rule.sortOrder ?? index,
                        createdAt: now,
                        updatedAt: now,
                    })),
                );
            }

            await tx
                .update(categoryCommissionStrategies)
                .set({
                    strategyName: `${input.categoryName}抽成策略`,
                    status: strategy.currentVersionId
                        ? strategy.status
                        : 'draft',
                    updatedBy: input.operatorId,
                    updatedAt: now,
                })
                .where(eq(categoryCommissionStrategies.id, strategy.id));
        });

        const detail = await this.findStrategyDetailByCategoryId(
            input.categoryId,
        );

        if (!detail) {
            throw new Error('保存抽成策略草稿后查询详情失败');
        }

        return detail;
    }

    async publishDraftVersion(
        input: PublishAdminServiceCategoryCommissionStrategyDraftParams,
    ): Promise<AdminServiceCategoryCommissionStrategyDetailRecord> {
        const now = new Date();

        await this.db.transaction(async (tx: any) => {
            const [strategy] = await tx
                .select({
                    id: categoryCommissionStrategies.id,
                })
                .from(categoryCommissionStrategies)
                .where(
                    eq(
                        categoryCommissionStrategies.categoryId,
                        input.categoryId,
                    ),
                )
                .limit(1);

            if (!strategy) {
                throw new Error('抽成策略不存在');
            }

            const [draftVersion] = await tx
                .select({
                    id: categoryCommissionStrategyVersions.id,
                    versionNote: categoryCommissionStrategyVersions.versionNote,
                })
                .from(categoryCommissionStrategyVersions)
                .where(
                    and(
                        eq(
                            categoryCommissionStrategyVersions.strategyId,
                            strategy.id,
                        ),
                        eq(categoryCommissionStrategyVersions.status, 'draft'),
                    ),
                )
                .orderBy(desc(categoryCommissionStrategyVersions.versionNo))
                .limit(1);

            if (!draftVersion) {
                throw new Error('草稿版本不存在');
            }

            await tx
                .update(categoryCommissionStrategyVersions)
                .set({
                    status: 'archived',
                    updatedAt: now,
                })
                .where(
                    and(
                        eq(
                            categoryCommissionStrategyVersions.strategyId,
                            strategy.id,
                        ),
                        eq(
                            categoryCommissionStrategyVersions.status,
                            'published',
                        ),
                        ne(
                            categoryCommissionStrategyVersions.id,
                            draftVersion.id,
                        ),
                    ),
                );

            await tx
                .update(categoryCommissionStrategyVersions)
                .set({
                    status: 'published',
                    versionNote:
                        input.publishReason ?? draftVersion.versionNote ?? null,
                    publishedAt: now,
                    publishedBy: input.operatorId,
                    updatedAt: now,
                })
                .where(
                    eq(categoryCommissionStrategyVersions.id, draftVersion.id),
                );

            await tx
                .update(categoryCommissionStrategies)
                .set({
                    currentVersionId: draftVersion.id,
                    status: 'published',
                    publishedAt: now,
                    publishedBy: input.operatorId,
                    updatedBy: input.operatorId,
                    updatedAt: now,
                })
                .where(eq(categoryCommissionStrategies.id, strategy.id));
        });

        const detail = await this.findStrategyDetailByCategoryId(
            input.categoryId,
        );

        if (!detail) {
            throw new Error('发布抽成策略后查询详情失败');
        }

        return detail;
    }

    private async loadVersions(
        strategyId: string,
    ): Promise<AdminCommissionStrategyVersion[]> {
        const versionRows = await this.db
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
            .where(
                eq(categoryCommissionStrategyVersions.strategyId, strategyId),
            )
            .orderBy(desc(categoryCommissionStrategyVersions.versionNo));

        if (versionRows.length === 0) {
            return [];
        }

        const versionIds = versionRows.map((version) => version.id);
        const ruleRows = await this.db
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
                inArray(
                    categoryCommissionStrategyRules.strategyVersionId,
                    versionIds,
                ),
            )
            .orderBy(
                asc(categoryCommissionStrategyRules.strategyVersionId),
                asc(categoryCommissionStrategyRules.sortOrder),
                desc(categoryCommissionStrategyRules.threshold),
                asc(categoryCommissionStrategyRules.id),
            );

        const rulesByVersionId = new Map<
            string,
            AdminCommissionStrategyRule[]
        >();

        for (const ruleRow of ruleRows) {
            const currentRules =
                rulesByVersionId.get(ruleRow.strategyVersionId) ?? [];
            currentRules.push(this.mapRule(ruleRow));
            rulesByVersionId.set(ruleRow.strategyVersionId, currentRules);
        }

        return versionRows.map((versionRow) =>
            this.mapVersion(
                versionRow,
                rulesByVersionId.get(versionRow.id) ?? [],
            ),
        );
    }

    private mapVersion(
        versionRow: {
            id: string;
            strategyId: string;
            versionNo: number;
            status: VersionRow['status'];
            versionNote: string | null;
            effectiveFrom: Date | null;
            effectiveTo: Date | null;
            beginnerProtectionIsEnabled: boolean;
            beginnerProtectionDays: number;
            beginnerProtectionMonthlyIncomeThreshold: number;
            beginnerProtectionFixedCommissionRate: number;
            publishedAt: Date | null;
            createdAt: Date | null;
            updatedAt: Date | null;
        },
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
