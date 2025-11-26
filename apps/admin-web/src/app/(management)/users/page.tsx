import { HydrateClient } from "@/components/hydrate-client"
import { preloadUsersPageState } from "@/lib/prefetchers"
import { UsersPageSection } from "./_components/users-page-section"
import { normalizeUsersQuery, parseUsersSearchParams } from "./_utils/query"

type PageProps = {
    searchParams?: Promise<Record<string, string | string[] | undefined>>
}

export default async function UsersPage({ searchParams }: PageProps) {
    const resolvedSearchParams = (await searchParams) ?? {}
    const initialQuery = parseUsersSearchParams(resolvedSearchParams)
    const dehydratedState = await preloadUsersPageState(initialQuery)

    return (
        <HydrateClient state={dehydratedState}>
            <UsersPageSection initialQuery={normalizeUsersQuery(initialQuery)} />
        </HydrateClient>
    )
}
