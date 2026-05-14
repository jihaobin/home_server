import type { AdminServiceOfferingsQueryInput } from "@repo/hooks/api/ssr"

const DEFAULT_PAGE = 1
const DEFAULT_LIMIT = 20

export type ServiceOfferingsQueryState = {
    page: number
    limit: number
    keyword: string
    status: "all" | "pending" | "published"
    reviewStatus: "all" | "pending" | "approved" | "rejected"
    publicationStatus: "all" | "active" | "taken_down"
}

export function parseServiceOfferingsSearchParams(
    searchParams: Record<string, string | string[] | undefined>,
): ServiceOfferingsQueryState {
    return normalizeServiceOfferingsQuery({
        page: parseNumberParam(searchParams.page),
        limit: parseNumberParam(searchParams.limit),
        keyword: parseStringParam(searchParams.keyword),
        status: parseStatusParam(searchParams.status),
        reviewStatus: parseReviewStatusParam(searchParams.reviewStatus),
        publicationStatus: parsePublicationStatusParam(
            searchParams.publicationStatus,
        ),
    })
}

export function normalizeServiceOfferingsQuery(
    input: Partial<ServiceOfferingsQueryState> = {},
): ServiceOfferingsQueryState {
    return {
        page: input.page && input.page > 0 ? input.page : DEFAULT_PAGE,
        limit: input.limit && input.limit > 0 ? input.limit : DEFAULT_LIMIT,
        keyword: input.keyword?.trim() ?? "",
        status: input.status ?? "all",
        reviewStatus: input.reviewStatus ?? "all",
        publicationStatus: input.publicationStatus ?? "all",
    }
}

export function toAdminServiceOfferingsQueryInput(
    query: ServiceOfferingsQueryState,
): AdminServiceOfferingsQueryInput {
    return {
        page: query.page,
        limit: query.limit,
        keyword: query.keyword || undefined,
        status: query.status,
        reviewStatus: query.reviewStatus,
        publicationStatus: query.publicationStatus,
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

    if (normalized.status !== "all") {
        params.set("status", normalized.status)
    }

    if (normalized.reviewStatus !== "all") {
        params.set("reviewStatus", normalized.reviewStatus)
    }

    if (normalized.publicationStatus !== "all") {
        params.set("publicationStatus", normalized.publicationStatus)
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

function parseStatusParam(value: string | string[] | undefined) {
    const raw = parseStringParam(value)
    return raw === "pending" || raw === "published" || raw === "all"
        ? raw
        : undefined
}

function parseReviewStatusParam(value: string | string[] | undefined) {
    const raw = parseStringParam(value)
    return raw === "pending" ||
        raw === "approved" ||
        raw === "rejected" ||
        raw === "all"
        ? raw
        : undefined
}

function parsePublicationStatusParam(value: string | string[] | undefined) {
    const raw = parseStringParam(value)
    return raw === "active" || raw === "taken_down" || raw === "all"
        ? raw
        : undefined
}
