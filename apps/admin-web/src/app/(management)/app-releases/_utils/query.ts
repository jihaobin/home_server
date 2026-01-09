import type { AdminAppReleasesQueryInput } from "@repo/hooks/api/ssr"
import type {
    AppReleaseApp,
    AppReleasePlatform,
} from "@repo/types"

type RawSearchParams = Record<string, string | string[] | undefined>

export type AppReleasesQueryState = AdminAppReleasesQueryInput

const APP_VALUES: AppReleaseApp[] = ["mobile-user", "mobile-worker"]
const PLATFORM_VALUES: AppReleasePlatform[] = ["android", "ios"]

export function normalizeAppReleasesQuery(
    input: AdminAppReleasesQueryInput = {},
): AppReleasesQueryState {
    return {
        app: normalizeApp(input.app),
        platform: normalizePlatform(input.platform),
        isActive:
            typeof input.isActive === "boolean" ? input.isActive : undefined,
    }
}

export function parseAppReleasesSearchParams(
    searchParams?: RawSearchParams,
): AdminAppReleasesQueryInput {
    if (!searchParams) {
        return {}
    }

    const getValue = (key: string) => {
        const raw = searchParams[key]
        return Array.isArray(raw) ? raw[0] : raw ?? undefined
    }

    const app = normalizeApp(getValue("app"))
    const platform = normalizePlatform(getValue("platform"))
    const isActive = normalizeBoolean(getValue("isActive"))

    return {
        app,
        platform,
        isActive,
    }
}

export function buildAppReleasesSearchParams(state: AppReleasesQueryState) {
    const params = new URLSearchParams()

    if (state.app) {
        params.set("app", state.app)
    }
    if (state.platform) {
        params.set("platform", state.platform)
    }
    if (typeof state.isActive === "boolean") {
        params.set("isActive", String(state.isActive))
    }

    const query = params.toString()
    return query ? `?${query}` : ""
}

function normalizeApp(value?: string): AppReleaseApp | undefined {
    if (!value) {
        return undefined
    }
    return APP_VALUES.includes(value as AppReleaseApp)
        ? (value as AppReleaseApp)
        : undefined
}

function normalizePlatform(
    value?: string,
): AppReleasePlatform | undefined {
    if (!value) {
        return undefined
    }
    return PLATFORM_VALUES.includes(value as AppReleasePlatform)
        ? (value as AppReleasePlatform)
        : undefined
}

function normalizeBoolean(value?: string): boolean | undefined {
    if (value === undefined) {
        return undefined
    }
    if (value === "true") {
        return true
    }
    if (value === "false") {
        return false
    }
    return undefined
}
