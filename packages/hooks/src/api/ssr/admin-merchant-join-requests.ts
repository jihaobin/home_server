import {
    AdminMerchantJoinRequestListResponseSchema,
    AdminMerchantJoinRequestSchema,
    type AdminMerchantJoinRequest,
    type AdminMerchantJoinRequestListQuery,
    type AdminUpdateMerchantJoinRequest,
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

const ADMIN_MERCHANT_JOIN_REQUESTS_QUERY_KEY = [
    "admin-merchant-join-requests",
] as const

export type AdminMerchantJoinRequestsQueryInput = Partial<
    AdminMerchantJoinRequestListQuery
>

export type NormalizedAdminMerchantJoinRequestsQuery = {
    page: number
    limit: number
    keyword?: string
    contactStatus?: AdminMerchantJoinRequestListQuery["contactStatus"]
}

const adminMerchantJoinRequestsResponseSchema =
    AdminMerchantJoinRequestListResponseSchema
type AdminMerchantJoinRequestsResponse = z.infer<
    typeof adminMerchantJoinRequestsResponseSchema
>

export function normalizeAdminMerchantJoinRequestsQuery(
    input: AdminMerchantJoinRequestsQueryInput = {},
): NormalizedAdminMerchantJoinRequestsQuery {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    const normalized: NormalizedAdminMerchantJoinRequestsQuery = {
        page,
        limit,
    }

    if (input.keyword?.trim()) {
        normalized.keyword = input.keyword.trim()
    }

    if (input.contactStatus && input.contactStatus !== "all") {
        normalized.contactStatus = input.contactStatus
    }

    return normalized
}

function buildQueryParams(input: NormalizedAdminMerchantJoinRequestsQuery) {
    const query: Record<string, string | number> = {
        page: input.page,
        limit: input.limit,
    }

    if (input.keyword) {
        query.keyword = input.keyword
    }

    if (input.contactStatus) {
        query.contactStatus = input.contactStatus
    }

    return query
}

export const adminMerchantJoinRequestsQueryKey = (
    input: NormalizedAdminMerchantJoinRequestsQuery,
) => [ADMIN_MERCHANT_JOIN_REQUESTS_QUERY_KEY, input] as QueryKey

export const adminMerchantJoinRequestsQueryOptions = (
    input: AdminMerchantJoinRequestsQueryInput = {},
) => {
    const normalized = normalizeAdminMerchantJoinRequestsQuery(input)

    return queryOptions({
        queryKey: adminMerchantJoinRequestsQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response =
                await apiClient.get<AdminMerchantJoinRequestsResponse>(
                    "/admin/merchant-join-requests",
                    {
                        query: buildQueryParams(normalized),
                        schema: adminMerchantJoinRequestsResponseSchema,
                    },
                )

            if (!response.data) {
                throw new Error("商户加盟申请列表为空")
            }

            return response.data
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: "商户加盟申请列表加载失败",
        },
    })
}

export function useAdminMerchantJoinRequests(
    input: AdminMerchantJoinRequestsQueryInput = {},
) {
    return useSuspenseQuery(adminMerchantJoinRequestsQueryOptions(input))
}

export function invalidateAdminMerchantJoinRequestsQuery(
    queryClient: QueryClient,
    input: AdminMerchantJoinRequestsQueryInput = {},
) {
    return queryClient.invalidateQueries({
        queryKey: adminMerchantJoinRequestsQueryKey(
            normalizeAdminMerchantJoinRequestsQuery(input),
        ),
    })
}

export function useUpdateAdminMerchantJoinRequest(
    query?: AdminMerchantJoinRequestsQueryInput,
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            merchantJoinRequestId,
            payload,
        }: {
            merchantJoinRequestId: string
            payload: AdminUpdateMerchantJoinRequest
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.patch<AdminMerchantJoinRequest>(
                `/admin/merchant-join-requests/${merchantJoinRequestId}`,
                payload,
                {
                    schema: AdminMerchantJoinRequestSchema,
                },
            )

            if (!response.data) {
                throw new Error("更新商户加盟申请失败")
            }

            return response.data
        },
        onSuccess: () => {
            if (query) {
                invalidateAdminMerchantJoinRequestsQuery(queryClient, query)
                return
            }

            queryClient.invalidateQueries({
                queryKey: ADMIN_MERCHANT_JOIN_REQUESTS_QUERY_KEY,
            })
        },
        meta: {
            errorMessage: "更新商户加盟申请失败",
        },
    })
}

export function getAdminMerchantJoinRequestsExportUrl() {
    const baseUrl =
        process.env.NEXT_PUBLIC_ADMIN_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? ""

    return `${baseUrl.replace(/\/$/, "")}/admin/merchant-join-requests/export.csv`
}
