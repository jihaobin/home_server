import type { AdminServiceTagListQuery } from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

type ServiceTagStatus = NonNullable<AdminServiceTagListQuery["status"]>
type ServiceTagDomain = NonNullable<AdminServiceTagListQuery["domain"]>

const STATUS_VALUES: ServiceTagStatus[] = ["all", "active", "inactive"]
const DOMAIN_VALUES: ServiceTagDomain[] = ["massage"]
const DEFAULT_SERVICE_TAGS_QUERY: AdminServiceTagListQuery = {
    status: "all",
}

export type ServiceTagsQueryState = {
    domain: ServiceTagDomain
    status: ServiceTagStatus
    keyword?: string
}

export function normalizeServiceTagsQuery(
    input: AdminServiceTagListQuery = DEFAULT_SERVICE_TAGS_QUERY,
): ServiceTagsQueryState {
    return {
        domain: normalizeDomain(input.domain) ?? "massage",
        status: normalizeStatus(input.status) ?? "all",
        keyword: normalizeKeyword(input.keyword),
    }
}

export function parseServiceTagsSearchParams(
    searchParams?: RawSearchParams,
): AdminServiceTagListQuery {
    if (!searchParams) {
        return DEFAULT_SERVICE_TAGS_QUERY
    }

    const getValue = (key: string) => {
        const raw = searchParams[key]
        return Array.isArray(raw) ? raw[0] : raw ?? undefined
    }

    return {
        domain: normalizeDomain(getValue("domain")),
        status: normalizeStatus(getValue("status")) ?? "all",
        keyword: normalizeKeyword(getValue("keyword")),
    }
}

export function buildServiceTagsSearchParams(state: ServiceTagsQueryState) {
    const params = new URLSearchParams()

    if (state.domain !== "massage") {
        params.set("domain", state.domain)
    }
    if (state.status !== "all") {
        params.set("status", state.status)
    }
    if (state.keyword) {
        params.set("keyword", state.keyword)
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

function normalizeDomain(
    value?: string,
): ServiceTagDomain | undefined {
    if (!value) {
        return undefined
    }

    return DOMAIN_VALUES.includes(value as ServiceTagDomain)
        ? (value as ServiceTagDomain)
        : undefined
}

function normalizeStatus(
    value?: string,
): ServiceTagStatus | undefined {
    if (!value) {
        return undefined
    }

    return STATUS_VALUES.includes(value as ServiceTagStatus)
        ? (value as ServiceTagStatus)
        : undefined
}

function normalizeKeyword(value?: string) {
    if (!value) {
        return undefined
    }

    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
}
