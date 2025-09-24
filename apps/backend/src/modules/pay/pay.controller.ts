import {
    Body,
    Controller,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Req,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AlipayNotifyResponseSchema,
    InitiatePaymentBodySchema,
    InitiatePaymentParamsSchema,
    InitiatePaymentResponseSchema,
    type InitiatePaymentBody,
    type PayNotification,
    payNotificationSchema,
} from '@repo/types';
import type { Request } from 'express';
import { ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { SkipTransform } from 'src/common/interceptors';
import { createMultiZodPipe, createZodPipe } from 'src/common/pipes';
import { Public } from '../auth/decorators';
import { PayService } from './pay.service';

@ApiTags('支付')
@Controller('pay')
export class PayController {
    constructor(private readonly payService: PayService) {}

    @Post('orders/:orderId')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        createMultiZodPipe({
            params: InitiatePaymentParamsSchema,
            body: InitiatePaymentBodySchema,
            errorMessage: '发起支付参数校验失败',
        }),
    )
    @ApiOperation({
        summary: '发起订单支付',
        description: '校验订单状态与金额后，生成支付宝支付串返回给客户端',
    })
    @ApiBodies(InitiatePaymentBodySchema)
    @ApiSuccessResponse(InitiatePaymentResponseSchema, {
        description: '返回支付记录信息及用于客户端唤起支付宝的订单串',
    })
    async initiatePayment(
        @Param('orderId') orderId: string,
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
    @Post('alipay/notify')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        createZodPipe(payNotificationSchema, '支付宝异步通知参数校验失败'),
    )
    @ApiOperation({
        summary: '支付宝异步通知回调(不要在应用中进行调用)',
        description: '消费支付宝服务器推送的异步通知，并同步更新支付状态',
    })
    @ApiSuccessResponse(AlipayNotifyResponseSchema, {
        description: '处理完成后需返回 success 或 fail 给支付宝',
    })
    async handleAlipayNotify(@Body() payload: PayNotification) {
        return this.payService.payNotify(payload);
    }
}



