import type { AdminOrdersQueryInput } from "@repo/hooks/api/ssr"
import type { AssignmentType, OrderStatus } from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

const ORDER_STATUS_VALUES: OrderStatus[] = [
    "pending_payment",
    "paid",
    "in_progress",
    "completed",
    "cancelled",
    "refunded",
]

const ASSIGNMENT_TYPE_VALUES: AssignmentType[] = [
    "system_auto",
    "customer_designated",
    "grab",
]

const SORT_FIELDS = new Set(["createdAt", "appointmentTime", "totalAmount"])
const SORT_ORDER_VALUES = new Set(["asc", "desc"])

export type OrdersQueryState = Required<Pick<AdminOrdersQueryInput, "page" | "limit">> &
    Omit<AdminOrdersQueryInput, "page" | "limit">

export function normalizeOrdersQuery(
    input: AdminOrdersQueryInput = {},
): OrdersQueryState {
    return {
        page: typeof input.page === "number" && input.page > 0 ? input.page : 1,
        limit:
            typeof input.limit === "number" && input.limit > 0 ? input.limit : 20,
        orderSerial: input.orderSerial,
        customerKeyword: input.customerKeyword,
        servicePersonnelKeyword: input.servicePersonnelKeyword,
        status: input.status,
        assignmentType: input.assignmentType,
        startDate: input.startDate,
        endDate: input.endDate,
        minAmount:
            typeof input.minAmount === "number" ? input.minAmount : undefined,
        maxAmount:
            typeof input.maxAmount === "number" ? input.maxAmount : undefined,
        sortBy: input.sortBy ?? "createdAt",
        sortOrder: input.sortOrder ?? "desc",
    }
}

export function parseOrdersSearchParams(
    searchParams?: RawSearchParams,
): AdminOrdersQueryInput {
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

    const page = Number(getValue("page"))
    const limit = Number(getValue("limit"))
    const minAmount = Number(getValue("minAmount"))
    const maxAmount = Number(getValue("maxAmount"))
    const sortBy = getValue("sortBy")
    const sortOrder = getValue("sortOrder")

    return {
        page: Number.isFinite(page) && page > 0 ? page : undefined,
        limit: Number.isFinite(limit) && limit > 0 ? limit : undefined,
        orderSerial: normalizeText(getValue("orderSerial")),
        customerKeyword: normalizeText(getValue("customerKeyword")),
        servicePersonnelKeyword: normalizeText(getValue("servicePersonnelKeyword")),
        status: toOrderStatus(getValue("status")),
        assignmentType: toAssignmentType(getValue("assignmentType")),
        startDate: normalizeDate(getValue("startDate")),
        endDate: normalizeDate(getValue("endDate")),
        minAmount: Number.isFinite(minAmount) ? minAmount : undefined,
        maxAmount: Number.isFinite(maxAmount) ? maxAmount : undefined,
        sortBy: sortBy && SORT_FIELDS.has(sortBy) ? (sortBy as typeof sortBy) : undefined,
        sortOrder:
            sortOrder && SORT_ORDER_VALUES.has(sortOrder)
                ? (sortOrder as "asc" | "desc")
                : undefined,
    }
}

export function buildOrdersSearchParams(state: OrdersQueryState) {
    const params = new URLSearchParams()

    if (state.page > 1) {
        params.set("page", String(state.page))
    }
    if (state.limit !== 20) {
        params.set("limit", String(state.limit))
    }
    if (state.orderSerial) {
        params.set("orderSerial", state.orderSerial)
    }
    if (state.customerKeyword) {
        params.set("customerKeyword", state.customerKeyword)
    }
    if (state.servicePersonnelKeyword) {
        params.set("servicePersonnelKeyword", state.servicePersonnelKeyword)
    }
    if (state.status) {
        params.set("status", state.status)
    }
    if (state.assignmentType) {
        params.set("assignmentType", state.assignmentType)
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
    if (state.sortBy && state.sortBy !== "createdAt") {
        params.set("sortBy", state.sortBy)
    }
    if (state.sortOrder && state.sortOrder !== "desc") {
        params.set("sortOrder", state.sortOrder)
    }

    const query = params.toString()
    return query.length ? `?${query}` : ""
}

function normalizeText(value?: string) {
    if (!value) {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
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

function toOrderStatus(value?: string) {
    if (!value) return undefined
    return ORDER_STATUS_VALUES.includes(value as OrderStatus)
        ? (value as OrderStatus)
        : undefined
}

function toAssignmentType(value?: string) {
    if (!value) return undefined
    return ASSIGNMENT_TYPE_VALUES.includes(value as AssignmentType)
        ? (value as AssignmentType)
        : undefined
}
