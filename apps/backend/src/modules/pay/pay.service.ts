import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import type { PayNotification } from "@repo/types";
import { and, eq, sql } from "drizzle-orm";
import { DB } from "src/common/database/database.provider";
import type { DbType } from "src/common/database/db";
import { orders, type payments, users } from "src/common/database/schema";
import { CACHE_SERVICE, type IAdvancedCacheService } from "src/common/cache";
import { createAliPaySdk } from "src/lib/alipaySdk";
import { OrderService } from "../order/order.service";
import { PayRepository } from "./pay.repository";

type PaymentInsert = typeof payments.$inferInsert;

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
	private alipaySdk = createAliPaySdk();

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

				const currentPayment =
					await this.payRepository.findLatestByOrderAndMethod(
						order.id,
						"alipay",
						tx,
					);

				if (!currentPayment) {
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

					await this.payRepository.createPayment(newPayment, tx);
				} else if (currentPayment.status !== "succeeded") {
					const updateData: Partial<Omit<PaymentInsert, "id" | "orderId">> = {
						status: mappedStatus,
						paidAt,
					};

					if (payInfo.trade_no) {
						updateData.transactionId = payInfo.trade_no;
					}

					await this.payRepository.updatePaymentById(
						currentPayment.id,
						updateData,
						tx,
					);
				}

				if (mappedStatus === "succeeded") {
					this.order.updateOrderStatus(latestOrder.id, "paid", {
						tx: tx,
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
}
