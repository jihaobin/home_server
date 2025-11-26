import { HydrateClient } from "@/components/hydrate-client"
import { preloadOrdersPageState } from "@/lib/prefetchers"
import { OrdersPageSection } from "./_components/orders-page-section"
import { normalizeOrdersQuery, parseOrdersSearchParams } from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function OrdersPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseOrdersSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadOrdersPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <OrdersPageSection initialQuery={normalizeOrdersQuery(initialQuery)} />
        </HydrateClient>
    )
}
