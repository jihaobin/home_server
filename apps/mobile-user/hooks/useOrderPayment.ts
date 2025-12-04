import { useCallback, useEffect, useMemo, useState } from "react";
import { useInitiatePayment } from "@repo/hooks/api/pay";
import { useQueryClient } from "@tanstack/react-query";
import { aliPay } from "@repo/lib/pay";
import { apiClient } from "@repo/lib/http-client";
import type { QueryPaymentStatusResponse } from "@repo/types";
import { toast } from "sonner-native";

type PaymentFlowResult = {
	success: boolean;
	paymentStatus: QueryPaymentStatusResponse["paymentStatus"];
	message?: string;
	clientResultCode?: string;
};

type PayOrderParams = {
	orderId: string;
	displayAmount: number;
    paymentExpiresAt?: Date | string | null;
};

type RetryConfig = {
	retries: number;
	interval: number;
	loadingMessage: string;
	pendingMessage?: string;
	errorMessage?: string;
};

const FALLBACK_CONFIG: RetryConfig = {
	retries: 3,
	interval: 2000,
	loadingMessage: "正在确认支付状态...",
	pendingMessage: "支付结果确认中，请稍后查看订单状态",
	errorMessage: "支付失败，请稍后重试",
};

const RESULT_STATUS_CONFIG: Record<string, RetryConfig> = {
	"9000": {
		retries: 3,
		interval: 1500,
		loadingMessage: "支付成功，正在确认结果...",
		pendingMessage: "支付结果确认中，请稍后查看订单状态",
		errorMessage: "支付结果确认失败，请稍后重试",
	},
	"8000": {
		retries: 10,
		interval: 3000,
		loadingMessage: "支付结果确认中...",
		pendingMessage: "支付结果确认中，请稍后查看订单状态",
		errorMessage: "支付结果尚未确认，请稍后重试",
	},
	"6004": {
		retries: 10,
		interval: 3000,
		loadingMessage: "支付结果确认中...",
		pendingMessage: "支付结果确认中，请稍后查看订单状态",
		errorMessage: "支付结果尚未确认，请稍后重试",
	},
	"6001": {
		retries: 1,
		interval: 1500,
		loadingMessage: "正在确认订单状态...",
		pendingMessage: "您已取消支付，可稍后在订单列表继续支付",
		errorMessage: "您已取消支付",
	},
	"6002": {
		retries: 5,
		interval: 2000,
		loadingMessage: "网络异常，正在确认支付状态...",
		pendingMessage: "网络波动，稍后请在订单列表查看支付结果",
		errorMessage: "网络异常，请稍后查看支付结果",
	},
	"4000": {
		retries: 3,
		interval: 2000,
		loadingMessage: "支付失败，正在确认状态...",
		pendingMessage: "支付状态确认中，请稍后查看",
		errorMessage: "支付失败，请稍后重试",
	},
	"5000": {
		retries: 3,
		interval: 2000,
		loadingMessage: "正在确认支付重复请求结果...",
		pendingMessage: "支付状态确认中，请稍后查看",
		errorMessage: "支付请求重复或失败，请稍后重试",
	},
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const resolveErrorMessage = (error: unknown) => {
	if (error instanceof Error) {
		return error.message;
	}
	if (typeof error === "string") {
		return error;
	}
	return "操作失败，请稍后重试";
};

type PollResult = {
	success: boolean;
	paymentStatus: QueryPaymentStatusResponse["paymentStatus"];
	message?: string;
};

const isPaymentExpired = (value?: Date | string | null) => {
	if (!value) {
		return false;
	}
	const expiresAt = typeof value === "string" ? new Date(value) : value;
	const timestamp = expiresAt.getTime();
	if (Number.isNaN(timestamp)) {
		return false;
	}
	return timestamp <= Date.now();
};

export function useOrderPayment() {
	const initiatePayment = useInitiatePayment();
	const queryClient = useQueryClient();
	const [isPaying, setIsPaying] = useState(false);

	const mergeConfig = useMemo(() => {
		return (code?: string | null): RetryConfig => ({
			...FALLBACK_CONFIG,
			...(code ? RESULT_STATUS_CONFIG[code] ?? {} : {}),
		});
	}, []);

	const pollPaymentStatus = useCallback(
		async (
			orderId: string,
			config: RetryConfig,
		): Promise<PollResult> => {
			let lastSnapshot: QueryPaymentStatusResponse | null = null;

			for (let attempt = 0; attempt < config.retries; attempt++) {
				if (attempt > 0) {
					await delay(config.interval);
				}

				try {
					const response = await apiClient.get<QueryPaymentStatusResponse>(
						`/pay/orders/${orderId}/payment-status`,
					);

					lastSnapshot = response.data;

					if (response.data.paymentStatus !== "pending") {
						return {
							success: response.data.paymentStatus === "succeeded",
							paymentStatus: response.data.paymentStatus,
							message: response.data.message,
						};
					}
				} catch (error) {
					lastSnapshot = lastSnapshot ?? null;
				}
			}

			return {
				success: false,
				paymentStatus: lastSnapshot?.paymentStatus ?? "pending",
				message: lastSnapshot?.message,
			};
		},
		[],
	);

	const invalidateOrderCaches = useCallback(
		(orderId: string) => {
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
			queryClient.invalidateQueries({ queryKey: ["orders-list-infinite"] });
			queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] });
		},
		[queryClient],
	);

	const payOrder = useCallback(
		async ({ orderId, displayAmount, paymentExpiresAt }: PayOrderParams): Promise<PaymentFlowResult> => {
			if (!orderId) {
				toast.error("订单信息缺失，请稍后重试");
				return {
					success: false,
					paymentStatus: "pending",
					message: "订单信息缺失",
				};
			}

			const amount = Number(displayAmount);
			if (!Number.isFinite(amount) || amount <= 0) {
				toast.error("订单金额异常，请稍后重试");
				return {
					success: false,
					paymentStatus: "pending",
					message: "订单金额异常",
				};
			}

			if (isPaymentExpired(paymentExpiresAt)) {
				toast.error("订单支付已超时，请重新下单");
				return {
					success: false,
					paymentStatus: "pending",
					message: "支付已超时",
				};
			}

			if (isPaying) {
				return {
					success: false,
					paymentStatus: "pending",
					message: "支付处理中，请稍候",
				};
			}

			setIsPaying(true);

			try {
				toast.dismiss();
				toast.loading("正在创建支付请求...");

				const paymentResponse = await initiatePayment.mutateAsync({
					orderId,
					data: {
						payType: "alipay",
						displayAmount: amount,
					},
				});

				toast.dismiss();
				toast.loading("等待支付宝支付结果...");

				const alipayResult = await aliPay(paymentResponse.data.orderString);
				toast.dismiss();

				const resultStatus = alipayResult?.resultStatus ?? "unknown";
				const config = mergeConfig(resultStatus);

				toast.loading(config.loadingMessage);
				const pollResult = await pollPaymentStatus(orderId, config);
				toast.dismiss();

				if (pollResult.success) {
					toast.success("支付成功");
				} else if (pollResult.paymentStatus === "pending") {
					toast.info(
						config.pendingMessage ??
							pollResult.message ??
							"支付结果确认中，请稍后查看订单状态",
					);
				} else {
					toast.error(
						pollResult.message ??
							config.errorMessage ??
							"支付失败，请稍后重试",
					);
				}

				return {
					success: pollResult.success,
					paymentStatus: pollResult.paymentStatus,
					message: pollResult.message ?? config.errorMessage,
					clientResultCode: resultStatus,
				};
			} catch (error) {
				toast.dismiss();
				const message = resolveErrorMessage(error);
				toast.error(message);
				return {
					success: false,
					paymentStatus: "pending",
					message,
				};
			} finally {
				invalidateOrderCaches(orderId);
				setIsPaying(false);
			}
		},
		[initiatePayment, invalidateOrderCaches, isPaying, mergeConfig, pollPaymentStatus],
	);

	useEffect(() => {
		return () => {
			toast.dismiss();
		};
	}, []);

	return {
		payOrder,
		isPaying,
	};
}
