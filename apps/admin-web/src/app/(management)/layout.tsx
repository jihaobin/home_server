import type { ReactNode } from "react"
import { HydrateClient } from "@/components/hydrate-client"
import { AdminShell } from "@/components/layout/admin-shell"
import { preloadAdminShellState } from "@/lib/prefetchers"

export default async function ManagementLayout({
    children,
}: {
    children: ReactNode
}) {
    const dehydratedState = await preloadAdminShellState()

    return (
        <HydrateClient state={dehydratedState}>
            <AdminShell>{children}</AdminShell>
        </HydrateClient>
    )
}
