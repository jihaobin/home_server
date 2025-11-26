import {
    AdminRevenueLogListResponseSchema,
    type AdminRevenueLogListQuery,
    type TransactionType,
    type AdminRevenueDirection,
} from "@repo/types"
import {
    QueryClient,
    queryOptions,
    useSuspenseQuery,
    type QueryKey,
} from "@tanstack/react-query"
import { z } from "zod/v4"
import { getSsrApiClient } from "./client"

const ADMIN_REVENUE_LOGS_QUERY_KEY = ["admin-revenue-logs"] as const

export type AdminRevenueLogsQueryInput = Partial<AdminRevenueLogListQuery>

type NormalizedAdminRevenueLogsQuery = {
    page: number
    limit: number
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
    transactionType?: TransactionType
    direction?: AdminRevenueDirection
}

const adminRevenueLogsResponseSchema = AdminRevenueLogListResponseSchema
type AdminRevenueLogsResponse = z.infer<typeof adminRevenueLogsResponseSchema>

function normalizeAdminRevenueLogsQuery(
    input: AdminRevenueLogsQueryInput = {},
): NormalizedAdminRevenueLogsQuery {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    const normalized: NormalizedAdminRevenueLogsQuery = {
        page,
        limit,
    }

    if (input.startDate) {
        normalized.startDate = input.startDate
    }
    if (input.endDate) {
        normalized.endDate = input.endDate
    }

    if (typeof input.minAmount === "number") {
        normalized.minAmount = input.minAmount
    }
    if (typeof input.maxAmount === "number") {
        normalized.maxAmount = input.maxAmount
    }

    if (input.transactionType) {
        normalized.transactionType = input.transactionType
    }
    if (input.direction) {
        normalized.direction = input.direction
    }

    return normalized
}

function buildQueryParams(params: NormalizedAdminRevenueLogsQuery) {
    const query: Record<string, string | number> = {
        page: params.page,
        limit: params.limit,
    }

    if (params.startDate) {
        query.startDate = params.startDate
    }
    if (params.endDate) {
        query.endDate = params.endDate
    }
    if (typeof params.minAmount === "number") {
        query.minAmount = params.minAmount
    }
    if (typeof params.maxAmount === "number") {
        query.maxAmount = params.maxAmount
    }
    if (params.transactionType) {
        query.transactionType = params.transactionType
    }
    if (params.direction) {
        query.direction = params.direction
    }

    return query
}

export const adminRevenueLogsQueryKey = (
    input: NormalizedAdminRevenueLogsQuery,
) => [ADMIN_REVENUE_LOGS_QUERY_KEY, input] as QueryKey

export const adminRevenueLogsQueryOptions = (
    input: AdminRevenueLogsQueryInput = {},
) => {
    const normalized = normalizeAdminRevenueLogsQuery(input)
    return queryOptions({
        queryKey: adminRevenueLogsQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.get<AdminRevenueLogsResponse>(
                "/admin/revenue-logs",
                {
                    query: buildQueryParams(normalized),
                    schema: adminRevenueLogsResponseSchema,
                },
            )

            if (!response.data) {
                throw new Error("收益流水数据为空")
            }

            return response.data
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: "收益流水列表加载失败",
        },
    })
}

export function useAdminRevenueLogs(input: AdminRevenueLogsQueryInput = {}) {
    return useSuspenseQuery(adminRevenueLogsQueryOptions(input))
}

export function invalidateAdminRevenueLogsQuery(
    queryClient: QueryClient,
    input: AdminRevenueLogsQueryInput = {},
) {
    return queryClient.invalidateQueries({
        queryKey: adminRevenueLogsQueryKey(
            normalizeAdminRevenueLogsQuery(input),
        ),
    })
}

export type { NormalizedAdminRevenueLogsQuery }
