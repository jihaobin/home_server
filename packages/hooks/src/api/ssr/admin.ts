import {
    AdminDashboardOverviewSchema,
    AdminDashboardRangeSchema,
    type AdminDashboardOverview,
    type AdminDashboardRange,
    AdminProfileSchema,
    type AdminProfile,
} from "@repo/types";
import {
    queryOptions,
    useSuspenseQuery,
} from "@tanstack/react-query";
import { getSsrApiClient } from "./client";

export const ADMIN_PROFILE_QUERY_KEY = ["admin-profile"] as const;

export const adminProfileQueryOptions = () =>
    queryOptions<AdminProfile>({
        queryKey: ADMIN_PROFILE_QUERY_KEY,
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminProfile>("/admin/profile", {
                schema: AdminProfileSchema,
            });

            if (!response.data) {
                throw new Error("管理员信息为空");
            }

            return response.data;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        refetchInterval: 5 * 60 * 1000,
        meta: {
            errorMessage: "管理员信息获取失败",
        },
    });

export function useAdminProfile() {
    return useSuspenseQuery(adminProfileQueryOptions());
}

const DEFAULT_DASHBOARD_RANGE: AdminDashboardRange = '30d';

const ADMIN_DASHBOARD_QUERY_BASE_KEY = ["admin-dashboard-overview"] as const;

export const adminDashboardOverviewQueryKey = (range: AdminDashboardRange = DEFAULT_DASHBOARD_RANGE) => [
    ...ADMIN_DASHBOARD_QUERY_BASE_KEY,
    { range },
] as const;

export const adminDashboardOverviewQueryOptions = (
    range: AdminDashboardRange = DEFAULT_DASHBOARD_RANGE,
) =>
    queryOptions<AdminDashboardOverview>({
        queryKey: adminDashboardOverviewQueryKey(range),
        queryFn: async () => {
            const apiClient = getSsrApiClient();
            const response = await apiClient.get<AdminDashboardOverview>(
                "/admin/dashboard/overview",
                {
                    query: { range },
                    schema: AdminDashboardOverviewSchema,
                },
            );

            if (!response.data) {
                throw new Error("仪表盘统计返回为空");
            }

            return response.data;
        },
        staleTime: 60 * 1000,
        gcTime: 5 * 60 * 1000,
        meta: {
            errorMessage: "仪表盘统计获取失败",
        },
    });

export function useAdminDashboardOverview(
    range: AdminDashboardRange = DEFAULT_DASHBOARD_RANGE,
) {
    return useSuspenseQuery(adminDashboardOverviewQueryOptions(range));
}
