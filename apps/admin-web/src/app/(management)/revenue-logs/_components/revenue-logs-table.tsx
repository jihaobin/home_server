"use client"

import { useMemo } from "react"
import type {
    ColumnDef,
    PaginationState,
    Updater,
} from "@tanstack/react-table"
import {
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import type { AdminRevenueLog } from "@repo/types"
import Link from "next/link"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import {
    EntityTable,
    EntityTablePagination,
} from "@/components/common"

type RevenueLogsTableProps = {
    data: AdminRevenueLog[]
    total: number
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (log: AdminRevenueLog) => void
    isRefreshing?: boolean
}

const TRANSACTION_TYPE_LABELS: Partial<Record<AdminRevenueLog["transactionType"], string>> = {
    payment_received: "订单收款",
    service_earning: "服务分成",
    platform_fee: "平台手续费",
    withdrawal: "提现",
    refund_paid: "退款支出",
    bonus: "奖金",
    penalty: "罚金",
    adjustment: "调整",
}

const DIRECTION_BADGE_CLASS: Record<NonNullable<AdminRevenueLog["direction"]>, string> =
    {
        income: "bg-emerald-100 text-emerald-700",
        expense: "bg-rose-100 text-rose-700",
    }

export function RevenueLogsTable({
    data,
    total,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
}: RevenueLogsTableProps) {
    const columns = useMemo<ColumnDef<AdminRevenueLog>[]>(
        () => [
            {
                header: "发生时间",
                accessorKey: "createdAt",
                cell: ({ row }) => (
                    <div className="flex flex-col text-sm">
                        <span className="font-medium">
                            {formatDateTime(row.original.createdAt)}
                        </span>
                        {row.original.referenceId ? (
                            <span className="text-muted-foreground text-xs">
                                外部引用号：{row.original.referenceId}
                            </span>
                        ) : null}
                    </div>
                ),
            },
            {
                header: "金额/方向",
                cell: ({ row }) => {
                    const log = row.original
                    const direction = log.direction ?? "income"
                    const valueText = formatAmount(log)
                    return (
                        <div className="flex flex-col gap-1">
                            <span
                                className={cn(
                                    "text-base font-semibold",
                                    direction === "income"
                                        ? "text-emerald-600"
                                        : "text-rose-600",
                                )}
                            >
                                {valueText}
                            </span>
                            <Badge
                                className={cn(
                                    "w-fit text-xs",
                                    DIRECTION_BADGE_CLASS[direction],
                                )}
                            >
                                {direction === "income" ? "收入" : "支出"}
                            </Badge>
                        </div>
                    )
                },
            },
            {
                header: "类型/描述",
                cell: ({ row }) => {
                    const log = row.original
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">
                                {TRANSACTION_TYPE_LABELS[log.transactionType] ??
                                    log.transactionType}
                            </div>
                            <div className="text-muted-foreground text-xs">
                                {log.description ?? "暂无描述"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "关联订单",
                cell: ({ row }) => {
                    const order = row.original.order
                    if (!order) {
                        return <span className="text-muted-foreground">—</span>
                    }
                    const display = order.orderSerial ?? order.id
                    const href = `/orders${order.orderSerial ? `?orderSerial=${order.orderSerial}` : ""}`
                    return (
                        <Link
                            href={href}
                            className="text-sm font-medium text-primary hover:underline"
                        >
                            {display}
                        </Link>
                    )
                },
            },
            {
                header: "关联用户",
                cell: ({ row }) => {
                    const user = row.original.user
                    if (!user) {
                        return <span className="text-muted-foreground">—</span>
                    }
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">{user.name ?? "未填写"}</div>
                            <div className="text-muted-foreground text-xs">
                                {user.email ?? user.phoneNumber ?? "—"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "操作",
                cell: ({ row }) => (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetail(row.original)}
                    >
                        查看详情
                    </Button>
                ),
                enableSorting: false,
            },
        ],
        [onViewDetail],
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: Math.max(Math.ceil(total / Math.max(limit, 1)), 1),
        state: {
            pagination: {
                pageIndex: page - 1,
                pageSize: limit,
            },
        },
        onPaginationChange: (updater: Updater<PaginationState>) => {
            const current = {
                pageIndex: page - 1,
                pageSize: limit,
            }
            const next =
                typeof updater === "function"
                    ? updater(current)
                    : updater

            onPaginationChange({
                page: next.pageIndex + 1,
                limit: next.pageSize,
            })
        },
    })

    return (
        <div className="rounded-2xl border bg-card">
            <EntityTable
                table={table}
                className="rounded-none border-0"
                emptyState={{
                    title: "暂无收益记录",
                    description: "尝试调整筛选条件或稍后再试。",
                }}
            />
            <EntityTablePagination
                table={table}
                totalItems={total}
                pageSize={limit}
                onPageSizeChange={(size) => {
                    const maxPage = Math.max(Math.ceil(total / Math.max(size, 1)), 1)
                    const nextPage = Math.min(page, maxPage)
                    onPaginationChange({
                        page: nextPage,
                        limit: size,
                    })
                }}
            />
        </div>
    )
}

function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}

function formatAmount(log: AdminRevenueLog) {
    const amount = Math.abs(log.amount.amount ?? 0).toFixed(2)
    return `${log.direction === "expense" ? "-" : "+"}${amount}`
}
