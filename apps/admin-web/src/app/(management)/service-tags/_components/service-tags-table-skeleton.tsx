"use client"

import { Card, CardContent } from "@repo/web-ui/components/card"
import { Skeleton } from "@repo/web-ui/components/skeleton"

export function ServiceTagsTableSkeleton() {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4">
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-1 gap-3 rounded-xl border px-4 py-3 md:grid-cols-[2fr_120px_100px_120px_220px]"
                        >
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-40" />
                                <Skeleton className="h-3 w-64" />
                            </div>
                            <Skeleton className="h-6 w-16" />
                            <Skeleton className="h-4 w-12" />
                            <Skeleton className="h-4 w-16" />
                            <div className="flex gap-2">
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                                <Skeleton className="h-8 w-16" />
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
