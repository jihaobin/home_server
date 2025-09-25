import { createSign } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import {
	alipayWithdrawResponseSchema,
	alipayWithdrawSuccessResponseSchema,
	type PayNotification,
	type UserWithdrawBody,
	type UserWithdrawResponse,
} from "@repo/types";
import Decimal from "decimal.js";
import { eq, sql } from "drizzle-orm";
import { CACHE_SERVICE, IAdvancedCacheService } from "src/common/cache";
import { DB } from "src/common/database/database.provider";
import { DbType } from "src/common/database/db";
import {
	earnings,
	financialTransactions,
	orderAssignments,
	orders,
	payments,
	userBalances,
	users,
} from "src/common/database/schema";
import { createAliPaySdk } from "src/lib/alipaySdk";
import { OrderService } from "../order/order.service";
import { PayRepository } from "./pay.repository";

type PaymentInsert = typeof payments.$inferInsert;

type PaymentRecord = typeof payments.$inferSelect;
type OrderRecord = typeof orders.$inferSelect;

type PaymentStatus = (typeof payments.status.enumValues)[number];

type TradeStatus = PayNotification["trade_status"];

const TRADE_STATUS_TO_PAYMENT_STATUS: Record<TradeStatus, PaymentStatus> = {
	WAIT_BUYER_PAY: "pending",
	TRADE_SUCCESS: "succeeded",
	TRADE_FINISHED: "succeeded",
	TRADE_CLOSED: "failed",
};

function parseAlipayTime(value?: string) {
	if (!value) {
		return undefined;
	}

	return new Date(`${value.replace(" ", "T")}+08:00`);
}

@Injectable()
export class PayService {
	// 实例化客户端
	private alipaySdk = createAliPaySdk(true);

	@Inject(DB)
	private db: DbType;

	@Inject(OrderService)
	private order: OrderService;

	@Inject(PayRepository)
	private payRepository: PayRepository;

	@Inject(CACHE_SERVICE)
	private cacheService: IAdvancedCacheService;

	private readonly paymentLockTtl = 30; // 秒

	private getPaymentLockKey(orderId: string) {
		return `lock:payment:order:${orderId}`;
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
		signType = "RSA2",
		scope = "kuaijie",
		authType = "AUTHACCOUNT",
		appName = "mc",
		productId = "APP_FAST_LOGIN",
		method = "alipay.open.auth.sdk.code.get",
		apiname = "com.alipay.account.auth",
		bizType = "openservice",
		extraParams = {},
		encodeValues = false,
		encodeSign = true,
		privateKey,
	}: {
		appId: string;
		pid: string;
		targetId: string;
		signType?: "RSA2" | "RSA";
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
		privateKey?: string;
	}): string {
		if (!appId?.trim()) {
			throw new BadRequestException("支付宝应用 ID 缺失");
		}

		if (!pid?.trim()) {
			throw new BadRequestException("支付宝 PID 缺失");
		}

		if (!targetId?.trim()) {
			throw new BadRequestException("授权请求 target_id 缺失");
		}

		const encodeValue = (key: string, value: string) => {
			if (key === "sign") {
				return encodeSign ? encodeURIComponent(value) : value;
			}

			return encodeValues ? encodeURIComponent(value) : value;
		};

		const normalizedSignType: "RSA2" | "RSA" =
			signType === "RSA" ? "RSA" : "RSA2";

		const baseEntries: Array<[string, string]> = [
			["apiname", apiname],
			["app_id", appId],
			["app_name", appName],
			["auth_type", authType],
			["biz_type", bizType],
			["method", method],
			["pid", pid],
			["product_id", productId],
			["scope", scope],
			["sign_type", normalizedSignType],
			["target_id", targetId],
		];

		const extraEntries = Object.entries(extraParams ?? {})
			.filter(
				([, value]) =>
					value !== undefined && value !== null && String(value).length > 0,
			)
			.map(([key, value]) => [key, String(value)] as [string, string])
			.sort(([a], [b]) => a.localeCompare(b));

		const signingEntries = [...baseEntries, ...extraEntries];

		const unsignedText = signingEntries
			.map(([key, value]) => `${key}=${value}`)
			.join("&");

		const sdkPrivateKey = (
			this.alipaySdk as unknown as { config?: { privateKey?: string } }
		)?.config?.privateKey;

		const rawPrivateKey = (
			privateKey ??
			sdkPrivateKey ??
			process.env.ALIPAY_PRIVATE_KEY ??
			""
		).trim();

		if (!rawPrivateKey) {
			throw new BadRequestException("支付宝私钥缺失");
		}

		const normalizedPrivateKey = rawPrivateKey
			.split("\n")
			.join(String.fromCharCode(10))
			.replace(/\r/g, "");

		const algorithm = normalizedSignType === "RSA2" ? "RSA-SHA256" : "RSA-SHA1";

		const signer = createSign(algorithm);

		signer.update(unsignedText, "utf8");

		const sign = signer.sign(normalizedPrivateKey, "base64");

		const pairs = signingEntries.map(([key, value]) => {
			return `${key}=${encodeValue(key, value)}`;
		});

		pairs.push(`sign=${encodeValue("sign", sign)}`);

		return pairs.join("&");
	}

	async pay({
		displayAmount,
		payType,
		orderId,
		userId,
	}: {
		displayAmount: number;
		payType: "wechat_pay" | "alipay" | "bank_transfer";
		orderId: string;
		userId: string;
	}) {
		if (!userId) {
			throw new BadRequestException("用户信息缺失");
		}

		const userExists = await this.isUserExist(userId);
		if (!userExists) {
			throw new BadRequestException("用户不存在");
		}

		const orderInfo = await this.order.getOrderById(orderId, userId);
		let payableAmount = Number(orderInfo.totalAmount);

		if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
			throw new BadRequestException("订单金额异常，无法发起支付");
		}

		if (
			displayAmount !== undefined &&
			Math.abs(displayAmount - payableAmount) > 0.01
		) {
			throw new BadRequestException("显示金额与应付金额不一致");
		}

		if (orderInfo.status !== "pending_payment") {
			throw new BadRequestException("当前状态不支持发起支付");
		}

		if (payType !== "alipay") {
			throw new BadRequestException("当前暂不支持该支付方式");
		}

		const lockKey = this.getPaymentLockKey(orderInfo.id);
		let lockId: string | null = null;

		try {
			lockId = await this.cacheService.acquireLock(
				lockKey,
				this.paymentLockTtl,
				10,
				200,
			);
			if (!lockId) {
				throw new BadRequestException("系统繁忙，请稍后重试");
			}

			const paymentRecord = await this.db.transaction(async (tx) => {
				const currentOrder = await tx.query.orders.findFirst({
					where: eq(orders.id, orderId),
				});

				if (!currentOrder) {
					throw new BadRequestException("订单不存在");
				}

				if (currentOrder.status !== "pending_payment") {
					throw new BadRequestException("当前状态不支持发起支付");
				}

				payableAmount = Number(currentOrder.totalAmount);
				if (!Number.isFinite(payableAmount) || payableAmount <= 0) {
					throw new BadRequestException("订单金额异常，无法发起支付");
				}

				if (
					displayAmount !== undefined &&
					Math.abs(displayAmount - payableAmount) > 0.01
				) {
					throw new BadRequestException("显示金额与应付金额不一致");
				}

				const existingPayments = await this.payRepository.findByOrderId(
					orderId,
					tx,
				);

				if (
					existingPayments.some((payment) => payment.status === "succeeded")
				) {
					throw new BadRequestException("该订单已完成支付");
				}

				let paymentRecord = existingPayments.find(
					(payment) =>
						payment.status === "pending" && payment.paymentMethod === payType,
				);

				if (!paymentRecord) {
					paymentRecord = await this.payRepository.createPayment(
						{
							orderId,
							amount: currentOrder.totalAmount,
							currency: currentOrder.currency ?? "CNY",
							paymentMethod: payType,
							status: "pending",
						},
						tx,
					);

					if (!paymentRecord) {
						throw new BadRequestException("创建支付记录失败");
					}
				}

				return paymentRecord;
			});

			const outTradeNo = orderInfo.orderSerial ?? orderInfo.id;
			const orderSubject =
				orderInfo.service?.name ??
				`订单支付-${orderInfo.orderSerial ?? orderInfo.id}`;
			const orderBody = orderInfo.service?.description ?? "";

			const orderString = this.alipaySdk.sdkExecute("alipay.trade.app.pay", {
				bizContent: {
					out_trade_no: outTradeNo,
					total_amount: payableAmount.toFixed(2),
					subject: orderSubject,
					product_code: "QUICK_MSECURITY_PAY",
					body: orderBody,
				},
				notify_url: process.env.ALIPAY_NOTIFY_URL,
			});

			return {
				paymentId: paymentRecord.id,
				orderString,
				payType,
				outTradeNo,
				amount: payableAmount,
				currency: orderInfo.currency ?? "CNY",
			};
		} finally {
			if (lockId) {
				await this.cacheService.releaseLock(lockKey, lockId).catch((error) => {
					console.warn(
						`[PayService] release payment lock failed: ${lockKey}`,
						error instanceof Error ? error.message : error,
					);
				});
			}
		}
	}

	async payNotify(payInfo: PayNotification) {
		const signatureValid = this.alipaySdk.checkNotifySign(payInfo);
		if (!signatureValid) {
			return "fail";
		}

		const order = await this.db.query.orders.findFirst({
			where: eq(orders.orderSerial, payInfo.out_trade_no),
		});

		if (!order) {
			return "fail";
		}

		const mappedStatus = TRADE_STATUS_TO_PAYMENT_STATUS[payInfo.trade_status];
		if (!mappedStatus) {
			return "success";
		}

		const lockKey = this.getPaymentLockKey(order.id);
		let lockId: string | null = null;

		try {
			lockId = await this.cacheService.acquireLock(
				lockKey,
				this.paymentLockTtl,
				15,
				200,
			);
			if (!lockId) {
				return "fail";
			}

			const paidAt =
				mappedStatus === "succeeded"
					? parseAlipayTime(payInfo.gmt_payment || payInfo.notify_time)
					: undefined;

			await this.db.transaction(async (tx) => {
				const latestOrder = await tx.query.orders.findFirst({
					where: eq(orders.id, order.id),
				});

				if (!latestOrder) {
					return;
				}

				let paymentRecord = await this.payRepository.findLatestByOrderAndMethod(
					order.id,
					"alipay",
					tx,
				);

				if (!paymentRecord) {
					const newPayment: PaymentInsert = {
						orderId: order.id,
						amount: latestOrder.totalAmount,
						currency: latestOrder.currency ?? "CNY",
						paymentMethod: "alipay",
						status: mappedStatus,
						paidAt,
					};

					if (payInfo.trade_no) {
						newPayment.transactionId = payInfo.trade_no;
					}

					paymentRecord = await this.payRepository.createPayment(
						newPayment,
						tx,
					);
				} else if (paymentRecord.status !== "succeeded") {
					const updateData: Partial<Omit<PaymentInsert, "id" | "orderId">> = {
						status: mappedStatus,
						paidAt,
					};

					if (payInfo.trade_no) {
						updateData.transactionId = payInfo.trade_no;
					}

					paymentRecord = await this.payRepository.updatePaymentById(
						paymentRecord.id,
						updateData,
						tx,
					);
				}

				if (mappedStatus === "succeeded") {
					// 支付成功后进入结算与分成流程
					let orderForSettlement: OrderRecord = latestOrder;
					try {
						const updatedOrder = await this.order.updateOrderStatus(
							latestOrder.id,
							"paid",
							{
								tx: tx,
							},
						);
						if (updatedOrder) {
							orderForSettlement = updatedOrder;
						}
					} catch (error) {
						console.warn(
							`[PayService] 支付回调更新订单状态失败: ${latestOrder.id}`,
							error instanceof Error ? error.message : error,
						);
					}

					// 再次查询以防并发导致支付记录落后
					const finalPaymentRecord =
						paymentRecord ??
						(await this.payRepository.findLatestByOrderAndMethod(
							order.id,
							"alipay",
							tx,
						));

					await this.processServiceRevenue({
						tx,
						order: orderForSettlement,
						payment: finalPaymentRecord,
						tradeNo: payInfo.trade_no,
					});
				}
			});

			return "success";
		} catch (error) {
			console.warn(
				"[PayService] 支付回调处理失败",
				error instanceof Error ? error.message : error,
			);
			return "fail";
		} finally {
			if (lockId) {
				await this.cacheService
					.releaseLock(lockKey, lockId)
					.catch((releaseError) => {
						console.warn(
							`[PayService] release payment lock failed: ${lockKey}`,
							releaseError instanceof Error
								? releaseError.message
								: releaseError,
						);
					});
			}
		}
	}

	// 集中处理服务人员收益入账，需保证幂等与精确计算
	private async processServiceRevenue({
		tx,
		order,
		payment,
		tradeNo,
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
			console.warn(
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
		const platformShareDecimal = totalAmountDecimal
			.minus(serviceShareDecimal)
			.toDecimalPlaces(2, Decimal.ROUND_HALF_UP);

		const serviceShare = serviceShareDecimal.toFixed(2);
		const platformShare = platformShareDecimal.toFixed(2);
		const currency = order.currency ?? "CNY";

		// 使用数据库原子 upsert 累加余额，避免并发竞争
		const [balanceRow] = await tx
			.insert(userBalances)
			.values({
				userId: servicePersonnelId,
				availableBalance: serviceShare,
				frozenBalance: "0",
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

		const balanceAfterDecimal = new Decimal(balanceRow.availableBalance ?? "0");
		const balanceBeforeDecimal = Decimal.max(
			balanceAfterDecimal.minus(serviceShareDecimal),
			new Decimal(0),
		);

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

		// 在流水元数据中记录拆分详情，方便后续审计
		const metadata = JSON.stringify({
			orderId: order.id,
			orderSerial: order.orderSerial,
			totalAmount: totalAmountDecimal.toFixed(2),
			serviceShare,
			platformFee: platformShare,
			rate: {
				service: 0.8,
				platform: 0.2,
			},
		});

		const transactionValues: typeof financialTransactions.$inferInsert = {
			orderId: order.id,
			paymentId: payment?.id ?? null,
			earningId: earningRecord.id,
			userId: servicePersonnelId,
			transactionType: "service_earning",
			amount: serviceShare,
			currency,
			balanceBefore: balanceBeforeDecimal.toFixed(2),
			balanceAfter: balanceAfterDecimal.toFixed(2),
			description: `订单${order.orderSerial ?? order.id}服务人员收益入账`,
			metadata,
		};

		if (tradeNo) {
			transactionValues.referenceId = tradeNo;
		}

		const [transactionRecord] = await tx
			.insert(financialTransactions)
			.values(transactionValues)
			.returning();

		if (transactionRecord) {
			await tx
				.update(userBalances)
				.set({ lastTransactionId: transactionRecord.id })
				.where(eq(userBalances.id, balanceRow.id));
		}
	}

	// 用户提现（当前仅支持支付宝）
	async withdraw(
		userId: string,
		payload: UserWithdrawBody,
	): Promise<UserWithdrawResponse> {
		if (!userId) {
			throw new BadRequestException("用户信息缺失");
		}

		const userExists = await this.isUserExist(userId);
		if (!userExists) {
			throw new BadRequestException("用户不存在");
		}

		const { amount, currency, payType, payee, remark } = payload;
		if (payType !== "alipay") {
			throw new BadRequestException("当前仅支持支付宝提现");
		}

		const amountDecimal = new Decimal(amount).toDecimalPlaces(
			2,
			Decimal.ROUND_HALF_UP,
		);
		const amountText = amountDecimal.toFixed(2);

		// 1. 在数据库中冻结余额并创建提现记录
		const freezeContext = await this.db.transaction(async (tx) => {
			const balanceRecord = await this.payRepository.findUserBalanceByUserId(
				userId,
				tx,
			);

			if (!balanceRecord) {
				throw new BadRequestException("账户余额不存在或未初始化");
			}

			const availableBefore = new Decimal(
				balanceRecord.availableBalance ?? "0",
			);
			const frozenBefore = new Decimal(balanceRecord.frozenBalance ?? "0");
			const totalBefore = new Decimal(balanceRecord.totalBalance ?? "0");

			if (availableBefore.lt(amountDecimal)) {
				throw new BadRequestException("可用余额不足");
			}

			// 使用 Decimal 避免浮点运算误差
			const availableAfterFreeze = availableBefore.minus(amountDecimal);
			const frozenAfterFreeze = frozenBefore.plus(amountDecimal);
			const totalAfterFreeze = availableAfterFreeze.plus(frozenAfterFreeze);

			const updatedBalance = await this.payRepository.updateUserBalanceById(
				balanceRecord.id,
				{
					availableBalance: availableAfterFreeze.toFixed(2),
					frozenBalance: frozenAfterFreeze.toFixed(2),
					totalBalance: totalAfterFreeze.toFixed(2),
				},
				tx,
			);

			if (!updatedBalance) {
				throw new BadRequestException("余额更新失败");
			}

			const withdrawalRecord = await this.payRepository.createWithdrawal(
				{
					userId,
					amount: amountText,
					currency,
					status: "pending",
				},
				tx,
			);

			if (!withdrawalRecord) {
				throw new BadRequestException("创建提现记录失败");
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
			biz_scene: "DIRECT_TRANSFER",
			product_code: "TRANS_ACCOUNT_NO_PWD",
			order_title: "用户余额提现",
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
				"alipay.fund.trans.uni.transfer",
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
			throw new BadRequestException("提现请求失败，请稍后重试");
		}

		const parsedResponse =
			alipayWithdrawResponseSchema.parse(alipayResponseRaw);
		const successResult =
			alipayWithdrawSuccessResponseSchema.safeParse(parsedResponse);

		if (
			!successResult.success ||
			(successResult.data.status && successResult.data.status === "FAIL")
		) {
			const errorMessage =
				"sub_msg" in parsedResponse && parsedResponse.sub_msg
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
				freezeContext.balanceAfterFreeze.available.plus(frozenAfterSuccess);

			const balanceRecord = await this.payRepository.updateUserBalanceById(
				freezeContext.balanceId,
				{
					availableBalance:
						freezeContext.balanceAfterFreeze.available.toFixed(2),
					frozenBalance: frozenAfterSuccess.toFixed(2),
					totalBalance: totalAfterSuccess.toFixed(2),
				},
				tx,
			);

			if (!balanceRecord) {
				throw new BadRequestException("更新余额失败");
			}

			const withdrawalRecord = await this.payRepository.updateWithdrawalById(
				freezeContext.withdrawal.id,
				{
					status: "completed",
					processedAt,
				},
				tx,
			);

			if (!withdrawalRecord) {
				throw new BadRequestException("更新提现状态失败");
			}

			await this.payRepository.createFinancialTransaction(
				{
					userId,
					withdrawalId: freezeContext.withdrawal.id,
					transactionType: "withdrawal",
					amount: amountDecimal.negated().toFixed(2),
					currency,
					balanceBefore: freezeContext.balanceBefore.available.toFixed(2),
					balanceAfter: freezeContext.balanceAfterFreeze.available.toFixed(2),
					description: `提现至支付宝账号 ${payee.identity}`.slice(0, 120),
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
			status: withdrawalRecord.status as UserWithdrawResponse["status"],
			amount: amountDecimal.toNumber(),
			currency,
			balance: {
				available: Number(balanceRecord.availableBalance ?? "0"),
				frozen: Number(balanceRecord.frozenBalance ?? "0"),
				total: Number(balanceRecord.totalBalance ?? "0"),
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
					status: "rejected",
					processedAt: new Date(),
				},
				tx,
			);
		});
	}

	async generateAuthString() {
		const targetId = createId();
		return this.alipaySdk.sdkExecute("alipay.open.auth.sdk.code.get", {
			apiname: "com.alipay.account.auth",
			appId: process.env.ALIPAY_APP_ID!,
			pid: "2088721080157591",
			targetId,
			app_name: "mc",
			biz_type: "openservice",
			product_id: "kuaijie",
			auth_type: "AUTHACCOUNT",
			sign_type: "RSA2",
		});
	}
}
