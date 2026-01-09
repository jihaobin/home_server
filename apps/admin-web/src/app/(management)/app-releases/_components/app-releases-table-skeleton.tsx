"use client"

import { Card, CardContent } from "@repo/web-ui/components/card"
import { Skeleton } from "@repo/web-ui/components/skeleton"

export function AppReleasesTableSkeleton() {
    return (
        <Card className="overflow-hidden">
            <CardContent className="p-4">
                <div className="space-y-3">
                    {Array.from({ length: 5 }).map((_, index) => (
                        <div
                            key={index}
                            className="grid grid-cols-1 gap-3 rounded-xl border px-4 py-3 md:grid-cols-2 lg:grid-cols-3"
                        >
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-28" />
                                <Skeleton className="h-3 w-20" />
                            </div>
                            <div className="space-y-2">
                                <Skeleton className="h-4 w-24" />
                                <div className="flex gap-2">
                                    <Skeleton className="h-3 w-16" />
                                    <Skeleton className="h-3 w-16" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </CardContent>
        </Card>
    )
}
