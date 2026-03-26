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

export type WechatPayFailureResponse = {
    code: 'FAIL';
    message: string;
};
