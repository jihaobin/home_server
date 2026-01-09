import { redirect } from "next/navigation"
import {
    adminDashboardOverviewQueryOptions,
    adminProfileQueryOptions,
    adminUsersQueryOptions,
    adminOrdersQueryOptions,
    type AdminUsersQueryInput,
    type AdminOrdersQueryInput,
    adminServiceCategoriesQueryOptions,
    adminRevenueLogsQueryOptions,
    type AdminRevenueLogsQueryInput,
    adminWithdrawalsQueryOptions,
    type AdminWithdrawalsQueryInput,
    adminAppReleasesQueryOptions,
    type AdminAppReleasesQueryInput,
} from "@repo/hooks/api/ssr"
import { ErrorCode, type AdminDashboardRange } from "@repo/types"
import { ApiClientError } from "@repo/utils/api-client"
import { prefetchDehydratedState } from "@/lib/react-query-server"
import { ensureSsrApiClient } from "@/lib/ssr-api-client"

export async function preloadAdminShellState() {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminProfileQueryOptions())
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }

        throw error
    }
}

export async function preloadDashboardOverviewState(
    range: AdminDashboardRange = "30d",
) {
    ensureSsrApiClient()

    return prefetchDehydratedState(async (queryClient) => {
        await queryClient.fetchQuery(adminDashboardOverviewQueryOptions(range))
    })
}

export async function preloadUsersPageState(
    query: AdminUsersQueryInput = {},
) {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminUsersQueryOptions(query))
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }

        throw error
    }
}

export async function preloadOrdersPageState(
    query: AdminOrdersQueryInput = {},
) {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminOrdersQueryOptions(query))
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }

        throw error
    }
}

export async function preloadServiceCategoriesPageState() {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(
                adminServiceCategoriesQueryOptions(),
            )
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }
        throw error
    }
}

export async function preloadRevenueLogsPageState(
    query: AdminRevenueLogsQueryInput = {},
) {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminRevenueLogsQueryOptions(query))
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }
        throw error
    }
}

export async function preloadWithdrawalsPageState(
    query: AdminWithdrawalsQueryInput = {},
) {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminWithdrawalsQueryOptions(query))
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }
        throw error
    }
}

export async function preloadAppReleasesPageState(
    query: AdminAppReleasesQueryInput = {},
) {
    ensureSsrApiClient()

    try {
        return await prefetchDehydratedState(async (queryClient) => {
            await queryClient.fetchQuery(adminAppReleasesQueryOptions(query))
        })
    } catch (error) {
        if (
            error instanceof ApiClientError &&
            (error.code === ErrorCode.UNAUTHORIZED ||
                error.code === ErrorCode.FORBIDDEN)
        ) {
            redirect("/auth/login")
        }
        throw error
    }
}
