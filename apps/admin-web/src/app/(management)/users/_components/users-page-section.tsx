"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { UsersQueryState } from "../_utils/query"
import { UsersPageContent } from "./users-page-content"
import { UsersPageError } from "./users-page-error"

type UsersPageSectionProps = {
    initialQuery: UsersQueryState
}

export function UsersPageSection({ initialQuery }: UsersPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <UsersPageError error={error} onRetry={resetErrorBoundary} />
                    )}
                >
                    <UsersPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
