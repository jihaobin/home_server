import type {
	InitiatePaymentBody,
	InitiatePaymentResponse,
	QueryPaymentStatusResponse,
	TransactionType,
	UserWithdrawBody,
	UserWithdrawResponse,
	ZodPaginationMeta,
} from "@repo/types";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

export type EarningsTransactionFilter = "all" | "income" | "withdrawal";

export interface EarningsOverview {
	balance: {
		available: number;
		frozen: number;
		total: number;
		currency: string;
	};
	monthlyEarnings: number;
	totalEarnings: number;
	updatedAt: string;
}

export interface EarningsTransactionItem {
	id: string;
	transactionType: TransactionType;
	type: Exclude<EarningsTransactionFilter, "all">;
	amount: number;
	currency: string;
	description: string | null;
	referenceId: string | null;
	createdAt: string;
	withdrawal?: {
		id: string;
		status: string;
	};
}

export interface EarningsTransactionListResponse {
	items: EarningsTransactionItem[];
	meta: ZodPaginationMeta;
}

export interface EarningsTransactionQuery {
	page?: number;
	limit?: number;
	type?: EarningsTransactionFilter;
}

/**
 * 获取支付宝授权登录所需的签名字符串
 */
export const useGetAuthSign = () =>
	useSuspenseQuery({
		queryKey: ["pay-auth-sign"],
		queryFn: async () => {
			const response = await apiClient.get<string>("/pay/getAuthSign");
			return response.data;
		},
		meta: {
			errorMessage: "获取授权签名失败",
		},
	});

/**
 * 获取收益概览数据
 */
export const useEarningsOverview = () =>
	useQuery({
		queryKey: ["earnings-overview"],
		queryFn: async () => {
			const response =
				await apiClient.get<EarningsOverview>("/pay/earnings/overview");
			return response.data;
		},
		meta: {
			errorMessage: "收益概览获取失败",
		},
	});

/**
 * 获取收益流水列表
 */
export const useEarningsTransactions = (
	params: EarningsTransactionQuery = {},
) =>
	useQuery({
		queryKey: ["earnings-transactions", params],
		queryFn: async () => {
			const response =
				await apiClient.get<EarningsTransactionListResponse>(
					"/pay/earnings/transactions",
					{
						query: {
							page: String(params.page ?? 1),
							limit: String(params.limit ?? 20),
							type:
								params.type && params.type !== "all"
									? params.type
									: undefined,
						},
					},
				);
			return response.data;
		},
		meta: {
			errorMessage: "收益流水获取失败",
		},
	});

/**
 * 发起订单支付
 * @description 校验订单状态与金额后，生成支付宝支付串返回给客户端
 */
export const useInitiatePayment = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			orderId,
			data,
		}: {
			orderId: string;
			data: InitiatePaymentBody;
		}) => {
			return apiClient.post<InitiatePaymentResponse>(
				`/pay/orders/${orderId}`,
				data,
			);
		},
		onSuccess: (_result, variables) => {
			// 支付发起后更新订单相关缓存
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
			queryClient.invalidateQueries({
				queryKey: ["order-detail", variables.orderId],
			});
		},
		scope: {
			id: "initiatePayment",
		},
	});
};

/**
 * 查询订单支付状态
 * @description 主动查询支付宝订单的支付状态,用于客户端收到不确定状态码(8000/6004)时确认支付结果
 */
export const useQueryPaymentStatus = (orderId: string) => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: () => {
			return apiClient.get<QueryPaymentStatusResponse>(`/pay/orders/${orderId}/payment-status`);
		},
		onSuccess: (result) => {
			// 查询成功后更新订单相关缓存
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
			queryClient.invalidateQueries({
				queryKey: ["order-detail", orderId],
			});

			// 如果支付成功,还需要更新用户余额等相关信息
			if (result.data.paymentStatus === "succeeded") {
				queryClient.invalidateQueries({ queryKey: ["user-balance"] });
			}
		},
		scope: {
			id: `queryPaymentStatus-${orderId}`,
		},
	});
};

/**
 * 用户提现
 * @description 校验余额并立即发起支付宝转账，成功后记录提现流水
 */
export const useWithdraw = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (data: UserWithdrawBody) => {
			return apiClient.post<UserWithdrawResponse>("/pay/withdraw", data);
		},
		onSuccess: () => {
			// 提现成功后需要更新用户余额相关缓存
			queryClient.invalidateQueries({ queryKey: ["user-balance"] });
			queryClient.invalidateQueries({ queryKey: ["withdrawal-history"] });
		},
		scope: {
			id: "withdraw",
		},
	});
};
