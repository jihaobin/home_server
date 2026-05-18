import type { AdminServiceOfferingsQueryInput } from "@repo/hooks/api/ssr"
import type { ServiceOfferingLifecycleFilter } from "@repo/types"

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

export const SERVICE_OFFERINGS_LIFECYCLE_VALUES: ServiceOfferingLifecycleFilter[] = [
    "all",
    "pending_review",
    "rejected",
    "active",
    "taken_down",
]

export type ServiceOfferingsGroupMode = "flat" | "by-personnel"

export type ServiceOfferingsQueryState = {
    page: number
    limit: number
    keyword: string
    lifecycle: ServiceOfferingLifecycleFilter
    groupMode: ServiceOfferingsGroupMode
}

export function parseServiceOfferingsSearchParams(
    searchParams: Record<string, string | string[] | undefined>,
): ServiceOfferingsQueryState {
    return normalizeServiceOfferingsQuery({
        page: parseNumberParam(searchParams.page),
        limit: parseNumberParam(searchParams.limit),
        keyword: parseStringParam(searchParams.keyword),
        lifecycle: parseLifecycleParam(searchParams.lifecycle),
        groupMode: parseGroupModeParam(searchParams.group),
    })
}

export function normalizeServiceOfferingsQuery(
    input: Partial<ServiceOfferingsQueryState> = {},
): ServiceOfferingsQueryState {
    return {
        page: input.page && input.page > 0 ? input.page : DEFAULT_PAGE,
        limit: input.limit && input.limit > 0 ? input.limit : DEFAULT_LIMIT,
        keyword: input.keyword?.trim() ?? "",
        lifecycle: input.lifecycle ?? "pending_review",
        groupMode: input.groupMode ?? "flat",
    }
}

export function toAdminServiceOfferingsQueryInput(
    query: ServiceOfferingsQueryState,
): AdminServiceOfferingsQueryInput {
    return {
        page: query.page,
        limit: query.limit,
        keyword: query.keyword || undefined,
        lifecycle: query.lifecycle,
    }
}

export function buildServiceOfferingsSearchParams(
    query: ServiceOfferingsQueryState,
) {
    const normalized = normalizeServiceOfferingsQuery(query)
    const params = new URLSearchParams()

    if (normalized.page !== DEFAULT_PAGE) {
        params.set("page", String(normalized.page))
    }

    if (normalized.limit !== DEFAULT_LIMIT) {
        params.set("limit", String(normalized.limit))
    }

    if (normalized.keyword) {
        params.set("keyword", normalized.keyword)
    }

    if (normalized.lifecycle !== "pending_review") {
        params.set("lifecycle", normalized.lifecycle)
    }

    if (normalized.groupMode !== "flat") {
        params.set("group", normalized.groupMode)
    }

    const serialized = params.toString()
    return serialized ? `?${serialized}` : ""
}

function parseNumberParam(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value
    if (!raw) {
        return undefined
    }

    const parsed = Number(raw)
    return Number.isFinite(parsed) ? parsed : undefined
}

function parseStringParam(value: string | string[] | undefined) {
    const raw = Array.isArray(value) ? value[0] : value
    return raw?.trim() || undefined
}

function parseLifecycleParam(
    value: string | string[] | undefined,
): ServiceOfferingLifecycleFilter | undefined {
    const raw = parseStringParam(value)
    if (raw === "appeal_pending") {
        return "pending_review"
    }
    return raw && (SERVICE_OFFERINGS_LIFECYCLE_VALUES as string[]).includes(raw)
        ? (raw as ServiceOfferingLifecycleFilter)
        : undefined
}

function parseGroupModeParam(
    value: string | string[] | undefined,
): ServiceOfferingsGroupMode | undefined {
    const raw = parseStringParam(value)
    return raw === "by-personnel" || raw === "flat" ? raw : undefined
}
