import { HydrateClient } from "@/components/hydrate-client"
import { preloadWithdrawalsPageState } from "@/lib/prefetchers"
import { WithdrawalsPageSection } from "./_components/withdrawals-page-section"
import {
    normalizeWithdrawalsQuery,
    parseWithdrawalsSearchParams,
} from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function WithdrawalsPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseWithdrawalsSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadWithdrawalsPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <WithdrawalsPageSection
                initialQuery={normalizeWithdrawalsQuery(initialQuery)}
            />
        </HydrateClient>
    )
}
