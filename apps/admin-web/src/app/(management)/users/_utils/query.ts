import type { AdminUsersQueryInput } from "@repo/hooks/api/ssr"
import type { UserRole } from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

const USER_ROLE_VALUES: UserRole[] = [
    "customer",
    "service_personnel",
    "shop_admin",
    "admin",
    "super_admin",
]

const STATUS_VALUES = new Set(["active", "inactive"])

export type UsersQueryState = Required<Pick<AdminUsersQueryInput, "page" | "limit">> &
    Omit<AdminUsersQueryInput, "page" | "limit">

export function normalizeUsersQuery(
    input: AdminUsersQueryInput = {},
): UsersQueryState {
    return {
        page: typeof input.page === "number" && input.page > 0 ? input.page : 1,
        limit:
            typeof input.limit === "number" && input.limit > 0 ? input.limit : 20,
        name: input.name,
        phone: input.phone,
        role: input.role,
        status: input.status,
    }
}

export function parseUsersSearchParams(
    searchParams?: RawSearchParams,
): AdminUsersQueryInput {
    if (!searchParams) {
        return {}
    }

    const getValue = (key: string) => {
        const raw = searchParams[key]
        if (Array.isArray(raw)) {
            return raw[0]
        }
        return raw ?? undefined
    }

    const pageValue = Number(getValue("page"))
    const limitValue = Number(getValue("limit"))
    const roleValue = getValue("role")
    const statusValue = getValue("status")
    const nameValue = getValue("name")
    const phoneValue = getValue("phone")

    return {
        page: Number.isFinite(pageValue) && pageValue > 0 ? pageValue : undefined,
        limit:
            Number.isFinite(limitValue) && limitValue > 0 ? limitValue : undefined,
        role: USER_ROLE_VALUES.includes(roleValue as UserRole)
            ? (roleValue as UserRole)
            : undefined,
        status: statusValue && STATUS_VALUES.has(statusValue) ? statusValue : undefined,
        name: nameValue?.trim() ? nameValue.trim() : undefined,
        phone: phoneValue?.trim() ? phoneValue.trim() : undefined,
    }
}

export function buildUsersSearchParams(state: UsersQueryState) {
    const params = new URLSearchParams()

    if (state.page > 1) {
        params.set("page", String(state.page))
    }
    if (state.limit !== 20) {
        params.set("limit", String(state.limit))
    }
    if (state.name) {
        params.set("name", state.name)
    }
    if (state.phone) {
        params.set("phone", state.phone)
    }
    if (state.role) {
        params.set("role", state.role)
    }
    if (state.status) {
        params.set("status", state.status)
    }

    const query = params.toString()
    return query.length ? `?${query}` : ""
}
