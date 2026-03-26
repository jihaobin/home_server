import { Injectable } from '@nestjs/common';
import { WechatPayClient } from 'src/lib/wechatPay/wechatPay.client';
import type {
    PaymentProvider,
    PaymentProviderInitiateRequest,
    PaymentProviderInitiateResult,
    PaymentProviderNotifyRequest,
    PaymentProviderNotifyResult,
    PaymentProviderQueryRequest,
    PaymentProviderStatusResult,
} from './payment-provider.interface';

function toFen(amount: number) {
    return Math.round(amount * 100);
}

function toYuan(total?: number) {
    if (typeof total !== 'number') {
        return undefined;
    }

    return (total / 100).toFixed(2);
}

function parseWechatTime(value?: string) {
    if (!value) {
        return undefined;
    }

    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) {
        return undefined;
    }

    return parsed;
}

@Injectable()
export class WechatPaymentProvider implements PaymentProvider {
    readonly channel = 'wechat_pay' as const;

    private readonly wechatPayClient = new WechatPayClient();

    async initiatePayment(
        request: PaymentProviderInitiateRequest,
    ): Promise<PaymentProviderInitiateResult> {
        const description = request.subject.slice(0, 127);
        const prepay = await this.wechatPayClient.createAppPrepayOrder({
            appid: this.wechatPayClient.getUserAppId(),
            mchid: this.wechatPayClient.getMchId(),
            description,
            out_trade_no: request.outTradeNo,
            time_expire: request.timeExpire
                ? new Date(request.timeExpire).toISOString()
                : undefined,
            notify_url: this.wechatPayClient.getUserNotifyUrl(),
            amount: {
                total: toFen(request.amount),
                currency: request.currency || 'CNY',
            },
        });

        return {
            payType: 'wechat_pay',
            wechatPayRequest: this.wechatPayClient.buildAppLaunchRequest(
                prepay.prepay_id,
            ),
        };
    }

    async queryPaymentStatus(
        request: PaymentProviderQueryRequest,
    ): Promise<PaymentProviderStatusResult> {
        const result = await this.wechatPayClient.queryOrderByOutTradeNo(
            request.outTradeNo,
        );

        if (!result) {
            return {
                channel: this.channel,
                providerStatus: 'NOT_FOUND',
                message: '订单尚未在微信支付侧创建',
                notFound: true,
            };
        }

        return {
            channel: this.channel,
            providerStatus: result.trade_state,
            transactionId: result.transaction_id,
            paidAt: parseWechatTime(result.success_time),
            amount: toYuan(result.amount?.total),
            message: result.trade_state_desc || '微信支付状态已更新',
        };
    }

    async handleNotify(
        request: PaymentProviderNotifyRequest,
    ): Promise<PaymentProviderNotifyResult> {
        const notify = this.wechatPayClient.parseAndVerifyPaymentNotify({
            rawBody: request.rawBody,
            headers: request.headers ?? {},
        });

        return {
            outTradeNo: notify.transaction.out_trade_no,
            channel: this.channel,
            providerStatus: notify.transaction.trade_state,
            transactionId: notify.transaction.transaction_id,
            paidAt: parseWechatTime(notify.transaction.success_time),
            amount: toYuan(notify.transaction.amount?.total),
            message:
                notify.transaction.trade_state_desc ||
                notify.envelope.summary ||
                '微信支付回调处理成功',
        };
    }
}
