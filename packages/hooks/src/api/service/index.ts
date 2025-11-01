import type {
	CreateService,
	CreateServiceCategory,
	ServiceCategory,
	ServiceCategoryRequest,
	ServiceCategoryTree,
	ServiceDetail,
	ServiceListRequest,
	ServiceListResponse,
	ServiceStats,
	UpdateService,
	UpdateServiceCategory,
} from "@repo/types";
import {
	useMutation,
	useQueryClient,
	useSuspenseInfiniteQuery,
	useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

type ServiceCategoryListResult = ServiceCategoryTree[];

type DeleteResult = {
	success: boolean;
	message: string;
};

/**
 * 获取服务分类（支持层级与关键字筛选）
 */
export const useServiceCategories = (params: ServiceCategoryRequest = {}) =>
	useSuspenseQuery({
		queryKey: ["service-categories", params],
		queryFn: async () => {
			const response = await apiClient.get<ServiceCategoryListResult>(
				"/service/getCategories",
				{
					query: {
						...(params.dep ? { dep: params.dep } : {}),
						...(params.keyword ? { keyword: params.keyword } : {}),
					},
				},
			);
			return response.data;
		},
		meta: {
			errorMessage: "服务分类获取失败",
		},
	});

/**
 * 获取单个服务分类详情
 */
export const useServiceCategoryDetail = (categoryId: string) =>
	useSuspenseQuery({
		queryKey: ["service-category", categoryId],
		queryFn: async () => {
			const response = await apiClient.get<ServiceCategory>(
				`/service/categories/${categoryId}`,
			);
			return response.data;
		},
		meta: {
			errorMessage: "服务分类详情获取失败",
		},
	});

/**
 * 创建服务分类
 */
export const useCreateServiceCategory = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateServiceCategory) => {
			return apiClient.post<ServiceCategory>("/service/categories", payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["service-categories"],
			});
		},
		scope: {
			id: "createServiceCategory",
		},
	});
};

/**
 * 更新服务分类
 */
export const useUpdateServiceCategory = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data: Partial<UpdateServiceCategory>;
		}) => {
			return apiClient.put<ServiceCategory>(`/service/categories/${id}`, data);
		},
		onSuccess: (_result, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["service-categories"],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-category", variables.id],
			});
		},
		scope: {
			id: "updateServiceCategory",
		},
	});
};

/**
 * 删除服务分类
 */
export const useDeleteServiceCategory = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => {
			return apiClient.delete<DeleteResult>(`/service/categories/${id}`);
		},
		onSuccess: (_result, id) => {
			queryClient.invalidateQueries({
				queryKey: ["service-categories"],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-category", id],
			});
		},
		scope: {
			id: "deleteServiceCategory",
		},
	});
};

/**
 * 获取服务项目列表（无限滚动版本）
 */
export const useServiceList = (params: Omit<ServiceListRequest, "page">) =>
	useSuspenseInfiniteQuery({
		queryKey: ["service-list", params],
		queryFn: async ({ pageParam = 1 }) => {
			const response = await apiClient.get<ServiceListResponse>(
				"/service/services",
				{
					query: {
						page: pageParam.toString(),
						...(params.limit ? { limit: params.limit.toString() } : {}),
						...(params.categoryId ? { categoryId: params.categoryId } : {}),
						...(params.keyword ? { keyword: params.keyword } : {}),
						...(params.minPrice !== undefined
							? { minPrice: params.minPrice.toString() }
							: {}),
						...(params.maxPrice !== undefined
							? { maxPrice: params.maxPrice.toString() }
							: {}),
						...(params.isActive !== undefined
							? { isActive: params.isActive.toString() }
							: {}),
						...(params.search ? { search: params.search } : {}),
						...(params.sortBy ? { sortBy: params.sortBy } : {}),
						...(params.sortOrder ? { sortOrder: params.sortOrder } : {}),
					},
				},
			);
			return response.data;
		},
		getNextPageParam: (lastPage) => {
			// 如果当前页有数据且未达到总页数，返回下一页页码
			const { page, totalPages } = lastPage.meta;
			return page < totalPages ? page + 1 : undefined;
		},
		initialPageParam: 1,
		meta: {
			errorMessage: "服务项目列表获取失败",
		},
	});

/**
 * 获取服务项目详情
 */
export const useServiceDetail = (serviceId: string) =>
	useSuspenseQuery({
		queryKey: ["service-detail", serviceId],
		queryFn: async () => {
			const response = await apiClient.get<ServiceDetail>(
				`/service/services/${serviceId}`,
			);
			return response.data;
		},
		meta: {
			errorMessage: "服务项目详情获取失败",
		},
	});

/**
 * 获取服务统计信息
 */
export const useServiceStats = () =>
	useSuspenseQuery({
		queryKey: ["service-stats"],
		queryFn: async () => {
			const response = await apiClient.get<ServiceStats>(
				"/service/services/stats",
			);
			return response.data;
		},
		meta: {
			errorMessage: "服务统计信息获取失败",
		},
	});

/**
 * 创建服务项目
 */
export const useCreateService = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (payload: CreateService) => {
			return apiClient.post<ServiceDetail>("/service/services", payload);
		},
		onSuccess: () => {
			queryClient.invalidateQueries({
				queryKey: ["service-list"],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-stats"],
			});
		},
		scope: {
			id: "createService",
		},
	});
};

/**
 * 更新服务项目
 */
export const useUpdateService = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: ({
			id,
			data,
		}: {
			id: string;
			data: Partial<UpdateService>;
		}) => {
			return apiClient.put<ServiceDetail>(`/service/services/${id}`, data);
		},
		onSuccess: (_result, variables) => {
			queryClient.invalidateQueries({
				queryKey: ["service-list"],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-detail", variables.id],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-stats"],
			});
		},
		scope: {
			id: "updateService",
		},
	});
};

/**
 * 删除服务项目
 */
export const useDeleteService = () => {
	const queryClient = useQueryClient();

	return useMutation({
		mutationFn: (id: string) => {
			return apiClient.delete<DeleteResult>(`/service/services/${id}`);
		},
		onSuccess: (_result, id) => {
			queryClient.invalidateQueries({
				queryKey: ["service-list"],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-detail", id],
			});
			queryClient.invalidateQueries({
				queryKey: ["service-stats"],
			});
		},
		scope: {
			id: "deleteService",
		},
	});
};
