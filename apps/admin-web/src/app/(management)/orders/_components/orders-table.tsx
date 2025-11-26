"use client"

import { useCallback, useMemo } from "react"
import type {
    ColumnDef,
    PaginationState,
    RowSelectionState,
    Updater,
    VisibilityState,
} from "@tanstack/react-table"
import {
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import type { AdminOrderListItem, OrderStatus } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { Checkbox } from "@repo/web-ui/components/checkbox"
import {
    DropdownMenu,
    DropdownMenuCheckboxItem,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuTrigger,
} from "@repo/web-ui/components/dropdown-menu"
import { EntityTable, EntityTablePagination } from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"
import {
    ASSIGNMENT_TYPE_LABELS,
    ORDER_STATUS_BADGE_CLASSES,
    ORDER_STATUS_LABELS,
    PAYMENT_STATUS_BADGE_CLASSES,
    PAYMENT_STATUS_LABELS,
} from "../_constants"

type OrdersTableProps = {
    data: AdminOrderListItem[]
    total: number
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    rowSelection: RowSelectionState
    onRowSelectionChange: (state: RowSelectionState) => void
    columnVisibility: VisibilityState
    onColumnVisibilityChange: (state: VisibilityState) => void
    onViewDetail: (order: AdminOrderListItem) => void
    onUpdateStatus: (orderId: string, status: OrderStatus) => void
    isRefreshing?: boolean
}

const ROW_STATUS_OPTIONS: OrderStatus[] = [
    "paid",
    "in_progress",
    "completed",
    "cancelled",
    "refunded",
]

export function OrdersTable({
    data,
    total,
    page,
    limit,
    onPaginationChange,
    rowSelection,
    onRowSelectionChange,
    columnVisibility,
    onColumnVisibilityChange,
    onViewDetail,
    onUpdateStatus,
    isRefreshing,
}: OrdersTableProps) {
    const columns = useMemo<ColumnDef<AdminOrderListItem>[]>(
        () => [
            {
                id: "select",
                header: ({ table }) => {

                    return (
                        <Checkbox
                            checked={table.getIsAllPageRowsSelected() ||
                                (table.getIsSomePageRowsSelected() && "indeterminate")}
                            aria-checked={"mixed"}
                            onCheckedChange={() => {
                                const shouldSelectAll =
                                    !table.getIsAllPageRowsSelected()
                                table.toggleAllPageRowsSelected(shouldSelectAll)
                            }}
                            aria-label="Select all"
                        />
                    )
                },
                cell: ({ row }) => (
                    <Checkbox
                        checked={row.getIsSelected()}
                        onCheckedChange={(value) => row.toggleSelected(value === true)}
                        aria-label="Select row"
                    />
                ),
                enableSorting: false,
                enableHiding: false,
                size: 40,
            },
            {
                accessorKey: "orderSerial",
                header: "订单信息",
                cell: ({ row }) => {
                    const order = row.original
                    return (
                        <div className="flex flex-col gap-1">
                            <div className="flex items-center gap-2">
                                <span className="font-medium">
                                    {order.orderSerial}
                                </span>
                                <Badge
                                    className={cn(
                                        "text-xs",
                                        ORDER_STATUS_BADGE_CLASSES[order.status],
                                    )}
                                >
                                    {ORDER_STATUS_LABELS[order.status] ?? order.status}
                                </Badge>
                            </div>
                            <span className="text-xs text-muted-foreground">
                                创建：{formatDateTime(order.createdAt)}
                            </span>
                        </div>
                    )
                },
            },
            {
                header: "用户",
                cell: ({ row }) => {
                    const { customer } = row.original
                    return (
                        <div className="text-sm">
                            <div className="font-medium">
                                {customer.name || customer.email}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {customer.phoneNumber ?? "—"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "服务",
                cell: ({ row }) => {
                    const { service } = row.original
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">{service.name}</div>
                            <div className="text-xs text-muted-foreground">
                                分类：{service.categoryName ?? "未分类"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "金额 / 支付",
                cell: ({ row }) => {
                    const order = row.original
                    return (
                        <div className="space-y-1 text-sm">
                            <div>
                                订单 ¥{order.totalAmount.amount.toFixed(2)} · 已付 ¥
                                {order.paidAmount.amount.toFixed(2)}
                            </div>
                            <Badge
                                className={cn(
                                    "text-xs",
                                    PAYMENT_STATUS_BADGE_CLASSES[order.paymentStatus],
                                )}
                            >
                                {PAYMENT_STATUS_LABELS[order.paymentStatus] ??
                                    order.paymentStatus}
                            </Badge>
                        </div>
                    )
                },
            },
            {
                header: "分配 / 服务人员",
                cell: ({ row }) => {
                    const order = row.original
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">
                                {order.servicePersonnel?.name ?? "待分配"}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                {order.assignmentType
                                    ? ASSIGNMENT_TYPE_LABELS[order.assignmentType]
                                    : "未指定"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "预约时间",
                cell: ({ row }) => (
                    <span className="text-sm text-muted-foreground">
                        {formatDateTime(row.original.appointmentTime)}
                    </span>
                ),
            },
            {
                id: "actions",
                header: "操作",
                cell: ({ row }) => {
                    const order = row.original
                    return (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetail(order)}
                            >
                                查看详情
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        disabled={!order.canUpdateStatus}
                                    >
                                        状态
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-32">
                                    {ROW_STATUS_OPTIONS.map((status) => (
                                        <DropdownMenuItem
                                            key={status}
                                            onClick={() => onUpdateStatus(order.id, status)}
                                        >
                                            {ORDER_STATUS_LABELS[status]}
                                        </DropdownMenuItem>
                                    ))}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )
                },
                enableHiding: false,
            },
        ],
        [onUpdateStatus, onViewDetail],
    )

    const handlePageSizeChange = useCallback(
        (nextSize: number) => {
            const maxPage = Math.max(Math.ceil(total / Math.max(nextSize, 1)), 1)
            const nextPage = Math.min(page, maxPage)
            onPaginationChange({
                page: nextPage,
                limit: nextSize,
            })
        },
        [onPaginationChange, page, total],
    )

    const table = useReactTable({
        data,
        columns,
        getRowId: (row, index) => row.id ?? row.orderSerial ?? `${index}`,
        getCoreRowModel: getCoreRowModel(),
        manualPagination: true,
        pageCount: Math.max(Math.ceil(total / Math.max(limit, 1)), 1),
        enableRowSelection: true,
        state: {
            pagination: {
                pageIndex: page - 1,
                pageSize: limit,
            },
            rowSelection,
            columnVisibility,
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
        onRowSelectionChange: (updater: Updater<RowSelectionState>) => {
            const next =
                typeof updater === "function" ? updater(rowSelection) : updater
            onRowSelectionChange(next)
        },
        onColumnVisibilityChange: (updater: Updater<VisibilityState>) => {
            const next =
                typeof updater === "function"
                    ? updater(columnVisibility)
                    : updater
            onColumnVisibilityChange(next)
        },
    })

    return (
        <div className="rounded-2xl border bg-card">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b px-4 py-3 text-sm text-muted-foreground">
                <span>
                    {isRefreshing ? "数据刷新中..." : "最新数据已加载"}
                </span>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm">
                            列显示
                        </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                        <DropdownMenuLabel>切换列</DropdownMenuLabel>
                        {table
                            .getAllLeafColumns()
                            .filter((column) => column.getCanHide())
                            .map((column) => (
                                <DropdownMenuCheckboxItem
                                    key={column.id}
                                    checked={column.getIsVisible()}
                                    onCheckedChange={(value) =>
                                        column.toggleVisibility(!!value)
                                    }
                                >
                                    {column.columnDef.header as string}
                                </DropdownMenuCheckboxItem>
                            ))}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
            <EntityTable
                table={table}
                className="rounded-none border-0"
                emptyState={{
                    title: "暂无订单数据",
                    description: "调整筛选条件或稍后再试。",
                }}
            />
            <EntityTablePagination
                table={table}
                totalItems={total}
                pageSize={limit}
                onPageSizeChange={handlePageSizeChange}
                className="rounded-none border-t"
            />
        </div>
    )
}

function formatDateTime(input: string) {
    const date = new Date(input)
    return date.toLocaleString()
}
