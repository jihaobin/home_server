import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import type {
    AdminReviewWithdrawalBody,
    AdminWithdrawal,
    AdminWithdrawalListQuery,
    AdminWithdrawalListResponse,
    WithdrawalStatus,
} from '@repo/types';
import Decimal from 'decimal.js';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { PayRepository } from './pay.repository';
import { PayoutDispatcher } from './providers/payout.dispatcher';
import {
    AdminWithdrawalsRepository,
    type AdminWithdrawalFilters,
    type AdminWithdrawalRecord,
} from './admin-withdrawals.repository';

const WITHDRAWAL_TERMINAL_STATUSES: WithdrawalStatus[] = [
    'completed',
    'failed',
    'cancelled',
    'rejected',
];

const WITHDRAWAL_IN_FLIGHT_STATUSES: WithdrawalStatus[] = [
    'approved',
    'processing',
];

@Injectable()
export class AdminWithdrawalsService {
    private readonly logger = new Logger(AdminWithdrawalsService.name);

    constructor(
        private readonly repository: AdminWithdrawalsRepository,
        private readonly payRepository: PayRepository,
        private readonly payoutDispatcher: PayoutDispatcher,
        @Inject(DB) private readonly db: DbType,
    ) {}

    async listWithdrawals(
        query: AdminWithdrawalListQuery,
    ): Promise<AdminWithdrawalListResponse> {
        const normalized = this.normalizeQuery(query);
        const { items, total } = await this.repository.findWithdrawals(
            normalized.filters,
        );
        const mapped = items.map((record) => this.mapRecord(record));
        const totalPages = Math.ceil(total / normalized.limit) || 0;

        return {
            items: mapped,
            meta: {
                page: normalized.page,
                limit: normalized.limit,
                total,
                totalPages,
                hasNext: normalized.page < totalPages,
                hasPrev: normalized.page > 1,
            },
        };
    }

    async reviewWithdrawal(
        withdrawalId: string,
        adminId: string,
        payload: AdminReviewWithdrawalBody,
    ): Promise<AdminWithdrawal> {
        if (payload.action === 'reject') {
            await this.rejectWithdrawal(withdrawalId, adminId, payload.note);
        } else {
            await this.approveAndPayout(withdrawalId, adminId, payload.note);
        }

        const updated = await this.repository.findWithdrawalById(withdrawalId);
        if (!updated) {
            throw new NotFoundException('提现记录不存在');
        }
        return this.mapRecord(updated);
    }

    @Cron('30 */5 * * * *')
    async syncInFlightWithdrawalsJob() {
        await this.syncInFlightWithdrawals();
    }

    async applyPayoutResultForWithdrawal(
        withdrawalId: string,
        payoutResult: Awaited<ReturnType<PayoutDispatcher['executePayout']>>,
    ) {
        const withdrawal =
            await this.payRepository.findWithdrawalById(withdrawalId);

        if (!withdrawal) {
            throw new NotFoundException('提现记录不存在');
        }

        await this.applyPayoutResult(
            withdrawal,
            withdrawal.reviewedByAdminId,
            withdrawal.reviewNote ?? undefined,
            payoutResult,
        );

        return await this.repository.findWithdrawalById(withdrawalId);
    }

    private async approveAndPayout(
        withdrawalId: string,
        adminId: string,
        note?: string,
    ) {
        const withdrawal = await this.claimPendingWithdrawalForApproval(
            withdrawalId,
            adminId,
            note,
        );

        const amountDecimal = new Decimal(withdrawal.amount ?? '0');
        if (amountDecimal.lte(0)) {
            throw new BadRequestException('提现金额异常');
        }

        try {
            const payoutResult = await this.payoutDispatcher.executePayout(
                withdrawal.method,
                {
                    withdrawal,
                },
            );

            await this.applyPayoutResult(
                withdrawal,
                adminId,
                note,
                payoutResult,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '渠道打款请求异常';

            await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                withdrawal.id,
                ['approved'],
                {
                    providerState: 'REQUEST_EXCEPTION',
                    failureReason: message.slice(0, 500),
                },
            );

            this.logger.error(
                `[AdminWithdrawalsService] 打款请求异常，提现单进入待同步状态: ${withdrawal.id}`,
                message,
            );
        }
    }

    private async rejectWithdrawal(
        withdrawalId: string,
        adminId: string,
        note?: string,
    ) {
        await this.db.transaction(async (tx) => {
            const withdrawal = await this.payRepository.findWithdrawalById(
                withdrawalId,
                tx,
            );

            if (!withdrawal) {
                throw new NotFoundException('提现记录不存在');
            }

            this.ensureWithdrawalPendingForReview(withdrawal.status);

            const amountDecimal = new Decimal(withdrawal.amount ?? '0');
            if (amountDecimal.lte(0)) {
                throw new BadRequestException('提现金额异常');
            }

            const processedAt = new Date();
            const reviewedAt = new Date();

            const balanceRecord =
                await this.payRepository.findUserBalanceByUserId(
                    withdrawal.userId,
                    tx,
                );

            if (!balanceRecord) {
                throw new BadRequestException('账户余额不存在或未初始化');
            }

            const available = new Decimal(
                balanceRecord.availableBalance ?? '0',
            );
            const frozen = new Decimal(balanceRecord.frozenBalance ?? '0');

            if (frozen.lt(amountDecimal)) {
                throw new BadRequestException('冻结余额不足，无法驳回');
            }

            const availableAfter = available.plus(amountDecimal);
            const frozenAfter = frozen.minus(amountDecimal);
            const totalAfter = availableAfter.plus(frozenAfter);

            const claimed =
                await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                    withdrawal.id,
                    ['pending'],
                    {
                        status: 'rejected',
                        reviewedByAdminId: adminId,
                        reviewNote: note ?? null,
                        reviewedAt,
                        processedAt,
                        payoutReferenceId: null,
                        providerState: null,
                        providerBillNo: null,
                        providerPackageInfo: null,
                        providerMeta: null,
                        failureReason: null,
                    },
                    tx,
                );

            if (!claimed) {
                const latest = await this.payRepository.findWithdrawalById(
                    withdrawal.id,
                    tx,
                );
                this.throwWithdrawalReviewConflict(latest?.status);
            }

            await this.payRepository.updateUserBalanceById(
                balanceRecord.id,
                {
                    availableBalance: availableAfter.toFixed(2),
                    frozenBalance: frozenAfter.toFixed(2),
                    totalBalance: totalAfter.toFixed(2),
                },
                tx,
            );
        });
    }

    private async claimPendingWithdrawalForApproval(
        withdrawalId: string,
        adminId: string,
        note?: string,
    ) {
        return this.db.transaction(async (tx) => {
            const withdrawal = await this.payRepository.findWithdrawalById(
                withdrawalId,
                tx,
            );

            if (!withdrawal) {
                throw new NotFoundException('提现记录不存在');
            }

            this.ensureWithdrawalPendingForReview(withdrawal.status);

            const reviewedAt = new Date();
            const claimed =
                await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                    withdrawal.id,
                    ['pending'],
                    {
                        status: 'approved',
                        reviewedByAdminId: adminId,
                        reviewNote: note ?? null,
                        reviewedAt,
                        processedAt: null,
                        payoutReferenceId: null,
                        providerState: null,
                        providerBillNo: null,
                        providerPackageInfo: null,
                        providerMeta: null,
                        failureReason: null,
                    },
                    tx,
                );

            if (!claimed) {
                const latest = await this.payRepository.findWithdrawalById(
                    withdrawal.id,
                    tx,
                );
                this.throwWithdrawalReviewConflict(latest?.status);
            }

            return claimed;
        });
    }

    private async applyPayoutResult(
        withdrawal: NonNullable<
            Awaited<ReturnType<PayRepository['findWithdrawalById']>>
        >,
        adminId: string | null | undefined,
        note: string | undefined,
        payoutResult: Awaited<ReturnType<PayoutDispatcher['executePayout']>>,
    ) {
        if (
            payoutResult.withdrawalStatus === 'approved' ||
            payoutResult.withdrawalStatus === 'processing'
        ) {
            await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                withdrawal.id,
                ['approved', 'processing'],
                {
                    status: payoutResult.withdrawalStatus,
                    reviewedByAdminId: adminId ?? withdrawal.reviewedByAdminId,
                    reviewNote: note ?? null,
                    processedAt: null,
                    payoutReferenceId: payoutResult.referenceId ?? null,
                    providerState: payoutResult.providerState ?? null,
                    providerAppId:
                        payoutResult.providerAppId ??
                        withdrawal.providerAppId ??
                        null,
                    providerBillNo: payoutResult.providerBillNo ?? null,
                    providerPackageInfo:
                        payoutResult.providerPackageInfo ?? null,
                    providerMeta: this.mergeProviderMeta(
                        withdrawal.providerMeta ?? null,
                        payoutResult.providerMeta ?? null,
                    ),
                    failureReason: payoutResult.failureReason ?? null,
                },
            );
            return;
        }

        await this.db.transaction(async (tx) => {
            const latest = await this.payRepository.findWithdrawalById(
                withdrawal.id,
                tx,
            );

            if (!latest) {
                throw new NotFoundException('提现记录不存在');
            }

            if (WITHDRAWAL_TERMINAL_STATUSES.includes(latest.status)) {
                return;
            }

            if (!WITHDRAWAL_IN_FLIGHT_STATUSES.includes(latest.status)) {
                throw new BadRequestException('提现状态异常，无法推进到终态');
            }

            const amountDecimal = new Decimal(latest.amount ?? '0');
            if (amountDecimal.lte(0)) {
                throw new BadRequestException('提现金额异常');
            }

            const locked =
                await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                    latest.id,
                    ['approved', 'processing'],
                    {
                        status: payoutResult.withdrawalStatus,
                        reviewedByAdminId:
                            adminId ?? latest.reviewedByAdminId ?? null,
                        reviewNote: note ?? null,
                        processedAt: payoutResult.processedAt ?? new Date(),
                        payoutReferenceId: payoutResult.referenceId ?? null,
                        providerState: payoutResult.providerState ?? null,
                        providerAppId:
                            payoutResult.providerAppId ??
                            latest.providerAppId ??
                            null,
                        providerBillNo: payoutResult.providerBillNo ?? null,
                        providerPackageInfo:
                            payoutResult.providerPackageInfo ?? null,
                        providerMeta: this.mergeProviderMeta(
                            latest.providerMeta ?? null,
                            payoutResult.providerMeta ?? null,
                        ),
                        failureReason: payoutResult.failureReason ?? null,
                    },
                    tx,
                );

            if (!locked) {
                return;
            }

            const balanceRecord =
                await this.payRepository.findUserBalanceByUserId(
                    latest.userId,
                    tx,
                );

            if (!balanceRecord) {
                throw new BadRequestException('账户余额不存在或未初始化');
            }

            const available = new Decimal(
                balanceRecord.availableBalance ?? '0',
            );
            const frozen = new Decimal(balanceRecord.frozenBalance ?? '0');

            if (frozen.lt(amountDecimal)) {
                throw new BadRequestException('冻结余额不足，无法完成提现处理');
            }

            if (payoutResult.withdrawalStatus === 'completed') {
                const frozenAfter = frozen.minus(amountDecimal);
                const totalAfter = available.plus(frozenAfter);

                await this.payRepository.updateUserBalanceById(
                    balanceRecord.id,
                    {
                        availableBalance: available.toFixed(2),
                        frozenBalance: frozenAfter.toFixed(2),
                        totalBalance: totalAfter.toFixed(2),
                        lastTransactionId:
                            payoutResult.referenceId ?? undefined,
                    },
                    tx,
                );

                await this.payRepository.createFinancialTransaction(
                    {
                        userId: latest.userId,
                        withdrawalId: latest.id,
                        transactionType: 'withdrawal',
                        amount: amountDecimal.negated().toFixed(2),
                        currency: latest.currency ?? 'CNY',
                        description:
                            `提现至${latest.method}账号 ${latest.payeeAccount}`.slice(
                                0,
                                120,
                            ),
                        referenceId: payoutResult.referenceId ?? null,
                        metadata: JSON.stringify({
                            payeeAccount: latest.payeeAccount,
                            payeeAccountType: latest.payeeAccountType,
                            payeeName: latest.payeeName,
                            reviewedBy:
                                adminId ?? latest.reviewedByAdminId ?? null,
                            note,
                            providerMeta: payoutResult.providerMeta ?? null,
                        }),
                    },
                    tx,
                );
            }

            if (
                payoutResult.withdrawalStatus === 'failed' ||
                payoutResult.withdrawalStatus === 'cancelled'
            ) {
                const availableAfter = available.plus(amountDecimal);
                const frozenAfter = frozen.minus(amountDecimal);
                const totalAfter = availableAfter.plus(frozenAfter);

                await this.payRepository.updateUserBalanceById(
                    balanceRecord.id,
                    {
                        availableBalance: availableAfter.toFixed(2),
                        frozenBalance: frozenAfter.toFixed(2),
                        totalBalance: totalAfter.toFixed(2),
                    },
                    tx,
                );
            }
        });
    }

    private ensureWithdrawalPendingForReview(status?: WithdrawalStatus | null) {
        if (status === 'pending') {
            return;
        }

        this.throwWithdrawalReviewConflict(status);
    }

    private throwWithdrawalReviewConflict(
        status?: WithdrawalStatus | null,
    ): never {
        switch (status) {
            case 'completed':
                throw new BadRequestException('该提现已完成');
            case 'rejected':
                throw new BadRequestException('该提现已被驳回');
            case 'processing':
                throw new BadRequestException('该提现正在处理中');
            case 'approved':
                throw new BadRequestException('该提现已审核通过，等待渠道处理');
            case 'failed':
            case 'cancelled':
                throw new BadRequestException('该提现已进入失败或取消状态');
            default:
                throw new BadRequestException('该提现当前不可审核');
        }
    }

    private async syncInFlightWithdrawals(limit = 100) {
        const candidates = await this.payRepository.findWithdrawalsByStatuses(
            WITHDRAWAL_IN_FLIGHT_STATUSES,
            limit,
        );

        let syncedCount = 0;
        let skippedCount = 0;
        let failedCount = 0;

        for (const withdrawal of candidates) {
            try {
                const payoutResult =
                    await this.payoutDispatcher.queryPayoutStatus(
                        withdrawal.method,
                        {
                            withdrawal,
                        },
                    );

                if (!payoutResult) {
                    skippedCount++;
                    continue;
                }

                await this.applyPayoutResult(
                    withdrawal,
                    withdrawal.reviewedByAdminId,
                    withdrawal.reviewNote ?? undefined,
                    payoutResult,
                );
                syncedCount++;
            } catch (error) {
                failedCount++;
                this.logger.warn(
                    `[AdminWithdrawalsService] 同步提现状态失败: ${withdrawal.id}`,
                    error instanceof Error ? error.message : error,
                );
            }
        }

        if (candidates.length > 0) {
            this.logger.log(
                `[AdminWithdrawalsService] 提现状态同步完成，总数=${candidates.length}，已同步=${syncedCount}，跳过=${skippedCount}，失败=${failedCount}`,
            );
        }
    }

    private normalizeQuery(query: AdminWithdrawalListQuery | undefined) {
        const page = Math.max(1, Number(query?.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));

        const filters: AdminWithdrawalFilters = {
            page,
            limit,
            startDate: query?.startDate ? new Date(query.startDate) : undefined,
            endDate: query?.endDate ? new Date(query.endDate) : undefined,
            minAmount:
                typeof query?.minAmount === 'number'
                    ? query.minAmount
                    : undefined,
            maxAmount:
                typeof query?.maxAmount === 'number'
                    ? query.maxAmount
                    : undefined,
            status: query?.status,
            method: query?.method,
            keyword: query?.keyword,
        };

        return { page, limit, filters };
    }

    private mapRecord(record: AdminWithdrawalRecord): AdminWithdrawal {
        const amountValue = Number(record.amount ?? 0) || 0;
        const currency = record.currency ?? 'CNY';

        return {
            id: record.id,
            status: record.status as AdminWithdrawal['status'],
            method: record.method as AdminWithdrawal['method'],
            amount: {
                amount: Math.round(amountValue * 100) / 100,
                currency,
            },
            payeeAccount: record.payeeAccount,
            payeeAccountType:
                record.payeeAccountType as AdminWithdrawal['payeeAccountType'],
            payeeName: record.payeeName ?? null,
            remark: record.remark ?? null,
            reviewNote: record.reviewNote ?? null,
            requestedAt: (record.requestedAt ?? new Date()).toISOString(),
            reviewedAt: record.reviewedAt
                ? record.reviewedAt.toISOString()
                : null,
            processedAt: record.processedAt
                ? record.processedAt.toISOString()
                : null,
            payoutReferenceId: record.payoutReferenceId ?? null,
            providerState: record.providerState ?? null,
            providerAppId: record.providerAppId ?? null,
            providerBillNo: record.providerBillNo ?? null,
            providerPackageInfo: record.providerPackageInfo ?? null,
            providerMeta: record.providerMeta ?? null,
            failureReason: record.failureReason ?? null,
            user: record.userId
                ? {
                      id: record.userId,
                      name: record.userName ?? null,
                      email: record.userEmail ?? null,
                      phoneNumber: record.userPhoneNumber ?? null,
                  }
                : null,
            reviewer: record.reviewerId
                ? {
                      id: record.reviewerId,
                      name: record.reviewerName ?? null,
                  }
                : null,
        };
    }

    private mergeProviderMeta(
        current: Record<string, unknown> | null | undefined,
        incoming: Record<string, unknown> | null | undefined,
    ) {
        if (!current && !incoming) {
            return null;
        }

        return {
            ...(current ?? {}),
            ...(incoming ?? {}),
        };
    }
}
