import { HydrateClient } from "@/components/hydrate-client"
import { preloadAppReleasesPageState } from "@/lib/prefetchers"
import { AppReleasesPageSection } from "./_components/app-releases-page-section"
import {
    normalizeAppReleasesQuery,
    parseAppReleasesSearchParams,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function AppReleasesPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseAppReleasesSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadAppReleasesPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <AppReleasesPageSection
                initialQuery={normalizeAppReleasesQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
