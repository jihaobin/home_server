"use client"

import { AlertTriangle } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/web-ui/components/card"

type OrdersPageErrorProps = {
    error: Error
    onRetry: () => void
}

export function OrdersPageError({ error, onRetry }: OrdersPageErrorProps) {
    return (
        <Card className="shadow-sm">
            <CardHeader className="flex flex-row items-center gap-3">
                <AlertTriangle className="text-destructive size-5" />
                <div>
                    <CardTitle>订单数据加载失败</CardTitle>
                    <CardDescription>尝试刷新或稍后再试。</CardDescription>
                </div>
            </CardHeader>
            <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                    {error.message || "未知错误"}
                </p>
                <Button onClick={onRetry} size="sm" variant="outline">
                    重新加载
                </Button>
            </CardContent>
        </Card>
    )
}
