import type {
    HomeBaseResponse,
    HomeQuery,
    HomeRecommendationsResponse,
    HomeResponse,
} from "@repo/types";
import { useInfiniteQuery, useSuspenseQuery } from "@tanstack/react-query";

import { apiClient } from "@repo/lib/http-client";

type HomeQueryParams = Partial<HomeQuery>;

/**
 * 用户端首页聚合接口
 * - 支持未登录访问（推荐列表依赖客户端上传的地址坐标）
 * - 返回首页渲染所需的运营位/分类/推荐人员
 */
export const useHome = (params: HomeQueryParams = {}) =>
    useSuspenseQuery({
        queryKey: ["home", params],
        queryFn: async () => {
            const response = await apiClient.get<HomeResponse>("/home", {
                query: {
                    ...(params.lat !== undefined
                        ? { lat: params.lat.toString() }
                        : {}),
                    ...(params.lng !== undefined
                        ? { lng: params.lng.toString() }
                        : {}),
                    ...(params.addressText !== undefined
                        ? { addressText: params.addressText }
                        : {}),
                    ...(params.maxDistanceKm !== undefined
                        ? { maxDistanceKm: params.maxDistanceKm.toString() }
                        : {}),
                    ...(params.limit !== undefined
                        ? { limit: params.limit.toString() }
                        : {}),
                },
            });
            return response.data;
        },
        meta: {
            errorMessage: "首页数据获取失败",
        },
    });

/**
 * 用户端首页基础数据
 * - 可匿名
 * - 不包含推荐列表，便于 UI 将推荐区块独立 Suspense
 */
export const useHomeBase = () =>
    useSuspenseQuery({
        queryKey: ["home-base"],
        queryFn: async () => {
            const response =
                await apiClient.get<HomeBaseResponse>("/home/base");
            return response.data;
        },
        meta: {
            errorMessage: "首页基础数据获取失败",
        },
    });

/**
 * 用户端首页推荐列表
 * - 可匿名
 * - 不传 lat/lng 时，后端返回全量推荐（无距离过滤）
 */
export const useHomeRecommendations = (params: HomeQueryParams = {}) =>
    useSuspenseQuery({
        queryKey: ["home-recommendations", params],
        queryFn: async () => {
            const response = await apiClient.get<HomeRecommendationsResponse>(
                "/home/recommendations",
                {
                    query: {
                        ...(params.lat !== undefined
                            ? { lat: params.lat.toString() }
                            : {}),
                        ...(params.lng !== undefined
                            ? { lng: params.lng.toString() }
                            : {}),
                        ...(params.addressText !== undefined
                            ? { addressText: params.addressText }
                            : {}),
                        ...(params.maxDistanceKm !== undefined
                            ? { maxDistanceKm: params.maxDistanceKm.toString() }
                            : {}),
                        ...(params.limit !== undefined
                            ? { limit: params.limit.toString() }
                            : {}),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "首页推荐数据获取失败",
        },
    });

/**
 * 首页推荐列表（无限滚动）
 * - 可匿名
 * - page 从 1 开始；后端返回 nextPage/hasMore
 */
export const useHomeRecommendationsInfinite = (
    params: Omit<HomeQueryParams, "page"> = {},
) =>
    useInfiniteQuery({
        queryKey: ["home-recommendations-infinite", params],
        initialPageParam: 1,
        queryFn: async ({ pageParam }) => {
            const response = await apiClient.get<HomeRecommendationsResponse>(
                "/home/recommendations",
                {
                    query: {
                        page: pageParam.toString(),
                        ...(params.lat !== undefined
                            ? { lat: params.lat.toString() }
                            : {}),
                        ...(params.lng !== undefined
                            ? { lng: params.lng.toString() }
                            : {}),
                        ...(params.addressText !== undefined
                            ? { addressText: params.addressText }
                            : {}),
                        ...(params.maxDistanceKm !== undefined
                            ? { maxDistanceKm: params.maxDistanceKm.toString() }
                            : {}),
                        ...(params.limit !== undefined
                            ? { limit: params.limit.toString() }
                            : {}),
                    },
                },
            );
            return response.data;
        },
        getNextPageParam: (lastPage) => lastPage.nextPage ?? undefined,
        meta: {
            errorMessage: "首页推荐数据获取失败",
        },
    });
