import { HydrateClient } from "@/components/hydrate-client"
import { preloadRevenueLogsPageState } from "@/lib/prefetchers"
import { RevenueLogsPageSection } from "./_components/revenue-logs-page-section"
import {
    normalizeRevenueLogsQuery,
    parseRevenueLogsSearchParams,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function RevenueLogsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseRevenueLogsSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadRevenueLogsPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <RevenueLogsPageSection
                initialQuery={normalizeRevenueLogsQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
