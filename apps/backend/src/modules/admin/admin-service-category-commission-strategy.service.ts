import {
    BadRequestException,
    Injectable,
    NotFoundException,
} from '@nestjs/common';
import type {
    AdminCommissionStrategyDetail,
    AdminCommissionStrategyPublishInput,
    AdminCommissionStrategySimulationInput,
    AdminCommissionStrategySimulationResult,
    AdminCommissionStrategyVersion,
    SaveAdminCommissionStrategyDraftInput,
} from '@repo/types';
import {
    AdminServiceCategoryCommissionStrategyRepository,
    type AdminServiceCategoryCommissionStrategyCategoryRecord,
} from './admin-service-category-commission-strategy.repository';

export interface SaveAdminServiceCategoryCommissionStrategyDraftCommand {
    categoryId: string;
    operatorId: string;
    payload: SaveAdminCommissionStrategyDraftInput;
}

export interface PublishAdminServiceCategoryCommissionStrategyDraftCommand extends AdminCommissionStrategyPublishInput {
    operatorId: string;
}

@Injectable()
export class AdminServiceCategoryCommissionStrategyService {
    constructor(
        private readonly repository: AdminServiceCategoryCommissionStrategyRepository,
    ) {}

    async getStrategyDetail(
        categoryId: string,
    ): Promise<AdminCommissionStrategyDetail> {
        const category = await this.assertSupportedCategory(categoryId);
        const detail =
            await this.repository.findStrategyDetailByCategoryId(categoryId);

        if (detail) {
            return detail;
        }

        return {
            categoryId: category.id,
            categoryName: category.name,
            fixedCommissionRate: category.commissionRate,
            strategyId: null,
            strategyName: null,
            status: null,
            draftVersion: null,
            currentPublishedVersion: null,
        };
    }

    async saveDraft(
        input: SaveAdminServiceCategoryCommissionStrategyDraftCommand,
    ): Promise<AdminCommissionStrategyDetail> {
        const category = await this.assertSupportedCategory(input.categoryId);

        if (input.payload.categoryId !== input.categoryId) {
            throw new BadRequestException('请求路径与 body.categoryId 不一致');
        }

        return await this.repository.saveDraft({
            categoryId: category.id,
            categoryName: category.name,
            operatorId: input.operatorId,
            payload: input.payload,
        });
    }

    async publishDraft(
        input: PublishAdminServiceCategoryCommissionStrategyDraftCommand,
    ): Promise<AdminCommissionStrategyDetail> {
        await this.assertSupportedCategory(input.categoryId);

        const draftVersion = await this.repository.findDraftVersionByCategoryId(
            input.categoryId,
        );

        if (!draftVersion) {
            throw new BadRequestException('暂无可发布的草稿');
        }

        this.assertDraftVersionPublishable(draftVersion);

        return await this.repository.publishDraftVersion({
            categoryId: input.categoryId,
            operatorId: input.operatorId,
            publishReason: input.publishReason,
        });
    }

    async simulate(
        input: AdminCommissionStrategySimulationInput,
    ): Promise<AdminCommissionStrategySimulationResult> {
        const category = await this.assertSupportedCategory(input.categoryId);
        const fixedResult = this.buildFixedResult(
            input,
            category.commissionRate,
        );

        const publishedVersion =
            await this.repository.findCurrentPublishedVersionByCategoryId(
                input.categoryId,
            );

        if (!publishedVersion) {
            return fixedResult;
        }

        if (
            publishedVersion.beginnerProtection.isEnabled &&
            input.isWithinBeginnerProtection &&
            input.monthlyIncomeBeforeSettlement <=
                publishedVersion.beginnerProtection.monthlyIncomeThreshold
        ) {
            return {
                ...fixedResult,
                strategyVersionId: publishedVersion.id,
                ruleType: 'beginner-protection',
                commissionRate:
                    publishedVersion.beginnerProtection.fixedCommissionRate,
            };
        }

        const matchedRule = [...publishedVersion.rules]
            .filter((rule) => rule.isEnabled)
            .sort(
                (left, right) =>
                    right.threshold - left.threshold ||
                    left.sortOrder - right.sortOrder,
            )
            .find(
                (rule) => input.monthlyIncomeBeforeSettlement >= rule.threshold,
            );

        if (!matchedRule) {
            return {
                ...fixedResult,
                strategyVersionId: publishedVersion.id,
            };
        }

        return {
            ...fixedResult,
            strategyVersionId: publishedVersion.id,
            ruleType: 'dynamic',
            commissionRate: matchedRule.commissionRate,
            matchedRuleId: matchedRule.id,
            matchedThreshold: matchedRule.threshold,
        };
    }

    private async assertSupportedCategory(
        categoryId: string,
    ): Promise<AdminServiceCategoryCommissionStrategyCategoryRecord> {
        const category = await this.repository.findCategoryById(categoryId);

        if (!category) {
            throw new NotFoundException('服务分类不存在');
        }

        const existingStrategy =
            await this.repository.findStrategyDetailByCategoryId(categoryId);

        if (existingStrategy?.strategyId) {
            return category;
        }

        const boundCategoryId = await this.repository.findStrategyCategoryId();

        if (boundCategoryId === null || boundCategoryId === categoryId) {
            return category;
        }

        if (boundCategoryId !== categoryId) {
            throw new BadRequestException('当前分类不支持配置动态抽成策略');
        }

        return category;
    }

    private buildFixedResult(
        input: AdminCommissionStrategySimulationInput,
        fixedCommissionRate: number,
    ): AdminCommissionStrategySimulationResult {
        return {
            categoryId: input.categoryId,
            strategyVersionId: null,
            ruleType: 'fixed',
            commissionRate: fixedCommissionRate,
            matchedRuleId: null,
            matchedThreshold: null,
            fixedCommissionRate,
            monthlyIncomeBeforeSettlement: input.monthlyIncomeBeforeSettlement,
            isWithinBeginnerProtection: input.isWithinBeginnerProtection,
            settlementDate: input.settlementDate,
        };
    }

    private assertDraftVersionPublishable(
        draftVersion: AdminCommissionStrategyVersion,
    ) {
        const enabledRules = draftVersion.rules.filter(
            (rule) => rule.isEnabled,
        );

        if (enabledRules.length === 0) {
            throw new BadRequestException('至少保留一条启用的动态规则');
        }

        if (!enabledRules.some((rule) => rule.threshold === 0)) {
            throw new BadRequestException(
                '启用规则必须覆盖 0 门槛，否则低收入会回退固定抽成',
            );
        }
    }
}
