import type {
    FavoritePersonnelListResponse,
    PersonnelFavoriteMutationResponse,
    PersonnelFavoriteSummaryResponse,
} from "@repo/types";
import {
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

const invalidateFavoriteRelatedQueries = async (
    queryClient: ReturnType<typeof useQueryClient>,
    personnelId: string,
) => {
    return await Promise.all([
        queryClient.invalidateQueries({
            queryKey: ["personnel-favorite-summary", personnelId],
        }),
        queryClient.invalidateQueries({
            queryKey: ["favorite-personnel-list"],
        }),
        queryClient.invalidateQueries({
            queryKey: ["massage-personnel-detail", personnelId],
        }),
    ]);
};

export const usePersonnelFavoriteSummary = (personnelId: string) =>
    useSuspenseQuery({
        queryKey: ["personnel-favorite-summary", personnelId],
        queryFn: async () => {
            const response = await apiClient.get<PersonnelFavoriteSummaryResponse>(
                `/follows/personnel/${personnelId}/summary`,
            );
            return response.data;
        },
        meta: {
            errorMessage: "收藏状态获取失败",
        },
    });

export const useFavoritePersonnel = (personnelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await apiClient.post<PersonnelFavoriteMutationResponse>(
                `/follows/personnel/${personnelId}`,
            );
            return response.data;
        },
        onSuccess: async () => {
            return await invalidateFavoriteRelatedQueries(
                queryClient,
                personnelId,
            );
        },
        meta: {
            errorMessage: "收藏服务人员失败",
        },
    });
};

export const useUnfavoritePersonnel = (personnelId: string) => {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async () => {
            const response = await apiClient.delete<PersonnelFavoriteMutationResponse>(
                `/follows/personnel/${personnelId}`,
            );
            return response.data;
        },
        onSuccess: async () => {
            return await invalidateFavoriteRelatedQueries(
                queryClient,
                personnelId,
            );
        },
        meta: {
            errorMessage: "取消收藏服务人员失败",
        },
    });
};

export const useFavoritePersonnelList = (page = 1, pageSize = 10) =>
    useSuspenseQuery({
        queryKey: ["favorite-personnel-list", page, pageSize],
        queryFn: async () => {
            const response = await apiClient.get<FavoritePersonnelListResponse>(
                "/follows/personnel",
                {
                    query: {
                        page: page.toString(),
                        pageSize: pageSize.toString(),
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "收藏服务人员列表获取失败",
        },
    });
