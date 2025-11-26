import type { AdminDashboardRange } from "@repo/types"
import { HydrateClient } from "@/components/hydrate-client"
import { preloadDashboardOverviewState } from "@/lib/prefetchers"
import { DashboardOverviewSection } from "./_components/dashboard-overview-section"

type DashboardSearchParams = Record<string, string | string[] | undefined>

type DashboardPageProps = {
    searchParams?: Promise<DashboardSearchParams>
}

const DEFAULT_RANGE: AdminDashboardRange = "30d"

export default async function DashboardPage({ searchParams }: DashboardPageProps) {
    const resolvedSearchParams = await searchParams
    const initialRange = resolveRange(resolvedSearchParams)
    const dehydratedState = await preloadDashboardOverviewState(initialRange)

    return (
        <HydrateClient state={dehydratedState}>
            <DashboardOverviewSection key={initialRange} initialRange={initialRange} />
        </HydrateClient>
    )
}

function resolveRange(searchParams?: DashboardSearchParams): AdminDashboardRange {
    const rawValue = searchParams ? searchParams["range"] : undefined
    const normalized = Array.isArray(rawValue) ? rawValue[0] : rawValue
    if (normalized === "7d" || normalized === "30d" || normalized === "90d") {
        return normalized
    }
    return DEFAULT_RANGE
}
