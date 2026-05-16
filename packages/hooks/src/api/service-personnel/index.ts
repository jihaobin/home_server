import type {
    MatchedPersonnel,
    PaginatedData,
    ServiceDetails,
    ServicePersonnelDashboardStats,
    ServicePersonnelDetailsQuery,
    ServicePersonnelFilterRequest,
    ServicePersonnelProfile,
    UpdateServicePersonnelProfileRequest,
} from "@repo/types";
import {
    keepPreviousData,
    useMutation,
    useQuery,
    useQueryClient,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export type ServicePersonnelSearchResult = PaginatedData<MatchedPersonnel>;

export type MatchedPersonnelUI = MatchedPersonnel & {
    // 后端 search 新增：用于 UI 直接渲染头像（url + blurhash）；保留 avatarUrl(hash) 兼容。
    avatar?: {
        url: string;
        blurhash?: string | null;
    } | null;
};

export type ServicePersonnelSearchUIResult = PaginatedData<MatchedPersonnelUI>;
export type ServicePersonnelSearchParams = Omit<
    ServicePersonnelFilterRequest,
    "page" | "pageSize"
> & {
    page?: number;
    pageSize?: number;
    enabled?: boolean;
};

const buildSearchQuery = (
    params: ServicePersonnelSearchParams,
    pageOverride?: number,
) => {
    const {
        serviceId,
        userLat,
        userLng,
        maxDistance,
        minPrice,
        maxPrice,
        minYearsOfExperience,
        needServiceTime,
        page = DEFAULT_PAGE,
        pageSize = DEFAULT_PAGE_SIZE,
        sortBy = "distance",
        sortOrder = "asc",
    } = params;

    const resolvedPage = pageOverride ?? page;

    return {
        serviceId,
        userLat: userLat.toString(),
        userLng: userLng.toString(),
        ...(maxDistance !== undefined
            ? { maxDistance: maxDistance.toString() }
            : {}),
        ...(minPrice !== undefined ? { minPrice: minPrice.toString() } : {}),
        ...(maxPrice !== undefined ? { maxPrice: maxPrice.toString() } : {}),
        ...(minYearsOfExperience !== undefined
            ? { minYearsOfExperience: minYearsOfExperience.toString() }
            : {}),
        ...(needServiceTime
            ? {
                  needServiceTime: needServiceTime.toISOString(),
              }
            : {}),
        page: resolvedPage.toString(),
        pageSize: pageSize.toString(),
        sortBy,
        sortOrder,
    };
};

/**
 * 基于后台筛选逻辑的服务人员搜索
 * 支持技能匹配、距离限制、价格区间、时间可用性与多维度排序。
 *
 * **认证模式：**
 * - � 可选认证：未登录用户也可以搜索服务人员
 * - 🔐 已登录用户：自动排除自己在搜索结果中
 *
 * **重要特性：**
 * - 📍 基于地理位置的智能匹配
 * - 💰 价格区间筛选
 * - ⏰ 时间可用性检查
 * - 🎯 多维度排序（距离、价格、经验、评分）
 *
 * @note 后端会自动从认证信息中获取用户ID（如果已登录）
 */
export const useServicePersonnelSearch = (
    params: ServicePersonnelSearchParams,
) =>
    useSuspenseQuery({
        queryKey: ["service-personnel-search", params],
        queryFn: async () => {
            const response =
                await apiClient.get<ServicePersonnelSearchUIResult>(
                    "/service-personnel/search",
                    {
                        query: buildSearchQuery(params),
                    },
                );
            return response.data;
        },
        meta: {
            errorMessage: "服务人员筛选失败",
        },
    });

/**
 * 非 Suspense 版本（便于在页面内按条件 enabled 控制请求）。
 */
export const useServicePersonnelSearchQuery = (
    params: ServicePersonnelSearchParams,
) => {
    const { enabled = true, ...restParams } = params;
    return useQuery({
        queryKey: ["service-personnel-search", restParams],
        queryFn: async () => {
            const response =
                await apiClient.get<ServicePersonnelSearchUIResult>(
                    "/service-personnel/search",
                    {
                        query: buildSearchQuery(restParams),
                    },
                );
            return response.data;
        },
        enabled,
        placeholderData: keepPreviousData,
        meta: {
            errorMessage: "服务人员筛选失败",
        },
    });
};

/**
 * 服务人员搜索的无限分页 Hook，适合构建下拉加载更多场景。
 *
 * **认证模式：**
 * - � 可选认证：未登录用户也可以搜索服务人员
 * - 🔐 已登录用户：自动排除自己在搜索结果中
 *
 * **重要特性：**
 * - 📍 基于地理位置的智能匹配
 * - ♾️ 支持无限滚动加载
 * - 💰 价格区间筛选
 * - ⏰ 时间可用性检查
 * - 🎯 多维度排序（距离、价格、经验、评分）
 *
 * @note 后端会自动从认证信息中获取用户ID（如果已登录）
 */
export const useServicePersonnelSearchInfinite = (
    params: ServicePersonnelSearchParams,
) =>
    useSuspenseInfiniteQuery({
        queryKey: ["service-personnel-search-infinite", params],
        queryFn: async ({ pageParam = DEFAULT_PAGE }) => {
            const response =
                await apiClient.get<ServicePersonnelSearchUIResult>(
                    "/service-personnel/search",
                    {
                        query: buildSearchQuery(params, pageParam),
                    },
                );
            return {
                items: response.data.items,
                meta: response.data.meta,
                page: pageParam,
            };
        },
        getNextPageParam: (lastPage) => {
            return lastPage.meta.hasNext ? lastPage.page + 1 : undefined;
        },
        initialPageParam: DEFAULT_PAGE,
        meta: {
            errorMessage: "服务人员筛选失败",
        },
    });

/**
 * 获取服务人员的具体服务详情
 * 根据服务人员ID和服务ID，获取该服务人员提供的具体服务详情，包括服务描述、价格、可用时间等信息。
 */
export const useServicePersonnelDetails = (
    params: ServicePersonnelDetailsQuery,
) =>
    useSuspenseQuery({
        queryKey: ["service-personnel-details", params],
        queryFn: async () => {
            const response = await apiClient.get<ServiceDetails>(
                "/service-personnel/getServiceDetails",
                {
                    query: {
                        serviceId: params.serviceId,
                        personnelId: params.personnelId,
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "服务人员详情获取失败",
        },
    });

/**
 * 获取服务人员的具体服务详情（非 Suspense 版本）
 * - 便于页面按 enabled 控制请求，并在 404/无定价时渲染错误态。
 */
export const useServicePersonnelDetailsQuery = (
    params: ServicePersonnelDetailsQuery,
    options: { enabled?: boolean } = {},
) => {
    const enabled = options.enabled ?? true;
    return useQuery({
        queryKey: ["service-personnel-details", params],
        queryFn: async () => {
            const response = await apiClient.get<ServiceDetails>(
                "/service-personnel/getServiceDetails",
                {
                    query: {
                        serviceId: params.serviceId,
                        personnelId: params.personnelId,
                    },
                },
            );
            return response.data;
        },
        enabled:
            enabled && Boolean(params.personnelId) && Boolean(params.serviceId),
        meta: {
            errorMessage: "服务人员详情获取失败",
        },
    });
};

/**
 * 获取指定服务人员的聚合资料（头像/手机号/服务/资质等）
 */
export const useServicePersonnelProfile = (personnelId?: string) =>
    useQuery({
        queryKey: ["service-personnel-profile", personnelId],
        enabled: Boolean(personnelId),
        queryFn: async () => {
            if (!personnelId) {
                return null;
            }
            const response = await apiClient.get<ServicePersonnelProfile>(
                `/service-personnel/profile/${personnelId}`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "服务人员资料获取失败",
        },
    });

/**
 * 获取当前服务人员自己的聚合资料，包含已下架/待审核/未通过等管理态服务。
 */
export const useOwnServicePersonnelProfile = () =>
    useQuery({
        queryKey: ["service-personnel-profile", "me"],
        queryFn: async () => {
            const response = await apiClient.get<ServicePersonnelProfile>(
                "/service-personnel/profile/me",
            );
            return response.data;
        },
        meta: {
            errorMessage: "服务人员资料获取失败",
        },
    });

export const useServicePersonnelDashboardStats = (personnelId?: string) =>
    useQuery({
        queryKey: ["service-personnel-dashboard", personnelId],
        enabled: Boolean(personnelId),
        queryFn: async () => {
            const response =
                await apiClient.get<ServicePersonnelDashboardStats>(
                    "/service-personnel/dashboard/me",
                );
            return response.data;
        },
        meta: {
            errorMessage: "个人统计获取失败",
        },
    });

export const useUpdateServicePersonnelProfile = () => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (payload: UpdateServicePersonnelProfileRequest) => {
            const response = await apiClient.put(
                "/service-personnel/profile",
                payload,
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: ["service-personnel-profile"],
            });
        },
        scope: {
            id: "updateServicePersonnelProfile",
        },
    });
};
