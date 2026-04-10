import {
    AdminCommissionStrategyDetailSchema,
    AdminCommissionStrategyPublishInputSchema,
    AdminCommissionStrategySimulationInputSchema,
    AdminCommissionStrategySimulationResultSchema,
    SaveAdminCommissionStrategyDraftSchema,
    type AdminCommissionStrategyDetail,
    type AdminCommissionStrategyPublishInput,
    type AdminCommissionStrategySimulationInput,
    type AdminCommissionStrategySimulationResult,
    type SaveAdminCommissionStrategyDraftInput,
} from "@repo/types";
import {
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { getSsrApiClient } from "./client";

const ADMIN_SERVICE_CATEGORY_COMMISSION_STRATEGY_QUERY_KEY = [
    "admin-service-category-commission-strategy",
] as const;

export const adminServiceCategoryCommissionStrategyDetailQueryKey = (
    categoryId: string,
) =>
    [
        ...ADMIN_SERVICE_CATEGORY_COMMISSION_STRATEGY_QUERY_KEY,
        categoryId,
    ] as const;

export const adminServiceCategoryCommissionStrategyDetailQueryOptions = (
    categoryId: string,
) =>
    queryOptions<AdminCommissionStrategyDetail>({
        queryKey:
            adminServiceCategoryCommissionStrategyDetailQueryKey(categoryId),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminCommissionStrategyDetail>(
                `/admin/service-categories/${categoryId}/commission-strategy`,
                {
                    schema: AdminCommissionStrategyDetailSchema,
                },
            );

            if (!response.data) {
                throw new Error("抽成策略详情为空");
            }

            return response.data;
        },
        enabled: Boolean(categoryId),
        staleTime: 30 * 1000,
        gcTime: 5 * 60 * 1000,
        meta: {
            errorMessage: "抽成策略详情获取失败",
        },
    });

export function useAdminServiceCategoryCommissionStrategyDetail(
    categoryId: string,
) {
    return useSuspenseQuery(
        adminServiceCategoryCommissionStrategyDetailQueryOptions(categoryId),
    );
}

export function useSaveAdminServiceCategoryCommissionStrategyDraft() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            categoryId,
            payload,
        }: {
            categoryId: string;
            payload: SaveAdminCommissionStrategyDraftInput;
        }) => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.put<AdminCommissionStrategyDetail>(
                `/admin/service-categories/${categoryId}/commission-strategy/draft`,
                SaveAdminCommissionStrategyDraftSchema.parse(payload),
                {
                    schema: AdminCommissionStrategyDetailSchema,
                },
            );

            if (!response.data) {
                throw new Error("保存抽成策略草稿失败");
            }

            return response.data;
        },
        onSuccess: (detail, variables) => {
            queryClient.setQueryData(
                adminServiceCategoryCommissionStrategyDetailQueryKey(
                    variables.categoryId,
                ),
                detail,
            );
            queryClient.invalidateQueries({
                queryKey: adminServiceCategoryCommissionStrategyDetailQueryKey(
                    variables.categoryId,
                ),
            });
        },
        meta: {
            errorMessage: "保存抽成策略草稿失败",
        },
    });
}

export function usePublishAdminServiceCategoryCommissionStrategy() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async ({
            categoryId,
            payload,
        }: {
            categoryId: string;
            payload: AdminCommissionStrategyPublishInput;
        }) => {
            const apiClient = getSsrApiClient();
            const response =
                await apiClient.post<AdminCommissionStrategyDetail>(
                    `/admin/service-categories/${categoryId}/commission-strategy/publish`,
                    AdminCommissionStrategyPublishInputSchema.parse(payload),
                    {
                        schema: AdminCommissionStrategyDetailSchema,
                    },
                );

            if (!response.data) {
                throw new Error("发布抽成策略失败");
            }

            return response.data;
        },
        onSuccess: (detail, variables) => {
            queryClient.setQueryData(
                adminServiceCategoryCommissionStrategyDetailQueryKey(
                    variables.categoryId,
                ),
                detail,
            );
            queryClient.invalidateQueries({
                queryKey: adminServiceCategoryCommissionStrategyDetailQueryKey(
                    variables.categoryId,
                ),
            });
        },
        meta: {
            errorMessage: "发布抽成策略失败",
        },
    });
}

export function useSimulateAdminServiceCategoryCommissionStrategy() {
    return useMutation({
        mutationFn: async ({
            categoryId,
            payload,
        }: {
            categoryId: string;
            payload: AdminCommissionStrategySimulationInput;
        }) => {
            const apiClient = getSsrApiClient();
            const response =
                await apiClient.post<AdminCommissionStrategySimulationResult>(
                    `/admin/service-categories/${categoryId}/commission-strategy/simulate`,
                    AdminCommissionStrategySimulationInputSchema.parse(payload),
                    {
                        schema: AdminCommissionStrategySimulationResultSchema,
                    },
                );

            if (!response.data) {
                throw new Error("抽成策略试算失败");
            }

            return response.data;
        },
        meta: {
            errorMessage: "抽成策略试算失败",
        },
    });
}

export { ADMIN_SERVICE_CATEGORY_COMMISSION_STRATEGY_QUERY_KEY as adminServiceCategoryCommissionStrategyQueryKey };
