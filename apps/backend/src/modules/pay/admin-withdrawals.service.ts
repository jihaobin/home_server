import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import type {
    AdminReviewWithdrawalBody,
    AdminWithdrawal,
    AdminWithdrawalListQuery,
    AdminWithdrawalListResponse,
    AlipayWithdrawResponse,
} from '@repo/types';
import {
    alipayWithdrawResponseSchema,
    alipayWithdrawSuccessResponseSchema,
} from '@repo/types';
import Decimal from 'decimal.js';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { createWorkerAliPaySdk } from 'src/lib/alipaySdk';
import { PayRepository } from './pay.repository';
import {
    AdminWithdrawalsRepository,
    type AdminWithdrawalFilters,
    type AdminWithdrawalRecord,
} from './admin-withdrawals.repository';
import z from 'zod/v4';

const unwrapAlipayResponsePayload = (raw: unknown) => {
    if (!raw || typeof raw !== 'object' || raw === null) {
        return raw;
    }

    const payload = raw as Record<string, unknown>;
    if ('alipay_fund_trans_uni_transfer_response' in payload) {
        const nested = payload.alipay_fund_trans_uni_transfer_response;
        if (nested && typeof nested === 'object') {
            return nested;
        }
    }

    return payload;
};

@Injectable()
export class AdminWithdrawalsService {
    private readonly alipaySdk = createWorkerAliPaySdk();
    private readonly logger = new Logger(AdminWithdrawalsService.name);

    constructor(
        private readonly repository: AdminWithdrawalsRepository,
        private readonly payRepository: PayRepository,
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

    private async approveAndPayout(
        withdrawalId: string,
        adminId: string,
        note?: string,
    ) {
        const withdrawal =
            await this.payRepository.findWithdrawalById(withdrawalId);

        if (!withdrawal) {
            throw new NotFoundException('提现记录不存在');
        }

        if (withdrawal.status === 'completed') {
            throw new BadRequestException('该提现已完成');
        }

        if (withdrawal.status === 'rejected') {
            throw new BadRequestException('该提现已被驳回');
        }

        if (withdrawal.method !== 'alipay') {
            throw new BadRequestException('当前仅支持支付宝打款');
        }

        if (
            withdrawal.payeeAccountType === 'ALIPAY_LOGON_ID' &&
            !withdrawal.payeeName
        ) {
            throw new BadRequestException('支付宝账号提现需要提供收款人姓名');
        }

        const amountDecimal = new Decimal(withdrawal.amount ?? '0');
        if (amountDecimal.lte(0)) {
            throw new BadRequestException('提现金额异常');
        }

        const transferResult = await this.executeAlipayTransfer(
            withdrawal.id,
            amountDecimal,
            withdrawal.payeeAccount,
            withdrawal.payeeAccountType,
            withdrawal.payeeName ?? undefined,
            withdrawal.remark ?? undefined,
        );

        const processedAt = new Date();
        const reviewedAt = new Date();
        await this.db.transaction(async (tx) => {
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
                throw new BadRequestException('冻结余额不足，无法完成提现');
            }

            const frozenAfter = frozen.minus(amountDecimal);
            const totalAfter = available.plus(frozenAfter);

            await this.payRepository.updateUserBalanceById(
                balanceRecord.id,
                {
                    availableBalance: available.toFixed(2),
                    frozenBalance: frozenAfter.toFixed(2),
                    totalBalance: totalAfter.toFixed(2),
                    lastTransactionId: transferResult.referenceId ?? undefined,
                },
                tx,
            );

            await this.payRepository.updateWithdrawalById(
                withdrawal.id,
                {
                    status: 'completed',
                    reviewedByAdminId: adminId,
                    reviewNote: note ?? null,
                    reviewedAt,
                    processedAt,
                    payoutReferenceId: transferResult.referenceId,
                    failureReason: null,
                },
                tx,
            );

            await this.payRepository.createFinancialTransaction(
                {
                    userId: withdrawal.userId,
                    withdrawalId: withdrawal.id,
                    transactionType: 'withdrawal',
                    amount: amountDecimal.negated().toFixed(2),
                    currency: withdrawal.currency ?? 'CNY',
                    description:
                        `提现至支付宝账号 ${withdrawal.payeeAccount}`.slice(
                            0,
                            120,
                        ),
                    referenceId: transferResult.referenceId,
                    metadata: JSON.stringify({
                        payeeAccount: withdrawal.payeeAccount,
                        payeeAccountType: withdrawal.payeeAccountType,
                        payeeName: withdrawal.payeeName,
                        reviewedBy: adminId,
                        note,
                    }),
                },
                tx,
            );
        });
    }

    private async rejectWithdrawal(
        withdrawalId: string,
        adminId: string,
        note?: string,
    ) {
        const withdrawal =
            await this.payRepository.findWithdrawalById(withdrawalId);

        if (!withdrawal) {
            throw new NotFoundException('提现记录不存在');
        }

        if (withdrawal.status === 'completed') {
            throw new BadRequestException('该提现已完成，无法驳回');
        }

        if (withdrawal.status === 'rejected') {
            throw new BadRequestException('该提现已被驳回');
        }

        const amountDecimal = new Decimal(withdrawal.amount ?? '0');
        if (amountDecimal.lte(0)) {
            throw new BadRequestException('提现金额异常');
        }

        const processedAt = new Date();
        const reviewedAt = new Date();

        await this.db.transaction(async (tx) => {
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

            await this.payRepository.updateUserBalanceById(
                balanceRecord.id,
                {
                    availableBalance: availableAfter.toFixed(2),
                    frozenBalance: frozenAfter.toFixed(2),
                    totalBalance: totalAfter.toFixed(2),
                },
                tx,
            );

            await this.payRepository.updateWithdrawalById(
                withdrawal.id,
                {
                    status: 'rejected',
                    reviewedByAdminId: adminId,
                    reviewNote: note ?? null,
                    reviewedAt,
                    processedAt,
                    failureReason: null,
                },
                tx,
            );
        });
    }

    private async executeAlipayTransfer(
        withdrawalId: string,
        amount: Decimal,
        payeeAccount: string,
        payeeAccountType: string,
        payeeName?: string,
        remark?: string,
    ) {
        const amountText = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const bizContent: Record<string, unknown> = {
            out_biz_no: withdrawalId,
            trans_amount: amountText.toFixed(2),
            biz_scene: 'DIRECT_TRANSFER',
            product_code: 'TRANS_ACCOUNT_NO_PWD',
            order_title: '服务人员提现',
            transfer_scene_name: '佣金报酬',
            transfer_scene_report_infos: [
                {
                    info_type: '佣金报酬说明',
                    info_content: '服务人员提现',
                },
            ],
            payee_info: {
                identity: payeeAccount,
                identity_type: payeeAccountType,
                ...(payeeName ? { name: payeeName } : {}),
            },
        };

        if (remark) {
            Object.assign(bizContent, { remark });
        }

        let rawResponse: unknown;
        try {
            rawResponse = await this.alipaySdk.exec(
                'alipay.fund.trans.uni.transfer',
                {
                    bizContent,
                },
            );
            console.log('支付宝打款接口返回：', rawResponse);
        } catch (error) {
            this.logger.error(
                `调用支付宝打款接口失败: ${withdrawalId}`,
                error instanceof Error ? error.message : String(error),
            );
            throw new BadRequestException('支付宝打款失败，请稍后重试');
        }

        const normalizedPayload = unwrapAlipayResponsePayload(
            rawResponse,
        ) as Record<string, unknown>;

        const parsedResult =
            alipayWithdrawResponseSchema.safeParse(normalizedPayload);
        if (!parsedResult.success) {
            this.logger.warn(
                '[AdminWithdrawalsService] 支付宝打款响应格式异常',
                {
                    withdrawalId,
                    errors: z.treeifyError(parsedResult.error),
                    response: normalizedPayload,
                },
            );
        }

        const responsePayload:
            | AlipayWithdrawResponse
            | Record<string, unknown> = parsedResult.success
            ? parsedResult.data
            : normalizedPayload;

        const responseCode =
            typeof responsePayload.code === 'string'
                ? responsePayload.code
                : '';

        if (responseCode !== '10000') {
            const payloadRecord = responsePayload as Record<string, unknown>;
            const getStringField = (key: string) => {
                const value = payloadRecord[key];
                return typeof value === 'string' ? value : null;
            };
            const errorMessage =
                getStringField('subMsg') ??
                getStringField('sub_msg') ??
                getStringField('msg');
            throw new BadRequestException(
                `支付宝打款失败：${errorMessage || '未知错误'}`,
            );
        }

        const successData =
            alipayWithdrawSuccessResponseSchema.safeParse(responsePayload);
        if (!successData.success) {
            this.logger.warn(
                '[AdminWithdrawalsService] 支付宝打款成功但响应字段缺失',
                {
                    withdrawalId,
                    response: responsePayload,
                    errors: successData.error.flatten(),
                },
            );
            throw new BadRequestException('支付宝打款结果解析失败，请稍后重试');
        }

        return {
            referenceId:
                successData.data.payFundOrderId ?? successData.data.orderId,
        };
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
}
