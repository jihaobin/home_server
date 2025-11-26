"use client"

import { Suspense } from "react"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
import { Card, CardContent } from "@repo/web-ui/components/card"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import { ServiceCategoriesPageContent } from "./service-categories-page-content"

export function ServiceCategoriesPageSection() {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <ServiceCategoriesPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <Suspense fallback={<ServiceCategoriesPageSkeleton />}>
                        <ServiceCategoriesPageContent />
                    </Suspense>
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}

function ServiceCategoriesPageError({
    error,
    onRetry,
}: {
    error: Error
    onRetry: () => void
}) {
    return (
        <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <div className="flex items-center gap-3">
                <AlertTriangle className="size-5" />
                <div>
                    <p className="text-sm font-semibold">分类树加载失败</p>
                    <p className="text-sm opacity-80">{error.message}</p>
                </div>
            </div>
            <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 size-4" />
                重试加载
            </Button>
        </div>
    )
}

function ServiceCategoriesPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-5 w-48" />
                <Skeleton className="h-4 w-72" />
            </div>
            <Card>
                <CardContent className="grid gap-6 p-6 lg:grid-cols-[320px_1fr]">
                    <div className="space-y-3">
                        <Skeleton className="h-4 w-24" />
                        <div className="space-y-2">
                            {[...Array(3)].map((_, index) => (
                                <Skeleton key={index} className="h-10 w-full" />
                            ))}
                        </div>
                    </div>
                    <div className="space-y-3">
                        <Skeleton className="h-6 w-40" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-24 w-full" />
                    </div>
                </CardContent>
            </Card>
        </div>
    )
}
