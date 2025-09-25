import { createSign } from "node:crypto";
import { BadRequestException, Inject, Injectable } from "@nestjs/common";
import { createId } from "@paralleldrive/cuid2";
import type { PayNotification } from "@repo/types";
import { AlipaySdk } from "alipay-sdk";
import Decimal from "decimal.js";
import { and, eq, sql } from "drizzle-orm";
import { CACHE_SERVICE, type IAdvancedCacheService } from "src/common/cache";
import { DB } from "src/common/database/database.provider";
import type { DbType } from "src/common/database/db";
import {
	earnings,
	financialTransactions,
	orderAssignments,
	orders,
	type payments,
	userBalances,
	users,
} from "src/common/database/schema";
import { createAliPaySdk } from "src/lib/alipaySdk";
import { uuidv4 } from "zod";
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

	// 用户提现(微信，支付宝)
	async withdraw() {
		// 用户是否存在
		// 检查用户余额是否有那么多钱
		// 用户是否绑定了提现的方式，如果没有客户端提示用户对提现平台进行绑定
        // 转账
        // 流水记录，记录用户提现记录

		const alipaySdk = new AlipaySdk({
			appId: "9021000153675106",
			privateKey:
				"MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCgQy3+QtBHZvoF3e2v9xjRyYt6GmRQJhTDPXBDHvQnIN1WrcdrGG0+/Zubh+TwhWiK0WXXEqSd240tnUEFzHPibj/HAXZnNQVWtuvSjCajZ4sBjy1+vtifM3ojJPq945yyJsQs1pVZ97nPAQm2Z0ELkCivrPMDk3CBd/Q/5jhNmiAbvS7sawD2Gv4K2BtBGWkjKJsjnmW0atyI7Ob5tPwzaem+P4C9/3X2w8mt6JnnmSX+9XI+H/sDBIVckCA3Rg7BIqveudHmXH/b3XWHc7guID5vvsNd3aQ5bjyi0Agrj/K0o2XE/TxVlqHeJl7cpCmL1RE//gm1L4BI8cUNenGrAgMBAAECggEABEPFZY7BnCTRYnaVbKlWr759R7KMGNXql4d7BU49kQz+1t+o/uCXh6WYDnt/TCdAsPEBlMeaOdkt2JjmshDOxKfKarFPRU/T5IrZm7C/Fnoa6N+2hjjt6s6j4WuKgKMd+F+vuMG9F7fP6gJND92PjY84hfREQ0QZKljW1xx5Qxdb2CDES+Lv0xxp3bMA9eb4Mtn0dWNSKtuPpVFE69L4m0ozeoNxlFVMPDkV1GFMdT0m0ZY5hRXMeFfyQmmk2EveudAasUq67yzu8RcdhXj4gkuE100920lPKdAlOG47bVGMjgMA2n0pcT7yp29M9EmCBW44coXE5kCdt+B6O5U1AQKBgQD8kk2T3XdKBYbKqJEYyRl9/wF6kx2slRN1UgZ9WRbDa6GDIFcHdtXAP8CafP4i/qVRz771IR+Q3YjQWwRkeYYjY71/HK6uQBcEbScmFFxAG6kiisUlk4Nz/lx7tPnF8Xu/cDA8J/C8CFdXinpVPtHISKat+wq/+52x6LBXcl3XCQKBgQCicBk7QY9adKdu9rM+OcV7UHXoS0AzhKppbyH5UfR4ctH541nH/ViZTuRZ1p8vfdqSm678oJ/kjCylZMoUtEAQG84zmVIm5IeFHfhGjlJ7HZ388sLXQRSLXmZyKmT1YBnL/g5Wmv3VFf9OFlIlRflhaxKECn8dr12Nt2tkyiqcEwKBgH91kaLKQ7XePhytnrOkYLH965AhB/udK7msEExXli4+db6HpoPEy6/+PEN6SoH8gg9cSKDJ+3UO50lGdVwDG9dmMS4hmmGjRDpen0APTFKp4tvkrgL9g3wY5DElrlrfN7Tvd9gTy+AIUZOC9aNpVVK+nybzpoQmBXnP1JX8yDCJAoGAGQ7t9YQxlySzx5xrHkhPPKy247ToHIp0t3sbZJjN+97KoZ/+86kTh+LxuyIuwGbL1x4JKpOk1t8A7CrWOcdsso93ieI3GCTc+x4adNfzxWZWPvU8NXSmtLFFYItFs8y1bhCtKZMTYVHZZrRuy601wV+BJblwzqWE6x3GhW/ijt0CgYA7SZ6EgjRqMYg0/w1zOQsNiig6pA6n14+S+ialgQfTtPDS62QO54oFV4s2di3Jy3iRnSDmZ9/JTcKFqb4+eYQpnrKngN1TrCPMPzscNZ3Ad/SWo2xZK04Xa3X6LTyIKkeh+5qeyXWg6f0I9eLc6Bi3g2M8wehB/Ay4FN86c+kdbg==",
			gateway: "https://openapi-sandbox.dl.alipaydev.com/gateway.do",
		});
		const result = await alipaySdk.exec("alipay.fund.trans.uni.transfer", {
			bizContent: {
				out_biz_no: "fghdftytry",
				trans_amount: "23.00",
				biz_scene: "DIRECT_TRANSFER",
				product_code: "TRANS_ACCOUNT_NO_PWD",
				payee_info: {
					identity: "2088722080157608",
					identity_type: "ALIPAY_USER_ID",
					bankcard_ext_info: {
						inst_name: "招商银行",
						account_type: "1",
					},
				},
			},
		});
		return result;
	}

	// 生成请求第三方平台授权登录时的校验信息
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
            sign_type: "RSA2"
		});
	}
}
