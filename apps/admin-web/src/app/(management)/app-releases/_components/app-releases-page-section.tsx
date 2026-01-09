"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { AppReleasesQueryState } from "../_utils/query"
import { AppReleasesPageContent } from "./app-releases-page-content"
import { AppReleasesPageError } from "./app-releases-page-error"

type AppReleasesPageSectionProps = {
    initialQuery: AppReleasesQueryState
}

export function AppReleasesPageSection({
    initialQuery,
}: AppReleasesPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <AppReleasesPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <AppReleasesPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
