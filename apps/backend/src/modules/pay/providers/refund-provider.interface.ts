import { paymentMethodEnum } from 'src/common/database/schema/enums';

export type RefundChannel = (typeof paymentMethodEnum.enumValues)[number];

export interface RefundRequest {
    outTradeNo: string;
    tradeNo?: string;
    outRequestNo: string;
    amount: number;
    totalAmount?: number;
    reason?: string;
    channel?: RefundChannel;
}

export interface RefundQueryRequest {
    outRequestNo: string;
}

export interface RefundQueryResult {
    channel: RefundChannel;
    outRequestNo: string;
    outTradeNo?: string;
    providerStatus: string;
    refundId?: string;
    refundAmount?: number;
    successTime?: Date;
    message: string;
    notFound?: boolean;
    raw?: unknown;
}

export interface RefundNotifyRequest {
    rawBody: string;
    headers?: Record<string, string | string[] | undefined>;
}

export type RefundNotifyResult = RefundQueryResult;

export interface RefundSuccessResult {
    success: true;
    refundAmount: number;
    tradeNo?: string;
    metadata?: Record<string, unknown>;
    raw?: unknown;
    message?: string;
}

export interface RefundFailureResult {
    success: false;
    message: string;
    code?: string;
    subCode?: string;
    raw?: unknown;
}

export type RefundResult = RefundSuccessResult | RefundFailureResult;

export interface RefundProvider {
    readonly channel: RefundChannel;
    refund(request: RefundRequest): Promise<RefundResult>;
    queryRefundStatus?(request: RefundQueryRequest): Promise<RefundQueryResult>;
    handleNotify?(request: RefundNotifyRequest): Promise<RefundNotifyResult>;
}

export const REFUND_PROVIDERS = Symbol('REFUND_PROVIDERS');
