import {
    AdminWithdrawalSchema,
    AdminWithdrawalListResponseSchema,
    type AdminReviewWithdrawalBody,
    type AdminWithdrawal,
    type AdminWithdrawalListQuery,
} from "@repo/types"
import {
    QueryClient,
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
    type QueryKey,
} from "@tanstack/react-query"
import { z } from "zod/v4"
import { getSsrApiClient } from "./client"

const ADMIN_WITHDRAWALS_QUERY_KEY = ["admin-withdrawals"] as const

export type AdminWithdrawalsQueryInput = Partial<AdminWithdrawalListQuery>

export type NormalizedAdminWithdrawalsQuery = {
    page: number
    limit: number
    startDate?: string
    endDate?: string
    minAmount?: number
    maxAmount?: number
    status?: AdminWithdrawalListQuery["status"]
    method?: AdminWithdrawalListQuery["method"]
    keyword?: string
}

const adminWithdrawalsResponseSchema = AdminWithdrawalListResponseSchema
type AdminWithdrawalsResponse = z.infer<typeof adminWithdrawalsResponseSchema>

function normalizeAdminWithdrawalsQuery(
    input: AdminWithdrawalsQueryInput = {},
): NormalizedAdminWithdrawalsQuery {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    const normalized: NormalizedAdminWithdrawalsQuery = {
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
    if (input.status) {
        normalized.status = input.status
    }
    if (input.method) {
        normalized.method = input.method
    }
    if (input.keyword?.trim()) {
        normalized.keyword = input.keyword.trim()
    }

    return normalized
}

function buildQueryParams(params: NormalizedAdminWithdrawalsQuery) {
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
    if (params.status) {
        query.status = params.status
    }
    if (params.method) {
        query.method = params.method
    }
    if (params.keyword) {
        query.keyword = params.keyword
    }

    return query
}

export const adminWithdrawalsQueryKey = (
    input: NormalizedAdminWithdrawalsQuery,
) => [ADMIN_WITHDRAWALS_QUERY_KEY, input] as QueryKey

export const adminWithdrawalsQueryOptions = (
    input: AdminWithdrawalsQueryInput = {},
) => {
    const normalized = normalizeAdminWithdrawalsQuery(input)

    return queryOptions({
        queryKey: adminWithdrawalsQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.get<AdminWithdrawalsResponse>(
                "/admin/withdrawals",
                {
                    query: buildQueryParams(normalized),
                    schema: adminWithdrawalsResponseSchema,
                },
            )

            if (!response.data) {
                throw new Error("提现记录为空")
            }

            return response.data
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: "提现列表加载失败",
        },
    })
}

export function useAdminWithdrawals(input: AdminWithdrawalsQueryInput = {}) {
    return useSuspenseQuery(adminWithdrawalsQueryOptions(input))
}

export function invalidateAdminWithdrawalsQuery(
    queryClient: QueryClient,
    input: AdminWithdrawalsQueryInput = {},
) {
    return queryClient.invalidateQueries({
        queryKey: adminWithdrawalsQueryKey(
            normalizeAdminWithdrawalsQuery(input),
        ),
    })
}

export function useReviewAdminWithdrawal(
    query?: AdminWithdrawalsQueryInput,
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            withdrawalId,
            payload,
        }: {
            withdrawalId: string
            payload: AdminReviewWithdrawalBody
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.patch<AdminWithdrawal>(
                `/admin/withdrawals/${withdrawalId}`,
                payload,
                {
                    schema: AdminWithdrawalSchema,
                },
            )

            if (!response.data) {
                throw new Error("提现审核失败")
            }

            return response.data
        },
        onSuccess: () => {
            if (query) {
                invalidateAdminWithdrawalsQuery(queryClient, query)
            } else {
                queryClient.invalidateQueries({
                    queryKey: ADMIN_WITHDRAWALS_QUERY_KEY,
                })
            }
        },
        meta: {
            errorMessage: "提现审核失败",
        },
    })
}
