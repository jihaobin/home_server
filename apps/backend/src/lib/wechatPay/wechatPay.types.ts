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
    workerAppId?: string;
    workerTransferNotifyUrl?: string;
    workerTransferSceneId?: string;
    transferSourceIp?: string;
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

export type WechatPayMerchantTransferSceneReportInfo = {
    info_type: string;
    info_content: string;
};

export type WechatPayCreateMerchantTransferRequest = {
    appid: string;
    out_bill_no: string;
    transfer_scene_id: string;
    openid: string;
    user_name?: string;
    transfer_amount: number;
    transfer_remark: string;
    notify_url?: string;
    user_recv_perception?: string;
    transfer_scene_report_infos: WechatPayMerchantTransferSceneReportInfo[];
};

export type WechatPayMerchantTransferState =
    | 'ACCEPTED'
    | 'PROCESSING'
    | 'WAIT_USER_CONFIRM'
    | 'TRANSFERING'
    | 'SUCCESS'
    | 'FAIL'
    | 'CANCELING'
    | 'CANCELLED';

export type WechatPayCreateMerchantTransferResponse = {
    out_bill_no: string;
    transfer_bill_no: string;
    create_time: string;
    state: WechatPayMerchantTransferState;
    package_info?: string;
};

export type WechatPayMerchantTransferQueryResponse = {
    mch_id: string;
    out_bill_no: string;
    transfer_bill_no: string;
    appid: string;
    state: WechatPayMerchantTransferState;
    transfer_amount: number;
    transfer_remark: string;
    fail_reason?: string;
    openid?: string;
    user_name?: string;
    create_time: string;
    update_time: string;
};

export type WechatPayDecryptedMerchantTransfer = {
    out_bill_no: string;
    transfer_bill_no: string;
    state: 'SUCCESS' | 'FAIL' | 'CANCELLED';
    mch_id: string;
    transfer_amount: number;
    openid: string;
    fail_reason?: string;
    create_time: string;
    update_time: string;
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

export type WechatPayMerchantTransferNotifyParseResult = {
    envelope: WechatPayNotifyEnvelope;
    transfer: WechatPayDecryptedMerchantTransfer;
};

export type WechatPayFailureResponse = {
    code: 'FAIL';
    message: string;
};
