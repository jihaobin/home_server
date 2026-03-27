export type WechatPayConfig = {
    mchId: string;
    apiV3Key: string;
    merchantCertSerialNo: string;
    privateKeyPem: string;
    platformVerifierPem: string;
    platformVerifierId: string;
    baseUrl: string;
    userAppId: string;
    userNotifyUrl: string;
    userRefundNotifyUrl: string;
};

export type WechatPayAppPrepayRequest = {
    appid: string;
    mchid: string;
    description: string;
    out_trade_no: string;
    time_expire?: string;
    notify_url: string;
    amount: {
        total: number;
        currency?: string;
    };
};

export type WechatPayAppPrepayResponse = {
    prepay_id: string;
};

export type WechatPayOrderQueryResponse = {
    appid: string;
    mchid: string;
    out_trade_no: string;
    transaction_id?: string;
    trade_type?: string;
    trade_state: string;
    trade_state_desc: string;
    bank_type?: string;
    attach?: string;
    success_time?: string;
    payer?: {
        openid?: string;
    };
    amount?: {
        total?: number;
        payer_total?: number;
        currency?: string;
        payer_currency?: string;
    };
};

export type WechatPayCloseOrderRequest = {
    mchid: string;
};

export type WechatPayRefundAmount = {
    refund: number;
    total: number;
    currency?: string;
};

export type WechatPayCreateRefundRequest = {
    transaction_id?: string;
    out_trade_no?: string;
    out_refund_no: string;
    reason?: string;
    notify_url?: string;
    amount: WechatPayRefundAmount;
};

export type WechatPayCreateRefundResponse = {
    refund_id: string;
    out_refund_no: string;
    out_trade_no?: string;
    transaction_id?: string;
    status: 'SUCCESS' | 'CLOSED' | 'PROCESSING' | 'ABNORMAL';
    user_received_account?: string;
    success_time?: string;
    create_time?: string;
    amount?: {
        total?: number;
        refund?: number;
        payer_total?: number;
        payer_refund?: number;
        settlement_refund?: number;
        settlement_total?: number;
        discount_refund?: number;
        currency?: string;
    };
};

export type WechatPayRefundQueryResponse = WechatPayCreateRefundResponse;

export type WechatPayRequestHeaders = Record<
    string,
    string | string[] | undefined
>;

export type WechatPayNotifyEnvelope = {
    id: string;
    create_time: string;
    event_type: string;
    resource_type: string;
    summary: string;
    resource: {
        algorithm: string;
        ciphertext: string;
        associated_data?: string;
        original_type: string;
        nonce: string;
    };
};

export type WechatPayDecryptedTransaction = {
    appid: string;
    mchid: string;
    out_trade_no: string;
    transaction_id: string;
    trade_type: string;
    trade_state: string;
    trade_state_desc: string;
    success_time?: string;
    amount?: {
        total?: number;
        payer_total?: number;
        currency?: string;
        payer_currency?: string;
    };
};

export type WechatPayDecryptedRefund = {
    out_trade_no: string;
    out_refund_no: string;
    transaction_id?: string;
    refund_id: string;
    refund_status: 'SUCCESS' | 'CLOSED' | 'ABNORMAL' | 'PROCESSING';
    success_time?: string;
    user_received_account?: string;
    amount?: {
        refund?: number;
        total?: number;
        payer_total?: number;
        payer_refund?: number;
        settlement_refund?: number;
        settlement_total?: number;
        discount_refund?: number;
        currency?: string;
    };
};

export type WechatPayAppLaunchRequest = {
    appId: string;
    partnerId: string;
    prepayId: string;
    packageValue: 'Sign=WXPay';
    nonceStr: string;
    timeStamp: string;
    sign: string;
};

export type WechatPayNotifyParseResult = {
    envelope: WechatPayNotifyEnvelope;
    transaction: WechatPayDecryptedTransaction;
};

export type WechatPayRefundNotifyParseResult = {
    envelope: WechatPayNotifyEnvelope;
    refund: WechatPayDecryptedRefund;
};

export type WechatPayFailureResponse = {
    code: 'FAIL';
    message: string;
};
