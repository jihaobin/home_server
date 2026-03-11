import type {
    CreateDesignatedOrder,
    CreateDesignatedOrderResponse,
    GenerateOrderCheckinDto,
    OrderConfirmDesignatedPreviewQuery,
    OrderConfirmDesignatedPreviewResponse,
    OrderDetail,
    OrderListRequest,
    OrderListResponse,
    OrderCardsListResponse,
    OrderCardsTab,
    OrderStatus,
    StaffOrderListRequest,
    StaffOrderListResponse,
    VerifyOrderCheckinDto,
} from "@repo/types";
import {
    useInfiniteQuery,
    useMutation,
    useQuery,
    useQueryClient,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

type StaffOrdersListParams = Omit<StaffOrderListRequest, "servicePersonnelId">;

const normalizePaginationParams = ({
    page,
    limit,
    startTime,
    endTime,
    ...rest
}: {
    page?: number;
    limit?: number;
    startTime?: Date;
    endTime?: Date;
    [key: string]: unknown;
}) => ({
    ...rest,
    page: page ? page.toString() : undefined,
    limit: limit ? limit.toString() : undefined,
    startTime: startTime ? startTime.toISOString() : undefined,
    endTime: endTime ? endTime.toISOString() : undefined,
});

const normalizeConfirmPreviewParams = (
    params: OrderConfirmDesignatedPreviewQuery,
): Record<string, string | undefined> => ({
    personnelId: params.personnelId,
    serviceId: params.serviceId,
    specificationId: params.specificationId,
    addressId: params.addressId,
    appointmentTime: params.appointmentTime,
    couponCode: params.couponCode,
});

/**
 * 获取订单列表 - Suspense 版本
 */
export const useOrdersList = (params: OrderListRequest) =>
    useSuspenseQuery({
        queryKey: ["orders-list", params],
        queryFn: async () => {
            const response = await apiClient.get<OrderListResponse>("/order", {
                query: normalizePaginationParams(params),
            });
            return response.data;
        },
        meta: {
            errorMessage: "订单列表获取失败",
        },
    });

/**
 * 服务人员订单列表 - Suspense 版本
 */
export const useStaffOrdersList = (params: StaffOrdersListParams) =>
    useSuspenseQuery({
        queryKey: ["staff-orders-list", params],
        queryFn: async () => {
            const response = await apiClient.get<StaffOrderListResponse>(
                "/order/assignments/me",
                {
                    query: normalizePaginationParams(params),
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "服务人员订单获取失败",
        },
    });

/**
 * 获取订单详情 - Suspense 版本
 */
export const useOrderDetail = (orderId: string) =>
    useSuspenseQuery({
        queryKey: ["order-detail", orderId],
        queryFn: async () => {
            const response = await apiClient.get<OrderDetail>(
                `/order/${orderId}`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "订单详情获取失败",
        },
    });

export const useOrderDetailQuery = (
    orderId: string,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: ["order-detail", orderId],
        queryFn: async () => {
            const response = await apiClient.get<OrderDetail>(
                `/order/${orderId}`,
            );
            return response.data;
        },
        enabled: (options.enabled ?? true) && Boolean(orderId),
        meta: {
            errorMessage: "订单详情获取失败",
        },
    });

/**
 * 获取订单核验二维码
 */
export const useOrderCheckin = (orderId: string, orderStatus?: OrderStatus) =>
    useQuery({
        queryKey: ["order-checkin", orderId],
        queryFn: async () => {
            const response = await apiClient.get<GenerateOrderCheckinDto>(
                `/order/${orderId}/check-in`,
            );
            return response.data;
        },
        enabled:
            Boolean(orderId) &&
            (orderStatus === "paid" || orderStatus === "in_progress"),
        meta: {
            errorMessage: "订单核验码获取失败",
        },
    });

/**
 * 创建指定服务人员的订单
 */
export const useCreateDesignatedOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (orderData: CreateDesignatedOrder) => {
            return apiClient.post<CreateDesignatedOrderResponse>(
                "/order/createWithDesignatedPersonnel",
                orderData,
            );
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
        },
        scope: {
            id: "createDesignatedOrder",
        },
    });
};

/**
 * 确认订单预览（指定服务人员）
 */
export const useOrderConfirmDesignatedPreview = (
    params: OrderConfirmDesignatedPreviewQuery,
    options: { enabled?: boolean } = {},
) =>
    useQuery({
        queryKey: ["order-confirm-designated-preview", params],
        queryFn: async () => {
            const response =
                await apiClient.get<OrderConfirmDesignatedPreviewResponse>(
                    "/order/confirm/designated",
                    {
                        query: normalizeConfirmPreviewParams(params),
                    },
                );
            return response.data;
        },
        enabled: options.enabled ?? true,
        meta: {
            errorMessage: "确认订单预览获取失败",
        },
    });

export const useOrderConfirmDesignatedPreviewSuspense = (
    params: OrderConfirmDesignatedPreviewQuery,
) =>
    useSuspenseQuery({
        queryKey: ["order-confirm-designated-preview", params],
        queryFn: async () => {
            const response =
                await apiClient.get<OrderConfirmDesignatedPreviewResponse>(
                    "/order/confirm/designated",
                    {
                        query: normalizeConfirmPreviewParams(params),
                    },
                );
            return response.data;
        },
        meta: {
            errorMessage: "确认订单预览获取失败",
        },
    });

/**
 * 核验订单（扫码）
 */
export const useVerifyCheckIn = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (verifyData: VerifyOrderCheckinDto) => {
            return apiClient.post("/order/check-in/verify", verifyData);
        },
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ["order-detail"] });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
        },
        scope: {
            id: "verifyCheckIn",
        },
    });
};

/**
 * 取消订单
 */
export const useCancelOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            orderId,
            reason,
        }: {
            orderId: string;
            reason: string;
        }) => {
            return apiClient.post(`/order/${orderId}/cancel`, {
                reason,
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["orders-list-infinite"],
            });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
            if (variables?.orderId) {
                queryClient.invalidateQueries({
                    queryKey: ["order-detail", variables.orderId],
                });
            }
        },
        scope: {
            id: "cancelOrder",
        },
    });
};

/**
 * 服务人员改期：更新订单 appointmentTime（2 小时窗口起点）。
 */
export const useRescheduleOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            orderId,
            appointmentTime,
        }: {
            orderId: string;
            appointmentTime: string;
        }) => {
            return apiClient.post<OrderDetail>(`/order/${orderId}/reschedule`, {
                appointmentTime,
            });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            if (variables?.orderId) {
                queryClient.invalidateQueries({
                    queryKey: ["order-detail", variables.orderId],
                });
            }
        },
        scope: {
            id: "rescheduleOrder",
        },
    });
};

export const useAcceptOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({ orderId }: { orderId: string }) => {
            return apiClient.post(`/order/${orderId}/accept`);
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["orders-list-infinite"],
            });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
            if (variables?.orderId) {
                queryClient.invalidateQueries({
                    queryKey: ["order-detail", variables.orderId],
                });
            }
        },
        scope: {
            id: "acceptOrder",
        },
    });
};

export const useRejectOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: ({
            orderId,
            reason,
        }: {
            orderId: string;
            reason: string;
        }) => {
            return apiClient.post(`/order/${orderId}/reject`, { reason });
        },
        onSuccess: (_data, variables) => {
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["orders-list-infinite"],
            });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
            if (variables?.orderId) {
                queryClient.invalidateQueries({
                    queryKey: ["order-detail", variables.orderId],
                });
            }
        },
        scope: {
            id: "rejectOrder",
        },
    });
};

/**
 * 完成订单
 */
export const useCompleteOrder = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (orderId: string) => {
            return apiClient.post(`/order/${orderId}/complete`);
        },
        onSuccess: (_data, orderId) => {
            queryClient.invalidateQueries({ queryKey: ["orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["orders-list-infinite"],
            });
            queryClient.invalidateQueries({ queryKey: ["staff-orders-list"] });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
            if (orderId) {
                queryClient.invalidateQueries({
                    queryKey: ["order-detail", orderId],
                });
            }
        },
        scope: {
            id: "completeOrder",
        },
    });
};

/**
 * 无限滚动加载订单列表
 */
export const useOrdersListInfinite = (
    params: Omit<OrderListRequest, "page" | "limit">,
) =>
    useSuspenseInfiniteQuery({
        queryKey: ["orders-list-infinite", params],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get<OrderListResponse>("/order", {
                query: normalizePaginationParams({
                    ...params,
                    page: pageParam,
                    limit: 10,
                }),
            });
            return {
                data: response.data.items,
                meta: response.data.meta,
                nextCursor: response.data.meta.hasNext
                    ? pageParam + 1
                    : undefined,
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: 1,
        meta: {
            errorMessage: "订单列表获取失败",
        },
    });

/**
 * 用户端订单列表页：卡片列表（支持分页 + tab）
 *
 * 非 Suspense 版本：便于移动端页面直接处理 loading/error。
 */
export const useOrderCardsListInfinite = (params: {
    tab: OrderCardsTab;
    limit?: number;
    enabled?: boolean;
}) => {
    const limit = params.limit ?? 10;

    return useInfiniteQuery({
        queryKey: ["order-cards-list-infinite", { tab: params.tab, limit }],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get<OrderCardsListResponse>(
                "/order/cards",
                {
                    query: {
                        tab: params.tab,
                        page: String(pageParam),
                        limit: String(limit),
                    },
                },
            );

            return {
                data: response.data.items,
                meta: response.data.meta,
                nextCursor: response.data.meta.hasNext
                    ? pageParam + 1
                    : undefined,
            };
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor,
        initialPageParam: 1,
        enabled: params.enabled ?? true,
        meta: {
            errorMessage: "订单列表获取失败",
        },
    });
};
