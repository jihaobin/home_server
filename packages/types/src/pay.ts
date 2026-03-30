import { z } from "zod/v4";
import {
    PaymentMethodEnum,
    PaymentStatusEnum,
    TransactionTypeEnum,
    WithdrawalStatusEnum,
} from "./database-entity";
import { PaginationMetaSchema } from "./common";

const PAY_DATETIME_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const PAY_DATETIME_MILLIS_PATTERN =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;
const PAY_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

const createBoundedString = (max: number, label: string) =>
    z
        .string()
        .min(1, `${label}不能为空`)
        .max(max, `${label}长度不能超过${max}`);

const createOptionalBoundedString = (max: number, label: string) =>
    createBoundedString(max, label).optional();

const payDateTimeSecondsSchema = z
    .string()
    .regex(PAY_DATETIME_SECONDS_PATTERN, "时间格式需为 yyyy-MM-dd HH:mm:ss");

const payDateTimeWithMillisSchema = z
    .string()
    .regex(
        PAY_DATETIME_MILLIS_PATTERN,
        "时间格式需为 yyyy-MM-dd HH:mm:ss，允许毫秒部分",
    );

const payAmountTextSchema = z
    .string()
    .min(1, "金额不能为空")
    .regex(PAY_AMOUNT_PATTERN, "金额格式必须为整数或保留两位小数");

/**
 * 支付渠道枚举
 */
export const fundChannelSchema = z
    .enum([
        "COUPON",
        "ALIPAYACCOUNT",
        "POINT",
        "DISCOUNT",
        "PCARD",
        "MCARD",
        "MDISCOUNT",
        "MCOUPON",
        "BANKCARD",
        "MONEYFUND",
        "VOUCHER",
        "DCEP_ASSET",
    ])
    .meta({
        title: "支付渠道",
        description: `支付宝支付渠道类型
COUPON: 支付宝红包
ALIPAYACCOUNT: 支付宝账户
POINT: 集分宝
DISCOUNT: 折扣券
PCARD: 预付卡
MCARD: 商家储值卡
MDISCOUNT: 商户优惠券
MCOUPON: 商户红包
BANKCARD: 银行卡
MONEYFUND: 余额宝
VOUCHER: 券
DCEP_ASSET: 数字人民币`,
        examples: ["ALIPAYACCOUNT"],
    });
export type FundChannel = z.infer<typeof fundChannelSchema>;

export const payNotifyTypeSchema = z.enum(["trade_status_sync"]).meta({
    title: "支付宝异步通知类型",
    description: "notify_type 字段的取值范围，目前仅支持 trade_status_sync。",
    examples: ["trade_status_sync"],
});
export type PayNotifyType = z.infer<typeof payNotifyTypeSchema>;

export const paySignTypeSchema = z.enum(["RSA2", "RSA"]).meta({
    title: "支付宝签名算法类型",
    description: "sign_type 字段所支持的签名算法，推荐使用 RSA2。",
    examples: ["RSA2"],
});
export type PaySignType = z.infer<typeof paySignTypeSchema>;

export const payTradeStatusSchema = z
    .enum(["WAIT_BUYER_PAY", "TRADE_CLOSED", "TRADE_SUCCESS", "TRADE_FINISHED"])
    .meta({
        title: "支付宝交易状态",
        description: "trade_status 字段在支付回调中的所有可能取值。",
        examples: ["TRADE_SUCCESS"],
    });
export type PayTradeStatus = z.infer<typeof payTradeStatusSchema>;

export const payFundBillSchema = z
    .object({
        fundChannel: fundChannelSchema,
        amount: payAmountTextSchema,
    })
    .meta({
        title: "支付渠道金额明细",
        description: "fund_bill_list 字段解析后的单条资金明细数据。",
        examples: [
            {
                fundChannel: "ALIPAYACCOUNT",
                amount: "15.00",
            },
        ],
    });
export type PayFundBill = z.infer<typeof payFundBillSchema>;

export const payVoucherContributeDetailSchema = z
    .object({
        contributeType: createBoundedString(32, "contributeType"),
        contributeAmount: payAmountTextSchema,
    })
    .meta({
        title: "优惠券其他出资方明细",
        description:
            "voucher_detail_list.otherContributeDetail 内的出资方记录。",
        examples: [
            {
                contributeType: "PLATFORM",
                contributeAmount: "0.18",
            },
        ],
    });
export type PayVoucherContributeDetail = z.infer<
    typeof payVoucherContributeDetailSchema
>;

export const payVoucherDetailSchema = z
    .object({
        voucherId: createBoundedString(32, "voucherId"),
        templateId: createBoundedString(64, "templateId"),
        name: createBoundedString(64, "name"),
        type: createBoundedString(32, "type"),
        amount: payAmountTextSchema,
        merchantContribute: payAmountTextSchema,
        otherContribute: payAmountTextSchema,
        otherContributeDetail: z
            .array(payVoucherContributeDetailSchema)
            .optional(),
        memo: z.string().max(256, "memo长度不能超过256").optional(),
    })
    .meta({
        title: "优惠券明细",
        description: "voucher_detail_list 字段解析后的单条优惠券使用记录。",
        examples: [
            {
                voucherId: "2015102600073002039000002D5O",
                templateId: "20171030000730015359000EMZP0",
                name: "5元代金券",
                type: "ALIPAY_BIZ_VOUCHER",
                amount: "0.20",
                merchantContribute: "0.00",
                otherContribute: "0.20",
                otherContributeDetail: [
                    {
                        contributeType: "PLATFORM",
                        contributeAmount: "0.20",
                    },
                ],
                memo: "学生专用优惠",
            },
        ],
    });
export type PayVoucherDetail = z.infer<typeof payVoucherDetailSchema>;

export const payFundBillListSchema = z
    .union([
        z.string().max(512, "fund_bill_list长度不能超过512"),
        z.array(payFundBillSchema).min(1, "fund_bill_list至少包含一项"),
    ])
    .meta({
        title: "资金明细列表",
        description:
            "fund_bill_list 的可能形态，既可为 JSON 字符串，也可为已解析的对象数组。",
        examples: [
            '[{"amount":"15.00","fundChannel":"ALIPAYACCOUNT"}]',
            [
                {
                    fundChannel: "ALIPAYACCOUNT",
                    amount: "15.00",
                },
            ],
        ],
    });
export type PayFundBillList = z.infer<typeof payFundBillListSchema>;

export const payVoucherDetailListSchema = z
    .union([
        z.string(),
        z
            .array(payVoucherDetailSchema)
            .min(1, "voucher_detail_list至少包含一项"),
    ])
    .meta({
        title: "优惠券明细列表",
        description:
            "voucher_detail_list 字段的两种展现形式：原始 JSON 字符串或解析后的结构化数组。",
        examples: [
            '[{"amount":"0.20","merchantContribute":"0.00","name":"一键创建券模板的券名称","otherContribute":"0.20","type":"ALIPAY_BIZ_VOUCHER"}]',
            [
                {
                    voucherId: "2015102600073002039000002D5O",
                    templateId: "20171030000730015359000EMZP0",
                    name: "5元代金券",
                    type: "ALIPAY_BIZ_VOUCHER",
                    amount: "0.20",
                    merchantContribute: "0.00",
                    otherContribute: "0.20",
                    memo: "学生专用优惠",
                },
            ],
        ],
    });
export type PayVoucherDetailList = z.infer<typeof payVoucherDetailListSchema>;

export const payNotificationTriggerDefaultsSchema = z
    .object({
        TRADE_FINISHED: z.literal(true),
        TRADE_SUCCESS: z.literal(true),
        TRADE_CLOSED: z.literal(true),
        WAIT_BUYER_PAY: z.literal(false),
    })
    .meta({
        title: "支付宝通知默认触发规则",
        description:
            "不同交易状态对应的异步通知默认触发策略，true 表示会推送，false 表示默认不推送。",
        examples: [
            {
                TRADE_FINISHED: true,
                TRADE_SUCCESS: true,
                TRADE_CLOSED: true,
                WAIT_BUYER_PAY: false,
            },
        ],
    });
export type PayNotificationTriggerDefaults = z.infer<
    typeof payNotificationTriggerDefaultsSchema
>;

export const payNotificationSchema = z
    .object({
        notify_time: payDateTimeSecondsSchema,
        notify_type: payNotifyTypeSchema,
        notify_id: createBoundedString(128, "notify_id"),
        sign_type: paySignTypeSchema,
        sign: createBoundedString(344, "sign"),
        trade_no: createBoundedString(64, "trade_no"),
        app_id: createBoundedString(32, "app_id"),
        auth_app_id: createOptionalBoundedString(32, "auth_app_id"),
        out_trade_no: createBoundedString(64, "out_trade_no"),
        out_biz_no: createOptionalBoundedString(64, "out_biz_no"),
        buyer_id: createOptionalBoundedString(128, "buyer_id"),
        buyer_open_id: createOptionalBoundedString(128, "buyer_open_id"),
        buyer_logon_id: createOptionalBoundedString(100, "buyer_logon_id"),
        seller_id: createBoundedString(30, "seller_id"),
        seller_email: createOptionalBoundedString(100, "seller_email"),
        trade_status: payTradeStatusSchema,
        total_amount: payAmountTextSchema,
        receipt_amount: payAmountTextSchema.optional(),
        invoice_amount: payAmountTextSchema.optional(),
        buyer_pay_amount: payAmountTextSchema.optional(),
        point_amount: payAmountTextSchema.optional(),
        refund_fee: payAmountTextSchema.optional(),
        send_back_fee: payAmountTextSchema.optional(),
        subject: createBoundedString(256, "subject"),
        body: createOptionalBoundedString(400, "body"),
        passback_params: z
            .string()
            .max(512, "passback_params长度不能超过512")
            .optional(),
        gmt_create: payDateTimeSecondsSchema.optional(),
        gmt_payment: payDateTimeSecondsSchema.optional(),
        gmt_refund: payDateTimeWithMillisSchema.optional(),
        gmt_close: payDateTimeSecondsSchema.optional(),
        fund_bill_list: payFundBillListSchema.optional(),
        voucher_detail_list: payVoucherDetailListSchema.optional(),
    })
    .meta({
        title: "支付宝支付回调通知",
        description: "从支付宝接收到的 trade_status_sync 异步通知数据结构。",
        examples: [
            {
                notify_time: "2020-12-27 06:20:30",
                notify_type: "trade_status_sync",
                notify_id: "ac05099524730693a8b330c5ecf72da9786",
                sign_type: "RSA2",
                sign: "601510b7970e52cc63db0f44997cf70e",
                trade_no: "20213112011001004330000121536",
                app_id: "2014072300007148",
                out_trade_no: "6823789339978248",
                seller_id: "2088101106499364",
                trade_status: "TRADE_SUCCESS",
                total_amount: "20.00",
                subject: "XXX交易",
                receipt_amount: "15.00",
                buyer_logon_id: "180****0062",
                gmt_create: "2015-04-27 15:45:57",
                gmt_payment: "2015-04-27 15:45:57",
                fund_bill_list: [
                    {
                        fundChannel: "ALIPAYACCOUNT",
                        amount: "15.00",
                    },
                ],
            },
        ],
    });
export type PayNotification = z.infer<typeof payNotificationSchema>;

const PAY_OUT_TRADE_NO_ALLOWED_PATTERN = /^[0-9A-Za-z_]+$/;
const PAY_NUMERIC_STRING_PATTERN = /^\d+$/;
const PAY_MIN_AGE_PATTERN = /^\d{1,3}$/;

const payOutTradeNoSchema = z
    .string()
    .min(1, "out_trade_no不能为空")
    .max(64, "out_trade_no长度不能超过64")
    .regex(
        PAY_OUT_TRADE_NO_ALLOWED_PATTERN,
        "out_trade_no仅支持字母、数字、下划线",
    );

const payTotalAmountSchema = payAmountTextSchema.refine((value) => {
    const numeric = Number(value);
    return !Number.isNaN(numeric) && numeric >= 0.01 && numeric <= 100000000;
}, "total_amount取值范围为[0.01,100000000]");

const payGoodsQuantitySchema = z
    .number("quantity需为数字")
    .int("quantity需为整数")
    .min(1, "quantity最小为1");

const payInstallmentNumberSchema = z
    .string()
    .min(1, "hb_fq_num不能为空")
    .max(5, "hb_fq_num长度不能超过5")
    .regex(PAY_NUMERIC_STRING_PATTERN, "hb_fq_num仅支持数字");

const payInstallmentPercentSchema = z
    .string()
    .min(1, "hb_fq_seller_percent不能为空")
    .max(3, "hb_fq_seller_percent长度不能超过3")
    .regex(PAY_NUMERIC_STRING_PATTERN, "hb_fq_seller_percent仅支持数字")
    .refine((value) => {
        const numeric = Number(value);
        return !Number.isNaN(numeric) && numeric >= 0 && numeric <= 100;
    }, "hb_fq_seller_percent取值范围为0-100");

const payExtUserInfoMinAgeSchema = z
    .string()
    .min(1, "min_age不能为空")
    .max(3, "min_age长度不能超过3")
    .regex(PAY_MIN_AGE_PATTERN, "min_age仅支持数字表示年龄")
    .refine((value) => Number(value) >= 0, "min_age需大于等于0");

const payNeedCheckInfoSchema = z.enum(["T", "F"]).meta({
    title: "身份信息校验开关",
    description:
        "need_check_info 传入 T 时会校验证件信息，传入 F 或缺省则不校验。",
    examples: ["F"],
});

const payCardTypeSchema = z.enum(["S0JP0000"]).meta({
    title: "卡类型编码",
    description: "card_type 目前仅支持 S0JP0000（境外发卡行卡类型）。",
    examples: ["S0JP0000"],
});

const payRoyaltyFreezeSchema = z.enum(["true", "false"]).meta({
    title: "分账冻结标识",
    description: "royalty_freeze 为 true 表示申请资金冻结；false 表示不冻结。",
    examples: ["true"],
});

export const payGoodsDetailSchema = z
    .object({
        goods_id: createOptionalBoundedString(32, "goods_id"),
        goods_name: createOptionalBoundedString(256, "goods_name"),
        quantity: payGoodsQuantitySchema.optional(),
        price: payAmountTextSchema.optional(),
        alipay_goods_id: createOptionalBoundedString(32, "alipay_goods_id"),
        goods_category: createOptionalBoundedString(24, "goods_category"),
        categories_tree: createOptionalBoundedString(128, "categories_tree"),
        show_url: createOptionalBoundedString(400, "show_url"),
    })
    .meta({
        title: "商品明细条目",
        description:
            "用于描述订单中的单个商品，字段均对应支付宝 goods_detail 结构。",
        examples: [
            {
                goods_id: "apple-01",
                goods_name: "ipad",
                quantity: 1,
                price: "2000",
                alipay_goods_id: "20010001",
                goods_category: "34543238",
                categories_tree: "124868003|126232002|126252004",
                show_url: "http://www.alipay.com/xxx.jpg",
            },
        ],
    });
export type PayGoodsDetail = z.infer<typeof payGoodsDetailSchema>;

export const payGoodsDetailListSchema = z
    .array(payGoodsDetailSchema)
    .min(1, "goods_detail 至少包含一项商品")
    .meta({
        title: "商品明细列表",
        description:
            "goods_detail 可以在业务内以数组方式构造，也可以按支付宝接口要求传入 JSON 字符串。",
        examples: [
            '[{"goods_id":"apple-01","goods_name":"ipad","quantity":1,"price":"2000"}]',
            [
                {
                    goods_id: "apple-01",
                    goods_name: "ipad",
                    quantity: 1,
                    price: "2000",
                },
            ],
        ],
    });
export type PayGoodsDetailList = z.infer<typeof payGoodsDetailListSchema>;

export const payExtendParamsSchema = z
    .object({
        sys_service_provider_id: createOptionalBoundedString(
            64,
            "sys_service_provider_id",
        ),
        hb_fq_num: payInstallmentNumberSchema.optional(),
        hb_fq_seller_percent: payInstallmentPercentSchema.optional(),
        industry_reflux_info: createOptionalBoundedString(
            512,
            "industry_reflux_info",
        ),
        card_type: payCardTypeSchema.optional(),
        royalty_freeze: payRoyaltyFreezeSchema.optional(),
    })
    .meta({
        title: "业务扩展参数",
        description: "extend_params 承载花呗分期、行业回流等扩展能力。",
        examples: [
            {
                sys_service_provider_id: "2088511833207846",
                hb_fq_num: "3",
                hb_fq_seller_percent: "100",
                industry_reflux_info:
                    '{"scene_code":"metro_tradeorder","channel":"xxxx","scene_data":{"asset_name":"ALIPAY"}}',
                card_type: "S0JP0000",
                royalty_freeze: "true",
            },
        ],
    });
export type PayExtendParams = z.infer<typeof payExtendParamsSchema>;

const payCertTypeSchema = z
    .enum([
        "IDENTITY_CARD",
        "PASSPORT",
        "OFFICER_CARD",
        "SOLDIER_CARD",
        "HOKOU",
        "PERMANENT_RESIDENCE_FOREIGNER",
    ])
    .meta({
        title: "证件类型",
        description:
            "ext_user_info.cert_type 的可选值，覆盖居民身份证、护照等证件。",
        examples: ["IDENTITY_CARD"],
    });
export type PayCertType = z.infer<typeof payCertTypeSchema>;

export const payExtUserInfoSchema = z
    .object({
        cert_no: createOptionalBoundedString(64, "cert_no"),
        min_age: payExtUserInfoMinAgeSchema.optional(),
        name: createOptionalBoundedString(16, "name"),
        mobile: createOptionalBoundedString(20, "mobile"),
        cert_type: payCertTypeSchema.optional(),
        need_check_info: payNeedCheckInfoSchema.optional(),
        identity_hash: createOptionalBoundedString(128, "identity_hash"),
    })
    .meta({
        title: "外部指定用户信息",
        description: "ext_user_info 用于在订单中标记需要校验的用户实名信息。",
        examples: [
            {
                cert_no: "362334768769238881",
                min_age: "18",
                name: "Zhang San",
                mobile: "16587658765",
                cert_type: "IDENTITY_CARD",
                need_check_info: "F",
                identity_hash:
                    "27bfcd1dee4f22c8fe8a2374af9b660419d1361b1c207e9b41a754a113f38fcc",
            },
        ],
    });
export type PayExtUserInfo = z.infer<typeof payExtUserInfoSchema>;

export const payQueryOptionSchema = z
    .enum(["hyb_amount", "enterprise_pay_info", "medical_insurance_info"])
    .meta({
        title: "可选查询字段",
        description: "query_options 中的取值需与支付宝文档保持一致。",
        examples: ["hyb_amount"],
    });
export type PayQueryOption = z.infer<typeof payQueryOptionSchema>;

const payQueryOptionArraySchema = z
    .array(payQueryOptionSchema)
    .min(1, "query_options 至少包含一项")
    .max(256, "query_options 最多支持256项");

export const payQueryOptionsSchema = z
    .union([z.string(), payQueryOptionArraySchema])
    .meta({
        title: "附加查询字段",
        description:
            "query_options 可直接传递 JSON 字符串，或在业务层构造成枚举数组再序列化。",
        examples: [
            '["hyb_amount","enterprise_pay_info"]',
            ["hyb_amount", "enterprise_pay_info"],
        ],
    });
export type PayQueryOptions = z.infer<typeof payQueryOptionsSchema>;

export const payRequestSchema = z
    .object({
        out_trade_no: payOutTradeNoSchema,
        total_amount: payTotalAmountSchema,
        subject: createBoundedString(256, "subject"),
        product_code: createBoundedString(64, "product_code"),
        goods_detail: payGoodsDetailListSchema.optional(),
        time_expire: payDateTimeSecondsSchema.optional(),
        extend_params: payExtendParamsSchema.optional(),
        passback_params: z
            .string()
            .max(512, "passback_params长度不能超过512")
            .optional(),
        merchant_order_no: createOptionalBoundedString(32, "merchant_order_no"),
        ext_user_info: payExtUserInfoSchema.optional(),
        query_options: payQueryOptionsSchema.optional(),
    })
    .meta({
        title: "统一收单交易支付请求",
        description:
            "基于文档中的业务参数定义的请求校验规则，涵盖主参数与嵌套结构。",
        examples: [
            {
                out_trade_no: "70501111111S001111119",
                total_amount: "9.00",
                subject: "Test Order",
                product_code: "QUICK_MSECURITY_PAY",
                goods_detail: [
                    {
                        goods_id: "apple-01",
                        goods_name: "ipad",
                        quantity: 1,
                        price: "2000",
                    },
                ],
                time_expire: "2016-12-31 10:05:00",
                extend_params: {
                    sys_service_provider_id: "2088511833207846",
                    hb_fq_num: "3",
                    hb_fq_seller_percent: "100",
                    industry_reflux_info:
                        '{"scene_code":"metro_tradeorder","channel":"xxxx","scene_data":{"asset_name":"ALIPAY"}}',
                    royalty_freeze: "true",
                },
                passback_params:
                    "merchantBizType%3d3C%26merchantBizNo%3d2016010101111",
                merchant_order_no: "20161008001",
                ext_user_info: {
                    cert_no: "362334768769238881",
                    min_age: "18",
                    name: "Zhang San",
                    mobile: "16587658765",
                    cert_type: "IDENTITY_CARD",
                    need_check_info: "F",
                    identity_hash:
                        "27bfcd1dee4f22c8fe8a2374af9b660419d1361b1c207e9b41a754a113f38fcc",
                },
                query_options: ["hyb_amount", "enterprise_pay_info"],
            },
        ],
    });
export type PayRequest = z.infer<typeof payRequestSchema>;

const ALIPAY_WITHDRAW_BIZ_SCENES = [
    "DIRECT_TRANSFER",
    "PERSONAL_COLLECTION",
    "CAE_TRANSFER",
    "DIRECT_ALLOCATION",
    "DIRECT_ALLOCATION_TRANSFER",
    "ENTRUST_ALLOCATION",
    "ENTRUST_ALLOCATION_TRANSFER",
    "ENTRUST_TRANSFER",
    "OVERSEA_FCY_TRANSFER",
    "THIRDPARTY_PERSONAL_COLLECTION",
    "THIRDPARTY_PERSONAL_COLLECTION_CONFIRM",
    "UNLIMITED_PAY",
] as const;

export const alipayWithdrawBizSceneSchema = z
    .enum(ALIPAY_WITHDRAW_BIZ_SCENES)
    .meta({
        title: "转账场景枚举",
        description:
            "biz_scene 字段的可选值列表，文档默认示例为 DIRECT_TRANSFER。",
        examples: ["DIRECT_TRANSFER"],
    });
export type AlipayWithdrawBizScene = z.infer<
    typeof alipayWithdrawBizSceneSchema
>;

export const alipayWithdrawProductCodeSchema = z
    .literal("TRANS_ACCOUNT_NO_PWD")
    .meta({
        title: "产品码",
        description: "product_code 固定为 TRANS_ACCOUNT_NO_PWD。",
        examples: ["TRANS_ACCOUNT_NO_PWD"],
    });
export type AlipayWithdrawProductCode = z.infer<
    typeof alipayWithdrawProductCodeSchema
>;

const ALIPAY_WITHDRAW_PAYEE_IDENTITY_TYPES = [
    "ALIPAY_USER_ID",
    "ALIPAY_LOGON_ID",
    "ALIPAY_OPEN_ID",
] as const;

export const alipayWithdrawPayeeIdentityTypeSchema = z
    .enum(ALIPAY_WITHDRAW_PAYEE_IDENTITY_TYPES)
    .meta({
        title: "收款方标识类型",
        description: "identity_type 的枚举值，与文档保持一致。",
        examples: ["ALIPAY_USER_ID"],
    });
export type AlipayWithdrawPayeeIdentityType = z.infer<
    typeof alipayWithdrawPayeeIdentityTypeSchema
>;

const alipayWithdrawPayeeSchemaBase = z
    .object({
        identity: createBoundedString(128, "identity"),
        identity_type: alipayWithdrawPayeeIdentityTypeSchema,
        name: createBoundedString(128, "name").optional(),
    })
    .meta({
        title: "收款方信息",
        description:
            "对应 alipay_withdraw.txt 中的 payee_info 结构，包含标识与姓名。",
        examples: [
            {
                identity: "2088123412341234",
                identity_type: "ALIPAY_USER_ID",
                name: "黄龙国际有限公司",
            },
        ],
    });

export const alipayWithdrawPayeeSchema =
    alipayWithdrawPayeeSchemaBase.superRefine((value, ctx) => {
        if (value.identity_type === "ALIPAY_LOGON_ID" && !value.name) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["name"],
                message: "identity_type 为 ALIPAY_LOGON_ID 时，name 为必填项",
            });
        }
    });
export type AlipayWithdrawPayee = z.infer<typeof alipayWithdrawPayeeSchema>;

const alipayWithdrawAmountSchema = payAmountTextSchema
    .refine((value) => {
        const numeric = Number(value);
        return (
            Number.isFinite(numeric) && numeric >= 0.1 && numeric <= 100000000
        );
    }, "trans_amount 必须在 0.1 到 100000000 之间")
    .meta({
        title: "转账金额",
        description: "单位为元，精确到小数点后两位，范围 [0.1, 100000000]。",
        examples: ["23.00"],
    });

const alipayWithdrawRemarkSchema = z
    .string()
    .max(200, "remark 最大长度 200")
    .optional();

const alipayWithdrawBusinessParamsSchema = z
    .string()
    .max(2048, "business_params 最大长度 2048")
    .optional();

export const alipayWithdrawRequestSchema = z
    .object({
        out_biz_no: createBoundedString(64, "out_biz_no"),
        trans_amount: alipayWithdrawAmountSchema,
        biz_scene: alipayWithdrawBizSceneSchema,
        product_code: alipayWithdrawProductCodeSchema,
        order_title: createBoundedString(128, "order_title"),
        payee_info: alipayWithdrawPayeeSchema,
        remark: alipayWithdrawRemarkSchema,
        business_params: alipayWithdrawBusinessParamsSchema,
    })
    .meta({
        title: "支付宝单笔无密转账请求",
        description: "根据 alipay_withdraw.txt 中的业务请求参数生成。",
        examples: [
            {
                out_biz_no: "201806300001",
                trans_amount: "23.00",
                biz_scene: "DIRECT_TRANSFER",
                product_code: "TRANS_ACCOUNT_NO_PWD",
                order_title: "201905工资",
                payee_info: {
                    identity: "2088123412341234",
                    identity_type: "ALIPAY_USER_ID",
                    name: "黄龙国际有限公司",
                },
                remark: "201905工资",
                business_params: { payer_show_name_use_alias: "true" },
            },
        ],
    });
export type AlipayWithdrawRequest = z.infer<typeof alipayWithdrawRequestSchema>;

const ALIPAY_WITHDRAW_STATUS_VALUES = ["SUCCESS", "FAIL"] as const;

export const alipayWithdrawStatusSchema = z
    .enum(ALIPAY_WITHDRAW_STATUS_VALUES)
    .meta({
        title: "转账状态",
        description: "SUCCESS 表示转账成功，FAIL 表示转账失败。",
        examples: ["SUCCESS"],
    });
export type AlipayWithdrawStatus = z.infer<typeof alipayWithdrawStatusSchema>;

const ALIPAY_WITHDRAW_ERROR_CODES = [
    "SYSTEM_ERROR",
    "INVALID_PARAMETER",
    "AUTHOREE_IS_NOT_MATCH",
    "BALANCE_IS_NOT_ENOUGH",
    "BIZ_UNIQUE_EXCEPTION",
    "BLOCK_USER_FORBBIDEN_RECIEVE",
    "BLOCK_USER_FORBBIDEN_SEND",
    "CHECK_RECEIVER_CERT_NOT_ALLOW",
    "CURRENCY_NOT_SUPPORT",
    "EXCEED_LIMIT_DC_RECEIVED",
    "EXCEED_LIMIT_DM_AMOUNT",
    "EXCEED_LIMIT_DM_MAX_AMOUNT",
    "EXCEED_LIMIT_ENT_SM_AMOUNT",
    "EXCEED_LIMIT_MM_AMOUNT",
    "EXCEED_LIMIT_MM_MAX_AMOUNT",
    "EXCEED_LIMIT_PERSONAL_SM_AMOUNT",
    "EXCEED_LIMIT_SM_AMOUNT",
    "EXCEED_LIMIT_SM_MIN_AMOUNT",
    "EXCEED_LIMIT_UNRN_DM_AMOUNT",
    "EXPAND_INDIRECT_VERIFY_FAIL",
    "IDENTITY_FUND_RELATION_NOT_FOUND",
    "ILLEGAL_OPERATION",
    "INST_PAY_UNABLE",
    "INVALID_PAYER_ACCOUNT",
    "ISV_AUTH_ERROR",
    "MEMO_REQUIRED_IN_TRANSFER_ERROR",
    "MONEY_PAY_CLOSED",
    "MRCHPROD_QUERY_ERROR",
    "NOT_IN_WHITE_LIST",
    "NOT_SUPPORT_PAYER_ACCOUNT_TYPE",
    "NO_ACCOUNTBOOK_PERMISSION",
    "NO_ACCOUNT_PAYMENT_PERMISSION",
    "NO_ACCOUNT_RECEIVE_PERMISSION",
    "NO_ACCOUNT_USER_FORBBIDEN_RECIEVE",
    "NO_AVAILABLE_PAYMENT_TOOLS",
    "NO_ORDER_PERMISSION",
    "NO_PERMISSION_ACCOUNT",
    "ORDER_NOT_EXIST",
    "ORDER_STATUS_INVALID",
    "OVERSEA_TRANSFER_CLOSE",
    "PARAM_ILLEGAL",
    "PAYCARD_UNABLE_PAYMENT",
    "PAYEE_ACCOUNT_NOT_EXSIT",
    "PAYEE_ACCOUNT_STATUS_ERROR",
    "PAYEE_ACC_OCUPIED",
    "PAYEE_CERT_INFO_ERROR",
    "PAYEE_NOT_EXIST",
    "PAYEE_NOT_RELNAME_CERTIFY",
    "PAYEE_TRUSTEESHIP_ACC_OVER_LIMIT",
    "PAYEE_USERINFO_STATUS_ERROR",
    "PAYEE_USER_TYPE_ERROR",
    "PAYER_BALANCE_NOT_ENOUGH",
    "PAYER_CERTIFY_CHECK_FAIL",
    "PAYER_NOT_EQUAL_PAYEE_ERROR",
    "PAYER_NOT_EXIST",
    "PAYER_PAYEE_CANNOT_SAME",
    "PAYER_PERMLIMIT_CHECK_FAILURE",
    "PAYER_REQUESTER_RELATION_INVALID",
    "PAYER_STATUS_ERROR",
    "PAYER_USERINFO_NOT_EXSIT",
    "PAYER_USER_INFO_ERROR",
    "PAYMENT_FAIL",
    "PAYMENT_INFO_INCONSISTENCY",
    "PAYMENT_TIME_EXPIRE",
    "PERMIT_CHECK_PERM_AML_CERT_EXPIRED",
    "PERMIT_CHECK_PERM_IDENTITY_THEFT",
    "PERMIT_CHECK_PERM_LIMITED",
    "PERMIT_CHECK_RECEIVE_LIMIT",
    "PERMIT_LIMIT_PAYEE",
    "PERMIT_NON_BANK_LIMIT_PAYEE",
    "PERMIT_PAYER_FORBIDDEN",
    "PERM_AML_NOT_REALNAME_REV",
    "PERM_PAY_CUSTOMER_DAILY_QUOTA_ORG_BALANCE_LIMIT",
    "PERM_PAY_CUSTOMER_MONTH_QUOTA_ORG_BALANCE_LIMIT",
    "PERM_PAY_USER_DAILY_QUOTA_ORG_BALANCE_LIMIT",
    "PERM_PAY_USER_MONTH_QUOTA_ORG_BALANCE_LIMIT",
    "PROCESS_FAIL",
    "PRODUCT_NOT_SIGN",
    "RELEASE_USER_FORBBIDEN_RECIEVE",
    "REMARK_HAS_SENSITIVE_WORD",
    "REQUEST_PROCESSING",
    "RESOURCE_LIMIT_EXCEED",
    "SECURITY_CHECK_FAILED",
    "SIGN_AGREEMENT_NO_INCONSISTENT",
    "SIGN_INVALID",
    "SIGN_INVOKE_PID_INCONSISTENT",
    "SIGN_NOT_ALLOW_SKIP",
    "SIGN_PARAM_INVALID",
    "SIGN_QUERY_AGGREMENT_ERROR",
    "SIGN_QUERY_APP_INFO_ERROR",
    "TRANSFER_SCENE_NAME_ILLEGAL",
    "TRUSTEESHIP_ACCOUNT_NOT_EXIST",
    "TRUSTEESHIP_RECIEVE_QUOTA_LIMIT",
    "USER_AGREEMENT_VERIFY_FAIL",
    "USER_NOT_EXIST",
    "USER_RISK_FREEZE",
] as const;

export const alipayWithdrawErrorCodeSchema = z
    .enum(ALIPAY_WITHDRAW_ERROR_CODES)
    .meta({
        title: "转账业务错误码",
        description: "sub_code 可能出现的业务错误码列表。",
        examples: ["SYSTEM_ERROR"],
    });
export type AlipayWithdrawErrorCode = z.infer<
    typeof alipayWithdrawErrorCodeSchema
>;

const alipayWithdrawBaseResponseSchema = z
    .object({
        code: createBoundedString(16, "code"),
        msg: z.string().min(1, "msg 不能为空").max(128, "msg 最大长度 128"),
        subCode: alipayWithdrawErrorCodeSchema.optional(),
        subMsg: z.string().min(1).max(512, "subMsg 最大长度 512").optional(),
        traceId: createOptionalBoundedString(64, "traceId"),
    })
    .meta({
        title: "转账接口基础响应",
        description:
            "所有转账响应均包含的标准字段，支付宝实际返回字段为驼峰写法。",
    });

export const alipayWithdrawSuccessResponseSchema =
    alipayWithdrawBaseResponseSchema
        .extend({
            outBizNo: createBoundedString(64, "outBizNo"),
            orderId: createBoundedString(32, "orderId"),
            payFundOrderId: createBoundedString(32, "payFundOrderId"),
            transDate: payDateTimeSecondsSchema,
            status: alipayWithdrawStatusSchema.optional(),
        })
        .meta({
            title: "转账成功响应",
            description: "业务处理成功时返回的核心字段，字段名为驼峰命名。",
            examples: [
                {
                    code: "10000",
                    msg: "Success",
                    outBizNo: "201806300001",
                    orderId: "20190801110070000006380000250621",
                    payFundOrderId: "20190801110070001506380000251556",
                    transDate: "2019-08-21 00:00:00",
                    status: "SUCCESS",
                },
            ],
        });
export type AlipayWithdrawSuccessResponse = z.infer<
    typeof alipayWithdrawSuccessResponseSchema
>;

export const alipayWithdrawErrorResponseSchema =
    alipayWithdrawBaseResponseSchema
        .extend({
            subCode: alipayWithdrawErrorCodeSchema,
        })
        .meta({
            title: "转账失败响应",
            description: "业务失败时将包含 subCode 及 subMsg 等信息。",
            examples: [
                {
                    code: "20000",
                    msg: "Service Currently Unavailable",
                    subCode: "SYSTEM_ERROR",
                    subMsg: "系统繁忙",
                },
            ],
        });
export type AlipayWithdrawErrorResponse = z.infer<
    typeof alipayWithdrawErrorResponseSchema
>;

export const alipayWithdrawResponseSchema = z
    .union([
        alipayWithdrawSuccessResponseSchema,
        alipayWithdrawErrorResponseSchema,
    ])
    .meta({
        title: "转账接口响应",
        description: "根据 code 可判断业务是否成功。",
    });
export type AlipayWithdrawResponse = z.infer<
    typeof alipayWithdrawResponseSchema
>;

const paymentAppChannelSchema = z.enum(["alipay", "wechat_pay"]);

const wechatPayRequestSchema = z
    .object({
        appId: createBoundedString(128, "微信 appId"),
        partnerId: createBoundedString(128, "微信商户号"),
        prepayId: createBoundedString(128, "微信 prepayId"),
        packageValue: createBoundedString(64, "微信 package"),
        nonceStr: createBoundedString(128, "微信 nonceStr"),
        timeStamp: createBoundedString(32, "微信 timeStamp"),
        sign: createBoundedString(512, "微信签名"),
    })
    .meta({
        title: "微信支付拉起参数",
        description: "APP 端调起微信支付所需参数。",
    });

export const InitiatePaymentParamsSchema = z
    .string()
    .min(1, "订单ID不能为空")
    .max(255, "订单ID长度不能超过255")
    .meta({
        title: "订单ID",
        description: "待发起支付的订单ID",
    });

export type InitiatePaymentParams = z.infer<typeof InitiatePaymentParamsSchema>;

export const InitiatePaymentBodySchema = z
    .object({
        payType: paymentAppChannelSchema.meta({
            title: "支付方式",
            description: "支付渠道。当前实现以支付宝为主，结构已兼容微信支付。",
            examples: ["alipay"],
        }),
        displayAmount: z.coerce
            .number("displayAmount 必须为数字")
            .positive("显示金额需大于 0")
            .meta({
                title: "显示金额",
                description: "客户端展示的支付金额，用于发起前的订单校验",
                examples: [199.99],
            }),
    })
    .meta({
        title: "发起支付请求体",
        description: "发起订单支付接口的请求体",
    });

export type InitiatePaymentBody = z.infer<typeof InitiatePaymentBodySchema>;

const initiatePaymentResponseBaseSchema = z.object({
    paymentId: z.string().min(1).meta({
        title: "支付记录ID",
        description: "用于后续查询或调试的支付记录标识",
    }),
    payType: paymentAppChannelSchema.meta({ title: "支付方式" }),
    outTradeNo: z.string().min(1).meta({
        title: "外部订单号",
        description: "支付流水号/商户订单号",
    }),
    amount: z.number().positive().meta({
        title: "支付金额",
        description: "本次支付的订单金额（单位：元）",
    }),
    currency: z
        .string()
        .min(1)
        .meta({ title: "币种", description: "默认使用 CNY" }),
});

export const InitiatePaymentResponseSchema = z
    .discriminatedUnion("payType", [
        initiatePaymentResponseBaseSchema.extend({
            payType: z.literal("alipay"),
            orderString: z.string().min(1).meta({
                title: "支付订单串",
                description: "客户端直接用于发起支付宝支付的订单字符串签名",
            }),
        }),
        initiatePaymentResponseBaseSchema.extend({
            payType: z.literal("wechat_pay"),
            wechatPayRequest: wechatPayRequestSchema,
        }),
    ])
    .meta({ title: "发起支付响应" });

export type InitiatePaymentResponse = z.infer<
    typeof InitiatePaymentResponseSchema
>;

export const AlipayNotifyResponseSchema = z.enum(["success", "fail"]).meta({
    title: "支付宝回调响应",
    description: "支付宝要求返回 success 或 fail",
});

export type AlipayNotifyResponse = z.infer<typeof AlipayNotifyResponseSchema>;

export const PaymentNotifyResponseSchema = z.enum(["success", "fail"]).meta({
    title: "支付回调响应",
    description: "支付渠道回调处理完成后返回 success 或 fail。",
});

export type PaymentNotifyResponse = z.infer<typeof PaymentNotifyResponseSchema>;

export const WechatRefundStatusSchema = z
    .enum(["SUCCESS", "CLOSED", "ABNORMAL", "PROCESSING"])
    .meta({
        title: "微信退款状态",
        description: "微信退款链路中的渠道状态枚举。",
        examples: ["SUCCESS"],
    });

export type WechatRefundStatus = z.infer<typeof WechatRefundStatusSchema>;

export const WechatRefundNotifyResourceAmountSchema = z
    .object({
        refund: z.number().int().nonnegative().optional(),
        total: z.number().int().nonnegative().optional(),
        payer_total: z.number().int().nonnegative().optional(),
        payer_refund: z.number().int().nonnegative().optional(),
        settlement_refund: z.number().int().nonnegative().optional(),
        settlement_total: z.number().int().nonnegative().optional(),
        discount_refund: z.number().int().nonnegative().optional(),
        currency: z.string().min(1).max(16).optional(),
    })
    .meta({
        title: "微信退款金额对象",
        description: "微信退款通知中 resource.amount 的结构，金额单位为分。",
    });

export type WechatRefundNotifyResourceAmount = z.infer<
    typeof WechatRefundNotifyResourceAmountSchema
>;

export const WechatRefundNotifyResourceSchema = z
    .object({
        out_trade_no: z.string().min(1).max(64),
        out_refund_no: z.string().min(1).max(64),
        transaction_id: z.string().min(1).max(64).optional(),
        refund_id: z.string().min(1).max(64),
        refund_status: WechatRefundStatusSchema,
        success_time: z.string().optional(),
        user_received_account: z.string().optional(),
        amount: WechatRefundNotifyResourceAmountSchema.optional(),
    })
    .meta({
        title: "微信退款解密资源",
        description: "微信退款回调 resource 解密后的业务字段。",
    });

export type WechatRefundNotifyResource = z.infer<
    typeof WechatRefundNotifyResourceSchema
>;

export const WechatRefundNotifySchema = z
    .object({
        id: z.string().min(1),
        create_time: z.string().min(1),
        event_type: z.string().min(1),
        resource_type: z.string().min(1),
        summary: z.string().optional(),
        resource: z
            .object({
                algorithm: z.literal("AEAD_AES_256_GCM"),
                ciphertext: z.string().min(1),
                nonce: z.string().min(1),
                associated_data: z.string().optional(),
                original_type: z.string().optional(),
            })
            .meta({
                title: "微信退款通知密文资源",
                description: "微信退款回调中的加密资源载体。",
            }),
    })
    .meta({
        title: "微信退款回调通知",
        description: "微信退款回调原始通知体结构。",
    });

export type WechatRefundNotify = z.infer<typeof WechatRefundNotifySchema>;

export const WechatRefundQueryResponseSchema = z
    .object({
        refund_id: z.string().min(1),
        out_refund_no: z.string().min(1),
        out_trade_no: z.string().min(1).optional(),
        transaction_id: z.string().min(1).optional(),
        status: WechatRefundStatusSchema,
        success_time: z.string().optional(),
        user_received_account: z.string().optional(),
        amount: WechatRefundNotifyResourceAmountSchema.optional(),
    })
    .meta({
        title: "微信退款查单响应",
        description: "微信退款查单接口返回的核心业务字段。",
    });

export type WechatRefundQueryResponse = z.infer<
    typeof WechatRefundQueryResponseSchema
>;

const withdrawAmountNumberSchema = z
    .number("提现金额必须为数字")
    .refine((value) => Number.isFinite(value), "提现金额格式有误")
    .refine((value) => value >= 0.1, "提现金额至少 0.1 元")
    .refine(
        (value) => Math.round(value * 100) === value * 100,
        "提现金额最多保留两位小数",
    );

const withdrawCurrencySchema = z
    .string()
    .min(1, "币种不能为空")
    .max(3, "币种长度不能超过 3")
    .transform((value) => value.toUpperCase())
    .default("CNY");

export const UserWithdrawBodySchema = z
    .object({
        amount: withdrawAmountNumberSchema,
        currency: withdrawCurrencySchema,
        payType: paymentAppChannelSchema,
        remark: alipayWithdrawRemarkSchema,
    })
    .meta({
        title: "用户提现请求体",
        description:
            "前端提交的提现申请信息，收款账号由后端根据渠道绑定信息自动填充",
    });

export type UserWithdrawBody = z.infer<typeof UserWithdrawBodySchema>;

export const UserWithdrawResponseSchema = z
    .object({
        withdrawalId: z.string().min(1, "提现记录 ID 不能为空").meta({
            title: "提现记录 ID",
            description: "数据库中生成的提现记录主键",
        }),
        status: WithdrawalStatusEnum.meta({ title: "提现状态" }),
        amount: z.number().positive().meta({
            title: "提现金额",
            description: "已提交的提现金额，单位元",
        }),
        currency: z.string().min(1).meta({ title: "币种" }),
        payType: paymentAppChannelSchema.meta({ title: "提现方式" }),
        balance: z
            .object({
                available: z.number().nonnegative(),
                frozen: z.number().nonnegative(),
                total: z.number().nonnegative(),
            })
            .meta({ title: "提现后余额快照" }),
        providerRequestNo: z.string().min(1, "渠道请求号不能为空").meta({
            title: "渠道请求号",
            description: "用于渠道打款或后续查询的业务单号",
        }),
        providerState: z
            .string()
            .min(1)
            .optional()
            .nullable()
            .meta({ title: "渠道状态" }),
    })
    .meta({
        title: "用户提现响应",
        description:
            "提交提现申请后的冻结余额快照，状态默认为 pending，等待管理员审核后才会打款",
    });

export type UserWithdrawResponse = z.infer<typeof UserWithdrawResponseSchema>;

export const EarningsOverviewResponseSchema = z
    .object({
        balance: z.object({
            available: z.number().nonnegative(),
            frozen: z.number().nonnegative(),
            total: z.number().nonnegative(),
            currency: z.string().min(1),
        }),
        monthlyEarnings: z.number().nonnegative(),
        totalEarnings: z.number().nonnegative(),
        updatedAt: z.date(),
    })
    .meta({
        title: "收益概览响应",
        description: "返回余额、月收益与累计收益及更新时间。",
    });
export type EarningsOverviewResponse = z.infer<
    typeof EarningsOverviewResponseSchema
>;

export const WorkerAlipayAuthorizeParamsResponseSchema = z
    .object({
        paramString: z.string().min(1),
        params: z.object({
            appId: z.string().min(1),
            pid: z.string().min(1),
            scope: z.string().min(1),
            targetId: z.string().min(1),
        }),
    })
    .meta({
        title: "服务人员支付宝授权参数",
        description:
            "服务端生成的 `alipay.open.auth.sdk.code.get` 参数串及元信息。",
    });
export type WorkerAlipayAuthorizeParamsResponse = z.infer<
    typeof WorkerAlipayAuthorizeParamsResponseSchema
>;

export const WorkerAlipayAuthExchangeBodySchema = z
    .object({
        authCode: createBoundedString(128, "授权码"),
        appId: z.string().optional(),
        scope: z.string().optional(),
        targetId: z.string().optional(),
    })
    .meta({
        title: "服务人员支付宝授权回传",
        description: "客户端将 auth_code 传到服务端换取 user_id/open_id",
    });
export type WorkerAlipayAuthExchangeBody = z.infer<
    typeof WorkerAlipayAuthExchangeBodySchema
>;

export const WorkerAlipayAuthExchangeResponseSchema = z
    .object({
        bound: z.literal(true),
        alipayUserId: createOptionalBoundedString(
            64,
            "支付宝 userId",
        ).nullable(),
        alipayOpenId: z.string().max(64).nullable(),
    })
    .meta({
        title: "服务人员支付宝授权绑定结果",
        description: "换取到的支付宝用户标识",
    });
export type WorkerAlipayAuthExchangeResponse = z.infer<
    typeof WorkerAlipayAuthExchangeResponseSchema
>;

export const WorkerAlipayBindingStatusSchema = z
    .object({
        bound: z.boolean(),
        alipayUserId: createOptionalBoundedString(
            64,
            "支付宝 userId",
        ).nullable(),
        alipayOpenId: z.string().max(64).nullable(),
        boundAt: z.string().optional(),
    })
    .meta({
        title: "服务人员支付宝绑定状态",
        description: "服务人员当前支付宝绑定标识",
    });
export type WorkerAlipayBindingStatus = z.infer<
    typeof WorkerAlipayBindingStatusSchema
>;

export const WorkerWechatAuthExchangeBodySchema = z
    .object({
        authCode: createBoundedString(128, "授权码"),
        appId: z.string().optional(),
        scope: z.string().optional(),
        state: z.string().optional(),
    })
    .meta({
        title: "服务人员微信授权回传",
        description: "客户端将微信 auth code 传到服务端换取 openid/unionid",
    });
export type WorkerWechatAuthExchangeBody = z.infer<
    typeof WorkerWechatAuthExchangeBodySchema
>;

export const WorkerWechatAuthExchangeResponseSchema = z
    .object({
        bound: z.literal(true),
        openId: z.string().max(128).nullable(),
        unionId: z.string().max(128).nullable(),
        appId: z.string().min(1).max(128),
        boundAt: z.string(),
    })
    .meta({
        title: "服务人员微信授权绑定结果",
        description: "换取并落库后的服务人员微信提现收款标识。",
    });
export type WorkerWechatAuthExchangeResponse = z.infer<
    typeof WorkerWechatAuthExchangeResponseSchema
>;

export const WorkerWechatBindingStatusSchema = z
    .object({
        bound: z.boolean(),
        openId: z.string().max(128).nullable(),
        unionId: z.string().max(128).nullable(),
        appId: z.string().max(128).nullable(),
        boundAt: z.string().optional(),
    })
    .meta({
        title: "服务人员微信绑定状态",
        description: "服务人员当前微信提现收款身份绑定状态。",
    });
export type WorkerWechatBindingStatus = z.infer<
    typeof WorkerWechatBindingStatusSchema
>;

export const WorkerAlipayUnbindResponseSchema = z
    .object({
        success: z.literal(true),
    })
    .meta({
        title: "服务人员支付宝解绑响应",
        description: "解绑成功标识",
    });
export type WorkerAlipayUnbindResponse = z.infer<
    typeof WorkerAlipayUnbindResponseSchema
>;

export const WorkerWechatUnbindResponseSchema = z
    .object({
        success: z.literal(true),
    })
    .meta({
        title: "服务人员微信解绑响应",
        description: "解绑成功标识",
    });
export type WorkerWechatUnbindResponse = z.infer<
    typeof WorkerWechatUnbindResponseSchema
>;

export const WorkerWechatMerchantTransferClientResultSchema = z
    .enum(["success", "fail", "cancel"])
    .meta({
        title: "微信确认收款客户端结果",
        description: "客户端拉起微信确认收款页后回传的页面展示结果。",
    });

export type WorkerWechatMerchantTransferClientResult = z.infer<
    typeof WorkerWechatMerchantTransferClientResultSchema
>;

export const WorkerWechatMerchantTransferResultBodySchema = z
    .object({
        result: WorkerWechatMerchantTransferClientResultSchema,
        businessType: z.string().optional(),
        extMsg: z.string().optional(),
        errorCode: z.number().int().optional(),
        errorMessage: z.string().optional(),
        transaction: z.string().optional(),
        receivedAt: z.string().optional(),
    })
    .meta({
        title: "微信提现确认收款结果上报",
        description:
            "worker 端将微信商家转账确认收款页面的展示结果上报给服务端。",
    });

export type WorkerWechatMerchantTransferResultBody = z.infer<
    typeof WorkerWechatMerchantTransferResultBodySchema
>;

export const WorkerWithdrawalPayoutStatusResponseSchema = z
    .object({
        withdrawalId: z.string().min(1),
        status: WithdrawalStatusEnum,
        method: PaymentMethodEnum,
        providerState: z.string().nullable(),
        providerAppId: z.string().nullable(),
        providerBillNo: z.string().nullable(),
        providerPackageInfo: z.string().nullable(),
        providerMeta: z.record(z.string(), z.unknown()).nullable().optional(),
        failureReason: z.string().nullable(),
        processedAt: z.string().nullable(),
    })
    .meta({
        title: "提现渠道状态快照",
        description: "用于 worker 端在微信提现确认收款后主动刷新提现渠道状态。",
    });

export type WorkerWithdrawalPayoutStatusResponse = z.infer<
    typeof WorkerWithdrawalPayoutStatusResponseSchema
>;

export const UserWithdrawalItemSchema = z
    .object({
        id: z.string().min(1),
        amount: z.number().nonnegative(),
        currency: z.string().min(1),
        status: WithdrawalStatusEnum,
        method: PaymentMethodEnum,
        remark: z.string().nullable(),
        reviewNote: z.string().nullable(),
        failureReason: z.string().nullable(),
        requestedAt: z.date(),
        reviewedAt: z.date().nullable(),
        processedAt: z.date().nullable(),
    })
    .meta({
        title: "用户提现记录",
        description: "服务人员发起的提现申请记录",
    });

export type UserWithdrawalItem = z.infer<typeof UserWithdrawalItemSchema>;

export const UserWithdrawalListResponseSchema = z
    .object({
        items: z.array(UserWithdrawalItemSchema),
        meta: PaginationMetaSchema,
    })
    .meta({
        title: "用户提现记录分页响应",
        description: "服务人员提现记录的分页响应结构",
    });

export type UserWithdrawalListResponse = z.infer<
    typeof UserWithdrawalListResponseSchema
>;

export const UserWithdrawalQuerySchema = z
    .object({
        page: z.coerce.number().min(1).optional(),
        limit: z.coerce.number().min(1).max(100).optional(),
        status: WithdrawalStatusEnum.optional(),
    })
    .meta({
        title: "用户提现记录查询参数",
        description: "服务人员查看提现列表时可用的查询参数",
    });

export type UserWithdrawalQuery = z.infer<typeof UserWithdrawalQuerySchema>;

export const WorkerEarningsRecordFlowEnum = z
    .enum(["income", "withdrawal"])
    .meta({
        title: "收益流水方向",
        description: "标记该条记录是收入还是提现/支出",
    });

export type WorkerEarningsRecordFlow = z.infer<
    typeof WorkerEarningsRecordFlowEnum
>;

export const WorkerEarningsRecordCategoryEnum = z
    .enum(["mixed", "income", "withdrawal"])
    .meta({
        title: "收益记录查询分类",
        description:
            "mixed 表示收益+提现聚合，income 表示仅收入，withdrawal 表示仅提现记录",
    });

export type WorkerEarningsRecordCategory = z.infer<
    typeof WorkerEarningsRecordCategoryEnum
>;

export const WorkerEarningsWithdrawalDetailSchema = z
    .object({
        id: z.string().min(1, "提现记录 ID 不能为空"),
        status: WithdrawalStatusEnum,
        method: PaymentMethodEnum,
        remark: z.string().nullable(),
        reviewNote: z.string().nullable(),
        failureReason: z.string().nullable(),
        providerState: z.string().nullable().optional(),
        providerAppId: z.string().nullable().optional(),
        providerBillNo: z.string().nullable().optional(),
        providerPackageInfo: z.string().nullable().optional(),
        providerMeta: z.record(z.string(), z.unknown()).nullable().optional(),
        requestedAt: z.date(),
        reviewedAt: z.date().nullable(),
        processedAt: z.date().nullable(),
    })
    .meta({
        title: "提现附加信息",
        description: "当记录为提现类型时返回更详细的审核/处理信息",
    });

export type WorkerEarningsWithdrawalDetail = z.infer<
    typeof WorkerEarningsWithdrawalDetailSchema
>;

export const WorkerEarningsRecordItemSchema = z
    .object({
        id: z.string().min(1),
        flowType: WorkerEarningsRecordFlowEnum,
        transactionType: TransactionTypeEnum,
        amount: z.number(),
        currency: z.string().min(1),
        description: z.string().nullable(),
        referenceId: z.string().nullable(),
        occurredAt: z.date(),
        withdrawal: WorkerEarningsWithdrawalDetailSchema.optional(),
    })
    .meta({
        title: "收益记录项",
        description: "统一的收益/提现记录响应结构",
    });

export type WorkerEarningsRecordItem = z.infer<
    typeof WorkerEarningsRecordItemSchema
>;

export const WorkerEarningsRecordQuerySchema = z
    .object({
        page: z.coerce.number().min(1).optional(),
        limit: z.coerce.number().min(1).max(100).optional(),
        category: WorkerEarningsRecordCategoryEnum.optional(),
        withdrawalStatus: WithdrawalStatusEnum.optional(),
    })
    .meta({
        title: "收益记录查询参数",
        description:
            "category 控制查询收入、提现或聚合列表，withdrawalStatus 仅在 category 为 withdrawal 时生效",
    });

export type WorkerEarningsRecordQuery = z.infer<
    typeof WorkerEarningsRecordQuerySchema
>;

export const WorkerEarningsRecordListResponseSchema = z
    .object({
        items: z.array(WorkerEarningsRecordItemSchema),
        meta: PaginationMetaSchema,
    })
    .meta({
        title: "收益记录分页响应",
        description: "聚合收益与提现记录的分页响应结构",
    });

export type WorkerEarningsRecordListResponse = z.infer<
    typeof WorkerEarningsRecordListResponseSchema
>;

export const QueryPaymentStatusResponseSchema = z.object({
    orderId: z.string(),
    orderSerial: z.string(),
    payType: paymentAppChannelSchema,
    paymentStatus: PaymentStatusEnum,
    channelStatus: z.string(),
    amount: z.string().optional(),
    transactionId: z.string().optional(),
    message: z.string(),
});

export type QueryPaymentStatusResponse = z.infer<
    typeof QueryPaymentStatusResponseSchema
>;

// ==================== 支付宝退款相关 Schema ====================

/**
 * 退分账账户类型枚举
 */
export const refundRoyaltyTransAccountTypeSchema = z
    .enum(["userId", "loginName", "cardAliasNo"])
    .meta({
        title: "退分账账户类型",
        description: "支付宝退分账时的账户标识类型",
        examples: ["userId"],
    });
export type RefundRoyaltyTransAccountType = z.infer<
    typeof refundRoyaltyTransAccountTypeSchema
>;

/**
 * 退分账类型枚举
 */
export const refundRoyaltyTypeSchema = z.enum(["transfer", "replenish"]).meta({
    title: "退分账类型",
    description: "transfer: 分账, replenish: 营销补差",
    examples: ["transfer"],
});
export type RefundRoyaltyType = z.infer<typeof refundRoyaltyTypeSchema>;

/**
 * 退款查询选项枚举
 */
export const refundQueryOptionSchema = z
    .enum([
        "refund_detail_item_list",
        "deposit_back_info",
        "refund_voucher_detail_list",
    ])
    .meta({
        title: "退款查询选项",
        description: "商户可选的额外返回信息字段",
        examples: ["refund_detail_item_list"],
    });
export type RefundQueryOption = z.infer<typeof refundQueryOptionSchema>;

/**
 * 退款商品明细
 */
export const refundGoodsDetailSchema = z
    .object({
        goods_id: createBoundedString(32, "goods_id"),
        refund_amount: payAmountTextSchema,
        out_certificate_no_list: z
            .array(z.string().max(128, "证书编号长度不能超过128"))
            .optional()
            .meta({
                title: "外部凭证编号列表",
                description: "外部商品凭证编号列表",
            }),
        out_item_id: createOptionalBoundedString(64, "out_item_id"),
        out_sku_id: createOptionalBoundedString(64, "out_sku_id"),
    })
    .meta({
        title: "退款商品明细",
        description: "退款包含的商品列表信息",
        examples: [
            {
                goods_id: "apple-01",
                refund_amount: "19.50",
                out_certificate_no_list: ["202407013232143241231243243423"],
                out_item_id: "outItem_01",
                out_sku_id: "outSku_01",
            },
        ],
    });
export type RefundGoodsDetail = z.infer<typeof refundGoodsDetailSchema>;

/**
 * 退分账明细信息
 */
export const refundRoyaltyParameterSchema = z
    .object({
        royalty_type: refundRoyaltyTypeSchema.optional(),
        trans_out: createOptionalBoundedString(16, "trans_out"),
        trans_out_type: refundRoyaltyTransAccountTypeSchema
            .refine(
                (value) => value === "userId" || value === "loginName",
                "支出方账户类型仅支持 userId 或 loginName",
            )
            .optional(),
        trans_in_type: refundRoyaltyTransAccountTypeSchema.optional(),
        trans_in: createOptionalBoundedString(16, "trans_in"),
        amount: payAmountTextSchema.optional(),
        desc: createOptionalBoundedString(1000, "desc"),
        royalty_scene: createOptionalBoundedString(256, "royalty_scene"),
        trans_in_name: createOptionalBoundedString(64, "trans_in_name"),
    })
    .meta({
        title: "退分账明细信息",
        description: "直付通模式等场景下需要明确的退分账信息",
        examples: [
            {
                royalty_type: "transfer",
                trans_out: "2088101126765726",
                trans_out_type: "userId",
                trans_in_type: "userId",
                trans_in: "2088101126708402",
                amount: "0.1",
                desc: "分账给2088101126708402",
                royalty_scene: "达人佣金",
                trans_in_name: "张三",
            },
        ],
    });
export type RefundRoyaltyParameter = z.infer<
    typeof refundRoyaltyParameterSchema
>;

/**
 * 支付宝退款请求 Schema
 */
export const alipayRefundRequestSchema = z
    .object({
        refund_amount: payAmountTextSchema,
        out_trade_no: createOptionalBoundedString(64, "out_trade_no"),
        trade_no: createOptionalBoundedString(64, "trade_no"),
        refund_reason: createOptionalBoundedString(256, "refund_reason"),
        out_request_no: createOptionalBoundedString(64, "out_request_no"),
        refund_goods_detail: z.array(refundGoodsDetailSchema).optional(),
        refund_royalty_parameters: z
            .array(refundRoyaltyParameterSchema)
            .optional(),
        query_options: z
            .union([
                z.string().max(1024, "query_options长度不能超过1024"),
                z
                    .array(refundQueryOptionSchema)
                    .min(1, "query_options至少包含一项"),
            ])
            .optional(),
        related_settle_confirm_no: createOptionalBoundedString(
            64,
            "related_settle_confirm_no",
        ),
    })
    .superRefine((value, ctx) => {
        // 校验 out_trade_no 和 trade_no 至少有一个
        if (!value.out_trade_no && !value.trade_no) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["out_trade_no"],
                message: "out_trade_no 和 trade_no 至少需要传入一个",
            });
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["trade_no"],
                message: "out_trade_no 和 trade_no 至少需要传入一个",
            });
        }
    })
    .meta({
        title: "支付宝退款请求",
        description: "用于发起支付宝退款的请求参数",
        examples: [
            {
                refund_amount: "200.12",
                out_trade_no: "20150320010101001",
                refund_reason: "正常退款",
                out_request_no: "HZ01RF001",
                refund_goods_detail: [
                    {
                        goods_id: "apple-01",
                        refund_amount: "19.50",
                    },
                ],
                query_options: ["refund_detail_item_list"],
            },
        ],
    });
export type AlipayRefundRequest = z.infer<typeof alipayRefundRequestSchema>;

/**
 * 支付宝退款错误码枚举
 */
export const alipayRefundErrorCodeSchema = z
    .enum([
        "ACQ.ALLOC_AMOUNT_VALIDATE_ERROR",
        "ACQ.BUYER_ENABLE_STATUS_FORBID",
        "ACQ.BUYER_ERROR",
        "ACQ.BUYER_NOT_EXIST",
        "ACQ.CURRENCY_NOT_SUPPORT",
        "ACQ.CUSTOMER_VALIDATE_ERROR",
        "ACQ.DISCORDANT_REPEAT_REQUEST",
        "ACQ.ENTERPRISE_PAY_BIZ_ERROR",
        "ACQ.INVALID_PARAMETER",
        "ACQ.NOT_ALLOW_PARTIAL_REFUND",
        "ACQ.ONLINE_TRADE_VOUCHER_NOT_ALLOW_REFUND",
        "ACQ.OVERDRAFT_AGREEMENT_NOT_MATCH",
        "ACQ.OVERDRAFT_ASSIGN_ACCOUNT_INVALID",
        "ACQ.REASON_TRADE_BEEN_FREEZEN",
        "ACQ.REASON_TRADE_REFUND_FEE_ERR",
        "ACQ.REASON_TRADE_STATUS_INVALID",
        "ACQ.REFUNDALLOC_UNAUTH_LIMIT",
        "ACQ.REFUND_ACCOUNT_NOT_EXIST",
        "ACQ.REFUND_AMT_NOT_EQUAL_TOTAL",
        "ACQ.REFUND_CHARGE_ERROR",
        "ACQ.REFUND_FEE_ERROR",
        "ACQ.REFUND_ROYALTY_PAYEE_ACCOUNT_NOT_EXIST",
        "ACQ.SELLER_BALANCE_NOT_ENOUGH",
        "ACQ.SYSTEM_ERROR",
        "ACQ.TRADE_HAS_CLOSE",
        "ACQ.TRADE_HAS_FINISHED",
        "ACQ.TRADE_NOT_ALLOW_REFUND",
        "ACQ.TRADE_NOT_EXIST",
        "ACQ.TRADE_SETTLE_ERROR",
        "ACQ.TRADE_STATUS_ERROR",
        "ACQ.USER_NOT_MATCH_ERR",
    ])
    .meta({
        title: "支付宝退款错误码",
        description: `支付宝退款业务错误码
ACQ.ALLOC_AMOUNT_VALIDATE_ERROR: 退分账金额超限
ACQ.BUYER_ENABLE_STATUS_FORBID: 买家状态异常
ACQ.BUYER_ERROR: 买家状态异常
ACQ.BUYER_NOT_EXIST: 买家不存在
ACQ.CURRENCY_NOT_SUPPORT: 退款币种不支持
ACQ.CUSTOMER_VALIDATE_ERROR: 账户已注销或者被冻结
ACQ.DISCORDANT_REPEAT_REQUEST: 请求信息不一致
ACQ.ENTERPRISE_PAY_BIZ_ERROR: 因公付业务异常
ACQ.INVALID_PARAMETER: 参数无效
ACQ.NOT_ALLOW_PARTIAL_REFUND: 不支持部分退款
ACQ.ONLINE_TRADE_VOUCHER_NOT_ALLOW_REFUND: 交易不允许退款
ACQ.OVERDRAFT_AGREEMENT_NOT_MATCH: 垫资退款接口传入模式和签约配置不一致
ACQ.OVERDRAFT_ASSIGN_ACCOUNT_INVALID: 垫资退款出资账号和商户信息不一致
ACQ.REASON_TRADE_BEEN_FREEZEN: 请求退款的交易被冻结
ACQ.REASON_TRADE_REFUND_FEE_ERR: 退款金额无效
ACQ.REASON_TRADE_STATUS_INVALID: 交易状态异常
ACQ.REFUNDALLOC_UNAUTH_LIMIT: 分账接收方未开启分账回退
ACQ.REFUND_ACCOUNT_NOT_EXIST: 退款出资账号不存在或账号异常
ACQ.REFUND_AMT_NOT_EQUAL_TOTAL: 退款金额超限
ACQ.REFUND_CHARGE_ERROR: 退收费异常
ACQ.REFUND_FEE_ERROR: 交易退款金额有误
ACQ.REFUND_ROYALTY_PAYEE_ACCOUNT_NOT_EXIST: 退分账收入方账户不存在
ACQ.SELLER_BALANCE_NOT_ENOUGH: 卖家余额不足
ACQ.SYSTEM_ERROR: 系统错误
ACQ.TRADE_HAS_CLOSE: 交易已关闭
ACQ.TRADE_HAS_FINISHED: 交易已完结
ACQ.TRADE_NOT_ALLOW_REFUND: 当前交易不允许退款
ACQ.TRADE_NOT_EXIST: 交易不存在
ACQ.TRADE_SETTLE_ERROR: 交易结算异常
ACQ.TRADE_STATUS_ERROR: 交易状态非法
ACQ.USER_NOT_MATCH_ERR: 交易用户不匹配`,
        examples: ["ACQ.TRADE_NOT_EXIST"],
    });
export type AlipayRefundErrorCode = z.infer<typeof alipayRefundErrorCodeSchema>;

// ==================== 支付宝退款响应相关 Schema ====================

/**
 * 退款券类型枚举
 */
export const refundVoucherTypeSchema = z
    .enum([
        "ALIPAY_FIX_VOUCHER",
        "ALIPAY_DISCOUNT_VOUCHER",
        "ALIPAY_ITEM_VOUCHER",
        "ALIPAY_CASH_VOUCHER",
        "ALIPAY_BIZ_VOUCHER",
    ])
    .meta({
        title: "退款券类型",
        description: "券类型枚举，不排除将来新增其他类型的可能",
        examples: ["ALIPAY_FIX_VOUCHER"],
    });
export type RefundVoucherType = z.infer<typeof refundVoucherTypeSchema>;

/**
 * 退款资金类型枚举
 */
export const refundFundTypeSchema = z
    .enum(["DEBIT_CARD", "CREDIT_CARD", "MIXED_CARD"])
    .meta({
        title: "退款资金类型",
        description: `渠道所使用的资金类型，仅在资金渠道是银行卡渠道时返回(借记卡: DEBIT_CARD
信用卡: CREDIT_CARD
借贷合一卡: MIXED_CARD)`,
        examples: ["DEBIT_CARD"],
    });
export type RefundFundType = z.infer<typeof refundFundTypeSchema>;

/**
 * 退款使用的资金渠道明细
 */
export const refundDetailItemSchema = z
    .object({
        fund_channel: fundChannelSchema.describe("交易使用的资金渠道"),
        amount: payAmountTextSchema.describe("本次退款使用的资金渠道金额"),
        real_amount: payAmountTextSchema.optional().describe("实际退款金额"),
        fund_type: refundFundTypeSchema
            .optional()
            .describe("渠道所使用的资金类型"),
    })
    .meta({
        title: "退款资金渠道明细",
        description:
            "本次退款使用的资金渠道，需要在签约中指定或在query_options中指定",
        examples: [
            {
                fund_channel: "ALIPAYACCOUNT",
                amount: "10.00",
                real_amount: "11.21",
                fund_type: "DEBIT_CARD",
            },
        ],
    });
export type RefundDetailItem = z.infer<typeof refundDetailItemSchema>;

/**
 * 退费信息 - 组合支付退费明细
 */
export const refundSubFeeSchema = z
    .object({
        refund_charge_fee: payAmountTextSchema.optional().describe("实退费用"),
        switch_fee_rate: createOptionalBoundedString(
            64,
            "switch_fee_rate",
        ).describe("签约费率"),
    })
    .meta({
        title: "组合支付退费明细",
        description: "组合支付的退费明细信息",
    });
export type RefundSubFee = z.infer<typeof refundSubFeeSchema>;

/**
 * 退费信息
 */
export const refundChargeInfoSchema = z
    .object({
        refund_charge_fee: payAmountTextSchema.optional().describe("实退费用"),
        switch_fee_rate: createOptionalBoundedString(
            64,
            "switch_fee_rate",
        ).describe("签约费率"),
        charge_type: createOptionalBoundedString(64, "charge_type").describe(
            "手续费类型(收单手续费trade，花呗分期手续hbfq，其他手续费charge)",
        ),
        refund_sub_fee_detail_list: z
            .array(refundSubFeeSchema)
            .optional()
            .describe("组合支付退费明细"),
    })
    .meta({
        title: "退费信息",
        description: "退款的手续费相关信息",
        examples: [
            {
                refund_charge_fee: "0.01",
                switch_fee_rate: "0.01",
                charge_type: "trade",
            },
        ],
    });
export type RefundChargeInfo = z.infer<typeof refundChargeInfoSchema>;

/**
 * 优惠券其他出资方明细（退款响应）
 */
export const refundVoucherContributeDetailSchema = z
    .object({
        contribute_type: z.enum(["PLATFORM", "BRAND", "MALL"]).meta({
            title: "出资方类型",
            description: `平台出资: PLATFORM
品牌商出资: BRAND
商圈出资 : MALL`,
            examples: ["PLATFORM"],
        }),
        contribute_amount: payAmountTextSchema,
    })
    .meta({
        title: "优惠券其他出资方明细",
        description: "券的其他出资方明细信息",
    });
export type RefundVoucherContributeDetail = z.infer<
    typeof refundVoucherContributeDetailSchema
>;

/**
 * 退款券明细
 */
export const refundVoucherDetailSchema = z
    .object({
        id: createBoundedString(32, "id"),
        name: createBoundedString(64, "name"),
        type: createBoundedString(32, "type"),
        amount: payAmountTextSchema,
        merchant_contribute: payAmountTextSchema.optional(),
        other_contribute: payAmountTextSchema.optional(),
        memo: createOptionalBoundedString(256, "memo"),
        template_id: createOptionalBoundedString(64, "template_id"),
        other_contribute_detail: z
            .array(refundVoucherContributeDetailSchema)
            .max(512, "other_contribute_detail最多512项")
            .optional(),
        purchase_buyer_contribute: payAmountTextSchema.optional(),
        purchase_merchant_contribute: payAmountTextSchema.optional(),
        purchase_ant_contribute: payAmountTextSchema.optional(),
    })
    .meta({
        title: "退款券明细",
        description:
            "本交易支付时使用的所有优惠券信息，需在query_options中指定",
        examples: [
            {
                id: "2015102600073002039000002D5O",
                name: "XX超市5折优惠",
                type: "ALIPAY_FIX_VOUCHER",
                amount: "10.00",
                merchant_contribute: "9.00",
                other_contribute: "1.00",
                memo: "学生专用优惠",
                template_id: "20171030000730015359000EMZP0",
                purchase_buyer_contribute: "2.01",
                purchase_merchant_contribute: "1.03",
                purchase_ant_contribute: "0.82",
            },
        ],
    });
export type RefundVoucherDetail = z.infer<typeof refundVoucherDetailSchema>;

/**
 * 支付宝退款响应
 */
export const alipayRefundResponseSchema = z
    .object({
        trade_no: createBoundedString(64, "trade_no"),
        out_trade_no: createBoundedString(64, "out_trade_no"),
        buyer_logon_id: createBoundedString(100, "buyer_logon_id"),
        refund_fee: payAmountTextSchema,
        refund_detail_item_list: z.array(refundDetailItemSchema).optional(),
        store_name: createOptionalBoundedString(512, "store_name"),
        buyer_user_id: createOptionalBoundedString(28, "buyer_user_id"),
        buyer_open_id: createOptionalBoundedString(128, "buyer_open_id"),
        send_back_fee: createOptionalBoundedString(11, "send_back_fee"),
        pre_auth_cancel_fee: createOptionalBoundedString(
            12,
            "pre_auth_cancel_fee",
        ),
        fund_change: z.enum(["Y", "N"]).optional(),
        refund_hyb_amount: createOptionalBoundedString(11, "refund_hyb_amount"),
        refund_charge_info_list: z.array(refundChargeInfoSchema).optional(),
        refund_voucher_detail_list: z
            .array(refundVoucherDetailSchema)
            .optional(),
    })
    .meta({
        title: "支付宝退款响应",
        description: "支付宝退款接口的业务响应参数",
        examples: [
            {
                trade_no: "2013112011001004330000121536",
                out_trade_no: "6823789339978248",
                buyer_logon_id: "159****5620",
                refund_fee: "88.88",
                fund_change: "Y",
                buyer_user_id: "2088101117955611",
                buyer_open_id:
                    "074a1CcTG1LelxKe4xQC0zgNdId0nxi95b5lsNpazWYoCo5",
                send_back_fee: "1.8",
            },
        ],
    });
export type AlipayRefundResponse = z.infer<typeof alipayRefundResponseSchema>;
