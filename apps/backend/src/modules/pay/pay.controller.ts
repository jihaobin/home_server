import {
    Body,
    Controller,
    Delete,
    Get,
    HttpCode,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import {
    AlipayNotifyResponseSchema,
    type InitiatePaymentBody,
    InitiatePaymentBodySchema,
    InitiatePaymentParamsSchema,
    InitiatePaymentResponseSchema,
    type PayNotification,
    payNotificationSchema,
    QueryPaymentStatusResponseSchema,
    type UserWithdrawBody,
    UserWithdrawBodySchema,
    UserWithdrawResponseSchema,
    WorkerEarningsRecordListResponseSchema,
    WorkerEarningsRecordQuerySchema,
    type WorkerEarningsRecordQuery,
    EarningsOverviewResponseSchema,
    WorkerAlipayAuthorizeParamsResponseSchema,
    WorkerAlipayAuthExchangeBodySchema,
    WorkerAlipayAuthExchangeResponseSchema,
    WorkerAlipayBindingStatusSchema,
    WorkerAlipayUnbindResponseSchema,
} from '@repo/types';
import type { Request } from 'express';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { SkipTransform } from 'src/common/interceptors';
import { createMultiZodPipe, createZodPipe } from 'src/common/pipes';
import { Public, Roles } from '../auth/decorators';
import { PayService } from './pay.service';
import { AuthGuard } from '../auth/auth.guard';
import { Cron } from '@nestjs/schedule';
import { createAliPaySdk } from 'src/lib/alipaySdk';
import z from 'zod/v4';

@ApiTags('支付')
@Controller('pay')
export class PayController {
    constructor(private readonly payService: PayService) {}

    private alipaySdk = createAliPaySdk();

    @UseGuards(AuthGuard)
    @Post('orders/:orderId')
    @ApiErrorResponses()
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

    @ApiOperation({
        summary: '用户提现',
        description: '校验余额并冻结提现金额，等待管理员审核后才会实际打款',
    })
    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post('withdraw')
    @UsePipes(createZodPipe(UserWithdrawBodySchema, '用户提现参数校验失败'))
    @ApiBodies(UserWithdrawBodySchema)
    @ApiSuccessResponse(UserWithdrawResponseSchema, {
        description: '返回提现记录及冻结后余额快照',
    })
    async withdraw(@Body() body: UserWithdrawBody, @Req() req: Request) {
        return this.payService.withdraw(req.user.id, body);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('earnings/overview')
    @ApiOperation({
        summary: '获取收益概览',
        description: '返回余额、本月收益与累计收益，用于收益页面展示',
    })
    @ApiSuccessResponse(EarningsOverviewResponseSchema, {
        description: '收益概览数据',
    })
    async getEarningsOverview(@Req() req: Request) {
        return this.payService.getEarningsOverview(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('earnings/records')
    @UsePipes(
        createZodPipe(
            WorkerEarningsRecordQuerySchema,
            '收益记录查询参数校验失败',
        ),
    )
    @ApiOperation({
        summary: '查询收益/提现记录',
        description: '通过 category 参数，查询收入记录、提现记录或混合列表',
    })
    @ApiSuccessResponse(WorkerEarningsRecordListResponseSchema, {
        description: '收益/提现聚合记录分页数据',
    })
    async getWorkerEarningsRecords(
        @Req() req: Request,
        @Query() query: WorkerEarningsRecordQuery,
    ) {
        return this.payService.getWorkerEarningsRecords(req.user.id, query);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('worker/alipay/authorize-params')
    @ApiOperation({
        summary: '获取服务人员端支付宝授权参数串',
        description:
            '服务端按 APP 授权文档（https://opendocs.alipay.com/open/218/105327）拼接 `alipay.open.auth.sdk.code.get` 所需参数串，客户端直接透传给支付宝 SDK 拉起授权。',
    })
    @ApiSuccessResponse(WorkerAlipayAuthorizeParamsResponseSchema, {
        description: '返回 APP 端唤起支付宝授权页所需的参数串及元信息',
    })
    async getWorkerAlipayAuthorizeParams(@Req() req: Request) {
        return this.payService.generateWorkerAlipayAuthorizeParams(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post('worker/alipay/auth/exchange')
    @UsePipes(
        createZodPipe(
            WorkerAlipayAuthExchangeBodySchema,
            '支付宝授权数据校验失败',
        ),
    )
    @ApiOperation({
        summary: '换取并保存支付宝用户标识',
        description:
            '客户端完成授权后上传 auth_code，服务端通过 alipay.system.oauth.token 换取 user_id/open_id 并落库',
    })
    @ApiBodies(WorkerAlipayAuthExchangeBodySchema)
    @ApiSuccessResponse(WorkerAlipayAuthExchangeResponseSchema, {
        description: '返回绑定结果与支付宝账号标识',
    })
    async exchangeWorkerAlipayAuthCode(
        @Body() body: z.infer<typeof WorkerAlipayAuthExchangeBodySchema>,
        @Req() req: Request,
    ) {
        return this.payService.exchangeWorkerAlipayAuthCode(req.user.id, body);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('worker/alipay/binding')
    @ApiOperation({
        summary: '查询服务人员支付宝绑定状态',
        description: '返回当前绑定的支付宝 userId/openId',
    })
    @ApiSuccessResponse(WorkerAlipayBindingStatusSchema, {
        description: '绑定状态',
    })
    async getWorkerAlipayBinding(@Req() req: Request) {
        return this.payService.getWorkerAlipayBindingStatus(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Delete('worker/alipay/binding')
    @ApiOperation({
        summary: '解绑服务人员支付宝账号',
        description: '清空用户资料中的支付宝 userId/openId',
    })
    @ApiSuccessResponse(WorkerAlipayUnbindResponseSchema, {
        description: '解绑结果',
    })
    async unbindWorkerAlipay(@Req() req: Request) {
        return this.payService.unbindWorkerAlipay(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Get('orders/:orderId/payment-status')
    @UsePipes(
        createMultiZodPipe({
            params: z.string(),
            errorMessage: '支付状态查询参数校验失败',
        }),
    )
    @ApiSuccessResponse(QueryPaymentStatusResponseSchema, {
        description: '返回订单支付状态',
    })
    @ApiOperation({
        summary: '查询订单支付状态',
        description:
            '主动查询支付宝订单的支付状态,用于客户端收到不确定状态码时确认支付结果',
    })
    async queryPaymentStatus(
        @Param('orderId') orderId: string,
        @Req() req: Request,
    ) {
        return this.payService.queryPaymentStatus(orderId, req.user.id);
    }

    // 每5分钟执行一次
    // 扫描并查询所有支付状态为 pending 的订单支付状态
    @Cron('0 */5 * * * *')
    async handleInterval() {
        await this.payService.scanAndQueryPendingPayments();
    }

    @Get('test-pay-config')
    async testPayConfig() {
        const result = await this.alipaySdk.curl(
            'POST',
            '/v3/alipay/user/deloauth/detail/query',
            {
                body: {
                    date: '20230102',
                    offset: 20,
                    limit: 1,
                },
            },
        );

        console.log(result);
        return result;
    }
}
