"use client"

import { Skeleton } from "@repo/web-ui/components/skeleton"

export function UsersTableSkeleton() {
    return (
        <div className="rounded-2xl border bg-card">
            <div className="space-y-3 px-4 py-6">
                {Array.from({ length: 5 }).map((_, index) => (
                    <div
                        key={index}
                        className="grid gap-4 rounded-xl border px-4 py-3 md:grid-cols-[200px,120px,140px,1fr,160px]"
                    >
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-4 w-3/4" />
                        <Skeleton className="h-4 w-2/3" />
                        <Skeleton className="h-4 w-full" />
                        <Skeleton className="h-9 w-32" />
                    </div>
                ))}
            </div>
            <div className="border-t px-4 py-3">
                <Skeleton className="h-9 w-48" />
            </div>
        </div>
    )
}
