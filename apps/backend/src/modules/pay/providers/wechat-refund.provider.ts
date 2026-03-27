import { Injectable, Logger } from '@nestjs/common';
import { WechatPayClient } from 'src/lib/wechatPay/wechatPay.client';
import type {
    RefundNotifyRequest,
    RefundNotifyResult,
    RefundProvider,
    RefundQueryRequest,
    RefundQueryResult,
    RefundRequest,
    RefundResult,
} from './refund-provider.interface';

type WechatApiErrorShape = {
    statusCode?: number;
    responseBody?: string;
};

function isWechatApiError(error: unknown): error is WechatApiErrorShape {
    return (
        typeof error === 'object' &&
        error !== null &&
        ('statusCode' in error || 'responseBody' in error)
    );
}

function toFen(amount: number) {
    return Math.round(amount * 100);
}

function toYuan(total?: number) {
    if (typeof total !== 'number') {
        return undefined;
    }

    return Number((total / 100).toFixed(2));
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
export class WechatRefundProvider implements RefundProvider {
    readonly channel = 'wechat_pay' as const;

    private readonly logger = new Logger(WechatRefundProvider.name);

    private readonly wechatPayClient = new WechatPayClient();

    async refund(request: RefundRequest): Promise<RefundResult> {
        if (!request.tradeNo && !request.outTradeNo) {
            return {
                success: false,
                message: '微信退款缺少交易号信息',
            };
        }

        try {
            const response = await this.createRefundWithFallback(request);

            return {
                success: true,
                refundAmount: toYuan(response.amount?.refund) ?? request.amount,
                tradeNo: response.refund_id,
                raw: response,
                message: this.buildStatusMessage(response.status),
                metadata: {
                    providerStatus: response.status,
                    refundId: response.refund_id,
                    outRefundNo: response.out_refund_no,
                    outTradeNo: response.out_trade_no,
                    transactionId: response.transaction_id,
                    successTime: response.success_time,
                },
            };
        } catch (error) {
            const message =
                error instanceof Error ? error.message : '微信退款请求失败';
            const providerError = isWechatApiError(error)
                ? {
                      statusCode: error.statusCode,
                      responseBody: error.responseBody,
                  }
                : undefined;
            this.logger.error(
                `[WechatRefundProvider] 微信退款请求失败 - outRefundNo:${request.outRequestNo}`,
                JSON.stringify({
                    message,
                    request: {
                        transactionId: request.tradeNo,
                        outTradeNo: request.outTradeNo,
                        amount: request.amount,
                        totalAmount: request.totalAmount ?? request.amount,
                    },
                    providerError,
                }),
            );
            return {
                success: false,
                message: providerError?.responseBody
                    ? `${message} - ${providerError.responseBody}`
                    : message,
                raw: error,
            };
        }
    }

    async queryRefundStatus(
        request: RefundQueryRequest,
    ): Promise<RefundQueryResult> {
        const result =
            await this.wechatPayClient.queryDomesticRefundByOutRefundNo(
                request.outRequestNo,
            );

        if (!result) {
            return {
                channel: this.channel,
                outRequestNo: request.outRequestNo,
                providerStatus: 'NOT_FOUND',
                message: '退款单尚未在微信侧创建',
                notFound: true,
            };
        }

        return {
            channel: this.channel,
            outRequestNo: result.out_refund_no,
            outTradeNo: result.out_trade_no,
            providerStatus: result.status,
            refundId: result.refund_id,
            refundAmount: toYuan(result.amount?.refund),
            successTime: parseWechatTime(result.success_time),
            message: this.buildStatusMessage(result.status),
            raw: result,
        };
    }

    handleNotify(request: RefundNotifyRequest): Promise<RefundNotifyResult> {
        const notify = this.wechatPayClient.parseAndVerifyRefundNotify({
            rawBody: request.rawBody,
            headers: request.headers ?? {},
        });

        return Promise.resolve({
            channel: this.channel,
            outRequestNo: notify.refund.out_refund_no,
            outTradeNo: notify.refund.out_trade_no,
            providerStatus: notify.refund.refund_status,
            refundId: notify.refund.refund_id,
            refundAmount: toYuan(notify.refund.amount?.refund),
            successTime: parseWechatTime(notify.refund.success_time),
            message:
                notify.envelope.summary ||
                this.buildStatusMessage(notify.refund.refund_status),
            raw: notify,
        });
    }

    private buildStatusMessage(status?: string) {
        switch (status) {
            case 'SUCCESS':
                return '微信退款成功';
            case 'PROCESSING':
                return '微信退款处理中';
            case 'ABNORMAL':
                return '微信退款异常';
            case 'CLOSED':
                return '微信退款已关闭';
            default:
                return '微信退款状态已更新';
        }
    }

    private async createRefundWithFallback(request: RefundRequest) {
        const payloadBase = {
            out_refund_no: request.outRequestNo,
            reason: request.reason,
            notify_url: this.wechatPayClient.getUserRefundNotifyUrl(),
            amount: {
                refund: toFen(request.amount),
                total: toFen(request.totalAmount ?? request.amount),
                currency: 'CNY' as const,
            },
        };

        if (request.tradeNo) {
            try {
                return await this.wechatPayClient.createDomesticRefund({
                    ...payloadBase,
                    transaction_id: request.tradeNo,
                });
            } catch (error) {
                if (!request.outTradeNo) {
                    throw error;
                }

                this.logger.warn(
                    `[WechatRefundProvider] transaction_id 退款失败，使用 out_trade_no 重试 - outRefundNo:${request.outRequestNo}`,
                );
            }
        }

        if (!request.outTradeNo) {
            throw new Error('微信退款缺少 out_trade_no');
        }

        return this.wechatPayClient.createDomesticRefund({
            ...payloadBase,
            out_trade_no: request.outTradeNo,
        });
    }
}
