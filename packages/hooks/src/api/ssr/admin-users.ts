import {
    AdminUpdateUserRoleSchema,
    AdminUpdateUserStatusSchema,
    AdminUserDetailSchema,
    AdminUserListItemSchema,
    type AdminUpdateUserRole,
    type AdminUpdateUserStatus,
    type AdminUserDetail,
    type AdminUserListQuery,
} from "@repo/types"
import { PaginatedDataSchema } from "@repo/types"
import {
    QueryClient,
    queryOptions,
    useMutation,
    useQueryClient,
    useSuspenseQuery,
} from "@tanstack/react-query"
import type { QueryKey } from "@tanstack/react-query"
import { z } from "zod/v4"
import { getSsrApiClient } from "./client"

const ADMIN_USERS_QUERY_KEY = ["admin-users"] as const

type NormalizedAdminUsersQuery = Pick<AdminUserListQuery, "page" | "limit"> &
    Partial<Omit<AdminUserListQuery, "page" | "limit">>

export type AdminUsersQueryInput = Partial<AdminUserListQuery>

function normalizeAdminUsersQuery(
    input: AdminUsersQueryInput = {},
): NormalizedAdminUsersQuery {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    const base: NormalizedAdminUsersQuery = {
        page,
        limit,
    }

    if (input.name) {
        const normalizedName = input.name.trim()
        if (normalizedName) {
            base.name = normalizedName
        }
    }

    if (input.role) {
        base.role = input.role
    }

    if (input.phone) {
        const normalizedPhone = input.phone.trim()
        if (normalizedPhone) {
            base.phone = normalizedPhone
        }
    }

    if (input.status === "active" || input.status === "inactive") {
        base.status = input.status
    }

    return base
}

function buildQueryParams(params: NormalizedAdminUsersQuery) {
    const query: Record<string, string | number> = {
        page: params.page,
        limit: params.limit,
    }

    if (params.name) {
        query.name = params.name
    }
    if (params.role) {
        query.role = params.role
    }
    if (params.phone) {
        query.phone = params.phone
    }
    if (params.status) {
        query.status = params.status
    }

    return query
}

const adminUsersListSchema = PaginatedDataSchema(AdminUserListItemSchema)
type AdminUsersListResponse = z.infer<typeof adminUsersListSchema>

export const adminUsersQueryOptions = (input: AdminUsersQueryInput = {}) => {
    const normalized = normalizeAdminUsersQuery(input)

    return queryOptions({
        queryKey: adminUsersQueryKey(normalized),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.get<AdminUsersListResponse>(
                "/admin/users",
                {
                    query: buildQueryParams(normalized),
                    schema: adminUsersListSchema,
                },
            )

            if (!response.data) {
                throw new Error("用户列表为空")
            }

            return response.data
        },
        meta: {
            errorMessage: "用户列表加载失败",
        },
        staleTime: 30 * 1000,
    })
}

export const adminUsersQueryKey = (
    input: NormalizedAdminUsersQuery,
) => [ADMIN_USERS_QUERY_KEY, input] as QueryKey

export function useAdminUsers(input: AdminUsersQueryInput = {}) {
    return useSuspenseQuery(adminUsersQueryOptions(input))
}

const ADMIN_USER_DETAIL_QUERY_KEY = ["admin-user-detail"] as const

export const adminUserDetailQueryKey = (userId: string) =>
    [ADMIN_USER_DETAIL_QUERY_KEY, userId] as const

export const adminUserDetailQueryOptions = (userId: string) =>
    queryOptions({
        queryKey: adminUserDetailQueryKey(userId),
        queryFn: async () => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.get<AdminUserDetail>(
                `/admin/users/${userId}`,
                {
                    schema: AdminUserDetailSchema,
                },
            )

            if (!response.data) {
                throw new Error("用户详情为空")
            }

            return response.data
        },
        meta: {
            errorMessage: "用户详情加载失败",
        },
        staleTime: 30 * 1000,
    })

export function useAdminUserDetail(userId: string) {
    return useSuspenseQuery(adminUserDetailQueryOptions(userId))
}

export function useUpdateAdminUserStatus() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            userId,
            payload,
        }: {
            userId: string
            payload: AdminUpdateUserStatus
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.patch<AdminUserDetail>(
                `/admin/users/${userId}/status`,
                payload,
                {
                    schema: AdminUserDetailSchema,
                },
            )

            if (!response.data) {
                throw new Error("用户状态更新失败")
            }

            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateUsersQueries(queryClient, variables.userId)
        },
        meta: {
            errorMessage: "更新用户状态失败",
        },
    })
}

export function useUpdateAdminUserRole() {
    const queryClient = useQueryClient()

    return useMutation({
        mutationFn: async ({
            userId,
            payload,
        }: {
            userId: string
            payload: AdminUpdateUserRole
        }) => {
            const apiClient = getSsrApiClient()
            const response = await apiClient.patch<AdminUserDetail>(
                `/admin/users/${userId}/role`,
                payload,
                {
                    schema: AdminUserDetailSchema,
                },
            )

            if (!response.data) {
                throw new Error("用户角色更新失败")
            }

            return response.data
        },
        onSuccess: (_data, variables) => {
            invalidateUsersQueries(queryClient, variables.userId)
        },
        meta: {
            errorMessage: "更新用户角色失败",
        },
    })
}

function invalidateUsersQueries(
    queryClient: QueryClient,
    userId: string,
) {
    queryClient.invalidateQueries({ queryKey: ADMIN_USERS_QUERY_KEY })
    queryClient.invalidateQueries({
        queryKey: adminUserDetailQueryKey(userId),
    })
}
