"use client"

import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import type { OrdersQueryState } from "../_utils/query"
import { OrdersPageContent } from "./orders-page-content"
import { OrdersPageError } from "./orders-page-error"

type OrdersPageSectionProps = {
    initialQuery: OrdersQueryState
}

export function OrdersPageSection({ initialQuery }: OrdersPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <OrdersPageError error={error} onRetry={resetErrorBoundary} />
                    )}
                >
                    <OrdersPageContent initialQuery={initialQuery} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}
