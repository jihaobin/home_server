"use client";

import { Suspense } from "react";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import { AlertTriangle, RefreshCw } from "lucide-react";
import { Button } from "@repo/web-ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@repo/web-ui/components/card";
import { Skeleton } from "@repo/web-ui/components/skeleton";
import { CommissionStrategyPageContent } from "./commission-strategy-page-content";

type CommissionStrategyPageSectionProps = {
    categoryId: string;
};

export function CommissionStrategyPageSection({
    categoryId,
}: CommissionStrategyPageSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ error, resetErrorBoundary }) => (
                        <CommissionStrategyPageError
                            error={error}
                            onRetry={resetErrorBoundary}
                        />
                    )}
                >
                    <Suspense fallback={<CommissionStrategyPageSkeleton />}>
                        <CommissionStrategyPageContent
                            categoryId={categoryId}
                        />
                    </Suspense>
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    );
}

function CommissionStrategyPageError({
    error,
    onRetry,
}: {
    error: Error;
    onRetry: () => void;
}) {
    return (
        <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <div className="flex items-center gap-3">
                <AlertTriangle className="size-5" />
                <div>
                    <p className="text-sm font-semibold">抽成策略加载失败</p>
                    <p className="text-sm opacity-80">{error.message}</p>
                </div>
            </div>
            <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 size-4" />
                重试加载
            </Button>
        </div>
    );
}

function CommissionStrategyPageSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-2">
                <Skeleton className="h-5 w-56" />
                <Skeleton className="h-4 w-80" />
            </div>
            <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Skeleton className="h-5 w-40" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-12 w-full" />
                        <Skeleton className="h-40 w-full" />
                    </CardContent>
                </Card>
                <Card>
                    <CardHeader>
                        <CardTitle>
                            <Skeleton className="h-5 w-32" />
                        </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-10 w-full" />
                        <Skeleton className="h-28 w-full" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}
