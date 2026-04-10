import { HydrateClient } from "@/components/hydrate-client";
import { preloadServiceCategoryCommissionStrategyPageState } from "@/lib/prefetchers";
import { CommissionStrategyPageSection } from "./_components/commission-strategy-page-section";

type PageProps = {
    params: Promise<{
        categoryId: string;
    }>;
};

export default async function ServiceCategoryCommissionStrategyPage({
    params,
}: PageProps) {
    const { categoryId } = await params;
    const dehydratedState =
        await preloadServiceCategoryCommissionStrategyPageState(categoryId);

    return (
        <HydrateClient state={dehydratedState}>
            <CommissionStrategyPageSection categoryId={categoryId} />
        </HydrateClient>
    );
}
