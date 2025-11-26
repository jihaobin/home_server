"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { RevenueLogsQueryState } from "../_utils/query"
import { RevenueLogsPageContent } from "./revenue-logs-page-content"
import { RevenueLogsPageError } from "./revenue-logs-page-error"

type RevenueLogsPageSectionProps = {
    initialQuery: RevenueLogsQueryState
}

export function RevenueLogsPageSection({
    initialQuery,
}: RevenueLogsPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <RevenueLogsPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <RevenueLogsPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
