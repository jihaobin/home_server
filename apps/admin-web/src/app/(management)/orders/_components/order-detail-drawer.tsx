"use client"

import { Suspense, useCallback, useState } from "react"
import type { AdminOrderListItem, OrderStatus } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/web-ui/components/dropdown-menu"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import { cn } from "@repo/web-ui/lib/utils"
import { useAdminOrderDetail } from "@repo/hooks/api/ssr"
import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"
import {
    ORDER_STATUS_BADGE_CLASSES,
    ORDER_STATUS_LABELS,
    ASSIGNMENT_TYPE_LABELS,
    PAYMENT_STATUS_BADGE_CLASSES,
    PAYMENT_STATUS_LABELS,
} from "../_constants"

const PAYMENT_STATUS_KEYS = Object.keys(PAYMENT_STATUS_LABELS) as Array<
    keyof typeof PAYMENT_STATUS_LABELS
>

function isKnownPaymentStatus(
    status: string,
): status is keyof typeof PAYMENT_STATUS_LABELS {
    return PAYMENT_STATUS_KEYS.includes(
        status as keyof typeof PAYMENT_STATUS_LABELS,
    )
}

type OrderDetailDrawerProps = {
    orderId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void> | void
    orderSummary?: AdminOrderListItem | null
}

const DETAIL_STATUS_OPTIONS: OrderStatus[] = [
    "paid",
    "in_progress",
    "completed",
    "cancelled",
    "refunded",
]

export function OrderDetailDrawer({
    orderId,
    open,
    onOpenChange,
    onUpdateStatus,
    orderSummary,
}: OrderDetailDrawerProps) {
    return (
        <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
            <EntityDrawerContent width="lg">
                <EntityDrawerHeader>
                    <EntityDrawerTitle>订单详情</EntityDrawerTitle>
                </EntityDrawerHeader>
                {orderId ? (
                    <Suspense
                        fallback={
                            <EntityDrawerBody>
                                <OrderDetailSkeleton />
                            </EntityDrawerBody>
                        }
                    >
                        <OrderDetailContent
                            orderId={orderId}
                            onUpdateStatus={onUpdateStatus}
                            summary={orderSummary}
                        />
                    </Suspense>
                ) : (
                    <EntityDrawerBody>
                        <OrderDetailSkeleton />
                    </EntityDrawerBody>
                )}
            </EntityDrawerContent>
        </EntityDrawer>
    )
}

type OrderDetailContentProps = {
    orderId: string
    onUpdateStatus: (orderId: string, status: OrderStatus) => Promise<void> | void
    summary?: AdminOrderListItem | null
}

function OrderDetailContent({
    orderId,
    onUpdateStatus,
    summary,
}: OrderDetailContentProps) {
    const { data } = useAdminOrderDetail(orderId)
    const [isUpdating, setUpdating] = useState(false)

    const handleStatusChange = useCallback(
        async (status: OrderStatus) => {
            setUpdating(true)
            try {
                await onUpdateStatus(orderId, status)
            } finally {
                setUpdating(false)
            }
        },
        [onUpdateStatus, orderId],
    )

    return (
        <EntityDrawerBody className="gap-6">
            <section className="space-y-3 rounded-2xl border bg-card/60 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold leading-tight">
                            {data.orderSerial}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            创建时间：{formatDateTime(data.createdAt)}
                        </span>
                    </div>
                    <Badge
                        className={cn(
                            "ml-auto",
                            ORDER_STATUS_BADGE_CLASSES[data.status],
                        )}
                    >
                        {ORDER_STATUS_LABELS[data.status] ?? data.status}
                    </Badge>
                    <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm" disabled={isUpdating}>
                                {isUpdating ? "更新中..." : "切换状态"}
                            </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end" className="w-40">
                            {DETAIL_STATUS_OPTIONS.map((status) => (
                                <DropdownMenuItem
                                    key={status}
                                    onClick={() => handleStatusChange(status)}
                                >
                                    {ORDER_STATUS_LABELS[status]}
                                </DropdownMenuItem>
                            ))}
                        </DropdownMenuContent>
                    </DropdownMenu>
                </div>
                <div className="grid gap-3 text-sm text-muted-foreground md:grid-cols-3">
                    <div>预约时间：{formatDateTime(data.appointmentTime)}</div>
                    <div>订单金额：¥{Number(data.totalAmount).toFixed(2)}</div>
                    <div>优惠金额：¥{Number(data.discountAmount ?? 0).toFixed(2)}</div>
                </div>
            </section>

            <EntityDrawerSection title="支付记录">
                {data.payments && data.payments.length > 0 ? (
                    <div className="space-y-3">
                        {data.payments.map((payment) => {
                            const knownStatus = isKnownPaymentStatus(payment.status)
                                ? payment.status
                                : undefined
                            const badgeClass =
                                PAYMENT_STATUS_BADGE_CLASSES[
                                    knownStatus ?? "pending"
                                ]
                            const statusLabel = knownStatus
                                ? PAYMENT_STATUS_LABELS[knownStatus]
                                : payment.status

                            return (
                                <div
                                    key={payment.id}
                                    className="flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3 text-sm"
                                >
                                    <div className="flex-1">
                                        <div className="font-medium">
                                            {payment.paymentMethod?.toUpperCase()}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            交易号：{payment.transactionId ?? "—"}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        <div className="text-base font-semibold">
                                            ¥{Number(payment.amount).toFixed(2)}
                                        </div>
                                        <div className="text-xs text-muted-foreground">
                                            {payment.paidAt
                                                ? formatDateTime(payment.paidAt)
                                                : "待支付"}
                                        </div>
                                    </div>
                                    <Badge className={cn("text-xs", badgeClass)}>
                                        {statusLabel}
                                    </Badge>
                                </div>
                            )
                        })}
                    </div>
                ) : (
                    <p className="text-sm text-muted-foreground">暂无支付记录</p>
                )}
            </EntityDrawerSection>

            <EntityDrawerSection title="服务与地址">
                <div className="space-y-3 rounded-xl border px-4 py-3 text-sm">
                    <EntityDrawerProperty
                        label="服务名称"
                        value={
                            summary?.service.name ??
                            data.service?.name ??
                            "未知服务"
                        }
                    />
                    <EntityDrawerProperty
                        label="服务分类"
                        value={summary?.service.categoryName ?? "未分类"}
                    />
                    <EntityDrawerProperty
                        label="服务描述"
                        value={data.service?.description ?? "—"}
                    />
                    <EntityDrawerProperty
                        label="服务地址"
                        value={data.address?.detailedAddress ?? "—"}
                    />
                    <EntityDrawerProperty
                        label="联系人"
                        value={`${data.address?.recipientName ?? "—"} / ${data.address?.recipientPhone ?? "—"
                            }`}
                    />
                </div>
            </EntityDrawerSection>

            <EntityDrawerSection title="分配信息">
                <div className="space-y-3 rounded-xl border px-4 py-3 text-sm">
                    <EntityDrawerProperty
                        label="分配方式"
                        value={
                            data.assignment?.assignmentType
                                ? ASSIGNMENT_TYPE_LABELS[data.assignment.assignmentType]
                                : "未分配"
                        }
                    />
                    <EntityDrawerProperty
                        label="服务人员"
                        value={
                            summary?.servicePersonnel?.name ??
                            summary?.servicePersonnel?.id ??
                            data.assignment?.servicePersonnel?.userId ??
                            "—"
                        }
                    />
                    <EntityDrawerProperty
                        label="分配时间"
                        value={
                            data.assignment?.assignedAt
                                ? formatDateTime(data.assignment.assignedAt)
                                : "—"
                        }
                    />
                </div>
            </EntityDrawerSection>
        </EntityDrawerBody>
    )
}

function OrderDetailSkeleton() {
    return (
        <div className="space-y-4">
            <Skeleton className="h-20 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
            <Skeleton className="h-32 w-full rounded-2xl" />
        </div>
    )
}

function formatDateTime(input: string | Date) {
    const date = input instanceof Date ? input : new Date(input)
    return date.toLocaleString()
}
