import {
    ErrorCode,
    type CreateReviewBody,
    type CreateReviewResponse,
    type ReviewerTargetsQuery,
    type ReviewerTargetsResponse,
    type ReviewStats,
    type TargetReviewsQuery,
    type TargetReviewsResponse,
} from "@repo/types";
import {
    useMutation,
    useInfiniteQuery,
    useQuery,
    useQueryClient,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";
import { isApiClientError } from "@repo/utils/api-client";

type TargetReviewsTab = "all" | "latest" | "photos" | "positive" | "negative";
type TargetReviewsQueryWithTab = TargetReviewsQuery & {
    tab?: TargetReviewsTab;
};

/**
 * 创建订单评价 - Mutation
 */
export const useCreateReview = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: (reviewData: CreateReviewBody) => {
            return apiClient.post<CreateReviewResponse>("/review", reviewData);
        },
        onSuccess: (_data, variables) => {
            // 创建评价后，更新相关缓存
            queryClient.invalidateQueries({ queryKey: ["reviewer-targets"] });
            queryClient.invalidateQueries({
                queryKey: ["review-by-order", variables.orderId],
            });
            queryClient.invalidateQueries({
                queryKey: [
                    "target-reviews",
                    variables.targetId,
                    variables.targetType,
                ],
            });
            queryClient.invalidateQueries({
                queryKey: [
                    "review-stats",
                    variables.targetId,
                    variables.targetType,
                ],
            });
        },
        scope: {
            id: "createReview",
        },
    });
};

/**
 * 获取用户已评价对象列表 - Suspense版本
 */
export const useReviewerTargets = (params: ReviewerTargetsQuery) =>
    useSuspenseQuery({
        queryKey: ["reviewer-targets", params],
        queryFn: async () => {
            const response = await apiClient.get<ReviewerTargetsResponse>(
                "/review/targets",
                {
                    query: {
                        page: params.page?.toString(),
                        limit: params.limit?.toString(),
                        targetType: params.targetType,
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "已评价对象列表获取失败",
        },
    });

/**
 * 获取用户已评价对象列表 - 无限查询版本
 */
export const useReviewerTargetsInfinite = (
    params: Omit<ReviewerTargetsQuery, "page">,
) =>
    useSuspenseInfiniteQuery({
        queryKey: ["reviewer-targets-infinite", params],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get<ReviewerTargetsResponse>(
                "/review/targets",
                {
                    query: {
                        page: pageParam.toString(),
                        limit: params.limit?.toString() || "10",
                        targetType: params.targetType,
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
        getNextPageParam: (lastPage) => {
            return lastPage.nextCursor;
        },
        initialPageParam: 1,
        meta: {
            errorMessage: "已评价对象列表获取失败",
        },
    });

/**
 * 获取用户针对某个订单的评价 - 非 Suspense版本（包含图片信息）
 */
export const useOrderReview = (orderId?: string) =>
    useQuery({
        enabled: Boolean(orderId),
        queryKey: ["review-by-order", orderId],
        queryFn: async () => {
            if (!orderId) {
                return null;
            }
            try {
                const response = await apiClient.get<CreateReviewResponse>(
                    `/review/order/${orderId}`,
                );
                return response.data;
            } catch (error) {
                if (
                    isApiClientError(error) &&
                    (error.code === ErrorCode.NOT_FOUND ||
                        error.code === ErrorCode.RESOURCE_NOT_FOUND)
                ) {
                    return null;
                }

                throw error;
            }
        },
        meta: {
            errorMessage: "订单评价获取失败",
        },
    });

/**
 * 获取用户针对某个订单的评价 - Suspense版本
 */
export const useReviewByOrder = (orderId: string) =>
    useSuspenseQuery({
        queryKey: ["review-by-order", orderId],
        queryFn: async () => {
            const response = await apiClient.get<CreateReviewResponse>(
                `/review/order/${orderId}`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "订单评价获取失败",
        },
    });

/**
 * 获取服务/服务人员的评价列表 - Suspense版本
 * @param targetType 评价对象类型（personnel 或 shop）
 * @param targetId 评价对象ID
 * @param params 查询参数（分页、服务过滤）
 */
export const useTargetReviews = (
    targetType: "personnel" | "shop",
    targetId: string,
    params: TargetReviewsQueryWithTab,
) =>
    useSuspenseQuery({
        queryKey: ["target-reviews", targetId, targetType, params],
        queryFn: async () => {
            const response = await apiClient.get<TargetReviewsResponse>(
                `/review/target/${targetType}/${targetId}`,
                {
                    query: {
                        page: params.page?.toString(),
                        limit: params.limit?.toString(),
                        serviceId: params.serviceId,
                        ...(params.tab ? { tab: params.tab } : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "评价列表获取失败",
        },
    });

/**
 * 获取服务/服务人员的评价列表 - 非 Suspense 版本（便于在页面内按 enabled 控制请求）。
 */
export const useTargetReviewsQuery = (
    targetType: "personnel" | "shop",
    targetId: string,
    params: TargetReviewsQueryWithTab,
    options: { enabled?: boolean } = {},
) => {
    const enabled = options.enabled ?? true;
    return useQuery({
        queryKey: ["target-reviews", targetId, targetType, params],
        queryFn: async () => {
            const response = await apiClient.get<TargetReviewsResponse>(
                `/review/target/${targetType}/${targetId}`,
                {
                    query: {
                        page: params.page?.toString(),
                        limit: params.limit?.toString(),
                        serviceId: params.serviceId,
                        ...(params.tab ? { tab: params.tab } : {}),
                    },
                },
            );
            return response.data;
        },
        enabled: enabled && Boolean(targetId),
        meta: {
            errorMessage: "评价列表获取失败",
        },
    });
};

/**
 * 获取服务/服务人员的评价列表 - 无限查询版本
 * @param targetType 评价对象类型（personnel 或 shop）
 * @param targetId 评价对象ID
 * @param params 查询参数（服务过滤）
 */
export const useTargetReviewsInfinite = (
    targetType: "personnel" | "shop",
    targetId: string,
    params: Omit<TargetReviewsQueryWithTab, "page">,
) =>
    useSuspenseInfiniteQuery({
        queryKey: ["target-reviews-infinite", targetId, targetType, params],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get<TargetReviewsResponse>(
                `/review/target/${targetType}/${targetId}`,
                {
                    query: {
                        page: pageParam.toString(),
                        limit: params.limit?.toString() || "10",
                        serviceId: params.serviceId,
                        ...(params.tab ? { tab: params.tab } : {}),
                    },
                },
            );
            const hasNext =
                response.data.page * response.data.limit < response.data.total;
            return {
                data: response.data.items,
                total: response.data.total,
                page: response.data.page,
                limit: response.data.limit,
                nextCursor: hasNext ? pageParam + 1 : undefined,
            };
        },
        getNextPageParam: (lastPage) => {
            return lastPage.nextCursor;
        },
        initialPageParam: 1,
        meta: {
            errorMessage: "评价列表获取失败",
        },
    });

/**
 * 获取服务/服务人员的评价列表 - 非 Suspense 无限查询版本
 */
export const useTargetReviewsInfiniteQuery = (
    targetType: "personnel" | "shop",
    targetId: string,
    params: Omit<TargetReviewsQueryWithTab, "page">,
    options: { enabled?: boolean } = {},
) => {
    const enabled = options.enabled ?? true;
    return useInfiniteQuery({
        queryKey: ["target-reviews-infinite", targetId, targetType, params],
        queryFn: async ({ pageParam = 1 }) => {
            const response = await apiClient.get<TargetReviewsResponse>(
                `/review/target/${targetType}/${targetId}`,
                {
                    query: {
                        page: pageParam.toString(),
                        limit: params.limit?.toString() || "10",
                        serviceId: params.serviceId,
                        ...(params.tab ? { tab: params.tab } : {}),
                    },
                },
            );
            const hasNext =
                response.data.page * response.data.limit < response.data.total;
            return {
                data: response.data.items,
                total: response.data.total,
                page: response.data.page,
                limit: response.data.limit,
                nextCursor: hasNext ? pageParam + 1 : undefined,
            };
        },
        getNextPageParam: (lastPage) => {
            return lastPage.nextCursor;
        },
        initialPageParam: 1,
        enabled: enabled && Boolean(targetId),
        meta: {
            errorMessage: "评价列表获取失败",
        },
    });
};

/**
 * 获取评价统计信息 - Suspense版本
 * @param targetType 评价对象类型（personnel 或 shop）
 * @param targetId 评价对象ID
 * @param serviceId 可选的服务ID，用于查询特定服务的统计
 */
export const useReviewStats = (
    targetType: "personnel" | "shop",
    targetId: string,
    serviceId?: string,
) =>
    useSuspenseQuery({
        queryKey: ["review-stats", targetId, targetType, serviceId],
        queryFn: async () => {
            const response = await apiClient.get<ReviewStats>(
                `/review/stats/${targetType}/${targetId}`,
                {
                    query: serviceId ? { serviceId } : {},
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "评价统计信息获取失败",
        },
    });

/**
 * 获取评价统计信息 - 非 Suspense 版本
 */
export const useReviewStatsQuery = (
    targetType: "personnel" | "shop",
    targetId: string,
    serviceId?: string,
    options: { enabled?: boolean } = {},
) => {
    const enabled = options.enabled ?? true;
    return useQuery({
        queryKey: ["review-stats", targetId, targetType, serviceId],
        queryFn: async () => {
            const response = await apiClient.get<ReviewStats>(
                `/review/stats/${targetType}/${targetId}`,
                {
                    query: serviceId ? { serviceId } : {},
                },
            );
            return response.data;
        },
        enabled: enabled && Boolean(targetId),
        meta: {
            errorMessage: "评价统计信息获取失败",
        },
    });
};
