"use client"

import type { FallbackProps } from "react-error-boundary"
import { AlertCircle, RefreshCcw } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"

export function ServiceOfferingsPageError({
    error,
    resetErrorBoundary,
}: FallbackProps) {
    return (
        <div className="rounded-2xl border bg-card p-8">
            <div className="flex max-w-2xl items-start gap-4">
                <div className="rounded-full bg-destructive/10 p-3 text-destructive">
                    <AlertCircle className="size-5" />
                </div>
                <div className="space-y-3">
                    <div>
                        <h2 className="text-lg font-semibold">服务发布管理加载失败</h2>
                        <p className="mt-1 text-sm text-muted-foreground">
                            {error.message || "请稍后重试，或刷新页面重新获取数据。"}
                        </p>
                    </div>
                    <Button size="sm" onClick={resetErrorBoundary}>
                        <RefreshCcw className="mr-2 size-4" />
                        重新加载
                    </Button>
                </div>
            </div>
        </div>
    )
}
