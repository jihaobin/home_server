import { HydrateClient } from "@/components/hydrate-client"
import { preloadServiceOfferingsPageState } from "@/lib/prefetchers"
import { ServiceOfferingsPageSection } from "./_components/service-offerings-page-section"
import {
    normalizeServiceOfferingsQuery,
    parseServiceOfferingsSearchParams,
    toAdminServiceOfferingsQueryInput,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function ServiceOfferingsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseServiceOfferingsSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadServiceOfferingsPageState(
        toAdminServiceOfferingsQueryInput(initialQuery),
    )

    return (
        <HydrateClient state={dehydratedState}>
            <ServiceOfferingsPageSection
                initialQuery={normalizeServiceOfferingsQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
