"use client"

import { Skeleton } from "@repo/web-ui/components/skeleton"

export function WithdrawalsTableSkeleton() {
    return (
        <div className="space-y-4 rounded-2xl border bg-card p-4">
            {Array.from({ length: 5 }).map((_, index) => (
                <div
                    key={index}
                    className="flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                >
                    <div className="flex-1 space-y-2">
                        <Skeleton className="h-4 w-48" />
                        <Skeleton className="h-3 w-56" />
                    </div>
                    <Skeleton className="h-9 w-32" />
                </div>
            ))}
        </div>
    )
}
