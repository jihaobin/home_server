"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { MerchantJoinRequestsQueryState } from "../_utils/query"
import { MerchantJoinRequestsPageContent } from "./merchant-join-requests-page-content"
import { MerchantJoinRequestsPageError } from "./merchant-join-requests-page-error"

type MerchantJoinRequestsPageSectionProps = {
    initialQuery: MerchantJoinRequestsQueryState
}

export function MerchantJoinRequestsPageSection({
    initialQuery,
}: MerchantJoinRequestsPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <MerchantJoinRequestsPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <MerchantJoinRequestsPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
