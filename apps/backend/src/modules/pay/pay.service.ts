import { createHash, createSign } from 'node:crypto';
import {
    BadRequestException,
    forwardRef,
    Inject,
    Injectable,
    Logger,
} from '@nestjs/common';
import { createId } from '@paralleldrive/cuid2';
import {
    type InitiatePaymentResponse,
    type QueryPaymentStatusResponse,
    type UserRole,
    type UserWithdrawBody,
    type UserWithdrawResponse,
    type WorkerEarningsRecordListResponse,
    type WorkerEarningsRecordQuery,
    type WorkerEarningsRecordCategory,
    type WorkerAlipayAuthExchangeBody,
    type WorkerAlipayAuthExchangeResponse,
    OrderStatus,
} from '@repo/types';
import Decimal from 'decimal.js';
import { and, arrayOverlaps, eq, gte, sql } from 'drizzle-orm';
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
    userProfiles,
    users,
} from 'src/common/database/schema';
import { createAliPaySdk, createWorkerAliPaySdk } from 'src/lib/alipaySdk';
import { OrderService } from '../order/order.service';
import { OrderRepository } from '../order/order.reposityro';
import { PayRepository } from './pay.repository';
import { PaymentDispatcher } from './providers/payment.dispatcher';
import type { PaymentChannel } from './providers/payment-provider.interface';
import { RefundDispatcher } from './providers/refund.dispatcher';
import type { RefundChannel } from './providers/refund-provider.interface';

type PaymentInsert = typeof payments.$inferInsert;

type PaymentRecord = typeof payments.$inferSelect;
type OrderRecord = typeof orders.$inferSelect;
type PaymentRecordWithOrder = PaymentRecord & { order: OrderRecord | null };

type PaymentStatus = (typeof payments.status.enumValues)[number];
type WithdrawalStatus = (typeof payments.status.enumValues)[number];

type BuildAlipayAuthParamOptions = {
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
    extraParams?: Record<string, string | number | boolean | null | undefined>;
    encodeValues?: boolean;
    encodeSign?: boolean;
};

type AlipayOauthTokenResponse = {
    userId?: string;
    openId?: string;
};

const maskAlipayId = (value?: string | null) => {
    if (!value) return null;
    if (value.length <= 6) return value;
    return `${value.slice(0, 3)}****${value.slice(-3)}`;
};

export interface EarningsOverview {
    balance: {
        available: number;
        frozen: number;
        total: number;
        currency: string;
    };
    monthlyEarnings: number;
    totalEarnings: number;
    updatedAt: Date;
}

@Injectable()
export class PayService {
    private alipaySdk = createAliPaySdk();
    private workerAlipaySdk = createWorkerAliPaySdk();

    @Inject(DB)
    private db: DbType;

    @Inject(forwardRef(() => OrderService))
    private order: OrderService;

    @Inject(OrderRepository)
    private orderRepository: OrderRepository;

    @Inject(PayRepository)
    private payRepository: PayRepository;

    @Inject(CACHE_SERVICE)
    private cacheService: IAdvancedCacheService;

    @Inject(RefundDispatcher)
    private refundDispatcher: RefundDispatcher;

    @Inject(PaymentDispatcher)
    private paymentDispatcher: PaymentDispatcher;

    private logger = new Logger(PayService.name);

    private readonly paymentLockTtl = 30; // 秒

    private getPaymentLockKey(orderId: string) {
        return `lock:payment:order:${orderId}`;
    }

    private getCloseWechatOrderLockKey(orderId: string) {
        return `lock:payment:wechat_close:${orderId}`;
    }

    private isPaymentExpired(expiresAt?: Date | null) {
        return Boolean(expiresAt && expiresAt.getTime() <= Date.now());
    }

    public async closePendingWechatPaymentOrder(
        orderId: string,
        scene: 'user_cancel' | 'payment_timeout' | 'pending_scan',
    ) {
        if (!orderId?.trim()) {
            return;
        }

        const lockKey = this.getCloseWechatOrderLockKey(orderId);
        let lockId: string | null = null;

        try {
            lockId = await this.cacheService.acquireLock(
                lockKey,
                this.paymentLockTtl,
                10,
                200,
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : String(error);
            if (message.includes('仍无法获取')) {
                this.logger.log(
                    `[PayService] 微信关单并发冲突，跳过本次处理: orderId=${orderId} (scene=${scene})`,
                );
                return;
            }

            this.logger.warn(
                `[PayService] 获取微信关单锁失败: orderId=${orderId} (scene=${scene})`,
                message,
            );
            throw error;
        }

        if (!lockId) {
            this.logger.log(
                `[PayService] 微信关单锁未获取到，跳过本次处理: orderId=${orderId} (scene=${scene})`,
            );
            return;
        }

        try {
            const order = await this.orderRepository.getOrderById(orderId);
            if (!order || order.status !== 'pending_payment') {
                return;
            }

            const paymentRecords =
                await this.payRepository.findByOrderId(orderId);
            const latestPayment = [...paymentRecords].sort((left, right) => {
                const leftTime = left.createdAt?.getTime?.() ?? 0;
                const rightTime = right.createdAt?.getTime?.() ?? 0;
                return rightTime - leftTime;
            })[0];

            if (
                !latestPayment ||
                latestPayment.paymentMethod !== 'wechat_pay' ||
                latestPayment.status !== 'pending'
            ) {
                return;
            }

            const outTradeNo = order.orderSerial ?? order.id;

            await this.paymentDispatcher.closeOrder('wechat_pay', {
                outTradeNo,
            });

            this.logger.log(
                `[PayService] 微信未支付订单已关闭: ${outTradeNo} (scene=${scene})`,
            );
        } catch (error) {
            this.logger.warn(
                `[PayService] 微信关闭订单失败: orderId=${orderId} (scene=${scene})`,
                error instanceof Error ? error.message : error,
            );

            throw error;
        } finally {
            if (lockId) {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((e) => {
                        this.logger.warn(
                            `[PayService] 释放微信关单锁失败: ${lockKey}`,
                            e instanceof Error ? e.message : e,
                        );
                    });
            }
        }
    }

    private parseAlipayOauthTokenResponse(
        raw: unknown,
    ): AlipayOauthTokenResponse | null {
        if (!raw || typeof raw !== 'object') {
            return null;
        }

        const payload = raw as Record<string, unknown>;
        const response =
            'alipay_system_oauth_token_response' in payload &&
            payload.alipay_system_oauth_token_response
                ? (payload.alipay_system_oauth_token_response as
                      | Record<string, unknown>
                      | null
                      | undefined)
                : payload.error_response
                  ? (payload.error_response as Record<string, unknown>)
                  : payload;

        if (!response || typeof response !== 'object') {
            return null;
        }

        const data = response;

        const code =
            (data.code as string | undefined) ??
            (data.result_code as string | undefined);

        if (code && code !== '10000') {
            return {
                userId: undefined,
                openId: undefined,
            };
        }

        return {
            userId:
                (data.user_id as string | undefined) ??
                (data.alipay_user_id as string | undefined) ??
                (data.userId as string | undefined),
            openId:
                (data.open_id as string | undefined) ??
                (data.alipay_open_id as string | undefined) ??
                (data.openId as string | undefined),
        };
    }

    private async saveWorkerAlipayBinding(
        userId: string,
        info: {
            alipayUserId?: string | null;
            alipayOpenId?: string | null;
        },
    ) {
        const alipayUserId = info.alipayUserId ?? null;
        const alipayOpenId = info.alipayOpenId ?? null;

        if (alipayUserId) {
            const existingProfileWithAlipayId =
                await this.db.query.userProfiles.findFirst({
                    where: eq(userProfiles.alipayUserId, alipayUserId),
                });

            if (
                existingProfileWithAlipayId &&
                existingProfileWithAlipayId.userId !== userId
            ) {
                throw new BadRequestException('该支付宝账号已绑定其他用户');
            }
        }

        const now = new Date();

        const [record] = await this.db
            .insert(userProfiles)
            .values({
                userId,
                alipayUserId,
                alipayOpenId,
                createdAt: now,
                updatedAt: now,
            })
            .onConflictDoUpdate({
                target: userProfiles.userId,
                set: {
                    alipayUserId,
                    alipayOpenId,
                    updatedAt: now,
                },
            })
            .returning();

        return record;
    }

    private mapProviderStatusToPaymentStatus(
        channel: PaymentChannel,
        providerStatus: string,
    ): PaymentStatus | null {
        if (channel === 'alipay') {
            switch (providerStatus) {
                case 'WAIT_BUYER_PAY':
                    return 'pending';
                case 'TRADE_SUCCESS':
                case 'TRADE_FINISHED':
                    return 'succeeded';
                case 'TRADE_CLOSED':
                    return 'failed';
                default:
                    return null;
            }
        }

        if (channel === 'wechat_pay') {
            switch (providerStatus) {
                case 'NOTPAY':
                case 'USERPAYING':
                case 'PROCESSING':
                case 'ACCEPT':
                    return 'pending';
                case 'SUCCESS':
                    return 'succeeded';
                case 'CLOSED':
                case 'REVOKED':
                case 'PAYERROR':
                case 'FAILED':
                    return 'failed';
                case 'REFUND':
                    return 'refunded';
                default:
                    return null;
            }
        }

        return null;
    }

    private async updatePaymentStatusIdempotent({
        orderId,
        channel,
        providerStatus,
        transactionId,
        paidAt,
    }: {
        orderId: string;
        channel: PaymentChannel;
        providerStatus: string;
        transactionId?: string;
        paidAt?: Date;
    }): Promise<{ success: boolean; alreadyProcessed: boolean }> {
        const mappedStatus = this.mapProviderStatusToPaymentStatus(
            channel,
            providerStatus,
        );
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

            let alreadyProcessed = false;

            let pendingAcceptanceOrderId: string | null = null;
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
                        channel,
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
                        paymentMethod: channel,
                        status: mappedStatus,
                        paidAt,
                    };

                    if (transactionId) {
                        newPayment.transactionId = transactionId;
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

                    if (transactionId) {
                        updateData.transactionId = transactionId;
                    }

                    paymentRecord = await this.payRepository.updatePaymentById(
                        paymentRecord.id,
                        updateData,
                        tx,
                    );
                }

                if (mappedStatus === 'succeeded') {
                    // 支付成功后更新订单状态为 'pending_acceptance'
                    let orderForPayment: OrderRecord = latestOrder;
                    try {
                        const updatedOrder = await this.order.updateOrderStatus(
                            latestOrder.id,
                            'pending_acceptance',
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
                            channel,
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
                            referenceId: transactionId ?? null,
                        };

                    await this.payRepository.createFinancialTransaction(
                        transactionValues,
                        tx,
                    );
                    pendingAcceptanceOrderId = orderForPayment.id;
                }
            });

            if (pendingAcceptanceOrderId) {
                await this.order.notifyPendingAcceptance(
                    pendingAcceptanceOrderId,
                );
            }

            if (mappedStatus === 'succeeded') {
                await this.order.clearPaymentExpirationSchedule(orderId);
            }

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

    private async markPaymentFailedAndCancelOrder(
        payment: PaymentRecordWithOrder,
    ) {
        if (!payment?.order || payment.status !== 'pending') {
            return;
        }

        if (payment.paymentMethod === 'wechat_pay') {
            await this.closePendingWechatPaymentOrder(
                payment.order.id,
                'pending_scan',
            );
        }

        try {
            await this.payRepository.updatePaymentById(payment.id, {
                status: 'failed',
            });
        } catch (error) {
            this.logger.warn(
                `[PayService] 标记支付 ${payment.id} 失败状态异常`,
                error instanceof Error ? error.message : error,
            );
        }

        try {
            await this.order.cancelOrderBySystem(
                payment.order.id,
                `${payment.paymentMethod} 未产生交易记录，系统自动取消`,
            );
        } catch (error) {
            this.logger.warn(
                `[PayService] 取消订单 ${payment.order.id} 失败`,
                error instanceof Error ? error.message : error,
            );
        }
    }

    private async isUserExist(id: string, role?: UserRole | UserRole[]) {
        if (!id) {
            return false;
        }

        const roles = Array.isArray(role) ? role : role ? [role] : [];
        const where = roles.length
            ? and(eq(users.id, id), arrayOverlaps(users.role, roles))
            : eq(users.id, id);

        const record = await this.db.query.users.findFirst({
            where,
            columns: { id: true },
        });

        return Boolean(record);
    }

    // 封装支付宝账号授权请求参数串，便于客户端直接拉起(参数说明请参考这个文档 https://opendocs.alipay.com/open-v3/05w8m8?pathHash=70e53558)
    public buildAlipayAuthParamString(
        options: BuildAlipayAuthParamOptions,
    ): string {
        return this.buildAlipayAuthParamStringInternal(options, this.alipaySdk);
    }

    private buildAlipayAuthParamStringInternal(
        {
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
        }: BuildAlipayAuthParamOptions,
        sdk?: { config?: { privateKey?: string } },
    ): string {
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

        const sdkPrivateKey = sdk?.config?.privateKey;

        const rawPrivateKey = (
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

    public async generateWorkerAlipayAuthorizeParams(userId: string) {
        if (!userId?.trim()) {
            throw new BadRequestException('用户信息缺失');
        }

        const isWorker = await this.isUserExist(userId, 'service_personnel');
        if (!isWorker) {
            throw new BadRequestException('仅服务人员可发起绑定');
        }

        const appId: string | undefined = process.env.ALIPAY_WORKER_APP_ID;
        if (!appId) {
            throw new BadRequestException('未配置服务人员端支付宝应用 ID');
        }

        const pid = process.env.ALIPAY_WORKER_PID || '';

        if (!pid) {
            throw new BadRequestException('未配置服务人员签约 PID');
        }

        const scope = 'kuaijie';

        const targetPrefix = 'worker';
        const hashedUserId = createHash('md5')
            .update(userId)
            .digest('hex')
            .slice(0, 8);
        const rawTargetId = `${targetPrefix}${hashedUserId}${createId()}`;
        const targetId = rawTargetId.replace(/[^0-9a-zA-Z]/g, '').slice(0, 32);

        const paramString = this.buildAlipayAuthParamStringInternal(
            {
                appId,
                pid,
                targetId,
                scope,
            },
            this.workerAlipaySdk as unknown as {
                config?: { privateKey?: string };
            },
        );

        return {
            paramString,
            params: {
                appId,
                pid,
                scope,
                targetId,
            },
        };
    }

    public async exchangeWorkerAlipayAuthCode(
        userId: string,
        payload: WorkerAlipayAuthExchangeBody,
    ): Promise<WorkerAlipayAuthExchangeResponse> {
        if (!userId?.trim()) {
            throw new BadRequestException('用户信息缺失');
        }

        const isWorker = await this.isUserExist(userId, 'service_personnel');
        if (!isWorker) {
            throw new BadRequestException('仅服务人员可发起绑定');
        }

        const authCode = payload.authCode?.trim();
        if (!authCode) {
            throw new BadRequestException('授权码无效，请重新授权');
        }

        let rawResponse: unknown;
        try {
            rawResponse = await this.workerAlipaySdk.exec(
                'alipay.system.oauth.token',
                {
                    grant_type: 'authorization_code',
                    code: authCode,
                },
            );
        } catch (error) {
            this.logger.error(
                '[PayService] 调用 alipay.system.oauth.token 失败',
                error instanceof Error ? error.message : error,
            );
            throw new BadRequestException('获取支付宝授权信息失败，请稍后重试');
        }

        const parsed = this.parseAlipayOauthTokenResponse(rawResponse);
        if (!parsed) {
            throw new BadRequestException('支付宝授权返回异常，请稍后重试');
        }

        console.log(parsed);

        if (!parsed.userId && !parsed.openId) {
            throw new BadRequestException(
                '未能获取到支付宝用户标识，请重新授权',
            );
        }

        await this.saveWorkerAlipayBinding(userId, {
            alipayUserId: parsed.userId ?? null,
            alipayOpenId: parsed.openId ?? null,
        });

        const maskedUserId = maskAlipayId(parsed.userId);
        const maskedOpenId = maskAlipayId(parsed.openId);

        return {
            bound: true,
            alipayUserId: maskedUserId,
            alipayOpenId: maskedOpenId,
        };
    }

    async getWorkerAlipayBindingStatus(userId: string): Promise<{
        bound: boolean;
        alipayUserId: string | null;
        alipayOpenId: string | null;
        boundAt?: string;
    }> {
        if (!userId?.trim()) {
            throw new BadRequestException('用户信息缺失');
        }

        const profile = await this.db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, userId),
            columns: {
                alipayUserId: true,
                alipayOpenId: true,
                updatedAt: true,
            },
        });

        const alipayUserId = profile?.alipayUserId ?? null;
        const alipayOpenId = profile?.alipayOpenId ?? null;
        const bound = Boolean(alipayUserId || alipayOpenId);

        return {
            bound,
            alipayUserId: maskAlipayId(alipayUserId),
            alipayOpenId: maskAlipayId(alipayOpenId),
            boundAt: bound ? profile?.updatedAt?.toISOString() : undefined,
        };
    }

    async unbindWorkerAlipay(userId: string) {
        if (!userId?.trim()) {
            throw new BadRequestException('用户信息缺失');
        }

        await this.db
            .update(userProfiles)
            .set({
                alipayUserId: null,
                alipayOpenId: null,
                updatedAt: new Date(),
            })
            .where(eq(userProfiles.userId, userId));

        return { success: true };
    }

    async pay({
        displayAmount,
        payType,
        orderId,
        userId,
    }: {
        displayAmount: number;
        payType: 'wechat_pay' | 'alipay';
        orderId: string;
        userId: string;
    }): Promise<InitiatePaymentResponse> {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const userExists = await this.isUserExist(userId, 'customer');
        if (!userExists) {
            throw new BadRequestException('用户不存在');
        }

        const orderInfo = await this.order.getOrderById(orderId, userId);
        let payableAmount = Number(orderInfo.totalAmount);

        if (this.isPaymentExpired(orderInfo.paymentExpiresAt)) {
            await this.order
                .cancelOrderBySystem(orderInfo.id)
                .catch(() =>
                    this.logger.warn(
                        `[PayService] 超时订单取消失败: ${orderInfo.id}`,
                    ),
                );
            throw new BadRequestException('订单支付已超时，请重新下单');
        }

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

                if (this.isPaymentExpired(currentOrder.paymentExpiresAt)) {
                    await this.order
                        .cancelOrderBySystem(orderId)
                        .catch(() =>
                            this.logger.warn(
                                `[PayService] 超时订单取消失败: ${orderId}`,
                            ),
                        );
                    throw new BadRequestException('订单支付已超时，请重新下单');
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

            const providerResult = await this.paymentDispatcher.initiatePayment(
                payType,
                {
                    paymentId: paymentRecord.id,
                    outTradeNo,
                    amount: payableAmount,
                    currency: orderInfo.currency ?? 'CNY',
                    subject: orderSubject,
                    body: orderBody,
                    timeExpire: orderInfo.paymentExpiresAt ?? undefined,
                },
            );

            return {
                paymentId: paymentRecord.id,
                outTradeNo,
                amount: payableAmount,
                currency: orderInfo.currency ?? 'CNY',
                ...providerResult,
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

    async handlePaymentNotify(channel: PaymentChannel, payload: unknown) {
        try {
            const notifyResult = await this.paymentDispatcher.handleNotify(
                channel,
                payload as never,
            );

            const order = await this.db.query.orders.findFirst({
                where: eq(orders.orderSerial, notifyResult.outTradeNo),
            });

            if (!order) {
                return false;
            }

            const result = await this.updatePaymentStatusIdempotent({
                orderId: order.id,
                channel: notifyResult.channel,
                providerStatus: notifyResult.providerStatus,
                transactionId: notifyResult.transactionId,
                paidAt: notifyResult.paidAt,
            });

            return result.success || result.alreadyProcessed;
        } catch (error) {
            this.logger.warn(
                '[PayService] 处理支付回调失败',
                error instanceof Error ? error.message : error,
            );
            return false;
        }
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
     * 主动查询订单支付状态
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
        const existingPayments =
            await this.payRepository.findByOrderId(orderId);
        const latestPayment = [...existingPayments].sort((left, right) => {
            const leftTime = left.createdAt?.getTime?.() ?? 0;
            const rightTime = right.createdAt?.getTime?.() ?? 0;
            return rightTime - leftTime;
        })[0];

        if (!latestPayment) {
            throw new BadRequestException('订单暂无支付记录');
        }

        if (
            latestPayment.paymentMethod !== 'alipay' &&
            latestPayment.paymentMethod !== 'wechat_pay'
        ) {
            throw new BadRequestException('当前支付记录不支持状态查询');
        }

        try {
            const providerResult =
                await this.paymentDispatcher.queryPaymentStatus(
                    latestPayment.paymentMethod,
                    {
                        outTradeNo,
                    },
                );

            if (!providerResult.notFound) {
                await this.updatePaymentStatusIdempotent({
                    orderId: orderInfo.id,
                    channel: providerResult.channel,
                    providerStatus: providerResult.providerStatus,
                    transactionId: providerResult.transactionId,
                    paidAt: providerResult.paidAt,
                });
            }

            const refreshedPayment =
                await this.payRepository.findLatestByOrderAndMethod(
                    orderInfo.id,
                    latestPayment.paymentMethod,
                );

            return {
                orderId: orderInfo.id,
                orderSerial: outTradeNo,
                payType: latestPayment.paymentMethod,
                paymentStatus: refreshedPayment?.status ?? 'pending',
                channelStatus: providerResult.providerStatus,
                amount: providerResult.amount,
                transactionId: providerResult.transactionId,
                message: providerResult.message,
            };
        } catch (error) {
            this.logger.error(
                '[PayService] 查询订单支付状态失败',
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
            const pendingPayments = await this.db.query.payments.findMany({
                where: and(
                    eq(payments.status, 'pending'),
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
                    const providerResult =
                        await this.paymentDispatcher.queryPaymentStatus(
                            payment.paymentMethod,
                            {
                                outTradeNo,
                            },
                        );

                    if (!providerResult.notFound) {
                        const result = await this.updatePaymentStatusIdempotent(
                            {
                                orderId: payment.order.id,
                                channel: providerResult.channel,
                                providerStatus: providerResult.providerStatus,
                                transactionId: providerResult.transactionId,
                                paidAt: providerResult.paidAt,
                            },
                        );

                        if (result.success || result.alreadyProcessed) {
                            successCount++;
                            this.logger.log(
                                `[PayService] 定时查询成功更新订单 ${outTradeNo} 状态: ${providerResult.providerStatus}`,
                            );
                        } else {
                            failCount++;
                        }
                    } else {
                        this.logger.log(
                            `[PayService] 订单 ${outTradeNo} 尚未在 ${payment.paymentMethod} 产生交易记录`,
                        );
                        await this.markPaymentFailedAndCancelOrder(payment);
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

        // 按 70% 给服务人员、30% 留给平台计算拆分金额
        const serviceShareDecimal = totalAmountDecimal
            .mul(70)
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

        await this.payRepository.createFinancialTransaction(
            {
                orderId: order.id,
                userId: servicePersonnelId,
                transactionType: 'service_earning',
                amount: serviceShare,
                currency,
                description: `订单${order.orderSerial ?? order.id}收益入账`,
                referenceId: order.id,
            },
            tx,
        );
    }

    /**
     * 订单完成后处理收益分配
     * @param orderId 订单ID
     */
    async handleOrderCompletion(orderId: string) {
        // 收益/退款等内部流程需要使用数据库原始订单记录（decimal 保持 string）。
        const order = await this.orderRepository.getOrderById(orderId);

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

    private buildRefundOutRequestNo(
        orderId: string,
        totalRefunded: number,
        refundAmount: number,
    ) {
        const fingerprint = `${orderId}:${totalRefunded.toFixed(2)}:${refundAmount.toFixed(2)}`;
        const digest = createHash('sha256')
            .update(fingerprint)
            .digest('hex')
            .slice(0, 24);
        return `REFUND_${digest}`;
    }

    private parseTransactionMetadata(metadata?: string | null) {
        if (!metadata) {
            return null;
        }

        try {
            const parsed = JSON.parse(metadata);
            return parsed && typeof parsed === 'object'
                ? (parsed as Record<string, unknown>)
                : null;
        } catch {
            return null;
        }
    }

    private extractProviderStatus(metadata?: Record<string, unknown>) {
        const value = metadata?.providerStatus;
        return typeof value === 'string' ? value : undefined;
    }

    private async finalizeRefundSettlement({
        order,
        payment,
        refundAmount,
        totalRefunded,
        orderAmount,
        reason,
        refundedById,
        outRequestNo,
        refundChannel,
        tradeNo,
        providerMetadata,
    }: {
        order: OrderRecord;
        payment: PaymentRecord;
        refundAmount: number;
        totalRefunded: number;
        orderAmount: number;
        reason: string;
        refundedById: string;
        outRequestNo: string;
        refundChannel: RefundChannel;
        tradeNo?: string;
        providerMetadata?: Record<string, unknown>;
    }) {
        await this.db.transaction(async (tx) => {
            const isFullRefund = totalRefunded + refundAmount >= orderAmount;

            if (isFullRefund) {
                await this.payRepository.updatePaymentById(
                    payment.id,
                    {
                        status: 'refunded',
                    },
                    tx,
                );
            }

            if (isFullRefund) {
                if (order.status === 'completed') {
                    await this.orderRepository.updateOrderStatus(
                        order.id,
                        'refunded',
                        tx,
                    );
                } else {
                    await this.orderRepository.cancelOrder(
                        order.id,
                        reason,
                        refundedById,
                        tx,
                    );
                }
            }

            const refundType = isFullRefund ? '全额退款' : '部分退款';
            await this.payRepository.createFinancialTransaction(
                {
                    orderId: order.id,
                    paymentId: payment.id,
                    userId: order.customerId,
                    transactionType: 'refund_paid',
                    amount: `-${refundAmount.toFixed(2)}`,
                    currency: order.currency ?? 'CNY',
                    description: `订单${refundType} - ${reason}`.slice(0, 500),
                    referenceId: tradeNo ?? null,
                    metadata: JSON.stringify({
                        outRequestNo,
                        outTradeNo: order.orderSerial,
                        refundChannel,
                        refundedById,
                        isFullRefund,
                        totalRefundedBefore: totalRefunded,
                        totalRefundedAfter: totalRefunded + refundAmount,
                        providerMetadata,
                    }),
                },
                tx,
            );

            if (order.status === 'completed') {
                await this.rollbackServicePersonnelEarnings(
                    order.id,
                    refundAmount,
                    order.currency ?? 'CNY',
                    tx,
                );
            }
        });
    }

    async handleWechatRefundNotify(payload: {
        rawBody: string;
        headers?: Record<string, string | string[] | undefined>;
    }) {
        try {
            const notifyResult = await this.refundDispatcher.handleNotify(
                'wechat_pay',
                payload,
            );

            if (notifyResult.providerStatus !== 'SUCCESS') {
                this.logger.log(
                    `[PayService] 微信退款回调状态: ${notifyResult.providerStatus}, outRefundNo:${notifyResult.outRequestNo}`,
                );
                return true;
            }

            if (!notifyResult.outTradeNo) {
                return false;
            }

            const order = await this.db.query.orders.findFirst({
                where: eq(orders.orderSerial, notifyResult.outTradeNo),
            });

            if (!order) {
                return false;
            }

            const lockKey = `lock:refund:order:${order.id}`;
            let lockId: string | null = null;
            lockId = await this.cacheService.acquireLock(lockKey, 30, 10, 200);
            if (!lockId) {
                return false;
            }

            try {
                const paymentRecords = await this.payRepository.findByOrderId(
                    order.id,
                );
                const payment =
                    paymentRecords.find(
                        (item) =>
                            item.paymentMethod === 'wechat_pay' &&
                            (item.status === 'succeeded' ||
                                item.status === 'refunded'),
                    ) ?? null;

                if (!payment) {
                    return false;
                }

                const refundAmount = notifyResult.refundAmount;
                if (!refundAmount || refundAmount <= 0) {
                    return false;
                }

                const refundTransactions = await this.db
                    .select()
                    .from(financialTransactions)
                    .where(
                        and(
                            eq(financialTransactions.orderId, order.id),
                            eq(
                                financialTransactions.transactionType,
                                'refund_paid',
                            ),
                        ),
                    );

                const alreadyProcessed = refundTransactions.some((tx) => {
                    const metadata = this.parseTransactionMetadata(tx.metadata);
                    return metadata?.outRequestNo === notifyResult.outRequestNo;
                });

                if (alreadyProcessed) {
                    return true;
                }

                const totalRefunded = refundTransactions.reduce((sum, tx) => {
                    return sum + Math.abs(Number(tx.amount));
                }, 0);

                const orderAmount = Number(order.totalAmount);
                if (totalRefunded + refundAmount > orderAmount + 0.01) {
                    this.logger.error(
                        `[PayService] 微信退款回调金额超限 - order:${order.id}, totalRefunded:${totalRefunded}, currentRefund:${refundAmount}, orderAmount:${orderAmount}`,
                    );
                    return false;
                }

                await this.finalizeRefundSettlement({
                    order,
                    payment,
                    refundAmount,
                    totalRefunded,
                    orderAmount,
                    reason: '微信退款回调确认成功',
                    refundedById: order.customerId,
                    outRequestNo: notifyResult.outRequestNo,
                    refundChannel: 'wechat_pay',
                    tradeNo: notifyResult.refundId,
                    providerMetadata: {
                        providerStatus: notifyResult.providerStatus,
                        source: 'wechat_refund_notify',
                    },
                });

                return true;
            } finally {
                await this.cacheService
                    .releaseLock(lockKey, lockId)
                    .catch((error) => {
                        this.logger.warn(
                            `[PayService] 释放退款锁失败: ${lockKey}`,
                            error instanceof Error ? error.message : error,
                        );
                    });
            }
        } catch (error) {
            this.logger.warn(
                '[PayService] 处理微信退款回调失败',
                error instanceof Error ? error.message : error,
            );
            return false;
        }
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
        // 退款流程使用数据库原始金额类型（decimal string），避免与面向客户端的 OrderService view 混用。
        const order = await this.orderRepository.getOrderById(orderId);
        if (!order) {
            throw new BadRequestException('订单不存在');
        }

        // 2. 校验订单状态(只有特定状态的订单才允许退款)
        const refundableStatuses: OrderStatus[] = [
            'pending_acceptance',
            'paid',
            'staff_rejected',
            'completed',
        ];
        if (!refundableStatuses.includes(order.status)) {
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

        const refundChannel = successPayment.paymentMethod;

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
            lockId = await this.cacheService.acquireLock(lockKey, 30, 10, 200);
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

            const latestRefundTransactions = await this.db
                .select()
                .from(financialTransactions)
                .where(
                    and(
                        eq(financialTransactions.orderId, orderId),
                        eq(
                            financialTransactions.transactionType,
                            'refund_paid',
                        ),
                    ),
                );

            const latestTotalRefunded = latestRefundTransactions.reduce(
                (sum, tx) => {
                    return sum + Math.abs(Number(tx.amount));
                },
                0,
            );

            if (latestTotalRefunded + requestRefundAmount > orderAmount) {
                throw new BadRequestException(
                    `累计退款金额不能超过订单总额。已退款: ${latestTotalRefunded}, 本次退款: ${requestRefundAmount}, 订单总额: ${orderAmount}`,
                );
            }

            const outRequestNo = this.buildRefundOutRequestNo(
                orderId,
                latestTotalRefunded,
                requestRefundAmount,
            );
            const outTradeNo = order.orderSerial;

            this.logger.log(
                `[PayService] 发起退款 - 订单:${outTradeNo}, 金额:${requestRefundAmount}, 原因:${reason}, 操作人:${refundedById}`,
            );

            // 6. 调用退款供应商接口
            const refundResponse = await this.refundDispatcher.refund(
                refundChannel,
                {
                    outTradeNo,
                    tradeNo:
                        latestSuccessPayment.transactionId ??
                        successPayment.transactionId ??
                        undefined,
                    outRequestNo,
                    amount: requestRefundAmount,
                    totalAmount: orderAmount,
                    reason,
                },
            );

            // 7. 处理退款结果
            if (!refundResponse.success) {
                this.logger.error(
                    `[PayService] 退款失败 - channel:${refundChannel}, code:${refundResponse.code}, message:${refundResponse.message}`,
                );
                throw new BadRequestException(
                    `退款失败: ${refundResponse.message}`,
                );
            }

            const providerStatus = this.extractProviderStatus(
                refundResponse.metadata,
            );
            if (
                refundChannel === 'wechat_pay' &&
                providerStatus !== 'SUCCESS'
            ) {
                if (providerStatus === 'PROCESSING') {
                    this.logger.log(
                        `[PayService] 微信退款已受理，等待异步终态 - outRefundNo:${outRequestNo}, status:${providerStatus}`,
                    );
                    return {
                        success: true,
                        message: '微信退款处理中，等待渠道终态',
                        refundAmount: refundResponse.refundAmount,
                        tradeNo: refundResponse.tradeNo,
                        outRequestNo,
                        refundChannel,
                        processing: true,
                        providerStatus,
                    };
                }

                throw new BadRequestException(
                    `微信退款失败: ${providerStatus ?? 'UNKNOWN'}`,
                );
            }

            await this.finalizeRefundSettlement({
                order,
                payment: successPayment,
                refundAmount: requestRefundAmount,
                totalRefunded: latestTotalRefunded,
                orderAmount,
                reason,
                refundedById,
                outRequestNo,
                refundChannel,
                tradeNo: refundResponse.tradeNo,
                providerMetadata: refundResponse.metadata,
            });

            this.logger.log(
                `[PayService] 退款成功 - 渠道:${refundChannel}, 订单:${outTradeNo}, 退款金额:${refundResponse.refundAmount}`,
            );

            return {
                success: true,
                message: '退款成功',
                refundAmount: refundResponse.refundAmount,
                tradeNo: refundResponse.tradeNo,
                outRequestNo,
                refundChannel,
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

    async getUserBalanceSnapshot(userId: string) {
        const record = await this.payRepository.findUserBalanceByUserId(userId);

        if (!record) {
            return {
                available: 0,
                frozen: 0,
                total: 0,
                currency: 'CNY',
            };
        }

        const toNumber = (value?: string | null) => Number(value ?? 0) || 0;

        return {
            available: toNumber(record.availableBalance),
            frozen: toNumber(record.frozenBalance),
            total: toNumber(record.totalBalance),
            currency: record.currency ?? 'CNY',
        };
    }

    async getEarningsOverview(userId: string): Promise<EarningsOverview> {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const now = new Date();
        const startOfMonth = new Date(
            now.getFullYear(),
            now.getMonth(),
            1,
            0,
            0,
            0,
            0,
        );

        const [balance, totalResult, monthlyResult] = await Promise.all([
            this.getUserBalanceSnapshot(userId),
            this.db
                .select({
                    total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
                })
                .from(earnings)
                .where(eq(earnings.userId, userId)),
            this.db
                .select({
                    total: sql<string>`COALESCE(SUM(${earnings.amount}), 0)`,
                })
                .from(earnings)
                .where(
                    and(
                        eq(earnings.userId, userId),
                        gte(earnings.createdAt, startOfMonth),
                    ),
                ),
        ]);

        const toNumber = (value?: string | null) => Number(value ?? 0) || 0;

        return {
            balance,
            totalEarnings: toNumber(totalResult[0]?.total),
            monthlyEarnings: toNumber(monthlyResult[0]?.total),
            updatedAt: new Date(),
        };
    }

    async getWorkerEarningsRecords(
        userId: string,
        query: WorkerEarningsRecordQuery,
    ): Promise<WorkerEarningsRecordListResponse> {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const page = Math.max(1, Number(query?.page ?? 1));
        const limit = Math.min(100, Math.max(1, Number(query?.limit ?? 20)));
        const offset = (page - 1) * limit;
        const category: WorkerEarningsRecordCategory =
            query?.category ?? 'mixed';

        if (category === 'withdrawal') {
            const { items, total } =
                await this.payRepository.queryWithdrawalRecords(userId, {
                    limit,
                    offset,
                    status: query?.withdrawalStatus ?? undefined,
                });

            return this.payRepository.buildPaginatedResponse(items, {
                page,
                limit,
                total,
            });
        }

        if (category === 'income') {
            const { items, total } =
                await this.payRepository.queryFinancialTransactionRecords(
                    userId,
                    {
                        limit,
                        offset,
                        flow: 'income',
                        excludeWithdrawalTransactions: true,
                    },
                );

            return this.payRepository.buildPaginatedResponse(items, {
                page,
                limit,
                total,
            });
        }

        return this.payRepository.getMixedEarningsRecords(userId, {
            page,
            limit,
            offset,
        });
    }

    // 用户提现申请：冻结余额并按渠道写入提现工单
    async withdraw(
        userId: string,
        payload: UserWithdrawBody,
    ): Promise<UserWithdrawResponse> {
        if (!userId) {
            throw new BadRequestException('用户信息缺失');
        }

        const userExists = await this.isUserExist(userId, 'service_personnel');
        if (!userExists) {
            throw new BadRequestException('用户不存在');
        }

        const { amount, currency, payType, remark } = payload;

        const amountDecimal = new Decimal(amount).toDecimalPlaces(
            2,
            Decimal.ROUND_HALF_UP,
        );

        if (amountDecimal.lt(0.1)) {
            throw new BadRequestException('提现金额需大于或等于 0.1 元');
        }

        const normalizedRemark = remark?.trim() ?? '';
        if (amountDecimal.greaterThanOrEqualTo(50000) && !normalizedRemark) {
            throw new BadRequestException('单笔提现满 50000 元时备注必填');
        }

        const profile = await this.db.query.userProfiles.findFirst({
            where: eq(userProfiles.userId, userId),
            columns: {
                alipayUserId: true,
                alipayOpenId: true,
                wechatWorkerOpenId: true,
                wechatWorkerAppId: true,
                realName: true,
            },
        });

        const alipayUserId = profile?.alipayUserId?.trim();
        const alipayOpenId = profile?.alipayOpenId?.trim();
        const wechatWorkerOpenId = profile?.wechatWorkerOpenId?.trim();
        const wechatWorkerAppId = profile?.wechatWorkerAppId?.trim();
        const payeeName = profile?.realName?.trim() || null;

        let payeeAccount: string | null = null;
        let payeeAccountType:
            | 'ALIPAY_USER_ID'
            | 'ALIPAY_OPEN_ID'
            | 'WECHAT_OPENID'
            | null = null;
        let providerAppId: string | null = null;

        if (payType === 'alipay') {
            if (alipayUserId) {
                payeeAccount = alipayUserId;
                payeeAccountType = 'ALIPAY_USER_ID';
            } else if (alipayOpenId) {
                payeeAccount = alipayOpenId;
                payeeAccountType = 'ALIPAY_OPEN_ID';
            }

            if (!payeeAccount || !payeeAccountType) {
                throw new BadRequestException('请先绑定支付宝账号后再提现');
            }
        } else {
            if (!wechatWorkerOpenId || !wechatWorkerAppId) {
                throw new BadRequestException(
                    '请先绑定服务人员端微信提现账号后再提现',
                );
            }

            payeeAccount = wechatWorkerOpenId;
            payeeAccountType = 'WECHAT_OPENID';
            providerAppId = wechatWorkerAppId;
        }

        if (!payeeAccount || !payeeAccountType) {
            throw new BadRequestException('提现收款账户信息缺失');
        }

        const confirmedPayeeAccount = payeeAccount;
        const confirmedPayeeAccountType = payeeAccountType;

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

            if (availableBefore.lt(amountDecimal)) {
                throw new BadRequestException('可用余额不足');
            }

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
                    amount: amountDecimal.toFixed(2),
                    currency,
                    status: 'pending',
                    method: payType,
                    payeeAccount: confirmedPayeeAccount,
                    payeeAccountType: confirmedPayeeAccountType,
                    payeeName,
                    providerAppId,
                    remark: normalizedRemark || null,
                },
                tx,
            );

            if (!withdrawalRecord) {
                throw new BadRequestException('创建提现记录失败');
            }

            return {
                withdrawal: withdrawalRecord,
                balanceAfterFreeze: {
                    available: availableAfterFreeze,
                    frozen: frozenAfterFreeze,
                    total: totalAfterFreeze,
                },
            };
        });

        const response: UserWithdrawResponse = {
            withdrawalId: freezeContext.withdrawal.id,
            status: freezeContext.withdrawal.status,
            amount: amountDecimal.toNumber(),
            currency,
            payType,
            balance: {
                available: Number(
                    freezeContext.balanceAfterFreeze.available.toFixed(2),
                ),
                frozen: Number(
                    freezeContext.balanceAfterFreeze.frozen.toFixed(2),
                ),
                total: Number(
                    freezeContext.balanceAfterFreeze.total.toFixed(2),
                ),
            },
            providerRequestNo: freezeContext.withdrawal.id,
            providerState: freezeContext.withdrawal.providerState ?? null,
        };

        return response;
    }
}
