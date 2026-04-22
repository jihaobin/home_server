import { HydrateClient } from "@/components/hydrate-client"
import { preloadMerchantJoinRequestsPageState } from "@/lib/prefetchers"
import { MerchantJoinRequestsPageSection } from "./_components/merchant-join-requests-page-section"
import {
    normalizeMerchantJoinRequestsQuery,
    parseMerchantJoinRequestsSearchParams,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function MerchantJoinRequestsPage({
    searchParams,
}: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseMerchantJoinRequestsSearchParams(resolvedSearchParams)
    const dehydratedState =
        await preloadMerchantJoinRequestsPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <MerchantJoinRequestsPageSection
                initialQuery={normalizeMerchantJoinRequestsQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
