import type {
	CreateDesignatedOrder,
	GenerateOrderCheckinDto,
	OrderDetail,
	OrderListRequest,
	OrderListResponse,
	VerifyOrderCheckinDto,
} from "@repo/types";
import {
	useMutation,
	useQuery,
	useQueryClient,
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@/lib/http-client";

/**
 * 获取订单列表 - Suspense版本
 */
export const useOrdersList = (params: OrderListRequest) =>
	useSuspenseQuery({
		queryKey: ["orders-list", params],
		queryFn: async () => {
			const response = await apiClient.get<OrderListResponse>("/order", {
				query: {
					...params,
					page: params.page?.toString(),
					limit: params.limit?.toString(),
					startTime: params.startTime
						? params.startTime.toISOString()
						: undefined,
					endTime: params.endTime ? params.endTime.toISOString() : undefined,
				},
			});
			return response.data;
		},
		meta: {
			errorMessage: "订单列表获取失败",
		},
	});

/**
 * 获取订单详情 - Suspense版本
 */
export const useOrderDetail = (orderId: string) =>
	useSuspenseQuery({
		queryKey: ["order-detail", orderId],
		queryFn: async () => {
			const response = await apiClient.get<OrderDetail>(`/order/${orderId}`);
			return response.data;
		},
		meta: {
			errorMessage: "订单详情获取失败",
		},
	});

/**
 * 生成订单核验二维码 - Query
 */
export const useOrderCheckin = (orderId: string) =>
	useQuery({
		queryKey: ["order-checkin", orderId],
		queryFn: async () => {
			const response = await apiClient.get<GenerateOrderCheckinDto>(
				`/order/${orderId}/check-in`,
			);
			return response.data;
		},
		meta: {
			errorMessage: "订单核验二维码获取失败",
		},
	});

/**
 * 创建指定服务人员订单 - Mutation
 */
export const useCreateDesignatedOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (orderData: CreateDesignatedOrder) => {
			return apiClient.post<OrderDetail>(
				"/order/createWithDesignatedPersonnel",
				orderData,
			);
		},
		onSuccess: () => {
			// 创建订单后，可能需要更新相关列表缓存
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
		},
		scope: {
			id: "createDesignatedOrder",
		},
	});
};

/**
 * 核验订单到场 - Mutation
 */
export const useVerifyCheckIn = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (verifyData: VerifyOrderCheckinDto) => {
			return apiClient.post("/order/check-in/verify", verifyData);
		},
		onSuccess: () => {
			// 核验成功后可能需要更新订单详情
			queryClient.invalidateQueries({ queryKey: ["order-detail"] });
		},
		scope: {
			id: "verifyCheckIn",
		},
	});
};

/**
 * 取消订单 - Mutation
 */
export const useCancelOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({ orderId, reason }: { orderId: string; reason?: string }) => {
			return apiClient.post(`/order/${orderId}/cancel`, { reason });
		},
		onSuccess: () => {
			// 取消订单后更新订单列表和详情
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
			queryClient.invalidateQueries({ queryKey: ["order-detail"] });
		},
		scope: {
			id: "cancelOrder",
		},
	});
};

/**
 * 完成订单 - Mutation
 */
export const useCompleteOrder = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (orderId: string) => {
			return apiClient.post(`/order/${orderId}/complete`);
		},
		onSuccess: () => {
			// 完成订单后更新订单列表和详情
			queryClient.invalidateQueries({ queryKey: ["orders-list"] });
			queryClient.invalidateQueries({ queryKey: ["order-detail"] });
		},
		scope: {
			id: "completeOrder",
		},
	});
};

/**
 * 分页获取订单列表 - 无限查询版本
 */
export const useOrdersListInfinite = (
	params: Omit<OrderListRequest, "page" | "limit">,
) =>
	useSuspenseInfiniteQuery({
		queryKey: ["orders-list-infinite", params],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await apiClient.get<OrderListResponse>("/order", {
				query: {
					...params,
					page: pageParam.toString(),
					limit: "10", // 默认每页10条
					startTime: params.startTime
						? params.startTime.toISOString()
						: undefined,
					endTime: params.endTime ? params.endTime.toISOString() : undefined,
				},
			});
			return {
				data: response.data.items,
				meta: response.data.meta,
				nextCursor: response.data.meta.hasNext ? pageParam + 1 : undefined,
			};
		},
		getNextPageParam: (lastPage) => {
			return lastPage.nextCursor;
		},
		initialPageParam: 1,
		meta: {
			errorMessage: "订单列表获取失败",
		},
	});
