import { HydrateClient } from "@/components/hydrate-client"
import { preloadServiceTagsPageState } from "@/lib/prefetchers"
import { ServiceTagsPageSection } from "./_components/service-tags-page-section"
import {
    normalizeServiceTagsQuery,
    parseServiceTagsSearchParams,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ServiceTagsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = normalizeServiceTagsQuery(
        parseServiceTagsSearchParams(resolvedSearchParams),
    )
    const dehydratedState = await preloadServiceTagsPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <ServiceTagsPageSection initialQuery={initialQuery} />
        </HydrateClient>
    )
}
