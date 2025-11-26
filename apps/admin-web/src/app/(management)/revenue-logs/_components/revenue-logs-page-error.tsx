"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"

type RevenueLogsPageErrorProps = {
    error?: Error
    onRetry: () => void
}

export function RevenueLogsPageError({
    error,
    onRetry,
}: RevenueLogsPageErrorProps) {
    return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-2xl border border-destructive/20 bg-destructive/5 px-6 py-16 text-center">
            <AlertTriangle className="size-10 text-destructive" />
            <div className="space-y-1">
                <p className="text-lg font-semibold text-destructive">收益流水加载失败</p>
                <p className="text-sm text-muted-foreground">
                    {error?.message ?? "请稍后重试或刷新页面"}
                </p>
            </div>
            <Button onClick={onRetry} variant="outline">
                重试
            </Button>
        </div>
    )
}
