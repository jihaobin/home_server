import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import type { AlipayWithdrawResponse } from '@repo/types';
import {
    alipayWithdrawResponseSchema,
    alipayWithdrawSuccessResponseSchema,
} from '@repo/types';
import Decimal from 'decimal.js';
import { createWorkerAliPaySdk } from 'src/lib/alipaySdk';
import z from 'zod/v4';
import type {
    PayoutProvider,
    PayoutProviderExecuteRequest,
    PayoutProviderExecuteResult,
} from './payout-provider.interface';

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
export class AlipayPayoutProvider implements PayoutProvider {
    readonly channel = 'alipay' as const;

    private readonly alipaySdk = createWorkerAliPaySdk();
    private readonly logger = new Logger(AlipayPayoutProvider.name);

    async executePayout(
        request: PayoutProviderExecuteRequest,
    ): Promise<PayoutProviderExecuteResult> {
        const { withdrawal } = request;

        if (
            withdrawal.payeeAccountType === 'ALIPAY_LOGON_ID' &&
            !withdrawal.payeeName
        ) {
            throw new BadRequestException('支付宝账号提现需要提供收款人姓名');
        }

        const amount = new Decimal(withdrawal.amount ?? '0');
        const amountText = amount.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);
        const bizContent: Record<string, unknown> = {
            out_biz_no: withdrawal.id,
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
                identity: withdrawal.payeeAccount,
                identity_type: withdrawal.payeeAccountType,
                ...(withdrawal.payeeName ? { name: withdrawal.payeeName } : {}),
            },
        };

        if (withdrawal.remark) {
            Object.assign(bizContent, { remark: withdrawal.remark });
        }

        let rawResponse: unknown;
        try {
            rawResponse = await this.alipaySdk.exec(
                'alipay.fund.trans.uni.transfer',
                {
                    bizContent,
                },
            );
        } catch (error) {
            this.logger.error(
                `调用支付宝打款接口失败: ${withdrawal.id}`,
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
            this.logger.warn('[AlipayPayoutProvider] 支付宝打款响应格式异常', {
                withdrawalId: withdrawal.id,
                errors: z.treeifyError(parsedResult.error),
                response: normalizedPayload,
            });
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

            return {
                channel: this.channel,
                withdrawalStatus: 'failed',
                providerState: responseCode || 'FAILED',
                providerMeta: {
                    raw: normalizedPayload,
                },
                failureReason: errorMessage || '未知错误',
                processedAt: new Date(),
            };
        }

        const successData =
            alipayWithdrawSuccessResponseSchema.safeParse(responsePayload);
        if (!successData.success) {
            this.logger.warn(
                '[AlipayPayoutProvider] 支付宝打款成功但响应字段缺失',
                {
                    withdrawalId: withdrawal.id,
                    response: responsePayload,
                    errors: successData.error.flatten(),
                },
            );
            throw new BadRequestException('支付宝打款结果解析失败，请稍后重试');
        }

        const referenceId =
            successData.data.payFundOrderId ?? successData.data.orderId;

        return {
            channel: this.channel,
            withdrawalStatus: 'completed',
            referenceId,
            providerState: 'SUCCESS',
            providerBillNo: referenceId ?? null,
            providerMeta: {
                raw: normalizedPayload,
            },
            processedAt: new Date(),
        };
    }
}
