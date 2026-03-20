import { Injectable, Logger } from '@nestjs/common';
import { createAliPaySdk } from 'src/lib/alipaySdk';
import type {
    RefundProvider,
    RefundRequest,
    RefundResult,
} from './refund.interface';

type RefundFundDetail = {
    fund_channel: string;
    amount: string;
    fund_type?: string;
    real_amount?: string;
};

type AlipayTradeRefundResponse = Record<string, unknown> & {
    code?: string;
    msg?: string;
    traceId?: string;
    subCode?: string;
    sub_code?: string;
    subMsg?: string;
    sub_msg?: string;
    tradeNo?: string;
    trade_no?: string;
    outTradeNo?: string;
    out_trade_no?: string;
    buyerLogonId?: string;
    buyer_logon_id?: string;
    buyerUserId?: string;
    buyer_user_id?: string;
    fundChange?: 'Y' | 'N';
    fund_change?: 'Y' | 'N';
    refundFee?: string;
    refund_fee?: string;
    refundCurrency?: string;
    refund_currency?: string;
    gmtRefundPay?: string;
    gmt_refund_pay?: string;
    refundDetailItemList?: RefundFundDetail[];
    refund_detail_item_list?: RefundFundDetail[];
    presentRefundBuyerAmount?: string;
    present_refund_buyer_amount?: string;
    presentRefundDiscountAmount?: string;
    present_refund_discount_amount?: string;
    presentRefundMdiscountAmount?: string;
    present_refund_mdiscount_amount?: string;
};

type AlipayTradeRefundPayload =
    | {
          alipay_trade_refund_response?: AlipayTradeRefundResponse;
          sign?: string;
      }
    | AlipayTradeRefundResponse;

@Injectable()
export class AlipayRefundProvider implements RefundProvider {
    readonly channel = 'alipay' as const;

    private readonly logger = new Logger(AlipayRefundProvider.name);

    private readonly alipaySdk = createAliPaySdk();

    async refund(request: RefundRequest): Promise<RefundResult> {
        const { outTradeNo, tradeNo, outRequestNo, amount, reason } = request;

        const payload = {
            bizContent: {
                refund_amount: amount.toFixed(2),
                refund_reason: reason || '用户申请退款',
                out_request_no: outRequestNo,
                ...(tradeNo
                    ? { trade_no: tradeNo }
                    : { out_trade_no: outTradeNo }),
            },
        };

        let rawResponse: AlipayTradeRefundPayload;
        try {
            rawResponse = (await this.alipaySdk.exec(
                'alipay.trade.refund',
                payload,
            )) as AlipayTradeRefundPayload;
        } catch (error) {
            this.logger.error(
                `[AlipayRefundProvider] 调用支付宝退款接口失败`,
                error instanceof Error ? error.message : error,
            );
            return {
                success: false,
                message: '退款请求失败，请稍后重试',
                raw: error,
            };
        }

        const response = this.extractResponse(rawResponse);
        if (!response) {
            this.logger.error(
                '[AlipayRefundProvider] 未能解析支付宝退款响应',
                rawResponse,
            );
            return {
                success: false,
                message: '支付宝退款响应异常，请稍后重试',
                raw: rawResponse,
            };
        }

        const code = this.getStringField(response, ['code']) ?? '';
        const msg = this.getStringField(response, ['msg']) ?? '退款失败';
        const subCode = this.getStringField(response, ['subCode', 'sub_code']);
        const subMsg = this.getStringField(response, ['subMsg', 'sub_msg']);
        const traceId = this.getStringField(response, ['traceId']);

        this.logger.log(
            `[AlipayRefundProvider] 支付宝退款响应 - code:${code}, msg:${msg}, subCode:${subCode ?? '-'}, subMsg:${subMsg ?? '-'}, traceId:${traceId ?? '-'}`,
        );

        if (code !== '10000') {
            const errorMessage = subMsg || msg || '退款失败';
            this.logger.error(
                `[AlipayRefundProvider] 支付宝退款失败 - tradeNo:${tradeNo ?? '-'}, outTradeNo:${outTradeNo}, subCode:${subCode ?? '-'}, subMsg:${subMsg ?? '-'}, traceId:${traceId ?? '-'}`,
            );
            return {
                success: false,
                message: errorMessage,
                code,
                subCode,
                raw: rawResponse,
            };
        }

        const refundFee = Number(
            this.getStringField(response, ['refundFee', 'refund_fee']) ??
                amount,
        );

        return {
            success: true,
            refundAmount: refundFee,
            tradeNo: this.getStringField(response, ['tradeNo', 'trade_no']),
            raw: rawResponse,
            metadata: {
                outTradeNo: this.getStringField(response, [
                    'outTradeNo',
                    'out_trade_no',
                ]),
                buyerLogonId: this.getStringField(response, [
                    'buyerLogonId',
                    'buyer_logon_id',
                ]),
                buyerUserId: this.getStringField(response, [
                    'buyerUserId',
                    'buyer_user_id',
                ]),
                fundChange: this.getStringField(response, [
                    'fundChange',
                    'fund_change',
                ]),
                refundCurrency: this.getStringField(response, [
                    'refundCurrency',
                    'refund_currency',
                ]),
                refundFee: this.getStringField(response, [
                    'refundFee',
                    'refund_fee',
                ]),
                gmtRefundPay: this.getStringField(response, [
                    'gmtRefundPay',
                    'gmt_refund_pay',
                ]),
                refundDetailItems: this.getField(response, [
                    'refundDetailItemList',
                    'refund_detail_item_list',
                ]),
                presentRefundBuyerAmount: this.getStringField(response, [
                    'presentRefundBuyerAmount',
                    'present_refund_buyer_amount',
                ]),
                presentRefundDiscountAmount: this.getStringField(response, [
                    'presentRefundDiscountAmount',
                    'present_refund_discount_amount',
                ]),
                presentRefundMdiscountAmount: this.getStringField(response, [
                    'presentRefundMdiscountAmount',
                    'present_refund_mdiscount_amount',
                ]),
                traceId,
            },
            message: msg,
        };
    }

    private extractResponse(
        payload: AlipayTradeRefundPayload,
    ): AlipayTradeRefundResponse | null {
        if (
            payload &&
            typeof payload === 'object' &&
            'alipay_trade_refund_response' in payload &&
            payload.alipay_trade_refund_response
        ) {
            return payload.alipay_trade_refund_response as AlipayTradeRefundResponse;
        }

        if (
            payload &&
            typeof payload === 'object' &&
            'code' in payload &&
            typeof payload.code === 'string'
        ) {
            return payload as AlipayTradeRefundResponse;
        }

        return null;
    }

    private getStringField(
        payload: AlipayTradeRefundResponse,
        keys: string[],
    ): string | undefined {
        for (const key of keys) {
            const value = payload[key];
            if (typeof value === 'string' && value.length > 0) {
                return value;
            }
        }

        return undefined;
    }

    private getField(
        payload: AlipayTradeRefundResponse,
        keys: string[],
    ): unknown {
        for (const key of keys) {
            if (key in payload) {
                return payload[key];
            }
        }

        return undefined;
    }
}
