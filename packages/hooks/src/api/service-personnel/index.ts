import type {
	MatchedPersonnel,
	PaginatedData,
	ServiceDetails,
	ServicePersonnelDetailsQuery,
	ServicePersonnelFilterRequest,
} from "@repo/types";
import {
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

const DEFAULT_PAGE = 1;
const DEFAULT_PAGE_SIZE = 20;

export type ServicePersonnelSearchResult = PaginatedData<MatchedPersonnel>;
export type ServicePersonnelSearchParams = Omit<
	ServicePersonnelFilterRequest,
	"page" | "pageSize"
> & {
	page?: number;
	pageSize?: number;
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
 */
export const useServicePersonnelSearch = (
	params: ServicePersonnelSearchParams,
) =>
	useSuspenseQuery({
		queryKey: ["service-personnel-search", params],
		queryFn: async () => {
			const response =
				await apiClient.get<ServicePersonnelSearchResult>(
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
 * 服务人员搜索的无限分页 Hook，适合构建下拉加载更多场景。
 */
export const useServicePersonnelSearchInfinite = (
	params: ServicePersonnelSearchParams,
) =>
	useSuspenseInfiniteQuery({
		queryKey: ["service-personnel-search-infinite", params],
		queryFn: async ({ pageParam = DEFAULT_PAGE }) => {
			const response =
				await apiClient.get<ServicePersonnelSearchResult>(
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
