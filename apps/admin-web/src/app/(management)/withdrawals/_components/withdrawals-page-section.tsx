"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { WithdrawalsQueryState } from "../_utils/query"
import { WithdrawalsPageContent } from "./withdrawals-page-content"
import { WithdrawalsPageError } from "./withdrawals-page-error"

type WithdrawalsPageSectionProps = {
    initialQuery: WithdrawalsQueryState
}

export function WithdrawalsPageSection({
    initialQuery,
}: WithdrawalsPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <WithdrawalsPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <WithdrawalsPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
