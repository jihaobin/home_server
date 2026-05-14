"use client"

import { Suspense } from "react"
import { ErrorBoundary } from "react-error-boundary"
import type { ServiceOfferingsQueryState } from "../_utils/query"
import { ServiceOfferingsPageContent } from "./service-offerings-page-content"
import { ServiceOfferingsPageError } from "./service-offerings-page-error"
import { ServiceOfferingsTableSkeleton } from "./service-offerings-table-skeleton"

type ServiceOfferingsPageSectionProps = {
    initialQuery: ServiceOfferingsQueryState
}

export function ServiceOfferingsPageSection({
    initialQuery,
}: ServiceOfferingsPageSectionProps) {
    return (
        <ErrorBoundary
            FallbackComponent={ServiceOfferingsPageError}
            resetKeys={[JSON.stringify(initialQuery)]}
        >
            <Suspense fallback={<ServiceOfferingsTableSkeleton />}>
                <ServiceOfferingsPageContent initialQuery={initialQuery} />
            </Suspense>
        </ErrorBoundary>
    )
}
