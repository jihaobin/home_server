"use client"

import { Skeleton } from "@repo/web-ui/components/skeleton"

export function OrdersTableSkeleton() {
    return (
        <div className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm text-muted-foreground">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-8 w-24" />
            </div>
            <div className="space-y-3 px-4 py-6">
                {Array.from({ length: 6 }).map((_, index) => (
                    <div
                        key={index}
                        className="grid gap-4 rounded-xl border px-4 py-3 md:grid-cols-[160px,1fr,1fr,200px,140px,120px]"
                    >
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-24" />
                    </div>
                ))}
            </div>
            <div className="border-t px-4 py-3">
                <Skeleton className="h-9 w-48" />
            </div>
        </div>
    )
}
