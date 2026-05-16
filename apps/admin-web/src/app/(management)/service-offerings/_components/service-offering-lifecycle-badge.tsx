import type { ServiceOfferingLifecycle } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { cn } from "@repo/web-ui/lib/utils"

export const LIFECYCLE_LABELS: Record<ServiceOfferingLifecycle, string> = {
    pending_review: "待审核",
    rejected: "已拒绝",
    active: "已上架",
    taken_down: "已下架",
}

const LIFECYCLE_BADGE_CLASS: Record<ServiceOfferingLifecycle, string> = {
    pending_review: "bg-amber-100 text-amber-800",
    rejected: "bg-rose-100 text-rose-700",
    active: "bg-emerald-100 text-emerald-700",
    taken_down: "bg-slate-200 text-slate-700",
}

const LIFECYCLE_DOT_CLASS: Record<ServiceOfferingLifecycle, string> = {
    pending_review: "bg-amber-500",
    rejected: "bg-rose-500",
    active: "bg-emerald-500",
    taken_down: "bg-slate-500",
}

export function ServiceOfferingLifecycleBadge({
    lifecycle,
    className,
}: {
    lifecycle: ServiceOfferingLifecycle
    className?: string
}) {
    return (
        <Badge
            className={cn(
                "w-fit gap-1.5 text-xs font-medium",
                LIFECYCLE_BADGE_CLASS[lifecycle],
                className,
            )}
        >
            <span
                className={cn(
                    "size-1.5 rounded-full",
                    LIFECYCLE_DOT_CLASS[lifecycle],
                )}
            />
            {LIFECYCLE_LABELS[lifecycle]}
        </Badge>
    )
}
