import type { AdminMerchantJoinRequestsQueryInput } from "@repo/hooks/api/ssr"
import type { AdminMerchantJoinRequestContactStatus } from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

export type MerchantJoinRequestsQueryState = Required<
    Pick<AdminMerchantJoinRequestsQueryInput, "page" | "limit">
> & {
    keyword?: string
    contactStatus: AdminMerchantJoinRequestContactStatus
}

const CONTACT_STATUS_VALUES: AdminMerchantJoinRequestContactStatus[] = [
    "all",
    "contacted",
    "uncontacted",
]

export function normalizeMerchantJoinRequestsQuery(
    input: AdminMerchantJoinRequestsQueryInput = {},
): MerchantJoinRequestsQueryState {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    return {
        page,
        limit,
        keyword: normalizeKeyword(input.keyword),
        contactStatus: normalizeContactStatus(input.contactStatus) ?? "all",
    }
}

export function parseMerchantJoinRequestsSearchParams(
    searchParams?: RawSearchParams,
): AdminMerchantJoinRequestsQueryInput {
    if (!searchParams) {
        return {}
    }

    const getValue = (key: string) => {
        const raw = searchParams[key]
        return Array.isArray(raw) ? raw[0] : raw ?? undefined
    }

    const page = Number(getValue("page"))
    const limit = Number(getValue("limit"))
    const keyword = normalizeKeyword(getValue("keyword"))
    const contactStatus = normalizeContactStatus(getValue("contactStatus"))

    return {
        page: Number.isFinite(page) && page > 0 ? page : undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        keyword,
        contactStatus,
    }
}

export function buildMerchantJoinRequestsSearchParams(
    state: MerchantJoinRequestsQueryState,
) {
    const params = new URLSearchParams()

    if (state.page > 1) {
        params.set("page", String(state.page))
    }

    if (state.limit !== 20) {
        params.set("limit", String(state.limit))
    }

    if (state.keyword) {
        params.set("keyword", state.keyword)
    }

    if (state.contactStatus !== "all") {
        params.set("contactStatus", state.contactStatus)
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

function normalizeKeyword(value?: string) {
    if (!value) {
        return undefined
    }

    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
}

function normalizeContactStatus(value?: string) {
    if (!value) {
        return undefined
    }

    return CONTACT_STATUS_VALUES.includes(
        value as AdminMerchantJoinRequestContactStatus,
    )
        ? (value as AdminMerchantJoinRequestContactStatus)
        : undefined
}
