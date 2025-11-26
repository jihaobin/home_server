import type {
    AdminRevenueDirection,
    TransactionType,
} from "@repo/types"
import type { AdminRevenueLogsQueryInput } from "@repo/hooks/api/ssr"

type RawSearchParams = Record<string, string | string[] | undefined>

export type RevenueLogsQueryState = Required<
    Pick<AdminRevenueLogsQueryInput, "page" | "limit">
> &
    Omit<AdminRevenueLogsQueryInput, "page" | "limit">

export function normalizeRevenueLogsQuery(
    input: AdminRevenueLogsQueryInput = {},
): RevenueLogsQueryState {
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
        transactionType: input.transactionType,
        direction: input.direction,
    }
}

export function parseRevenueLogsSearchParams(
    searchParams?: RawSearchParams,
): AdminRevenueLogsQueryInput {
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
    const transactionType = normalizeTransactionType(
        getValue("transactionType"),
    )
    const direction = normalizeDirection(getValue("direction"))

    return {
        page: Number.isFinite(page) && page > 0 ? page : undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
        maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
        startDate,
        endDate,
        transactionType,
        direction,
    }
}

export function buildRevenueLogsSearchParams(state: RevenueLogsQueryState) {
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
    if (state.transactionType) {
        params.set("transactionType", state.transactionType)
    }
    if (state.direction) {
        params.set("direction", state.direction)
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

const TRANSACTION_TYPES: TransactionType[] = [
    "service_earning",
    "platform_fee",
    "withdrawal",
    "refund_paid",
    "bonus",
    "penalty",
    "adjustment",
    "payment_received",
]

const DIRECTIONS: AdminRevenueDirection[] = ["income", "expense"]

function normalizeTransactionType(value?: string) {
    if (!value) {
        return undefined
    }
    return TRANSACTION_TYPES.includes(value as TransactionType)
        ? (value as TransactionType)
        : undefined
}

function normalizeDirection(value?: string) {
    if (!value) {
        return undefined
    }
    return DIRECTIONS.includes(value as AdminRevenueDirection)
        ? (value as AdminRevenueDirection)
        : undefined
}
