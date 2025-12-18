import { paymentMethodEnum } from 'src/common/database/schema/enums';

export type RefundChannel = (typeof paymentMethodEnum.enumValues)[number];

export interface RefundRequest {
    outTradeNo: string;
    outRequestNo: string;
    amount: number;
    reason?: string;
    channel?: RefundChannel;
}

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
}

export const REFUND_PROVIDERS = Symbol('REFUND_PROVIDERS');
