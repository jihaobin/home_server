"use client"

import { Suspense } from "react"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { ServiceTagsQueryState } from "../_utils/query"
import { ServiceTagsPageContent } from "./service-tags-page-content"
import { ServiceTagsPageError } from "./service-tags-page-error"
import { ServiceTagsTableSkeleton } from "./service-tags-table-skeleton"

type ServiceTagsPageSectionProps = {
    initialQuery: ServiceTagsQueryState
}

export function ServiceTagsPageSection({
    initialQuery,
}: ServiceTagsPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <ServiceTagsPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <Suspense fallback={<ServiceTagsTableSkeleton />}>
                        <ServiceTagsPageContent initialQuery={initialQuery} />
                    </Suspense>
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
