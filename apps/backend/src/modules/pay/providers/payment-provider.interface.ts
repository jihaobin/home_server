import { paymentMethodEnum } from 'src/common/database/schema/enums';

export type PaymentChannel = (typeof paymentMethodEnum.enumValues)[number];

export type PaymentProviderInitiateRequest = {
    paymentId: string;
    outTradeNo: string;
    amount: number;
    currency: string;
    subject: string;
    body?: string;
    timeExpire?: Date | null;
};

export type PaymentProviderInitiateResult =
    | {
          payType: 'alipay';
          orderString: string;
      }
    | {
          payType: 'wechat_pay';
          wechatPayRequest: {
              appId: string;
              partnerId: string;
              prepayId: string;
              packageValue: string;
              nonceStr: string;
              timeStamp: string;
              sign: string;
          };
      };

type PaymentProviderOutTradeNoRequest = {
    outTradeNo: string;
};

export type PaymentProviderQueryRequest = PaymentProviderOutTradeNoRequest;

export type PaymentProviderCloseRequest = PaymentProviderOutTradeNoRequest;

export type PaymentProviderNotifyRequest = {
    rawBody: string;
    headers?: Record<string, string | string[] | undefined>;
    parsedBody?: unknown;
};

export type PaymentProviderStatusResult = {
    channel: PaymentChannel;
    providerStatus: string;
    transactionId?: string;
    paidAt?: Date;
    amount?: string;
    message: string;
    notFound?: boolean;
};

export type PaymentProviderNotifyResult = PaymentProviderStatusResult & {
    outTradeNo: string;
};

export interface PaymentProvider {
    readonly channel: PaymentChannel;

    initiatePayment(
        request: PaymentProviderInitiateRequest,
    ): Promise<PaymentProviderInitiateResult>;

    queryPaymentStatus(
        request: PaymentProviderQueryRequest,
    ): Promise<PaymentProviderStatusResult>;

    closeOrder?(request: PaymentProviderCloseRequest): Promise<void>;

    handleNotify?(
        request: PaymentProviderNotifyRequest,
    ): Promise<PaymentProviderNotifyResult>;
}

export const PAYMENT_PROVIDERS = Symbol('PAYMENT_PROVIDERS');
