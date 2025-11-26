import { HydrateClient } from "@/components/hydrate-client"
import { preloadServiceCategoriesPageState } from "@/lib/prefetchers"
import { ServiceCategoriesPageSection } from "./_components/service-categories-page-section"

export default async function ServiceCategoriesPage() {
    const dehydratedState = await preloadServiceCategoriesPageState()

    return (
        <HydrateClient state={dehydratedState}>
            <ServiceCategoriesPageSection />
        </HydrateClient>
    )
}
