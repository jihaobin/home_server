import type {
	InitiatePaymentBody,
	InitiatePaymentResponse,
	QueryPaymentStatusResponse,
	UserWithdrawBody,
	UserWithdrawResponse,
	WorkerAlipayAuthorizeParamsResponse,
	WorkerAlipayAuthExchangeBody,
	WorkerAlipayAuthExchangeResponse,
	WorkerAlipayBindingStatus,
	WorkerAlipayUnbindResponse,
	WorkerEarningsRecordListResponse,
	WorkerEarningsRecordQuery,
} from "@repo/types";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseQuery,
	useInfiniteQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

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
 * 获取服务人员支付宝授权参数串
 */
export const useWorkerAlipayAuthorizeParams = (options?: {
	enabled?: boolean;
}) =>
	useQuery({
		queryKey: ["worker-alipay-authorize-params"],
		queryFn: async () => {
			const response =
				await apiClient.get<WorkerAlipayAuthorizeParamsResponse>(
					"/pay/worker/alipay/authorize-params",
				);
			return response.data;
		},
		enabled: options?.enabled ?? true,
	meta: {
		errorMessage: "获取支付宝授权参数失败",
	},
});

/**
 * 获取收益/提现记录
 */
export const useWorkerEarningsRecords = (
	params: WorkerEarningsRecordQuery = {},
	options?: { enabled?: boolean },
) =>
	useQuery({
		queryKey: ["worker-earnings-records", params],
		queryFn: async () => {
			const query: Record<string, string> = {
				page: String(params.page ?? 1),
				limit: String(params.limit ?? 20),
				category: params.category ?? "mixed",
			};
			if (params.withdrawalStatus) {
				query.withdrawalStatus = params.withdrawalStatus;
			}

			const response =
				await apiClient.get<WorkerEarningsRecordListResponse>(
					"/pay/earnings/records",
					{ query },
				);
			return response.data;
		},
		meta: {
			errorMessage: "收益流水获取失败",
	},
	enabled: options?.enabled ?? true,
});

export const useExchangeWorkerAlipayAuthCode = () =>
	useMutation({
		mutationFn: (payload: WorkerAlipayAuthExchangeBody) => {
			return apiClient.post<WorkerAlipayAuthExchangeResponse>(
				"/pay/worker/alipay/auth/exchange",
				payload,
			);
		},
		meta: {
			errorMessage: "上传支付宝授权信息失败",
		},
	});

export const useWorkerAlipayBindingStatus = (options?: { enabled?: boolean }) =>
	useQuery({
		queryKey: ["worker-alipay-binding-status"],
		queryFn: async () => {
			const response = await apiClient.get<WorkerAlipayBindingStatus>(
				"/pay/worker/alipay/binding",
			);
			return response.data;
		},
		meta: {
			errorMessage: "获取支付宝绑定状态失败",
		},
		enabled: options?.enabled ?? true,
	});

export const useUnbindWorkerAlipay = () =>
	useMutation({
		mutationFn: async () => {
			const response = await apiClient.delete<WorkerAlipayUnbindResponse>(
				"/pay/worker/alipay/binding",
			);
			return response.data;
		},
		meta: {
			errorMessage: "解绑失败，请稍后重试",
		},
	});

export const useInfiniteWorkerEarningsRecords = (
	params: WorkerEarningsRecordQuery = {},
	options?: { enabled?: boolean },
) =>
	useInfiniteQuery({
		queryKey: ["worker-earnings-records", "infinite", params],
		initialPageParam: 1,
		queryFn: async ({ pageParam }) => {
			const query: Record<string, string> = {
				page: String(pageParam ?? 1),
				limit: String(params.limit ?? 20),
				category: params.category ?? "mixed",
			};
			if (params.withdrawalStatus) {
				query.withdrawalStatus = params.withdrawalStatus;
			}

			const response =
				await apiClient.get<WorkerEarningsRecordListResponse>(
					"/pay/earnings/records",
					{ query },
				);
			return response.data;
		},
		getNextPageParam: (lastPage) =>
			lastPage.meta.hasNext ? lastPage.meta.page + 1 : undefined,
		meta: {
			errorMessage: "收益记录获取失败",
		},
		enabled: options?.enabled ?? true,
	});

/**
 * 提供提现记录的无限列表能力（内部强制 category = withdrawal）
 */
export const useWorkerWithdrawalRecords = (
	params: WorkerEarningsRecordQuery = {},
	options?: { enabled?: boolean },
) =>
	useInfiniteWorkerEarningsRecords(
		{
			...params,
			category: params.category ?? "withdrawal",
		},
		options,
	);

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
			queryClient.invalidateQueries({
				queryKey: ["worker-earnings-records"],
			});
			queryClient.invalidateQueries({
				queryKey: ["worker-earnings-records", "infinite"],
			});
			queryClient.invalidateQueries({ queryKey: ["earnings-overview"] });
		},
		scope: {
			id: "withdraw",
		},
	});
};
