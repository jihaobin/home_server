"use client"

import { AlertTriangle, RefreshCw } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"

type AppReleasesPageErrorProps = {
    error: Error
    onRetry: () => void
}

export function AppReleasesPageError({
    error,
    onRetry,
}: AppReleasesPageErrorProps) {
    return (
        <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6 text-destructive">
            <div className="flex items-start gap-3">
                <AlertTriangle className="size-5" aria-hidden="true" />
                <div className="space-y-1">
                    <p className="text-sm font-semibold">应用版本数据加载失败</p>
                    <p className="text-xs opacity-80">{error.message}</p>
                </div>
            </div>
            <Button size="sm" variant="outline" onClick={onRetry}>
                <RefreshCw className="mr-2 size-4" />
                重试
            </Button>
        </div>
    )
}
