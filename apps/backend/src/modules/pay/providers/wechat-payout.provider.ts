import { Injectable, Logger } from '@nestjs/common';
import Decimal from 'decimal.js';
import { WechatPayClient } from 'src/lib/wechatPay/wechatPay.client';
import type { WechatPayMerchantTransferState } from 'src/lib/wechatPay/wechatPay.types';
import type {
    PayoutProvider,
    PayoutProviderExecuteRequest,
    PayoutProviderExecuteResult,
    PayoutProviderNotifyRequest,
    PayoutProviderQueryRequest,
} from './payout-provider.interface';

const WECHAT_PAYOUT_TERMINAL_STATES = new Set<WechatPayMerchantTransferState>([
    'SUCCESS',
    'FAIL',
    'CANCELLED',
]);

@Injectable()
export class WechatPayoutProvider implements PayoutProvider {
    readonly channel = 'wechat_pay' as const;

    private readonly logger = new Logger(WechatPayoutProvider.name);

    private readonly wechatPayClient = new WechatPayClient();

    async executePayout(
        request: PayoutProviderExecuteRequest,
    ): Promise<PayoutProviderExecuteResult> {
        const { withdrawal } = request;
        const amount = new Decimal(withdrawal.amount ?? '0');

        if (amount.lte(0)) {
            return this.buildFailureResult(withdrawal.id, '提现金额异常');
        }

        if (!withdrawal.providerAppId?.trim()) {
            return this.buildFailureResult(
                withdrawal.id,
                '微信提现缺少 worker AppID',
            );
        }

        if (!withdrawal.payeeAccount?.trim()) {
            return this.buildFailureResult(
                withdrawal.id,
                '微信提现缺少收款 openid',
            );
        }

        if (
            amount.greaterThanOrEqualTo(2000) &&
            !withdrawal.payeeName?.trim()
        ) {
            return this.buildFailureResult(
                withdrawal.id,
                '微信提现金额满 2000 元时需要实名认证姓名',
            );
        }

        const transferSceneId = this.wechatPayClient.getWorkerTransferSceneId();
        if (!transferSceneId?.trim()) {
            throw new Error('未配置 WECHAT_PAY_WORKER_TRANSFER_SCENE_ID');
        }

        const notifyUrl = this.wechatPayClient.getWorkerTransferNotifyUrl();
        if (!notifyUrl?.trim()) {
            throw new Error('未配置 WECHAT_PAY_WORKER_TRANSFER_NOTIFY_URL');
        }

        const response = await this.wechatPayClient.createMerchantTransferBill({
            appid: withdrawal.providerAppId,
            out_bill_no: withdrawal.id,
            transfer_scene_id: transferSceneId,
            openid: withdrawal.payeeAccount,
            ...(withdrawal.payeeName?.trim()
                ? {
                      user_name: this.wechatPayClient.encryptSensitiveField(
                          withdrawal.payeeName.trim(),
                      ),
                  }
                : {}),
            transfer_amount: this.toFen(amount),
            transfer_remark: this.buildTransferRemark(withdrawal.remark),
            notify_url: notifyUrl,
            user_recv_perception: '服务收益提现',
            transfer_scene_report_infos: this.buildSceneReportInfos(
                withdrawal.remark,
            ),
        });

        return this.mapProviderResult({
            withdrawalId: withdrawal.id,
            appId: withdrawal.providerAppId,
            mchId: this.wechatPayClient.getMchId(),
            state: response.state,
            referenceId: response.transfer_bill_no,
            providerBillNo: response.transfer_bill_no,
            providerPackageInfo: response.package_info ?? null,
            createTime: response.create_time,
            raw: response,
        });
    }

    async queryPayoutStatus(
        request: PayoutProviderQueryRequest,
    ): Promise<PayoutProviderExecuteResult | null> {
        const { withdrawal } = request;
        const result =
            await this.wechatPayClient.queryMerchantTransferBillByOutBillNo(
                withdrawal.id,
            );

        if (!result) {
            return null;
        }

        return this.mapProviderResult({
            withdrawalId: withdrawal.id,
            appId: result.appid,
            mchId: result.mch_id,
            state: result.state,
            referenceId: result.transfer_bill_no,
            providerBillNo: result.transfer_bill_no,
            providerPackageInfo: withdrawal.providerPackageInfo ?? null,
            failReason: result.fail_reason,
            createTime: result.create_time,
            updateTime: result.update_time,
            raw: result,
        });
    }

    async handleNotify(
        request: PayoutProviderNotifyRequest,
    ): Promise<PayoutProviderExecuteResult | null> {
        const notify =
            this.wechatPayClient.parseAndVerifyMerchantTransferNotify({
                rawBody: request.rawBody,
                headers: request.headers ?? {},
            });

        if (notify.transfer.mch_id !== this.wechatPayClient.getMchId()) {
            this.logger.warn(
                `[WechatPayoutProvider] 忽略商户号不匹配的回调: ${notify.transfer.mch_id}`,
            );
            return null;
        }

        if (notify.envelope.event_type !== 'MCHTRANSFER.BILL.FINISHED') {
            this.logger.warn(
                `[WechatPayoutProvider] 忽略未知商家转账回调事件: ${notify.envelope.event_type}`,
            );
            return null;
        }

        return this.mapProviderResult({
            withdrawalId: notify.transfer.out_bill_no,
            appId: null,
            mchId: notify.transfer.mch_id,
            state: notify.transfer.state,
            referenceId: notify.transfer.transfer_bill_no,
            providerBillNo: notify.transfer.transfer_bill_no,
            providerPackageInfo: null,
            failReason: notify.transfer.fail_reason,
            createTime: notify.transfer.create_time,
            updateTime: notify.transfer.update_time,
            raw: notify,
        });
    }

    private buildFailureResult(
        withdrawalId: string,
        failureReason: string,
    ): PayoutProviderExecuteResult {
        return {
            channel: this.channel,
            withdrawalStatus: 'failed',
            providerState: 'FAIL',
            failureReason,
            processedAt: new Date(),
            providerMeta: {
                wechatMerchantTransfer: {
                    outBillNo: withdrawalId,
                    source: 'execute',
                    failReason: failureReason.slice(0, 500),
                },
            },
        };
    }

    private buildTransferRemark(remark?: string | null) {
        const normalized = remark?.trim();
        if (!normalized) {
            return '服务收益提现';
        }

        return normalized.slice(0, 32);
    }

    private buildSceneReportInfos(remark?: string | null) {
        const now = new Date();
        const monthLabel = `${now.getFullYear()}年${String(now.getMonth() + 1).padStart(2, '0')}月服务佣金提现`;
        const description = (remark?.trim() || monthLabel).slice(0, 32);

        return [
            {
                info_type: '岗位类型',
                info_content: '上门服务人员',
            },
            {
                info_type: '报酬说明',
                info_content: description,
            },
        ];
    }

    private mapProviderResult({
        withdrawalId,
        appId,
        mchId,
        state,
        referenceId,
        providerBillNo,
        providerPackageInfo,
        failReason,
        createTime,
        updateTime,
        raw,
    }: {
        withdrawalId: string;
        appId: string | null;
        mchId: string;
        state: WechatPayMerchantTransferState;
        referenceId?: string | null;
        providerBillNo?: string | null;
        providerPackageInfo?: string | null;
        failReason?: string | null;
        createTime?: string;
        updateTime?: string;
        raw: unknown;
    }): PayoutProviderExecuteResult {
        const processedAt =
            WECHAT_PAYOUT_TERMINAL_STATES.has(state) && updateTime
                ? (this.parseWechatTime(updateTime) ?? new Date())
                : undefined;

        return {
            channel: this.channel,
            withdrawalStatus: this.mapWithdrawalStatus(state),
            referenceId: referenceId ?? null,
            providerState: state,
            providerAppId: appId,
            providerBillNo: providerBillNo ?? null,
            providerPackageInfo: providerPackageInfo ?? null,
            failureReason: failReason ?? null,
            processedAt,
            providerMeta: {
                wechatMerchantTransfer: {
                    mchId,
                    appId,
                    outBillNo: withdrawalId,
                    transferBillNo: providerBillNo ?? null,
                    failReason: failReason ?? null,
                    createTime: createTime ?? null,
                    updateTime: updateTime ?? null,
                    source: 'execute',
                },
                raw,
            },
        };
    }

    private mapWithdrawalStatus(
        state: WechatPayMerchantTransferState,
    ): PayoutProviderExecuteResult['withdrawalStatus'] {
        switch (state) {
            case 'SUCCESS':
                return 'completed';
            case 'FAIL':
                return 'failed';
            case 'CANCELLED':
                return 'cancelled';
            case 'ACCEPTED':
            case 'PROCESSING':
            case 'WAIT_USER_CONFIRM':
            case 'TRANSFERING':
            case 'CANCELING':
            default:
                return 'processing';
        }
    }

    private toFen(amount: Decimal) {
        return amount
            .mul(100)
            .toDecimalPlaces(0, Decimal.ROUND_HALF_UP)
            .toNumber();
    }

    private parseWechatTime(value?: string) {
        if (!value) {
            return undefined;
        }

        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
            return undefined;
        }

        return parsed;
    }
}
