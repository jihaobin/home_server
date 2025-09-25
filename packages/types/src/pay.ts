import { z } from "zod/v4";
import { PaymentMethodEnum, WithdrawalStatusEnum } from "./database-entity";

const PAY_DATETIME_SECONDS_PATTERN = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/;
const PAY_DATETIME_MILLIS_PATTERN =
	/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d{1,3})?$/;
const PAY_AMOUNT_PATTERN = /^\d+(?:\.\d{1,2})?$/;

const createBoundedString = (max: number, label: string) =>
	z.string().min(1, `${label}不能为空`).max(max, `${label}长度不能超过${max}`);

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
		fundChannel: z.string().min(1, "fundChannel不能为空"),
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
		description: "voucher_detail_list.otherContributeDetail 内的出资方记录。",
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
		otherContributeDetail: z.array(payVoucherContributeDetailSchema).optional(),
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
		z.array(payVoucherDetailSchema).min(1, "voucher_detail_list至少包含一项"),
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

export const payGoodsDetailListSchema = z.array(payGoodsDetailSchema).min(1, "goods_detail 至少包含一项商品").meta({
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
				passback_params: "merchantBizType%3d3C%26merchantBizNo%3d2016010101111",
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

export const alipayWithdrawBizSceneSchema = z.enum(ALIPAY_WITHDRAW_BIZ_SCENES).meta({
	title: "转账场景枚举",
	description: "biz_scene 字段的可选值列表，文档默认示例为 DIRECT_TRANSFER。",
	examples: ["DIRECT_TRANSFER"],
});
export type AlipayWithdrawBizScene = z.infer<typeof alipayWithdrawBizSceneSchema>;

export const alipayWithdrawProductCodeSchema = z.literal("TRANS_ACCOUNT_NO_PWD").meta({
	title: "产品码",
	description: "product_code 固定为 TRANS_ACCOUNT_NO_PWD。",
	examples: ["TRANS_ACCOUNT_NO_PWD"],
});
export type AlipayWithdrawProductCode = z.infer<typeof alipayWithdrawProductCodeSchema>;

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
		description: "对应 alipay_withdraw.txt 中的 payee_info 结构，包含标识与姓名。",
		examples: [
			{
				identity: "2088123412341234",
				identity_type: "ALIPAY_USER_ID",
				name: "黄龙国际有限公司",
			},
		],
	});

export const alipayWithdrawPayeeSchema = alipayWithdrawPayeeSchemaBase.superRefine(
	(value, ctx) => {
		if (value.identity_type === "ALIPAY_LOGON_ID" && !value.name) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				path: ["name"],
				message: "identity_type 为 ALIPAY_LOGON_ID 时，name 为必填项",
			});
		}
	},
);
export type AlipayWithdrawPayee = z.infer<typeof alipayWithdrawPayeeSchema>;

const alipayWithdrawAmountSchema = payAmountTextSchema
	.refine((value) => {
		const numeric = Number(value);
		return Number.isFinite(numeric) && numeric >= 0.1 && numeric <= 100000000;
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
				business_params: {"payer_show_name_use_alias":"true"},
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
		sub_code: alipayWithdrawErrorCodeSchema.optional(),
		sub_msg: z.string().min(1).max(512, "sub_msg 最大长度 512").optional(),
		trace_id: createOptionalBoundedString(64, "trace_id"),
		traceId: createOptionalBoundedString(64, "traceId"),
	})
	.meta({
		title: "转账接口基础响应",
		description: "所有转账响应均包含的标准字段。",
	});

export const alipayWithdrawSuccessResponseSchema = alipayWithdrawBaseResponseSchema
	.extend({
		out_biz_no: createBoundedString(64, "out_biz_no"),
		order_id: createBoundedString(32, "order_id"),
		pay_fund_order_id: createBoundedString(32, "pay_fund_order_id"),
		trans_date: payDateTimeSecondsSchema,
		status: alipayWithdrawStatusSchema.optional(),
	})
	.meta({
		title: "转账成功响应",
		description: "业务处理成功时返回的核心字段。",
		examples: [
			{
				code: "10000",
				msg: "Success",
				out_biz_no: "201806300001",
				order_id: "20190801110070000006380000250621",
				pay_fund_order_id: "20190801110070001506380000251556",
				trans_date: "2019-08-21 00:00:00",
				status: "SUCCESS",
			},
		],
	});
export type AlipayWithdrawSuccessResponse = z.infer<
	typeof alipayWithdrawSuccessResponseSchema
>;

export const alipayWithdrawErrorResponseSchema = alipayWithdrawBaseResponseSchema
	.extend({
		sub_code: alipayWithdrawErrorCodeSchema,
	})
	.meta({
		title: "转账失败响应",
		description: "业务失败时将包含 sub_code 及 sub_msg 等信息。",
		examples: [
			{
				code: "20000",
				msg: "Service Currently Unavailable",
				sub_code: "SYSTEM_ERROR",
				sub_msg: "系统繁忙",
			},
		],
	});
export type AlipayWithdrawErrorResponse = z.infer<
	typeof alipayWithdrawErrorResponseSchema
>;

export const alipayWithdrawResponseSchema = z
	.union([alipayWithdrawSuccessResponseSchema, alipayWithdrawErrorResponseSchema])
	.meta({
		title: "转账接口响应",
		description: "根据 code 可判断业务是否成功。",
	});
export type AlipayWithdrawResponse = z.infer<
	typeof alipayWithdrawResponseSchema
>;

export const InitiatePaymentParamsSchema = z
	.object({
		orderId: z
			.string()
			.min(1, "订单ID不能为空")
			.max(255, "订单ID长度不能超过255")
			.meta({
				title: "订单ID",
				description: "待发起支付的订单ID",
			}),
	})
	.meta({
		title: "支付路径参数",
		description: "发起订单支付接口的路径参数",
	});

export type InitiatePaymentParams = z.infer<typeof InitiatePaymentParamsSchema>;

export const InitiatePaymentBodySchema = z
	.object({
		payType: PaymentMethodEnum.refine(
			(value) => value === "alipay",
			"当前仅支持支付宝支付",
		).meta({
			title: "支付方式",
			description: "当前仅支持 alipay",
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

export const InitiatePaymentResponseSchema = z
	.object({
		paymentId: z.string().min(1).meta({
			title: "支付记录ID",
			description: "用于后续查询或调试的支付记录标识",
		}),
		orderString: z.string().min(1).meta({
			title: "支付订单串",
			description: "客户端直接用于发起支付的订单字符串签名",
		}),
		payType: PaymentMethodEnum.meta({ title: "支付方式" }),
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
	})
	.meta({ title: "发起支付响应" });

export type InitiatePaymentResponse = z.infer<typeof InitiatePaymentResponseSchema>;

export const AlipayNotifyResponseSchema = z.enum(["success", "fail"]).meta({
	title: "支付宝回调响应",
	description: "支付宝要求返回 success 或 fail",
});

export type AlipayNotifyResponse = z.infer<typeof AlipayNotifyResponseSchema>;


const withdrawAmountNumberSchema = z
	.number( "提现金额必须为数字")
	.refine((value) => Number.isFinite(value), "提现金额格式有误")
	.refine((value) => value > 0, "提现金额必须大于 0")
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
		payType: PaymentMethodEnum.refine(
			(value) => value === "alipay",
			"当前仅支持支付宝提现",
		),
		payee: alipayWithdrawPayeeSchema,
		remark: alipayWithdrawRemarkSchema,
	})
	.meta({
		title: "用户提现请求体",
		description: "前端提交的提现金额与收款账户信息",
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
		balance: z
			.object({
				available: z.number().nonnegative(),
				frozen: z.number().nonnegative(),
				total: z.number().nonnegative(),
			})
			.meta({ title: "提现后余额快照" }),
		outBizNo: z.string().min(1, "业务单号不能为空").meta({
			title: "支付宝业务单号",
			description: "传给支付宝的 out_biz_no",
		}),
		alipayOrderId: z
			.string()
			.min(1)
			.optional()
			.meta({ title: "支付宝订单号" }),
	})
	.meta({ title: "用户提现响应" });

export type UserWithdrawResponse = z.infer<typeof UserWithdrawResponseSchema>;
