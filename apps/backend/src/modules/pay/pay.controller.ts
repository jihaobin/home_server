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
    Res,
    UseGuards,
    UsePipes,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import {
    type InitiatePaymentBody,
    InitiatePaymentBodySchema,
    InitiatePaymentParamsSchema,
    InitiatePaymentResponseSchema,
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
    WorkerWechatAuthExchangeResponseSchema,
    WorkerWechatBindingStatusSchema,
    WorkerWechatUnbindResponseSchema,
} from '@repo/types';
import type { Request, Response } from 'express';
import { ApiErrorResponses, ApiSuccessResponse } from 'src/common/decorator';
import { ApiBodies } from 'src/common/decorator/swagger-api-bodies';
import { SkipTransform } from 'src/common/interceptors';
import { createMultiZodPipe, createZodPipe } from 'src/common/pipes';
import type { RequestWithRawBody } from '../auth/middlewares';
import { Public, Roles } from '../auth/decorators';
import { PayService } from './pay.service';
import { AuthGuard } from '../auth/auth.guard';
import { Cron } from '@nestjs/schedule';
import { createAliPaySdk } from 'src/lib/alipaySdk';
import z from 'zod/v4';
import { serializeParsedNotifyBody } from './pay-notify.utils';

const paymentNotifyChannelSchema = z.enum(['alipay', 'wechat_pay']);

const workerWechatAuthExchangeBodySchema = z.object({
    authCode: z.string().min(1).max(128),
    appId: z.string().optional(),
    scope: z.string().optional(),
    state: z.string().optional(),
});

const workerWechatMerchantTransferResultBodySchema = z.object({
    result: z.enum(['success', 'fail', 'cancel']),
    businessType: z.string().optional(),
    extMsg: z.string().optional(),
    errorCode: z.number().int().optional(),
    errorMessage: z.string().optional(),
    transaction: z.string().optional(),
    receivedAt: z.string().optional(),
});

const workerWithdrawalPayoutStatusResponseSchema = z.object({
    withdrawalId: z.string().min(1),
    status: z.string().min(1),
    method: z.string().min(1),
    providerState: z.string().nullable(),
    providerAppId: z.string().nullable(),
    providerBillNo: z.string().nullable(),
    providerPackageInfo: z.string().nullable(),
    providerMeta: z.record(z.string(), z.unknown()).nullable().optional(),
    failureReason: z.string().nullable(),
    processedAt: z.string().nullable(),
});

@ApiTags('支付')
@Controller('pay')
export class PayController {
    constructor(private readonly payService: PayService) {}

    private alipaySdk = createAliPaySdk();

    private async readRawRequestBody(
        req: RequestWithRawBody,
        channel: 'alipay' | 'wechat_pay',
    ) {
        if (channel === 'wechat_pay' && typeof req.rawBody !== 'string') {
            throw new Error('微信回调缺少 rawBody，无法完成验签');
        }

        if (typeof req.rawBody === 'string') {
            return req.rawBody;
        }

        if (typeof req.body === 'string') {
            return req.body;
        }

        if (Buffer.isBuffer(req.body)) {
            return req.body.toString('utf8');
        }

        if (req.body && typeof req.body === 'object') {
            const serializedBody = serializeParsedNotifyBody(req.body, channel);

            if (serializedBody) {
                return serializedBody;
            }

            if (channel === 'wechat_pay') {
                throw new Error('微信支付回调缺少原始请求体，无法验签');
            }
        }
        const chunks: Buffer[] = [];
        for await (const chunk of req) {
            chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk);
        }

        return Buffer.concat(chunks).toString('utf8');
    }

    private async buildNotifyPayload(
        channel: 'alipay' | 'wechat_pay',
        req: RequestWithRawBody,
    ) {
        const rawBody = await this.readRawRequestBody(req, channel);

        if (channel === 'wechat_pay') {
            return {
                rawBody,
                headers: req.headers,
            };
        }

        return {
            rawBody,
            headers: req.headers,
            parsedBody: Object.fromEntries(
                new URLSearchParams(rawBody).entries(),
            ),
        };
    }

    private async handleWechatNotifyResponse(req: Request, res: Response) {
        const payload = await this.buildNotifyPayload('wechat_pay', req);
        const handled = await this.payService.handlePaymentNotify(
            'wechat_pay',
            payload,
        );

        if (handled) {
            return res.status(HttpStatus.NO_CONTENT).send();
        }

        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            code: 'FAIL',
            message: '处理失败',
        });
    }

    private async handleWechatRefundNotifyResponse(
        req: Request,
        res: Response,
    ) {
        const payload = await this.buildNotifyPayload('wechat_pay', req);
        const handled = await this.payService.handleWechatRefundNotify(payload);

        if (handled) {
            return res.status(HttpStatus.NO_CONTENT).send();
        }

        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            code: 'FAIL',
            message: '处理失败',
        });
    }

    private async handleWechatPayoutNotifyResponse(
        req: Request,
        res: Response,
    ) {
        const payload = await this.buildNotifyPayload('wechat_pay', req);
        const handled = await this.payService.handleWechatPayoutNotify(payload);

        if (handled) {
            return res.status(HttpStatus.NO_CONTENT).send();
        }

        return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
            code: 'FAIL',
            message: '处理失败',
        });
    }

    private async handleAlipayNotifyResponse(req: Request, res: Response) {
        const payload = await this.buildNotifyPayload('alipay', req);
        const handled = await this.payService.handlePaymentNotify(
            'alipay',
            payload,
        );

        return res.status(HttpStatus.OK).send(handled ? 'success' : 'fail');
    }

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
        description: '校验订单状态与金额后，按支付渠道生成客户端拉起参数',
    })
    @ApiBodies(InitiatePaymentBodySchema)
    @ApiSuccessResponse(InitiatePaymentResponseSchema, {
        description: '返回支付记录信息及客户端拉起支付所需参数',
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
    @Post('notify/:channel')
    @HttpCode(HttpStatus.OK)
    @UsePipes(
        createMultiZodPipe({
            params: paymentNotifyChannelSchema,
            errorMessage: '支付回调渠道参数校验失败',
        }),
    )
    @ApiOperation({
        summary: '统一支付异步通知回调(不要在应用中进行调用)',
        description:
            '按渠道消费支付平台异步通知。支付宝成功需返回 success，微信支付成功需返回 204 无响应体。',
    })
    @ApiResponse({
        status: HttpStatus.OK,
        description: '支付宝回调处理完成后返回 success 或 fail',
        schema: {
            type: 'string',
            enum: ['success', 'fail'],
            example: 'success',
        },
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '微信支付回调处理成功后返回 204，无响应体',
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '微信支付回调处理失败',
        schema: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    example: 'FAIL',
                },
                message: {
                    type: 'string',
                    example: '处理失败',
                },
            },
            required: ['code', 'message'],
        },
    })
    async handlePaymentNotify(
        @Param('channel') channel: z.infer<typeof paymentNotifyChannelSchema>,
        @Req() req: RequestWithRawBody,
        @Res({ passthrough: false }) res: Response,
    ) {
        console.log('回调接口被调用，渠道：', channel);
        switch (channel) {
            case 'alipay':
                return this.handleAlipayNotifyResponse(req, res);
            case 'wechat_pay':
                return this.handleWechatNotifyResponse(req, res);
        }
    }

    @Public()
    @SkipTransform()
    @Post('wechat/refund/notify')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: '微信退款异步通知回调(不要在应用中进行调用)',
        description: '消费微信退款结果通知，成功时返回 204 无响应体。',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '微信退款回调处理成功后返回 204，无响应体',
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '微信退款回调处理失败',
        schema: {
            type: 'object',
            properties: {
                code: {
                    type: 'string',
                    example: 'FAIL',
                },
                message: {
                    type: 'string',
                    example: '处理失败',
                },
            },
            required: ['code', 'message'],
        },
    })
    async handleWechatRefundNotify(
        @Req() req: RequestWithRawBody,
        @Res({ passthrough: false }) res: Response,
    ) {
        return this.handleWechatRefundNotifyResponse(req, res);
    }

    @Public()
    @SkipTransform()
    @Post('wechat/payout/notify')
    @HttpCode(HttpStatus.NO_CONTENT)
    @ApiOperation({
        summary: '微信提现商家转账异步通知回调(不要在应用中进行调用)',
        description: '消费微信商家转账结果通知，成功时返回 204 无响应体。',
    })
    @ApiResponse({
        status: HttpStatus.NO_CONTENT,
        description: '微信提现回调处理成功后返回 204，无响应体',
    })
    @ApiResponse({
        status: HttpStatus.INTERNAL_SERVER_ERROR,
        description: '微信提现回调处理失败',
        schema: {
            type: 'object',
            properties: {
                code: { type: 'string', example: 'FAIL' },
                message: { type: 'string', example: '处理失败' },
            },
            required: ['code', 'message'],
        },
    })
    async handleWechatPayoutNotify(
        @Req() req: RequestWithRawBody,
        @Res({ passthrough: false }) res: Response,
    ) {
        return this.handleWechatPayoutNotifyResponse(req, res);
    }

    @ApiOperation({
        summary: '用户提现',
        description:
            '校验余额并冻结提现金额，按渠道创建提现工单并等待管理员审核',
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
    @Roles(['service_personnel'])
    @Post('worker/wechat/auth/exchange')
    @UsePipes(
        createZodPipe(
            workerWechatAuthExchangeBodySchema,
            '微信授权数据校验失败',
        ),
    )
    @ApiOperation({
        summary: '换取并保存服务人员微信收款标识',
        description:
            '客户端完成微信授权后上传 auth_code，服务端通过微信开放平台接口换取 worker appid 对应的 openid/unionid 并落库',
    })
    @ApiBodies(workerWechatAuthExchangeBodySchema)
    @ApiSuccessResponse(WorkerWechatAuthExchangeResponseSchema, {
        description: '返回绑定结果与微信收款标识',
    })
    async exchangeWorkerWechatAuthCode(
        @Body() body: z.infer<typeof workerWechatAuthExchangeBodySchema>,
        @Req() req: Request,
    ) {
        return this.payService.exchangeWorkerWechatAuthCode(req.user.id, body);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Get('worker/wechat/binding')
    @ApiOperation({
        summary: '查询服务人员微信提现微信绑定状态',
        description: '返回当前绑定的 worker 端微信 openid/appid 信息',
    })
    @ApiSuccessResponse(WorkerWechatBindingStatusSchema, {
        description: '绑定状态',
    })
    async getWorkerWechatBinding(@Req() req: Request) {
        return this.payService.getWorkerWechatBindingStatus(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Delete('worker/wechat/binding')
    @ApiOperation({
        summary: '解绑服务人员微信提现微信账号',
        description: '清空用户资料中的 worker 微信 openid/unionid/appid',
    })
    @ApiSuccessResponse(WorkerWechatUnbindResponseSchema, {
        description: '解绑结果',
    })
    async unbindWorkerWechat(@Req() req: Request) {
        return this.payService.unbindWorkerWechat(req.user.id);
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post('withdrawals/:withdrawalId/payout/query')
    @ApiOperation({
        summary: '主动刷新微信提现状态',
        description:
            'worker 端在确认收款页返回后主动向服务端发起微信提现查单。',
    })
    @ApiSuccessResponse(workerWithdrawalPayoutStatusResponseSchema, {
        description: '最新提现渠道状态快照',
    })
    async queryWithdrawalPayoutStatus(
        @Param('withdrawalId') withdrawalId: string,
        @Req() req: Request,
    ) {
        return this.payService.queryWorkerWithdrawalPayoutStatus(
            req.user.id,
            withdrawalId,
        );
    }

    @UseGuards(AuthGuard)
    @Roles(['service_personnel'])
    @Post('withdrawals/:withdrawalId/wechat/merchant-transfer/result')
    @UsePipes(
        createZodPipe(
            workerWechatMerchantTransferResultBodySchema,
            '微信提现确认收款结果参数校验失败',
        ),
    )
    @ApiOperation({
        summary: '上报微信提现确认收款页面结果',
        description:
            'worker 端拉起微信确认收款页后，将页面返回结果上报给服务端并立即触发查单。',
    })
    @ApiBodies(workerWechatMerchantTransferResultBodySchema)
    @ApiSuccessResponse(workerWithdrawalPayoutStatusResponseSchema, {
        description: '最新提现渠道状态快照',
    })
    async reportWechatMerchantTransferResult(
        @Param('withdrawalId') withdrawalId: string,
        @Body()
        body: z.infer<typeof workerWechatMerchantTransferResultBodySchema>,
        @Req() req: Request,
    ) {
        return this.payService.reportWorkerWechatMerchantTransferResult(
            req.user.id,
            withdrawalId,
            body,
        );
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
            '主动查询订单最近一次支付记录对应渠道的支付状态，用于客户端确认支付结果',
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
