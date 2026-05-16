import {
    AdminServiceOfferingListResponseSchema,
    type AdminServiceOfferingListQuery,
    type AdminServiceOfferingListResponse,
    type AdminServiceOfferingReason,
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

const ADMIN_SERVICE_OFFERINGS_QUERY_KEY = ["admin-service-offerings"] as const

const operationResultSchema = z.object({
    success: z.boolean(),
})

export type AdminServiceOfferingsQueryInput = Partial<AdminServiceOfferingListQuery>

export type NormalizedAdminServiceOfferingsQuery = {
    page: number
    limit: number
    keyword?: string
    lifecycle?: AdminServiceOfferingListQuery["lifecycle"]
}

export function normalizeAdminServiceOfferingsQuery(
    input: AdminServiceOfferingsQueryInput = {},
): NormalizedAdminServiceOfferingsQuery {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    const normalized: NormalizedAdminServiceOfferingsQuery = {
        page,
        limit,
    }

    if (input.keyword?.trim()) {
        normalized.keyword = input.keyword.trim()
    }

    if (input.lifecycle && input.lifecycle !== "all") {
        normalized.lifecycle = input.lifecycle
    }

    return normalized
}

function buildQueryParams(input: NormalizedAdminServiceOfferingsQuery) {
    const query: Record<string, string | number> = {
        page: input.page,
        limit: input.limit,
    }

    if (input.keyword) {
        query.keyword = input.keyword
    }

    if (input.lifecycle) {
        query.lifecycle = input.lifecycle
    }

    return query
}

export const adminServiceOfferingsQueryKey = (
    input: NormalizedAdminServiceOfferingsQuery,
) => [ADMIN_SERVICE_OFFERINGS_QUERY_KEY, input] as QueryKey

export const adminServiceOfferingsQueryOptions = (
    input: AdminServiceOfferingsQueryInput = {},
) => {
    const normalized = normalizeAdminServiceOfferingsQuery(input)

    return queryOptions({
        queryKey: adminServiceOfferingsQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.get<AdminServiceOfferingListResponse>(
                "/admin/service-offerings",
                {
                    query: buildQueryParams(normalized),
                    schema: AdminServiceOfferingListResponseSchema,
                },
            )

            if (!response.data) {
                throw new Error("服务发布管理列表为空")
            }

            return response.data
        },
        staleTime: 30 * 1000,
        meta: {
            errorMessage: "服务发布管理列表加载失败",
        },
    })
}

export function useAdminServiceOfferings(
    input: AdminServiceOfferingsQueryInput = {},
) {
    return useSuspenseQuery(adminServiceOfferingsQueryOptions(input))
}

export function invalidateAdminServiceOfferingsQuery(
    queryClient: QueryClient,
    input?: AdminServiceOfferingsQueryInput,
) {
    if (input) {
        const normalized = normalizeAdminServiceOfferingsQuery(input)
        return queryClient.invalidateQueries({
            queryKey: adminServiceOfferingsQueryKey(normalized),
        })
    }

    return queryClient.invalidateQueries({
        predicate: (query) => {
            const [baseKey] = query.queryKey
            return (
                Array.isArray(baseKey) &&
                baseKey[0] === ADMIN_SERVICE_OFFERINGS_QUERY_KEY[0]
            )
        },
    })
}

export function useApproveAdminServiceOfferingDraft(
    query?: AdminServiceOfferingsQueryInput,
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async (draftId: string) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.post<z.infer<typeof operationResultSchema>>(
                `/admin/service-offerings/drafts/${draftId}/approve`,
                undefined,
                {
                    schema: operationResultSchema,
                },
            )

            if (!response.data?.success) {
                throw new Error("审核通过服务发布草稿失败")
            }

            return response.data
        },
        onSuccess: () => {
            invalidateAdminServiceOfferingsQuery(queryClient)
        },
        meta: {
            errorMessage: "审核通过服务发布草稿失败",
        },
    })
}

export function useRejectAdminServiceOfferingDraft(
    query?: AdminServiceOfferingsQueryInput,
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            draftId,
            reason,
        }: {
            draftId: string
            reason: AdminServiceOfferingReason["reason"]
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.post<z.infer<typeof operationResultSchema>>(
                `/admin/service-offerings/drafts/${draftId}/reject`,
                { reason },
                {
                    schema: operationResultSchema,
                },
            )

            if (!response.data?.success) {
                throw new Error("审核拒绝服务发布草稿失败")
            }

            return response.data
        },
        onSuccess: () => {
            invalidateAdminServiceOfferingsQuery(queryClient)
        },
        meta: {
            errorMessage: "审核拒绝服务发布草稿失败",
        },
    })
}

export function useTakeDownAdminServiceOffering(
    query?: AdminServiceOfferingsQueryInput,
) {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            personnelId,
            serviceId,
            reason,
        }: {
            personnelId: string
            serviceId: string
            reason: AdminServiceOfferingReason["reason"]
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.post<z.infer<typeof operationResultSchema>>(
                `/admin/service-offerings/${personnelId}/${serviceId}/take-down`,
                { reason },
                {
                    schema: operationResultSchema,
                },
            )

            if (!response.data?.success) {
                throw new Error("下架服务失败")
            }

            return response.data
        },
        onSuccess: () => {
            invalidateAdminServiceOfferingsQuery(queryClient)
        },
        meta: {
            errorMessage: "下架服务失败",
        },
    })
}
