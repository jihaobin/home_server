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

type AlipayTradeRefundResponse = {
    code: string;
    msg: string;
    sub_code?: string;
    sub_msg?: string;
    trade_no?: string;
    out_trade_no?: string;
    buyer_logon_id?: string;
    buyer_user_id?: string;
    fund_change?: 'Y' | 'N';
    refund_fee?: string;
    refund_currency?: string;
    gmt_refund_pay?: string;
    refund_detail_item_list?: RefundFundDetail[];
    present_refund_buyer_amount?: string;
    present_refund_discount_amount?: string;
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
        const { outTradeNo, outRequestNo, amount, reason } = request;

        const payload = {
            bizContent: {
                out_trade_no: outTradeNo,
                refund_amount: amount.toFixed(2),
                refund_reason: reason || '用户申请退款',
                out_request_no: outRequestNo,
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

        this.logger.log(
            `[AlipayRefundProvider] 支付宝退款响应 - code:${response.code}, msg:${response.msg}`,
        );

        if (response.code !== '10000') {
            const errorMessage = response.sub_msg || response.msg || '退款失败';
            this.logger.error(
                `[AlipayRefundProvider] 支付宝退款失败 - sub_code:${response.sub_code}, sub_msg:${response.sub_msg}`,
            );
            return {
                success: false,
                message: errorMessage,
                code: response.code,
                subCode: response.sub_code,
                raw: rawResponse,
            };
        }

        const refundFee = Number(response.refund_fee ?? amount);

        return {
            success: true,
            refundAmount: refundFee,
            tradeNo: response.trade_no,
            raw: rawResponse,
            metadata: {
                outTradeNo: response.out_trade_no,
                buyerLogonId: response.buyer_logon_id,
                buyerUserId: response.buyer_user_id,
                fundChange: response.fund_change,
                refundCurrency: response.refund_currency,
                refundFee: response.refund_fee,
                gmtRefundPay: response.gmt_refund_pay,
                refundDetailItems: response.refund_detail_item_list,
                presentRefundBuyerAmount: response.present_refund_buyer_amount,
                presentRefundDiscountAmount:
                    response.present_refund_discount_amount,
                presentRefundMdiscountAmount:
                    response.present_refund_mdiscount_amount,
            },
            message: response.msg,
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
            return payload.alipay_trade_refund_response;
        }

        if (
            payload &&
            typeof payload === 'object' &&
            'code' in payload &&
            typeof payload.code === 'string'
        ) {
            return payload;
        }

        return null;
    }
}
