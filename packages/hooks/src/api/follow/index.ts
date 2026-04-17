import type { PersonnelFavoriteSummaryResponse } from "@repo/types";
import { useSuspenseQuery } from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";

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
