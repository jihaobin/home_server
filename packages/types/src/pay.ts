import { z } from "zod/v4";

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
