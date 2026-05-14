import { Skeleton } from "@repo/web-ui/components/skeleton"

export function ServiceOfferingsTableSkeleton() {
    return (
        <div className="space-y-6">
            <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                    <Skeleton className="h-8 w-48" />
                    <Skeleton className="h-4 w-80" />
                </div>
                <Skeleton className="h-9 w-24" />
            </div>
            <Skeleton className="h-28 w-full rounded-2xl" />
            <div className="rounded-2xl border bg-card p-4">
                <div className="space-y-3">
                    {Array.from({ length: 6 }).map((_, index) => (
                        <Skeleton key={index} className="h-14 w-full" />
                    ))}
                </div>
            </div>
        </div>
    )
}
