import { Injectable } from '@nestjs/common';
import { format } from 'date-fns';
import type { PayNotification } from '@repo/types';
import { createAliPaySdk } from 'src/lib/alipaySdk';
import type {
    PaymentProvider,
    PaymentProviderInitiateRequest,
    PaymentProviderInitiateResult,
    PaymentProviderNotifyResult,
    PaymentProviderQueryRequest,
    PaymentProviderStatusResult,
} from './payment-provider.interface';

type AlipayTradeStatus =
    | 'WAIT_BUYER_PAY'
    | 'TRADE_CLOSED'
    | 'TRADE_SUCCESS'
    | 'TRADE_FINISHED';

type AlipayTradeQueryResponse = {
    code: string;
    msg: string;
    tradeStatus?: AlipayTradeStatus;
    tradeNo?: string;
    totalAmount?: string;
    sendPayDate?: string;
};

function parseAlipayTime(value?: string) {
    if (!value) {
        return undefined;
    }

    return new Date(`${value.replace(' ', 'T')}+08:00`);
}

@Injectable()
export class AlipayPaymentProvider implements PaymentProvider {
    readonly channel = 'alipay' as const;

    private readonly alipaySdk = createAliPaySdk();

    private formatAlipayTimeExpire(date: Date) {
        return format(date, 'yyyy-MM-dd+HH:mm:ss');
    }

    async initiatePayment(
        request: PaymentProviderInitiateRequest,
    ): Promise<PaymentProviderInitiateResult> {
        const orderString = this.alipaySdk.sdkExecute('alipay.trade.app.pay', {
            bizContent: {
                out_trade_no: request.outTradeNo,
                total_amount: request.amount.toFixed(2),
                subject: request.subject,
                product_code: 'QUICK_MSECURITY_PAY',
                body: request.body ?? '',
                ...(request.timeExpire
                    ? {
                          time_expire: this.formatAlipayTimeExpire(
                              new Date(request.timeExpire),
                          ),
                      }
                    : {}),
            },
            notify_url:
                process.env.ALIPAY_NOTIFY_URL ??
                'http://e96a2a8c.natappfree.cc/api/pay/alipay/notify',
        });

        return {
            payType: 'alipay',
            orderString,
        };
    }

    async queryPaymentStatus(
        request: PaymentProviderQueryRequest,
    ): Promise<PaymentProviderStatusResult> {
        const queryResult = (await this.alipaySdk.exec('alipay.trade.query', {
            bizContent: {
                out_trade_no: request.outTradeNo,
            },
        })) as AlipayTradeQueryResponse;

        if (queryResult.code === '10000' && queryResult.tradeStatus) {
            return {
                channel: this.channel,
                providerStatus: queryResult.tradeStatus,
                transactionId: queryResult.tradeNo,
                paidAt: parseAlipayTime(queryResult.sendPayDate),
                amount: queryResult.totalAmount,
                message:
                    queryResult.tradeStatus === 'WAIT_BUYER_PAY'
                        ? '订单尚未支付'
                        : '订单已支付完成',
            };
        }

        if (queryResult.code === '40004') {
            return {
                channel: this.channel,
                providerStatus: 'NOT_FOUND',
                amount: queryResult.totalAmount,
                transactionId: queryResult.tradeNo,
                message: '订单尚未支付',
                notFound: true,
            };
        }

        throw new Error(queryResult.msg || '查询支付状态失败');
    }

    async handleNotify(payload: unknown): Promise<PaymentProviderNotifyResult> {
        const payInfo = payload as PayNotification;
        const signatureValid = this.alipaySdk.checkNotifySignV2(payInfo);

        if (!signatureValid) {
            throw new Error('支付宝回调签名校验失败');
        }

        return {
            outTradeNo: payInfo.out_trade_no,
            channel: this.channel,
            providerStatus: payInfo.trade_status,
            transactionId: payInfo.trade_no,
            paidAt: parseAlipayTime(
                payInfo.gmt_payment || payInfo.notify_time,
            ),
            amount: payInfo.total_amount,
            message:
                payInfo.trade_status === 'WAIT_BUYER_PAY'
                    ? '订单尚未支付'
                    : '订单已支付完成',
        };
    }
}
