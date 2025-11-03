import { createSign } from 'node:crypto';
import {
    BadRequestException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import {
    alipayWithdrawResponseSchema,
    alipayWithdrawSuccessResponseSchema,
    type PayNotification,
    type QueryPaymentStatusResponse,
    type UserWithdrawBody,
    type UserWithdrawResponse,
} from '@repo/types';
import Decimal from 'decimal.js';
import { and, eq, sql } from 'drizzle-orm';
import { CACHE_SERVICE, type IAdvancedCacheService } from 'src/common/cache';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import {
    earnings,
    financialTransactions,
    orderAssignments,
    orders,
    payments,
    userBalances,
    users,
} from 'src/common/database/schema';
import { createAliPaySdk } from 'src/lib/alipaySdk';
import { OrderService } from '../order/order.service';
import { PayRepository } from './pay.repository';

type PaymentInsert = typeof payments.$inferInsert;

type PaymentRecord = typeof payments.$inferSelect;
type OrderRecord = typeof orders.$inferSelect;

type PaymentStatus = (typeof payments.status.enumValues)[number];

type TradeStatus = PayNotification['trade_status'];

const TRADE_STATUS_TO_PAYMENT_STATUS: Record<TradeStatus, PaymentStatus> = {
    WAIT_BUYER_PAY: 'pending',
    TRADE_SUCCESS: 'succeeded',
    TRADE_FINISHED: 'succeeded',
    TRADE_CLOSED: 'failed',
};

function parseAlipayTime(value?: string) {
    if (!value) {
        return undefined;
    }

    return new Date(`${value.replace(' ', 'T')}+08:00`);
}

@Injectable()
export class PayService {
    // 实例化客户端
    private alipaySdk = createAliPaySdk();

    @Inject(DB)
    private db: DbType;

    @Inject(forwardRef(() => OrderService))
    private order: OrderService;

    @Inject(PayRepository)
    private payRepository: PayRepository;

    @Inject(CACHE_SERVICE)
    private cacheService: IAdvancedCacheService;

    private logger = new Logger(PayService.name);

    private readonly paymentLockTtl = 30; // 秒

    private getPaymentLockKey(orderId: string) {
        return `lock:payment:order:${orderId}`;
    }

    constructor() {
        this.logger;
    }

    /**
     * 统一的支付状态更新逻辑(幂等性保证)
     * 被异步通知、主动查询、定时任务共同调用
     * @param orderId 订单ID
     * @param tradeStatus 支付宝交易状态
     * @param alipayTradeNo 支付宝交易号
     * @param notifyTime 通知时间
     * @returns 更新是否成功
     */
    private async updatePaymentStatusIdempotent({
        orderId,
        tradeStatus,
        alipayTradeNo,
        notifyTime,
    }: {
        orderId: string;
        tradeStatus: TradeStatus;
        alipayTradeNo?: string;
        notifyTime?: string;
    }): Promise<{ success: boolean; alreadyProcessed: boolean }> {
        const mappedStatus = TRADE_STATUS_TO_PAYMENT_STATUS[tradeStatus];
        if (!mappedStatus) {
            return { success: false, alreadyProcessed: false };
        }

        const lockKey = this.getPaymentLockKey(orderId);
        let lockId: string | null = null;

        try {
            // 获取分布式锁,避免并发冲突
            lockId = await this.cacheService.acquireLock(
                lockKey,
                this.paymentLockTtl,
                15,
                200,
            );
            if (!lockId) {
                return { success: false, alreadyProcessed: false };
            }

            const paidAt =
                mappedStatus === 'succeeded'
                    ? parseAlipayTime(notifyTime)
                    : undefined;

            let alreadyProcessed = false;

            await this.db.transaction(async (tx) => {
                const latestOrder = await tx.query.orders.findFirst({
                    where: eq(orders.id, orderId),
                });

                if (!latestOrder) {
                    throw new BadRequestException('订单不存在');
                }

                let paymentRecord =
                    await this.payRepository.findLatestByOrderAndMethod(
                        orderId,
                        'alipay',
                        tx,
                    );

                // 幂等性检查:如果已经是成功状态,则跳过处理
                if (paymentRecord?.status === 'succeeded') {
                    alreadyProcessed = true;
                    return;
                }

                if (!paymentRecord) {
                    const newPayment: PaymentInsert = {
                        orderId: orderId,
                        amount: latestOrder.totalAmount,
                        currency: latestOrder.currency ?? 'CNY',
                        paymentMethod: 'alipay',
                        status: mappedStatus,
                        paidAt,
                    };

                    if (alipayTradeNo) {
                        newPayment.transactionId = alipayTradeNo;
                    }

                    paymentRecord = await this.payRepository.createPayment(
                        newPayment,
                        tx,
                    );
                } else {
                    // 更新现有支付记录
                    const updateData: Partial<
                        Omit<PaymentInsert, 'id' | 'orderId'>
                    > = {
                        status: mappedStatus,
                        paidAt,
                    };

                    if (alipayTradeNo) {
                        updateData.transactionId = alipayTradeNo;
                    }

                    paymentRecord = await this.payRepository.updatePaymentById(
                        paymentRecord.id,
                        updateData,
                        tx,
                    );
                }

                if (mappedStatus === 'succeeded') {
                    // 支付成功后更新订单状态为 'paid'
                    let orderForPayment: OrderRecord = latestOrder;
                    try {
                        const updatedOrder = await this.order.updateOrderStatus(
                            latestOrder.id,
                            'paid',
                            { tx: tx },
                        );
                        if (updatedOrder) {
                            orderForPayment = updatedOrder;
                        }
                    } catch (error) {
                        this.logger.warn(
                            `[PayService] 更新订单状态失败: ${latestOrder.id}`,
                            error instanceof Error ? error.message : error,
                        );
                    }

                    // 创建支付流水记录
                    const finalPaymentRecord =
                        paymentRecord ??
                        (await this.payRepository.findLatestByOrderAndMethod(
                            orderId,
                            'alipay',
                            tx,
                        ));

                    const transactionValues: typeof financialTransactions.$inferInsert =
                        {
                            orderId: orderId,
                            paymentId: finalPaymentRecord?.id ?? null,
                            userId: orderForPayment.customerId,
                            transactionType: 'payment_received',
                            amount: `+${orderForPayment.totalAmount}`,
                            currency: orderForPayment.currency ?? 'CNY',
                            description: `客户支付订单${orderForPayment.orderSerial ?? orderForPayment.id}`,
                            referenceId: alipayTradeNo ?? null,
                        };

                    await this.payRepository.createFinancialTransaction(
                        transactionValues,
                        tx,
                    );
                }
            });

            return { success: true, alreadyProcessed };
        } catch (error) {
            this.logger.error(
                '[PayService] 更新支付状态失败',
                error instanceof Error ? error.message : error,
            );
            return { success: false, alreadyProcessed: false };
        } finally {
            if (lockId) {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((releaseError) => {
                        this.logger.warn(
                            `[PayService] 释放支付锁失败: ${lockKey}`,
                            releaseError instanceof Error
                                ? releaseError.message
                                : releaseError,
                        );
                    });
            }
        }
    }

    private async isUserExist(id: string) {
        const statement = sql`SELECT EXISTS (SELECT 1 FROM ${users} WHERE ${users.id} = ${id} AND ${users.role} = 'customer') AS has_user`;
        const result = await this.db.execute<{ has_user: boolean }>(statement);

        return result.rows[0]?.has_user === true;
    }

    // 封装支付宝账号授权请求参数串，便于客户端直接拉起(参数说明请参考这个文档 https://opendocs.alipay.com/open-v3/05w8m8?pathHash=70e53558)
    public buildAlipayAuthParamString({
        appId,
        pid,
        targetId,
        signType = 'RSA2',
        scope = 'kuaijie',
        authType = 'AUTHACCOUNT',
        appName = 'mc',
        productId = 'APP_FAST_LOGIN',
        method = 'alipay.open.auth.sdk.code.get',
        apiname = 'com.alipay.account.auth',
        bizType = 'openservice',
        extraParams = {},
        encodeValues = false,
        encodeSign = true,
        privateKey,
    }: {
        appId: string;
        pid: string;
        targetId: string;
        signType?: 'RSA2' | 'RSA';
        scope?: string;
        authType?: string;
        appName?: string;
        productId?: string;
        method?: string;
        apiname?: string;
        bizType?: string;
        extraParams?: Record<
            string,
            string | number | boolean | null | undefined
        >;
        encodeValues?: boolean;
        encodeSign?: boolean;
        privateKey?: string;
    }): string {
        if (!appId?.trim()) {
            throw new BadRequestException('支付宝应用 ID 缺失');
        }

        if (!pid?.trim()) {
            throw new BadRequestException('支付宝 PID 缺失');
        }

        if (!targetId?.trim()) {
            throw new BadRequestException('授权请求 target_id 缺失');
        }

        const encodeValue = (key: string, value: string) => {
            if (key === 'sign') {
                return encodeSign ? encodeURIComponent(value) : value;
            }

            return encodeValues ? encodeURIComponent(value) : value;
        };

        const normalizedSignType: 'RSA2' | 'RSA' =
            signType === 'RSA' ? 'RSA' : 'RSA2';

        const baseEntries: Array<[string, string]> = [
            ['apiname', apiname],
            ['app_id', appId],
            ['app_name', appName],
            ['auth_type', authType],
            ['biz_type', bizType],
            ['method', method],
            ['pid', pid],
            ['product_id', productId],
            ['scope', scope],
            ['sign_type', normalizedSignType],
            ['target_id', targetId],
        ];

        const extraEntries = Object.entries(extraParams ?? {})
            .filter(
                ([, value]) =>
                    value !== undefined &&
                    value !== null &&
                    String(value).length > 0,
            )
            .map(([key, value]) => [key, String(value)] as [string, string])
            .sort(([a], [b]) => a.localeCompare(b));

        const signingEntries = [...baseEntries, ...extraEntries];

        const unsignedText = signingEntries
            .map(([key, value]) => `${key}=${value}`)
            .join('&');

        const sdkPrivateKey = (
            this.alipaySdk as unknown as { config?: { privateKey?: string } }
        )?.config?.privateKey;

        const rawPrivateKey = (
            privateKey ??
            sdkPrivateKey ??
            process.env.ALIPAY_PRIVATE_KEY ??
            ''
        ).trim();

        if (!rawPrivateKey) {
            throw new BadRequestException('支付宝私钥缺失');
        }

        const normalizedPrivateKey = rawPrivateKey
            .split('\n')
            .join(String.fromCharCode(10))
            .replace(/\r/g, '');

        const algorithm =
            normalizedSignType === 'RSA2' ? 'RSA-SHA256' : 'RSA-SHA1';

        const signer = createSign(algorithm);

        signer.update(unsignedText, 'utf8');

        const sign = signer.sign(normalizedPrivateKey, 'base64');

        const pairs = signingEntries.map(([key, value]) => {
            return `${key}=${encodeValue(key, value)}`;
        });

        pairs.push(`sign=${encodeValue('sign', sign)}`);

        return pairs.join('&');
    }

    async pay({
        displayAmount,
        payType,
        orderId,
        userId,
    }: {
        displayAmount: number;
        payType: 'wechat_pay' | 'alipay' | 'bank_transfer';
        orderId: string;
        userId: string;
    }) {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const userExists = await this.isUserExist(userId);
        if (!userExists) {
            throw new BadRequestException('用户不存在');
        }

        const orderInfo = await this.order.getOrderById(orderId, userId);
        let payableAmount = Number(orderInfo.totalAmount);

        if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
            throw new BadRequestException('订单金额异常，无法发起支付');
        }

        if (
            displayAmount !== undefined &&
            Math.abs(displayAmount - payableAmount) > 0.01
        ) {
            throw new BadRequestException('显示金额与应付金额不一致');
        }

        if (orderInfo.status !== 'pending_payment') {
            throw new BadRequestException('当前状态不支持发起支付');
        }

        if (payType !== 'alipay') {
            throw new BadRequestException('当前暂不支持该支付方式');
        }

        const lockKey = this.getPaymentLockKey(orderInfo.id);
        let lockId: string | null = null;
        const lockInfo = await this.cacheService.getLockInfo(lockKey);
        this.logger.log('Current lock info:', lockInfo);

        try {
            lockId = await this.cacheService.acquireLock(
                lockKey,
                this.paymentLockTtl,
                10,
                200,
            );
            if (!lockId) {
                throw new BadRequestException('系统繁忙，请稍后重试');
            }

            const paymentRecord = await this.db.transaction(async (tx) => {
                const currentOrder = await tx.query.orders.findFirst({
                    where: eq(orders.id, orderId),
                });

                if (!currentOrder) {
                    throw new BadRequestException('订单不存在');
                }

                if (currentOrder.status !== 'pending_payment') {
                    throw new BadRequestException('当前状态不支持发起支付');
                }

                payableAmount = Number(currentOrder.totalAmount);
                if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
                    throw new BadRequestException('订单金额异常，无法发起支付');
                }

                if (
                    displayAmount !== undefined &&
                    Math.abs(displayAmount - payableAmount) > 0.01
                ) {
                    throw new BadRequestException('显示金额与应付金额不一致');
                }

                const existingPayments = await this.payRepository.findByOrderId(
                    orderId,
                    tx,
                );

                if (
                    existingPayments.some(
                        (payment) => payment.status === 'succeeded',
                    )
                ) {
                    throw new BadRequestException('该订单已完成支付');
                }

                let paymentRecord = existingPayments.find(
                    (payment) =>
                        payment.status === 'pending' &&
                        payment.paymentMethod === payType,
                );

                if (!paymentRecord) {
                    paymentRecord = await this.payRepository.createPayment(
                        {
                            orderId,
                            amount: currentOrder.totalAmount,
                            currency: currentOrder.currency ?? 'CNY',
                            paymentMethod: payType,
                            status: 'pending',
                        },
                        tx,
                    );

                    if (!paymentRecord) {
                        throw new BadRequestException('创建支付记录失败');
                    }
                }

                return paymentRecord;
            });

            const outTradeNo = orderInfo.orderSerial ?? orderInfo.id;
            const orderSubject =
                orderInfo.service?.name ??
                `订单支付-${orderInfo.orderSerial ?? orderInfo.id}`;
            const orderBody = orderInfo.service?.description ?? '';

            const orderString = this.alipaySdk.sdkExecute(
                'alipay.trade.app.pay',
                {
                    bizContent: {
                        out_trade_no: outTradeNo,
                        total_amount: payableAmount.toFixed(2),
                        subject: orderSubject,
                        product_code: 'QUICK_MSECURITY_PAY',
                        body: orderBody,
                    },
                    notify_url: `http://e96a2a8c.natappfree.cc/api/pay/alipay/notify`,
                },
            );

            return {
                paymentId: paymentRecord.id,
                orderString,
                payType,
                outTradeNo,
                amount: payableAmount,
            };
        } finally {
            if (lockId) {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((error) => {
                        this.logger.warn(
                            `[PayService] release payment lock failed: ${lockKey}`,
                            error instanceof Error ? error.message : error,
                        );
                    });
            }
        }
    }

    async payNotify(payInfo: PayNotification) {
        const signatureValid = this.alipaySdk.checkNotifySignV2(payInfo);
        // 生产环境必须校验签名
        // if (!signatureValid) {
        // 	return "fail";
        // }

        const order = await this.db.query.orders.findFirst({
            where: eq(orders.orderSerial, payInfo.out_trade_no),
        });

        if (!order) {
            return 'fail';
        }

        const result = await this.updatePaymentStatusIdempotent({
            orderId: order.id,
            tradeStatus: payInfo.trade_status,
            alipayTradeNo: payInfo.trade_no,
            notifyTime: payInfo.gmt_payment || payInfo.notify_time,
        });

        return result.success || result.alreadyProcessed ? 'success' : 'fail';
    }

    /**
     * 客户端报告支付结果并触发查询
     * 当客户端完成支付流程(无论成功/失败/取消)后调用此接口
     * 后端会立即向支付宝查询真实状态,确保数据一致性
     * @param orderId 订单ID
     * @param userId 用户ID
     * @param clientResultCode 客户端收到的支付宝返回码(9000成功/8000处理中/6001取消等)
     * @returns 从支付宝查询到的真实支付状态
     */
    async reportAndQueryPaymentStatus(
        orderId: string,
        userId: string,
        clientResultCode?: string,
    ): Promise<QueryPaymentStatusResponse> {
        // 记录客户端报告的结果码用于监控和分析
        if (clientResultCode) {
            this.logger.log(
                `[PayService] 客户端报告支付结果 - 订单:${orderId}, 结果码:${clientResultCode}`,
            );
        }

        // 实际仍然调用查询接口获取真实状态
        return this.queryPaymentStatus(orderId, userId);
    }

    /**
     * 主动查询支付宝订单状态
     * 客户端在收到不确定状态(8000/6004)时调用
     * @param orderId 订单ID
     * @param userId 用户ID(权限校验)
     * @returns 订单支付状态
     */
    async queryPaymentStatus(
        orderId: string,
        userId: string,
    ): Promise<QueryPaymentStatusResponse> {
        if (!userId) {
            throw new BadRequestException('用户未登录');
        }

        // 防刷保护:限制查询频率(每个订单每分钟最多查询10次)
        const rateLimitKey = `rate:query_payment:${orderId}`;
        const queryCount = await this.cacheService.get<number>(rateLimitKey);
        if (queryCount && Number(queryCount) >= 10) {
            throw new BadRequestException('查询过于频繁，请稍后再试');
        }
        await this.cacheService.set(
            rateLimitKey,
            (Number(queryCount) || 0) + 1,
            60,
        );

        // 权限校验:确保用户只能查询自己的订单
        const orderInfo = await this.order.getOrderById(orderId, userId);
        if (!orderInfo) {
            throw new BadRequestException('订单不存在');
        }

        const outTradeNo = orderInfo.orderSerial ?? orderInfo.id;

        try {
            // 调用支付宝查询接口
            const queryResult = await this.alipaySdk.exec(
                'alipay.trade.query',
                {
                    bizContent: {
                        out_trade_no: outTradeNo,
                    },
                },
            );

            // 解析查询结果
            const response = queryResult as {
                code: string;
                msg: string;
                tradeStatus?: TradeStatus;
                tradeNo?: string;
                totalAmount?: string;
                sendPayDate?: string;
            };

            // code=10000 表示接口调用成功
            if (response.code === '10000' && response.tradeStatus) {
                // 使用统一的更新逻辑
                await this.updatePaymentStatusIdempotent({
                    orderId: orderInfo.id,
                    tradeStatus: response.tradeStatus,
                    alipayTradeNo: response.tradeNo,
                    notifyTime: response.sendPayDate,
                });

                // 重新查询数据库中的最新状态
                const latestPayment =
                    await this.payRepository.findLatestByOrderAndMethod(
                        orderInfo.id,
                        'alipay',
                    );

                return {
                    orderId: orderInfo.id,
                    orderSerial: outTradeNo,
                    paymentStatus: latestPayment?.status ?? 'pending',
                    tradeStatus: response.tradeStatus,
                    amount: response.totalAmount,
                    transactionId: response.tradeNo,
                    message: '订单已支付完成',
                };
            }

            // code=40004 表示订单不存在(用户可能还未完成支付)
            if (response.code === '40004') {
                return {
                    orderId: orderInfo.id,
                    orderSerial: outTradeNo,
                    paymentStatus: 'pending',
                    tradeStatus: 'WAIT_BUYER_PAY' as TradeStatus,
                    amount: response.totalAmount,
                    transactionId: response.tradeNo,
                    message: '订单尚未支付',
                };
            }

            throw new BadRequestException(`查询支付状态失败: ${response.msg}`);
        } catch (error) {
            this.logger.error(
                '[PayService] 查询支付宝订单状态失败',
                error instanceof Error ? error.message : error,
            );
            throw new BadRequestException('查询支付状态失败,请稍后重试');
        }
    }

    /**
     * 定时任务:扫描超时的pending支付记录并主动查询
     * 建议每5分钟执行一次
     * 查询条件:支付状态为pending且创建时间超过10分钟的记录
     */
    async scanAndQueryPendingPayments() {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

        try {
            // 查询所有超时的pending支付记录
            const pendingPayments = await this.db.query.payments.findMany({
                where: and(
                    eq(payments.status, 'pending'),
                    eq(payments.paymentMethod, 'alipay'),
                    sql`${payments.createdAt} < ${tenMinutesAgo}`,
                ),
                with: {
                    order: true,
                },
                limit: 100, // 限制每次处理数量,避免一次处理过多
            });

            this.logger.log(
                `[PayService] 定时任务扫描到 ${pendingPayments.length} 条待查询的支付记录`,
            );

            let successCount = 0;
            let failCount = 0;

            // 逐个查询(避免并发过高)
            for (const payment of pendingPayments) {
                if (!payment.order) {
                    continue;
                }

                const outTradeNo =
                    payment.order.orderSerial ?? payment.order.id;

                try {
                    const queryResult = await this.alipaySdk.exec(
                        'alipay.trade.query',
                        {
                            bizContent: {
                                out_trade_no: outTradeNo,
                            },
                        },
                    );

                    const response = queryResult as {
                        code: string;
                        msg: string;
                        tradeStatus?: TradeStatus;
                        tradeNo?: string;
                        totalAmount?: string;
                        sendPayDate?: string;
                    };

                    if (response.code === '10000' && response.tradeStatus) {
                        const result = await this.updatePaymentStatusIdempotent(
                            {
                                orderId: payment.order.id,
                                tradeStatus: response.tradeStatus,
                                alipayTradeNo: response.tradeNo,
                                notifyTime: response.sendPayDate,
                            },
                        );

                        if (result.success || result.alreadyProcessed) {
                            successCount++;
                            this.logger.log(
                                `[PayService] 定时查询成功更新订单 ${outTradeNo} 状态: ${response.tradeStatus}`,
                            );
                        } else {
                            failCount++;
                        }
                    } else if (response.code === '40004') {
                        // 订单不存在,可能用户还未支付,保持pending状态
                        this.logger.log(
                            `[PayService] 订单 ${outTradeNo} 尚未在支付宝产生交易记录`,
                        );
                    }
                } catch (error) {
                    failCount++;
                    this.logger.error(
                        `[PayService] 定时查询订单 ${outTradeNo} 失败:`,
                        error instanceof Error ? error.message : error,
                    );
                }

                // 添加延迟避免请求过快
                await new Promise((resolve) => setTimeout(resolve, 200));
            }

            this.logger.log(
                `[PayService] 定时任务完成: 成功 ${successCount} 条, 失败 ${failCount} 条`,
            );

            return {
                total: pendingPayments.length,
                success: successCount,
                failed: failCount,
            };
        } catch (error) {
            this.logger.error(
                '[PayService] 定时任务执行失败:',
                error instanceof Error ? error.message : error,
            );
            throw error;
        }
    }

    // 处理服务完成后的收益分配
    public async processServiceRevenueAndPlatformFee({
        tx,
        order,
    }: {
        tx: DbType;
        order: OrderRecord;
        payment?: PaymentRecord | null;
        tradeNo?: string;
    }) {
        if (!order?.id) {
            return;
        }

        // 仅当订单已分配服务人员时才进行收益入账
        const assignment = await tx.query.orderAssignments.findFirst({
            where: eq(orderAssignments.orderId, order.id),
        });

        const servicePersonnelId = assignment?.servicePersonnelId;
        if (!servicePersonnelId) {
            return;
        }

        const existingEarning = await tx.query.earnings.findFirst({
            where: eq(earnings.orderId, order.id),
        });

        // 若已生成收益记录则直接返回，避免重复入账
        if (existingEarning) {
            return;
        }

        if (!order.totalAmount) {
            return;
        }

        // 使用高精度 Decimal 避免金额浮点误差
        let totalAmountDecimal: Decimal;
        try {
            totalAmountDecimal = new Decimal(order.totalAmount);
        } catch (error) {
            this.logger.warn(
                `[PayService] 订单${order.id}金额解析失败`,
                error instanceof Error ? error.message : error,
            );
            return;
        }

        if (totalAmountDecimal.lte(0)) {
            return;
        }

        // 按 80% 给服务人员、20% 留给平台计算拆分金额
        const serviceShareDecimal = totalAmountDecimal
            .mul(80)
            .div(100)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

        const serviceShare = serviceShareDecimal.toFixed(2);
        const currency = order.currency ?? 'CNY';

        // 使用数据库原子 upsert 累加服务人员余额，避免并发竞争
        const [balanceRow] = await tx
            .insert(userBalances)
            .values({
                userId: servicePersonnelId,
                availableBalance: serviceShare,
                frozenBalance: '0',
                totalBalance: serviceShare,
                currency,
            })
            .onConflictDoUpdate({
                target: userBalances.userId,
                set: {
                    availableBalance: sql`${userBalances.availableBalance} + ${serviceShare}`,
                    totalBalance: sql`${userBalances.totalBalance} + ${serviceShare}`,
                    currency,
                },
            })
            .returning({
                id: userBalances.id,
                availableBalance: userBalances.availableBalance,
                totalBalance: userBalances.totalBalance,
            });

        if (!balanceRow) {
            return;
        }

        // 记录服务人员收益
        const [earningRecord] = await tx
            .insert(earnings)
            .values({
                orderId: order.id,
                userId: servicePersonnelId,
                amount: serviceShare,
                currency,
            })
            .returning();

        if (!earningRecord) {
            return;
        }
    }

    /**
     * 订单完成后处理收益分配
     * @param orderId 订单ID
     */
    async handleOrderCompletion(orderId: string) {
        const order = await this.order.getOrderById(orderId);

        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        if (order.status !== 'completed') {
            throw new BadRequestException('订单必须是已完成状态才能处理收益');
        }

        // 获取订单的支付记录
        const payments = await this.payRepository.findByOrderId(orderId);
        const payment = payments.find((p) => p.status === 'succeeded');

        if (!payment) {
            throw new BadRequestException('订单未完成有效支付，无法处理收益');
        }

        // 处理服务人员收益和平台费用
        await this.db.transaction(async (tx) => {
            await this.processServiceRevenueAndPlatformFee({
                tx,
                order: order,
                payment,
                tradeNo: payment.transactionId || undefined,
            });
        });
    }

    /**
     * 请求退款
     * @param orderId 订单ID
     * @param refundAmount 退款金额(可选,不传则全额退款)
     * @param reason 退款原因
     * @param refundedById 退款操作人ID
     * @returns 退款结果
     */
    async requestRefund(
        orderId: string,
        reason: string,
        refundedById: string,
        refundAmount?: number,
    ) {
        if (!orderId) {
            throw new BadRequestException('订单ID不能为空');
        }

        if (!refundedById) {
            throw new BadRequestException('退款操作人ID不能为空');
        }

        // 1. 获取订单信息和支付记录
        const order = await this.order.getOrderById(orderId);
        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        // 2. 校验订单状态(只有已支付、已完成的订单才能退款)
        if (!['paid', 'completed'].includes(order.status)) {
            throw new BadRequestException(
                `订单状态为 ${order.status}，不允许退款`,
            );
        }

        // 3. 查找成功的支付记录
        const payments = await this.payRepository.findByOrderId(orderId);
        const successPayment = payments.find((p) => p.status === 'succeeded');

        if (!successPayment) {
            throw new BadRequestException('订单未找到成功的支付记录');
        }

        // 3.1 幂等性检查:如果支付记录已经是退款状态,则直接返回
        if (successPayment.status === 'refunded') {
            this.logger.log(
                `[PayService] 订单 ${orderId} 已经退款,无需重复处理`,
            );
            return {
                success: true,
                message: '该订单已退款',
                refundAmount: Number(successPayment.amount),
                alreadyRefunded: true,
            };
        }

        // 4. 计算退款金额并检查累计退款限制
        const orderAmount = Number(order.totalAmount);
        const requestRefundAmount = refundAmount ?? orderAmount;

        if (requestRefundAmount <= 0) {
            throw new BadRequestException('退款金额必须大于0');
        }

        if (requestRefundAmount > orderAmount) {
            throw new BadRequestException('退款金额不能大于订单金额');
        }

        // 4.1 查询累计已退款金额(通过financial_transactions表)
        const refundTransactions = await this.db
            .select()
            .from(financialTransactions)
            .where(
                and(
                    eq(financialTransactions.orderId, orderId),
                    eq(financialTransactions.transactionType, 'refund_paid'),
                ),
            );

        const totalRefunded = refundTransactions.reduce((sum, tx) => {
            return sum + Math.abs(Number(tx.amount));
        }, 0);

        this.logger.log(
            `[PayService] 订单 ${orderId} 累计已退款: ${totalRefunded}, 本次退款: ${requestRefundAmount}, 订单总额: ${orderAmount}`,
        );

        // 4.2 检查累计退款金额是否超过订单总额
        if (totalRefunded + requestRefundAmount > orderAmount) {
            throw new BadRequestException(
                `累计退款金额不能超过订单总额。已退款: ${totalRefunded}, 本次退款: ${requestRefundAmount}, 订单总额: ${orderAmount}`,
            );
        }

        // 5. 获取分布式锁,避免并发退款
        const lockKey = `lock:refund:order:${orderId}`;
        let lockId: string | null = null;

        try {
            lockId = await this.cacheService.acquireLock(
                lockKey,
                30000,
                10,
                200,
            );
            if (!lockId) {
                throw new BadRequestException('退款处理中,请稍后重试');
            }

            // 5.1 再次检查支付状态(双重检查,防止并发问题)
            const latestPayments =
                await this.payRepository.findByOrderId(orderId);
            const latestSuccessPayment = latestPayments.find(
                (p) => p.status === 'succeeded',
            );

            if (!latestSuccessPayment) {
                throw new BadRequestException('订单支付状态已变更,无法退款');
            }

            if (latestSuccessPayment.status === 'refunded') {
                return {
                    success: true,
                    message: '该订单已退款',
                    refundAmount: Number(latestSuccessPayment.amount),
                    alreadyRefunded: true,
                };
            }

            // 5.2 生成退款请求号(使用订单ID+时间戳确保唯一性)
            const outRequestNo = `REFUND_${orderId}_${Date.now()}`;
            const outTradeNo = order.orderSerial;

            this.logger.log(
                `[PayService] 发起退款 - 订单:${outTradeNo}, 金额:${requestRefundAmount}, 原因:${reason}, 操作人:${refundedById}`,
            );

            // 6. 调用支付宝退款接口
            let alipayResponseRaw: unknown;
            try {
                alipayResponseRaw = await this.alipaySdk.exec(
                    'alipay.trade.refund',
                    {
                        bizContent: {
                            out_trade_no: outTradeNo,
                            refund_amount: requestRefundAmount.toFixed(2),
                            refund_reason: reason || '用户申请退款',
                            out_request_no: outRequestNo,
                        },
                    },
                );
            } catch (error) {
                this.logger.error(
                    `[PayService] 调用支付宝退款接口失败:`,
                    error instanceof Error ? error.message : error,
                );
                throw new BadRequestException('退款请求失败，请稍后重试');
            }

            // 7. 解析退款响应
            const response = alipayResponseRaw as {
                code: string;
                msg: string;
                sub_code?: string;
                sub_msg?: string;
                trade_no?: string;
                out_trade_no?: string;
                buyer_logon_id?: string;
                refund_fee?: string;
                fund_change?: 'Y' | 'N';
            };

            this.logger.log('支付宝退款请求参数:', alipayResponseRaw);

            this.logger.log(
                `[PayService] 支付宝退款响应 - code:${response.code}, msg:${response.msg}`,
            );

            // 8. 处理退款结果
            if (response.code !== '10000') {
                const errorMessage =
                    response.sub_msg || response.msg || '退款失败';
                this.logger.error(
                    `[PayService] 支付宝退款失败 - sub_code:${response.sub_code}, sub_msg:${response.sub_msg}`,
                );
                throw new BadRequestException(
                    `支付宝退款失败: ${errorMessage}`,
                );
            }

            // 9. 更新数据库(事务处理)
            await this.db.transaction(async (tx) => {
                // 9.1 检查是否为全额退款
                const isFullRefund =
                    totalRefunded + requestRefundAmount >= orderAmount;

                // 9.2 更新支付记录状态(只有全额退款才标记为已退款)
                if (isFullRefund) {
                    await this.payRepository.updatePaymentById(
                        successPayment.id,
                        {
                            status: 'refunded',
                        },
                        tx,
                    );
                }

                // 9.3 更新订单状态(只有全额退款才改为已退款)
                if (isFullRefund) {
                    await tx
                        .update(orders)
                        .set({
                            status: 'refunded',
                            updatedAt: new Date(),
                        })
                        .where(eq(orders.id, orderId));
                }

                // 9.4 记录退款流水
                const refundType = isFullRefund ? '全额退款' : '部分退款';
                await this.payRepository.createFinancialTransaction(
                    {
                        orderId,
                        paymentId: successPayment.id,
                        userId: order.customerId,
                        transactionType: 'refund_paid',
                        amount: `-${requestRefundAmount.toFixed(2)}`,
                        currency: order.currency ?? 'CNY',
                        description: `订单${refundType} - ${reason}`.slice(
                            0,
                            500,
                        ),
                        referenceId: response.trade_no,
                        metadata: JSON.stringify({
                            outRequestNo,
                            outTradeNo,
                            buyerLogonId: response.buyer_logon_id,
                            fundChange: response.fund_change,
                            refundFee: response.refund_fee,
                            refundedById,
                            isFullRefund,
                            totalRefundedBefore: totalRefunded,
                            totalRefundedAfter:
                                totalRefunded + requestRefundAmount,
                        }),
                    },
                    tx,
                );

                // 9.5 如果服务已完成且已产生收益,需要回退服务人员收益
                if (order.status === 'completed') {
                    await this.rollbackServicePersonnelEarnings(
                        orderId,
                        requestRefundAmount,
                        order.currency ?? 'CNY',
                        tx,
                    );
                }
            });

            this.logger.log(
                `[PayService] 退款成功 - 订单:${outTradeNo}, 退款金额:${response.refund_fee}`,
            );

            return {
                success: true,
                message: '退款成功',
                refundAmount: Number(response.refund_fee),
                tradeNo: response.trade_no,
                outRequestNo,
            };
        } finally {
            // 释放分布式锁
            if (lockId) {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((error) => {
                        this.logger.warn(
                            `[PayService] 释放退款锁失败: ${lockKey}`,
                            error instanceof Error ? error.message : error,
                        );
                    });
            }
        }
    }

    /**
     * 回退服务人员收益
     * @param orderId 订单ID
     * @param refundAmount 退款金额
     * @param currency 币种
     * @param tx 数据库事务
     */
    private async rollbackServicePersonnelEarnings(
        orderId: string,
        refundAmount: number,
        currency: string,
        tx: DbType,
    ) {
        // 查询该订单的收益记录
        const earningRecord = await tx.query.earnings.findFirst({
            where: eq(earnings.orderId, orderId),
        });

        if (!earningRecord) {
            // 没有收益记录,无需回退
            this.logger.log(
                `[PayService] 订单 ${orderId} 没有收益记录,无需回退`,
            );
            return;
        }

        // 获取订单信息来计算回退比例
        const orderRecord = await tx.query.orders.findFirst({
            where: eq(orders.id, orderId),
        });

        if (!orderRecord) {
            this.logger.log(`[PayService] 订单 ${orderId} 不存在,无法回退收益`);
            return;
        }

        const earningAmount = Number(earningRecord.amount);
        const servicePersonnelId = earningRecord.userId;
        const orderTotalAmount = Number(orderRecord.totalAmount);

        // 计算需要回退的金额(按比例)
        // 回退金额 = 收益金额 * (退款金额 / 订单总金额)
        const rollbackAmount = new Decimal(earningAmount)
            .mul(refundAmount)
            .div(orderTotalAmount)
            .toDecimalPlaces(2, Decimal.ROUND_HALF_UP)
            .toNumber();

        this.logger.log(
            `[PayService] 回退服务人员收益 - 服务人员:${servicePersonnelId}, 金额:${rollbackAmount}`,
        );

        // 扣除服务人员余额
        const balanceRecord = await this.payRepository.findUserBalanceByUserId(
            servicePersonnelId,
            tx,
        );

        if (balanceRecord) {
            const currentAvailable = new Decimal(
                balanceRecord.availableBalance ?? '0',
            );
            const currentTotal = new Decimal(balanceRecord.totalBalance ?? '0');

            const newAvailable = currentAvailable.minus(rollbackAmount);
            const newTotal = currentTotal.minus(rollbackAmount);

            // 如果余额不足,需要记录负余额(后续可以通过其他方式补齐)
            await this.payRepository.updateUserBalanceById(
                balanceRecord.id,
                {
                    availableBalance: newAvailable.toFixed(2),
                    totalBalance: newTotal.toFixed(2),
                },
                tx,
            );

            // 记录回退流水
            await this.payRepository.createFinancialTransaction(
                {
                    orderId,
                    userId: servicePersonnelId,
                    transactionType: 'adjustment',
                    amount: `-${rollbackAmount.toFixed(2)}`,
                    currency,
                    description: `订单退款导致收益回退`,
                },
                tx,
            );
        }
    }

    // 用户提现（当前仅支持支付宝）
    async withdraw(
        userId: string,
        payload: UserWithdrawBody,
    ): Promise<UserWithdrawResponse> {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const userExists = await this.isUserExist(userId);
        if (!userExists) {
            throw new BadRequestException('用户不存在');
        }

        const { amount, currency, payType, payee, remark } = payload;
        if (payType !== 'alipay') {
            throw new BadRequestException('当前仅支持支付宝提现');
        }

        const amountDecimal = new Decimal(amount).toDecimalPlaces(
            2,
            Decimal.ROUND_HALF_UP,
        );
        const amountText = amountDecimal.toFixed(2);

        // 1. 在数据库中冻结余额并创建提现记录
        const freezeContext = await this.db.transaction(async (tx) => {
            const balanceRecord =
                await this.payRepository.findUserBalanceByUserId(userId, tx);

            if (!balanceRecord) {
                throw new BadRequestException('账户余额不存在或未初始化');
            }

            const availableBefore = new Decimal(
                balanceRecord.availableBalance ?? '0',
            );
            const frozenBefore = new Decimal(
                balanceRecord.frozenBalance ?? '0',
            );
            const totalBefore = new Decimal(balanceRecord.totalBalance ?? '0');

            if (availableBefore.lt(amountDecimal)) {
                throw new BadRequestException('可用余额不足');
            }

            // 使用 Decimal 避免浮点运算误差
            const availableAfterFreeze = availableBefore.minus(amountDecimal);
            const frozenAfterFreeze = frozenBefore.plus(amountDecimal);
            const totalAfterFreeze =
                availableAfterFreeze.plus(frozenAfterFreeze);

            const updatedBalance =
                await this.payRepository.updateUserBalanceById(
                    balanceRecord.id,
                    {
                        availableBalance: availableAfterFreeze.toFixed(2),
                        frozenBalance: frozenAfterFreeze.toFixed(2),
                        totalBalance: totalAfterFreeze.toFixed(2),
                    },
                    tx,
                );

            if (!updatedBalance) {
                throw new BadRequestException('余额更新失败');
            }

            const withdrawalRecord = await this.payRepository.createWithdrawal(
                {
                    userId,
                    amount: amountText,
                    currency,
                    status: 'pending',
                },
                tx,
            );

            if (!withdrawalRecord) {
                throw new BadRequestException('创建提现记录失败');
            }

            return {
                withdrawal: withdrawalRecord,
                balanceId: balanceRecord.id,
                balanceBefore: {
                    available: availableBefore,
                    frozen: frozenBefore,
                    total: totalBefore,
                },
                balanceAfterFreeze: {
                    available: availableAfterFreeze,
                    frozen: frozenAfterFreeze,
                    total: totalAfterFreeze,
                },
            };
        });

        const outBizNo = freezeContext.withdrawal.id;
        const bizContent: Record<string, unknown> = {
            out_biz_no: outBizNo,
            trans_amount: amountText,
            biz_scene: 'DIRECT_TRANSFER',
            product_code: 'TRANS_ACCOUNT_NO_PWD',
            order_title: '用户余额提现',
            payee_info: {
                identity: payee.identity,
                identity_type: payee.identity_type,
                ...(payee.name ? { name: payee.name } : {}),
            },
        };

        if (remark) {
            Object.assign(bizContent, { remark });
        }

        // 2. 调用支付宝转账接口
        let alipayResponseRaw: unknown;
        try {
            alipayResponseRaw = await this.alipaySdk.exec(
                'alipay.fund.trans.uni.transfer',
                {
                    bizContent,
                },
            );
        } catch (error) {
            await this.rollbackWithdrawalOnFailure({
                balanceId: freezeContext.balanceId,
                withdrawalId: freezeContext.withdrawal.id,
                balanceBefore: freezeContext.balanceBefore,
            });
            throw new BadRequestException('提现请求失败，请稍后重试');
        }

        const parsedResponse =
            alipayWithdrawResponseSchema.parse(alipayResponseRaw);
        const successResult =
            alipayWithdrawSuccessResponseSchema.safeParse(parsedResponse);

        if (
            !successResult.success ||
            (successResult.data.status && successResult.data.status === 'FAIL')
        ) {
            const errorMessage =
                'sub_msg' in parsedResponse && parsedResponse.sub_msg
                    ? parsedResponse.sub_msg
                    : parsedResponse.msg;

            await this.rollbackWithdrawalOnFailure({
                balanceId: freezeContext.balanceId,
                withdrawalId: freezeContext.withdrawal.id,
                balanceBefore: freezeContext.balanceBefore,
            });

            throw new BadRequestException(`支付宝提现失败：${errorMessage}`);
        }

        const successResponse = successResult.data;
        const referenceId =
            successResponse.pay_fund_order_id ?? successResponse.order_id;
        const processedAt = new Date();

        // 3. 根据返回结果落库并生成流水
        const finalizeResult = await this.db.transaction(async (tx) => {
            const frozenAfterSuccess = freezeContext.balanceBefore.frozen;
            const totalAfterSuccess =
                freezeContext.balanceAfterFreeze.available.plus(
                    frozenAfterSuccess,
                );

            const balanceRecord =
                await this.payRepository.updateUserBalanceById(
                    freezeContext.balanceId,
                    {
                        availableBalance:
                            freezeContext.balanceAfterFreeze.available.toFixed(
                                2,
                            ),
                        frozenBalance: frozenAfterSuccess.toFixed(2),
                        totalBalance: totalAfterSuccess.toFixed(2),
                        lastTransactionId: successResult.data.order_id,
                    },
                    tx,
                );

            if (!balanceRecord) {
                throw new BadRequestException('更新余额失败');
            }

            const withdrawalRecord =
                await this.payRepository.updateWithdrawalById(
                    freezeContext.withdrawal.id,
                    {
                        status: 'completed',
                        processedAt,
                    },
                    tx,
                );

            if (!withdrawalRecord) {
                throw new BadRequestException('更新提现状态失败');
            }

            await this.payRepository.createFinancialTransaction(
                {
                    userId,
                    withdrawalId: freezeContext.withdrawal.id,
                    transactionType: 'withdrawal',
                    amount: `-${amountDecimal.negated().toFixed(2)}`,
                    currency,
                    description: `提现至支付宝账号 ${payee.identity}`.slice(
                        0,
                        120,
                    ),
                    referenceId,
                    metadata: JSON.stringify({
                        outBizNo,
                        orderId: successResponse.order_id,
                        remark,
                        payee,
                    }),
                },
                tx,
            );

            return { balanceRecord, withdrawalRecord };
        });

        const { balanceRecord, withdrawalRecord } = finalizeResult;

        const response: UserWithdrawResponse = {
            withdrawalId: withdrawalRecord.id,
            status: withdrawalRecord.status,
            amount: amountDecimal.toNumber(),
            currency,
            balance: {
                available: Number(balanceRecord.availableBalance ?? '0'),
                frozen: Number(balanceRecord.frozenBalance ?? '0'),
                total: Number(balanceRecord.totalBalance ?? '0'),
            },
            outBizNo,
            alipayOrderId: referenceId,
        };

        return response;
    }

    private async rollbackWithdrawalOnFailure({
        balanceId,
        withdrawalId,
        balanceBefore,
    }: {
        balanceId: string;
        withdrawalId: string;
        balanceBefore: {
            available: Decimal;
            frozen: Decimal;
            total: Decimal;
        };
    }) {
        // 失败时需恢复余额并标记提现状态
        await this.db.transaction(async (tx) => {
            await this.payRepository.updateUserBalanceById(
                balanceId,
                {
                    availableBalance: balanceBefore.available.toFixed(2),
                    frozenBalance: balanceBefore.frozen.toFixed(2),
                    totalBalance: balanceBefore.total.toFixed(2),
                },
                tx,
            );

            await this.payRepository.updateWithdrawalById(
                withdrawalId,
                {
                    status: 'rejected',
                    processedAt: new Date(),
                },
                tx,
            );
        });
    }

    async generateAuthString() {
        const targetId = createId();
        return this.alipaySdk.sdkExecute('alipay.open.auth.sdk.code.get', {
            apiname: 'com.alipay.account.auth',
            appId: process.env.ALIPAY_APP_ID!,
            pid: '2088721080157591',
            targetId,
            app_name: 'mc',
            biz_type: 'openservice',
            product_id: 'kuaijie',
            auth_type: 'AUTHACCOUNT',
            sign_type: 'RSA2',
        });
    }
}
