import {
	Body,
	Controller,
	HttpCode,
	HttpStatus,
	Param,
	Post,
	Req,
	UsePipes,
} from "@nestjs/common";
import { ApiOperation, ApiTags } from "@nestjs/swagger";
import {
	PaymentMethodEnum,
	type PayNotification,
	payNotificationSchema,
} from "@repo/types";
import type { Request } from "express";
import { ApiSuccessResponse } from "src/common/decorator";
import { ApiBodies } from "src/common/decorator/swagger-api-bodies";
import { SkipTransform } from "src/common/interceptors";
import { createMultiZodPipe, createZodPipe } from "src/common/pipes";
import { z } from "zod/v4";
import { Public } from "../auth/decorators";
import { PayService } from "./pay.service";

type PaymentMethod = z.infer<typeof PaymentMethodEnum>;

const initiatePaymentParamsSchema = z
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
	});

const initiatePaymentBodySchema = z
	.object({
		payType: PaymentMethodEnum.refine(
			(value: PaymentMethod) => value === "alipay",
			"当前仅支持支付宝支付",
		).meta({
			title: "支付方式",
			description: "当前仅支持 alipay",
			examples: ["alipay"],
		}),
		displayAmount: z.coerce
			.number("displayAmount 需为数字")
			.positive("显示金额必须大于 0")
			.meta({
				title: "显示金额",
				description: "客户端展示的支付金额，用于发起前的二次校验",
				examples: [199.99],
			}),
	})
	.meta({
		title: "发起支付请求体",
	});

type InitiatePaymentBody = z.infer<typeof initiatePaymentBodySchema>;

const initiatePaymentResponseSchema = z
	.object({
		paymentId: z.string().min(1).meta({
			title: "支付记录ID",
			description: "用于后续查询或对账的支付记录主键",
		}),
		orderString: z.string().min(1).meta({
			title: "支付宝订单串",
			description: "客户端直接唤起支付宝所需的签名串",
		}),
		payType: PaymentMethodEnum.meta({ title: "支付方式" }),
		outTradeNo: z
			.string()
			.min(1)
			.meta({ title: "外部订单号", description: "订单流水号/商户订单号" }),
		amount: z.number().positive().meta({
			title: "支付金额",
			description: "本次支付的订单金额（单位：元）",
		}),
		currency: z
			.string()
			.min(1)
			.meta({ title: "币种", description: "货币单位，默认 CNY" }),
	})
	.meta({ title: "发起支付响应" });

const alipayNotifyResponseSchema = z.enum(["success", "fail"]).meta({
	title: "支付宝回调响应",
	description: "支付宝要求返回 success 或 fail",
});

@ApiTags("支付")
@Controller("pay")
export class PayController {
	constructor(private readonly payService: PayService) {}

	@Post("orders/:orderId")
	@HttpCode(HttpStatus.OK)
	@UsePipes(
		createMultiZodPipe({
			params: initiatePaymentParamsSchema,
			body: initiatePaymentBodySchema,
			errorMessage: "发起支付参数校验失败",
		}),
	)
	@ApiOperation({
		summary: "发起订单支付",
		description: "校验订单状态与金额后，生成支付宝支付串返回给客户端",
	})
	@ApiBodies(initiatePaymentBodySchema)
	@ApiSuccessResponse(initiatePaymentResponseSchema, {
		description: "返回支付记录信息及用于客户端唤起支付宝的订单串",
	})
	async initiatePayment(
		@Param("orderId") orderId: string,
		@Body() body: InitiatePaymentBody,
		@Req() req: Request,
	) {
		return this.payService.pay({
			orderId,
			userId: req.user.id,
			payType: body.payType,
			displayAmount: body.displayAmount,
		});
	}

	@Public()
    @SkipTransform()
    @Post("alipay/notify")
    @HttpCode(HttpStatus.OK)
    @UsePipes(createZodPipe(payNotificationSchema, "支付宝异步通知参数校验失败"))
    @ApiOperation({
        summary: "支付宝异步通知回调(不要在应用中进行调用)",
        description: "消费支付宝服务器推送的异步通知，并同步更新支付状态",
    })
    @ApiSuccessResponse(alipayNotifyResponseSchema, {
        description: "处理完成后需返回 success 或 fail 给支付宝",
    })
    async handleAlipayNotify(@Body() payload: PayNotification) {
        return this.payService.payNotify(payload);
    }
}
