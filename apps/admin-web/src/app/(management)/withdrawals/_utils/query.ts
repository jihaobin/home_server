import type { AdminWithdrawalsQueryInput } from "@repo/hooks/api/ssr"
import type { PaymentMethod, WithdrawalStatus } from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

export type WithdrawalsQueryState = Required<
    Pick<AdminWithdrawalsQueryInput, "page" | "limit">
> &
    Omit<AdminWithdrawalsQueryInput, "page" | "limit">

export function normalizeWithdrawalsQuery(
    input: AdminWithdrawalsQueryInput = {},
): WithdrawalsQueryState {
    const page = typeof input.page === "number" && input.page > 0 ? input.page : 1
    const limit =
        typeof input.limit === "number" && input.limit > 0 ? input.limit : 20

    return {
        page,
        limit,
        startDate: input.startDate,
        endDate: input.endDate,
        minAmount:
            typeof input.minAmount === "number" ? input.minAmount : undefined,
        maxAmount:
            typeof input.maxAmount === "number" ? input.maxAmount : undefined,
        status: input.status,
        method: input.method,
        keyword: input.keyword,
    }
}

export function parseWithdrawalsSearchParams(
    searchParams?: RawSearchParams,
): AdminWithdrawalsQueryInput {
    if (!searchParams) {
        return {}
    }

    const getValue = (key: string) => {
        const raw = searchParams[key]
        return Array.isArray(raw) ? raw[0] : raw ?? undefined
    }

    const page = Number(getValue("page"))
    const limit = Number(getValue("limit"))
    const minAmount = Number(getValue("minAmount"))
    const maxAmount = Number(getValue("maxAmount"))
    const startDate = normalizeDate(getValue("startDate"))
    const endDate = normalizeDate(getValue("endDate"))
    const status = normalizeStatus(getValue("status"))
    const method = normalizeMethod(getValue("method"))
    const keyword = normalizeKeyword(getValue("keyword"))

    return {
        page: Number.isFinite(page) && page > 0 ? page : undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
        maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
        startDate,
        endDate,
        status,
        method,
        keyword,
    }
}

export function buildWithdrawalsSearchParams(state: WithdrawalsQueryState) {
    const params = new URLSearchParams()

    if (state.page > 1) {
        params.set("page", String(state.page))
    }
    if (state.limit !== 20) {
        params.set("limit", String(state.limit))
    }
    if (state.startDate) {
        params.set("startDate", state.startDate)
    }
    if (state.endDate) {
        params.set("endDate", state.endDate)
    }
    if (typeof state.minAmount === "number") {
        params.set("minAmount", String(state.minAmount))
    }
    if (typeof state.maxAmount === "number") {
        params.set("maxAmount", String(state.maxAmount))
    }
    if (state.status) {
        params.set("status", state.status)
    }
    if (state.method) {
        params.set("method", state.method)
    }
    if (state.keyword) {
        params.set("keyword", state.keyword)
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

function normalizeDate(value?: string) {
    if (!value) {
        return undefined
    }
    const timestamp = Date.parse(value)
    if (Number.isNaN(timestamp)) {
        return undefined
    }
    return new Date(timestamp).toISOString()
}

const STATUS_VALUES: WithdrawalStatus[] = [
    "pending",
    "approved",
    "completed",
    "rejected",
]

const METHOD_VALUES: PaymentMethod[] = ["alipay", "wechat_pay", "bank_transfer"]

function normalizeStatus(value?: string) {
    if (!value) {
        return undefined
    }
    return STATUS_VALUES.includes(value as WithdrawalStatus)
        ? (value as WithdrawalStatus)
        : undefined
}

function normalizeMethod(value?: string) {
    if (!value) {
        return undefined
    }
    return METHOD_VALUES.includes(value as PaymentMethod)
        ? (value as PaymentMethod)
        : undefined
}

function normalizeKeyword(value?: string) {
    if (!value) {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
}
