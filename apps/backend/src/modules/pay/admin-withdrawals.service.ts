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
    NotificationChannelPlanItem,
    WithdrawalStatus,
} from '@repo/types';
import Decimal from 'decimal.js';
import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { NotificationPublisher } from '../notification/notification.publisher';
import { NotificationTemplateService } from '../notification/notification-template.service';
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

const FINANCIAL_TRANSACTION_METADATA_MAX_LENGTH = 1000;
const WECHAT_WAIT_USER_CONFIRM_CHANNEL_PLAN: NotificationChannelPlanItem[] = [
    {
        channel: 'in_app',
        when: 'online',
    },
    {
        channel: 'tencent_cloud_push',
        when: 'offline',
    },
];

type WithdrawalEntity = NonNullable<
    Awaited<ReturnType<PayRepository['findWithdrawalById']>>
>;

@Injectable()
export class AdminWithdrawalsService {
    private readonly logger = new Logger(AdminWithdrawalsService.name);

    constructor(
        private readonly repository: AdminWithdrawalsRepository,
        private readonly payRepository: PayRepository,
        private readonly payoutDispatcher: PayoutDispatcher,
        private readonly notificationPublisher: NotificationPublisher,
        private readonly notificationTemplateService: NotificationTemplateService,
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
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
            await this.handleApprovedWithdrawalRequestException(
                withdrawal,
                error,
                'initial_execute',
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
                        reviewNote: this.normalizeWithdrawalReviewNote(note),
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
                        reviewNote: this.normalizeWithdrawalReviewNote(note),
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
            const updated =
                await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                    withdrawal.id,
                    ['approved', 'processing'],
                    {
                        status: payoutResult.withdrawalStatus,
                        reviewedByAdminId:
                            adminId ?? withdrawal.reviewedByAdminId,
                        reviewNote: this.normalizeWithdrawalReviewNote(note),
                        processedAt: null,
                        payoutReferenceId: this.normalizeWithdrawalReferenceId(
                            payoutResult.referenceId,
                        ),
                        providerState:
                            this.normalizeWithdrawalProviderState(
                                payoutResult.providerState,
                            ) ??
                            this.normalizeWithdrawalProviderState(
                                withdrawal.providerState,
                            ) ??
                            null,
                        providerAppId:
                            this.normalizeWithdrawalProviderAppId(
                                payoutResult.providerAppId,
                            ) ??
                            this.normalizeWithdrawalProviderAppId(
                                withdrawal.providerAppId,
                            ) ??
                            null,
                        providerBillNo:
                            this.normalizeWithdrawalProviderBillNo(
                                payoutResult.providerBillNo,
                            ) ??
                            this.normalizeWithdrawalProviderBillNo(
                                withdrawal.providerBillNo,
                            ) ??
                            null,
                        providerPackageInfo:
                            this.normalizeWithdrawalProviderPackageInfo(
                                payoutResult.providerPackageInfo,
                            ) ??
                            this.normalizeWithdrawalProviderPackageInfo(
                                withdrawal.providerPackageInfo,
                            ) ??
                            null,
                        providerMeta: this.mergeProviderMeta(
                            withdrawal.providerMeta ?? null,
                            payoutResult.providerMeta ?? null,
                        ),
                        failureReason: this.normalizeWithdrawalFailureReason(
                            payoutResult.failureReason,
                        ),
                    },
                );

            await this.tryPublishWechatWaitUserConfirmNotification(
                updated ?? withdrawal,
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
                        reviewNote: this.normalizeWithdrawalReviewNote(note),
                        processedAt: payoutResult.processedAt ?? new Date(),
                        payoutReferenceId: this.normalizeWithdrawalReferenceId(
                            payoutResult.referenceId,
                        ),
                        providerState:
                            this.normalizeWithdrawalProviderState(
                                payoutResult.providerState,
                            ) ??
                            this.normalizeWithdrawalProviderState(
                                latest.providerState,
                            ) ??
                            null,
                        providerAppId:
                            this.normalizeWithdrawalProviderAppId(
                                payoutResult.providerAppId,
                            ) ??
                            this.normalizeWithdrawalProviderAppId(
                                latest.providerAppId,
                            ) ??
                            null,
                        providerBillNo:
                            this.normalizeWithdrawalProviderBillNo(
                                payoutResult.providerBillNo,
                            ) ??
                            this.normalizeWithdrawalProviderBillNo(
                                latest.providerBillNo,
                            ) ??
                            null,
                        providerPackageInfo:
                            this.normalizeWithdrawalProviderPackageInfo(
                                payoutResult.providerPackageInfo,
                            ) ??
                            this.normalizeWithdrawalProviderPackageInfo(
                                latest.providerPackageInfo,
                            ) ??
                            null,
                        providerMeta: this.mergeProviderMeta(
                            latest.providerMeta ?? null,
                            payoutResult.providerMeta ?? null,
                        ),
                        failureReason: this.normalizeWithdrawalFailureReason(
                            payoutResult.failureReason,
                        ),
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

                const existingFinancialTransaction =
                    await this.payRepository.findFinancialTransactionByWithdrawalId(
                        latest.id,
                        tx,
                    );

                await this.payRepository.updateUserBalanceById(
                    balanceRecord.id,
                    {
                        availableBalance: available.toFixed(2),
                        frozenBalance: frozenAfter.toFixed(2),
                        totalBalance: totalAfter.toFixed(2),
                        lastTransactionId:
                            this.normalizeWithdrawalReferenceId(
                                payoutResult.referenceId,
                            ) ??
                            this.normalizeWithdrawalReferenceId(
                                existingFinancialTransaction?.referenceId,
                            ) ??
                            undefined,
                    },
                    tx,
                );

                if (existingFinancialTransaction) {
                    return;
                }

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
                        referenceId: this.normalizeWithdrawalReferenceId(
                            payoutResult.referenceId,
                        ),
                        metadata: this.buildWithdrawalLedgerMetadata({
                            withdrawal: latest,
                            adminId,
                            note,
                            payoutResult,
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

        const latestAfterUpdate = await this.payRepository.findWithdrawalById(
            withdrawal.id,
        );
        await this.tryPublishWechatWaitUserConfirmNotification(
            latestAfterUpdate ?? withdrawal,
        );
    }

    private async tryPublishWechatWaitUserConfirmNotification(
        withdrawal: WithdrawalEntity,
    ) {
        if (
            withdrawal.method !== 'wechat_pay' ||
            withdrawal.providerState !== 'WAIT_USER_CONFIRM' ||
            !withdrawal.providerPackageInfo?.trim() ||
            !withdrawal.providerAppId?.trim() ||
            !withdrawal.userId?.trim()
        ) {
            return;
        }

        const lockKey = `lock:withdrawal:${withdrawal.id}:wechat-wait-user-confirm-notify`;
        let lockId: string | null = null;

        try {
            lockId = await this.cacheService.acquireLock(lockKey, 15, 1, 50);
            if (!lockId) {
                return;
            }

            const latest = await this.payRepository.findWithdrawalById(
                withdrawal.id,
            );
            if (
                !latest ||
                latest.method !== 'wechat_pay' ||
                latest.providerState !== 'WAIT_USER_CONFIRM' ||
                !latest.providerPackageInfo?.trim() ||
                !latest.providerAppId?.trim() ||
                !latest.userId?.trim()
            ) {
                return;
            }

            const currentMeta =
                latest.providerMeta && typeof latest.providerMeta === 'object'
                    ? latest.providerMeta
                    : {};
            const currentNotificationMeta =
                currentMeta.waitUserConfirmNotification &&
                typeof currentMeta.waitUserConfirmNotification === 'object'
                    ? (currentMeta.waitUserConfirmNotification as Record<
                          string,
                          unknown
                      >)
                    : null;

            const packageInfo = latest.providerPackageInfo.trim();
            if (
                currentNotificationMeta?.state === 'WAIT_USER_CONFIRM' &&
                currentNotificationMeta.packageInfo === packageInfo
            ) {
                return;
            }

            const amountLabel = new Decimal(latest.amount ?? '0').toFixed(2);
            const title = '微信提现待确认';
            const message = this.notificationTemplateService.getTemplate(
                'withdrawal_wechat_wait_user_confirm',
            );

            await this.notificationPublisher.publish({
                event: 'withdrawal_wechat_wait_user_confirm',
                payload: {
                    event: 'withdrawal_wechat_wait_user_confirm',
                    title,
                    message,
                    userId: latest.userId,
                    targetId: latest.userId,
                    status: latest.status,
                    withdrawalId: latest.id,
                    withdrawalStatus: latest.status,
                    providerState: latest.providerState,
                    amount: amountLabel,
                    currency: latest.currency ?? 'CNY',
                    triggeredAt: new Date().toISOString(),
                },
                targets: [
                    {
                        targetId: latest.userId,
                        userId: latest.userId,
                        targetType: 'service_personnel',
                        metadata: {
                            withdrawalId: latest.id,
                            scene: 'wechat_wait_user_confirm',
                        },
                        channelPlan: WECHAT_WAIT_USER_CONFIRM_CHANNEL_PLAN,
                    },
                ],
                priority: 'high',
                deliveryMode: 'best-effort',
            });

            await this.payRepository.updateWithdrawalById(latest.id, {
                providerMeta: this.mergeProviderMeta(
                    latest.providerMeta ?? null,
                    {
                        waitUserConfirmNotification: {
                            state: 'WAIT_USER_CONFIRM',
                            packageInfo,
                            sentAt: new Date().toISOString(),
                        },
                    },
                ),
            });
        } finally {
            if (lockId) {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((error) => {
                        this.logger.warn(
                            `[AdminWithdrawalsService] 释放微信提现通知锁失败: ${withdrawal.id}`,
                            error instanceof Error ? error.message : error,
                        );
                    });
            }
        }
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
                const syncResult =
                    await this.syncSingleInFlightWithdrawal(withdrawal);

                if (syncResult === 'skipped') {
                    skippedCount++;
                    continue;
                }

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

    private async syncSingleInFlightWithdrawal(withdrawal: WithdrawalEntity) {
        const payoutResult = await this.payoutDispatcher.queryPayoutStatus(
            withdrawal.method,
            {
                withdrawal,
            },
        );

        if (payoutResult) {
            await this.applyPayoutResult(
                withdrawal,
                withdrawal.reviewedByAdminId,
                withdrawal.reviewNote ?? undefined,
                payoutResult,
            );
            return 'synced' as const;
        }

        if (withdrawal.status !== 'approved') {
            return 'skipped' as const;
        }

        let executeResult: Awaited<
            ReturnType<PayoutDispatcher['executePayout']>
        >;

        try {
            executeResult = await this.payoutDispatcher.executePayout(
                withdrawal.method,
                {
                    withdrawal,
                },
            );
        } catch (error) {
            await this.handleApprovedWithdrawalRequestException(
                withdrawal,
                error,
                'sync_execute',
            );
            return 'synced' as const;
        }

        await this.applyPayoutResult(
            withdrawal,
            withdrawal.reviewedByAdminId,
            withdrawal.reviewNote ?? undefined,
            executeResult,
        );

        return 'synced' as const;
    }

    private async tryRecoverApprovedWithdrawal(withdrawal: WithdrawalEntity) {
        const latest = await this.payRepository.findWithdrawalById(
            withdrawal.id,
        );
        if (!latest || latest.status !== 'approved') {
            return {
                confirmedMissingRemoteRecord: false,
            };
        }

        try {
            const payoutResult = await this.payoutDispatcher.queryPayoutStatus(
                latest.method,
                {
                    withdrawal: latest,
                },
            );

            if (!payoutResult) {
                return {
                    confirmedMissingRemoteRecord: true,
                };
            }

            await this.applyPayoutResult(
                latest,
                latest.reviewedByAdminId,
                latest.reviewNote ?? undefined,
                payoutResult,
            );

            this.logger.log(
                `[AdminWithdrawalsService] 打款请求异常后自动查单恢复成功: ${latest.id}`,
            );

            return {
                confirmedMissingRemoteRecord: false,
            };
        } catch (error) {
            this.logger.warn(
                `[AdminWithdrawalsService] 打款请求异常后自动恢复失败: ${latest.id}`,
                error instanceof Error ? error.message : error,
            );

            return {
                confirmedMissingRemoteRecord: false,
            };
        }
    }

    private async handleApprovedWithdrawalRequestException(
        withdrawal: WithdrawalEntity,
        error: unknown,
        source: 'initial_execute' | 'sync_execute',
    ) {
        const message =
            error instanceof Error ? error.message : '渠道打款请求异常';
        const normalizedMessage = message.slice(0, 500);
        const requestExceptionAt = new Date().toISOString();

        await this.payRepository.updateWithdrawalByIdWithStatusGuard(
            withdrawal.id,
            ['approved'],
            {
                providerState: 'REQUEST_EXCEPTION',
                failureReason: normalizedMessage,
                providerMeta: this.mergeProviderMeta(
                    withdrawal.providerMeta ?? null,
                    {
                        payoutRecovery: {
                            source,
                            lastRequestExceptionAt: requestExceptionAt,
                            lastRequestExceptionMessage: normalizedMessage,
                        },
                    },
                ),
            },
        );

        this.logger.error(
            `[AdminWithdrawalsService] 打款请求异常，提现单进入恢复流程: ${withdrawal.id}`,
            normalizedMessage,
        );

        const recovery = await this.tryRecoverApprovedWithdrawal(withdrawal);

        if (!recovery.confirmedMissingRemoteRecord) {
            return;
        }

        await this.rollbackApprovedWithdrawalIfStillStuck(
            withdrawal.id,
            normalizedMessage,
            source,
        );
    }

    private async rollbackApprovedWithdrawalIfStillStuck(
        withdrawalId: string,
        message: string,
        source: 'initial_execute' | 'sync_execute',
    ) {
        const latest =
            await this.payRepository.findWithdrawalById(withdrawalId);

        if (!latest || latest.status !== 'approved') {
            return;
        }

        const rolledBack =
            await this.payRepository.updateWithdrawalByIdWithStatusGuard(
                withdrawalId,
                ['approved'],
                {
                    status: 'pending',
                    reviewedByAdminId: null,
                    reviewedAt: null,
                    processedAt: null,
                    payoutReferenceId: null,
                    providerState: null,
                    providerBillNo: null,
                    providerPackageInfo: null,
                    providerMeta: this.mergeProviderMeta(
                        latest.providerMeta ?? null,
                        {
                            payoutRecovery: {
                                source,
                                rolledBackAt: new Date().toISOString(),
                                rollbackReason: message.slice(0, 500),
                            },
                        },
                    ),
                    failureReason:
                        `渠道请求异常，已回退到待审核：${message}`.slice(
                            0,
                            500,
                        ),
                },
            );

        if (!rolledBack) {
            return;
        }

        this.logger.warn(
            `[AdminWithdrawalsService] 提现单恢复失败，已回退到待审核: ${withdrawalId}`,
        );
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

    private buildWithdrawalLedgerMetadata({
        withdrawal,
        adminId,
        note,
        payoutResult,
    }: {
        withdrawal: WithdrawalEntity;
        adminId: string | null | undefined;
        note: string | undefined;
        payoutResult: Awaited<ReturnType<PayoutDispatcher['executePayout']>>;
    }) {
        const provider = this.buildWithdrawalLedgerProviderSummary(
            withdrawal,
            payoutResult,
        );

        const fullMetadata = {
            payeeAccount: withdrawal.payeeAccount,
            payeeAccountType: withdrawal.payeeAccountType,
            payeeName: withdrawal.payeeName,
            reviewedBy: adminId ?? withdrawal.reviewedByAdminId ?? null,
            note: note ?? null,
            provider,
        };

        const fullSerialized = JSON.stringify(fullMetadata);
        if (
            fullSerialized.length <= FINANCIAL_TRANSACTION_METADATA_MAX_LENGTH
        ) {
            return fullSerialized;
        }

        const compactMetadata = {
            payeeAccount: withdrawal.payeeAccount,
            payeeAccountType: withdrawal.payeeAccountType,
            reviewedBy: adminId ?? withdrawal.reviewedByAdminId ?? null,
            provider,
        };

        const compactSerialized = JSON.stringify(compactMetadata);
        if (
            compactSerialized.length <=
            FINANCIAL_TRANSACTION_METADATA_MAX_LENGTH
        ) {
            return compactSerialized;
        }

        return JSON.stringify({
            withdrawalId: withdrawal.id,
            method: withdrawal.method,
            providerReferenceId: payoutResult.referenceId ?? null,
            providerState: payoutResult.providerState ?? null,
        });
    }

    private buildWithdrawalLedgerProviderSummary(
        withdrawal: WithdrawalEntity,
        payoutResult: Awaited<ReturnType<PayoutDispatcher['executePayout']>>,
    ) {
        const providerMeta = payoutResult.providerMeta;

        return {
            method: withdrawal.method,
            state: payoutResult.providerState ?? null,
            appId:
                payoutResult.providerAppId ?? withdrawal.providerAppId ?? null,
            billNo: payoutResult.providerBillNo ?? null,
            referenceId: payoutResult.referenceId ?? null,
            failureReason: payoutResult.failureReason ?? null,
            source:
                providerMeta && typeof providerMeta === 'object'
                    ? this.extractProviderSummarySource(providerMeta)
                    : null,
        };
    }

    private extractProviderSummarySource(
        providerMeta: Record<string, unknown>,
    ) {
        const wechatTransfer = providerMeta.wechatMerchantTransfer;
        if (wechatTransfer && typeof wechatTransfer === 'object') {
            const source = (wechatTransfer as Record<string, unknown>).source;
            return typeof source === 'string' ? source : null;
        }

        return null;
    }

    private normalizeWithdrawalReferenceId(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 255) : null;
    }

    private normalizeWithdrawalProviderState(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 64) : null;
    }

    private normalizeWithdrawalProviderAppId(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 128) : null;
    }

    private normalizeWithdrawalProviderBillNo(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 255) : null;
    }

    private normalizeWithdrawalProviderPackageInfo(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 1000) : null;
    }

    private normalizeWithdrawalFailureReason(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 500) : null;
    }

    private normalizeWithdrawalReviewNote(value?: string | null) {
        return typeof value === 'string' ? value.slice(0, 1000) : null;
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

        const merged = {
            ...(current ?? {}),
            ...(incoming ?? {}),
        } as Record<string, unknown>;

        for (const [key, value] of Object.entries(incoming ?? {})) {
            const currentValue = current?.[key];
            if (this.isPlainObject(currentValue) && this.isPlainObject(value)) {
                merged[key] = {
                    ...currentValue,
                    ...value,
                };
            }
        }

        return merged;
    }

    private isPlainObject(value: unknown): value is Record<string, unknown> {
        return (
            typeof value === 'object' && value !== null && !Array.isArray(value)
        );
    }
}
