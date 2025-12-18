"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Download, FileSpreadsheet, Layers, RefreshCcw } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { endOfDay, startOfDay } from "date-fns"
import type { RowSelectionState, VisibilityState } from "@tanstack/react-table"
import type {
    AdminOrderListItem,
    AdminOrderListResponse,
    AssignmentType,
    NotificationEventPayload,
    NotificationSocketServerMessage,
    OrderStatus,
} from "@repo/types"
import { NotificationSocketEventType } from "@repo/types"
import {
    useAdminOrders,
    useBulkUpdateAdminOrderStatus,
    useUpdateAdminOrderStatus,
    adminOrdersQueryKey,
    normalizeAdminOrdersQuery,
    adminOrderDetailQueryKey,
} from "@repo/hooks/api/ssr"
import { useQueryClient } from "@tanstack/react-query"
import { Button } from "@repo/web-ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from "@repo/web-ui/components/dropdown-menu"
import { toast } from "sonner"
import { useNotificationSocket } from "@/hooks/use-notification-socket"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"
import type { OrdersQueryState } from "../_utils/query"
import {
    buildOrdersSearchParams,
    normalizeOrdersQuery,
} from "../_utils/query"
import { OrdersFilterBar, type OrdersFilterValues } from "./orders-filter-bar"
import { OrdersTable } from "./orders-table"
import { OrdersTableSkeleton } from "./orders-table-skeleton"
import { OrderDetailDrawer } from "./order-detail-drawer"
import { ORDER_STATUS_LABELS } from "../_constants"
import { adminApiBaseUrl } from "@/lib/api-client"

const BULK_STATUS_OPTIONS: OrderStatus[] = [
    "paid",
    "in_progress",
    "completed",
    "cancelled",
    "refunded",
]

const TERMINAL_ORDER_STATUSES = new Set<OrderStatus>([
    "cancelled",
    "payment_timeout",
    "refunded",
])

type OrdersPageContentProps = {
    initialQuery: OrdersQueryState
}

export function OrdersPageContent({ initialQuery }: OrdersPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<OrdersQueryState>(() =>
        normalizeOrdersQuery(initialQuery),
    )
    const [rowSelection, setRowSelection] = useState<RowSelectionState>({})
    const [columnVisibility, setColumnVisibility] = useState<VisibilityState>({})
    const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null)
    const [selectedOrderSummary, setSelectedOrderSummary] =
        useState<AdminOrderListItem | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(() => ({ ...queryState }), [queryState])
    const normalizedRequestQuery = useMemo(
        () => normalizeAdminOrdersQuery(requestQuery),
        [requestQuery],
    )
    const currentListQueryKey = useMemo(
        () => adminOrdersQueryKey(normalizedRequestQuery),
        [normalizedRequestQuery],
    )
    const [tableSnapshot, setTableSnapshot] = useState<AdminOrderListResponse | null>(
        () =>
            queryClient.getQueryData<AdminOrderListResponse>(currentListQueryKey) ??
            null,
    )
    const [isTableFetching, setIsTableFetching] = useState(false)
    const handleDataChange = useCallback((data: AdminOrderListResponse) => {
        setTableSnapshot(data)
    }, [])
    const handleFetchingChange = useCallback((next: boolean) => {
        setIsTableFetching(next)
    }, [])
    const handleRegisterRefetch = useCallback(
        (fn: (() => Promise<unknown> | void) | null) => {
            refetchRef.current = fn ?? null
        },
        [],
    )
    useEffect(() => {
        const cached =
            queryClient.getQueryData<AdminOrderListResponse>(currentListQueryKey) ??
            null
        if (cached) {
            setTableSnapshot(cached)
        }
    }, [currentListQueryKey, queryClient])
    const updateStatusMutation = useUpdateAdminOrderStatus()
    const bulkUpdateMutation = useBulkUpdateAdminOrderStatus()

    const filterDefaults = useMemo<OrdersFilterValues>(
        () => ({
            orderSerial: queryState.orderSerial ?? "",
            customerKeyword: queryState.customerKeyword ?? "",
            servicePersonnelKeyword: queryState.servicePersonnelKeyword ?? "",
            status: queryState.status ?? "all",
            assignmentType: queryState.assignmentType ?? "all",
            dateRange: toDateRange(queryState.startDate, queryState.endDate),
            minAmount:
                typeof queryState.minAmount === "number"
                    ? String(queryState.minAmount)
                    : "",
            maxAmount:
                typeof queryState.maxAmount === "number"
                    ? String(queryState.maxAmount)
                    : "",
        }),
        [
            queryState.orderSerial,
            queryState.customerKeyword,
            queryState.servicePersonnelKeyword,
            queryState.status,
            queryState.assignmentType,
            queryState.startDate,
            queryState.endDate,
            queryState.minAmount,
            queryState.maxAmount,
        ],
    )

    const updateQuery = useCallback(
        (updater: (prev: OrdersQueryState) => OrdersQueryState) => {
            setQueryState((prev) => normalizeOrdersQuery(updater(prev)))
        },
        [],
    )

    const handlePaginationChange = useCallback(
        ({ page, limit }: { page: number; limit: number }) => {
            updateQuery((prev) => ({
                ...prev,
                page,
                limit,
            }))
        },
        [updateQuery],
    )

    const handleApplyFilters = useCallback(
        (values: OrdersFilterValues) => {
            updateQuery((prev) => ({
                ...prev,
                page: 1,
                orderSerial: normalizeText(values.orderSerial),
                customerKeyword: normalizeText(values.customerKeyword),
                servicePersonnelKeyword: normalizeText(
                    values.servicePersonnelKeyword,
                ),
                status:
                    values.status === "all"
                        ? undefined
                        : (values.status as OrderStatus),
                assignmentType:
                    values.assignmentType === "all"
                        ? undefined
                        : (values.assignmentType as AssignmentType),
                startDate: values.dateRange?.from
                    ? startOfDay(values.dateRange.from).toISOString()
                    : undefined,
                endDate: values.dateRange?.to
                    ? endOfDay(values.dateRange.to).toISOString()
                    : values.dateRange?.from
                        ? endOfDay(values.dateRange.from).toISOString()
                        : undefined,
                minAmount: parseAmount(values.minAmount),
                maxAmount: parseAmount(values.maxAmount),
            }))
        },
        [updateQuery],
    )

    const handleResetFilters = useCallback(() => {
        updateQuery((prev) => ({
            ...prev,
            page: 1,
            orderSerial: undefined,
            customerKeyword: undefined,
            servicePersonnelKeyword: undefined,
            status: undefined,
            assignmentType: undefined,
            startDate: undefined,
            endDate: undefined,
            minAmount: undefined,
            maxAmount: undefined,
        }))
    }, [updateQuery])

    const applyOrderEvent = useCallback(
        (payload?: NotificationEventPayload | null) => {
            if (!payload?.orderId || payload.event !== "order_payment_expired") {
                return
            }

            const nextStatus =
                (payload.status as OrderStatus) ?? "payment_timeout"

            if (refetchRef.current) {
                void refetchRef.current()
            }

            queryClient.invalidateQueries({
                queryKey: adminOrderDetailQueryKey(payload.orderId),
            })

            setSelectedOrderSummary((prev) => {
                if (!prev || prev.id !== payload.orderId) {
                    return prev
                }
                return {
                    ...prev,
                    status: nextStatus,
                    canUpdateStatus: !TERMINAL_ORDER_STATUSES.has(nextStatus),
                }
            })

            if (payload.message) {
                toast.info(payload.message)
            } else {
                toast.info(
                    `订单已更新为「${
                        ORDER_STATUS_LABELS[nextStatus] ?? nextStatus
                    }」`,
                )
            }
        },
        [queryClient],
    )

    const handleNotificationMessage = useCallback(
        (
            message: NotificationSocketServerMessage & {
                type: NotificationSocketEventType.Notification
            },
        ) => {
            applyOrderEvent(message.payload)
        },
        [applyOrderEvent],
    )

    const {
        lastError: notificationError,
        lastAckError: notificationAckError,
    } = useNotificationSocket({
        onNotification: handleNotificationMessage,
    })

    useEffect(() => {
        if (!notificationError) {
            return
        }
        console.warn("[notification] socket error", notificationError)
    }, [notificationError])

    useEffect(() => {
        if (!notificationAckError) {
            return
        }
        console.warn("[notification] ack error", notificationAckError)
    }, [notificationAckError])

    useEffect(() => {
        const search = buildOrdersSearchParams(queryState)
        const target = `${pathname}${search}`

        if (typeof window !== "undefined") {
            const current = `${pathname}${window.location.search}`
            if (current === target) {
                return
            }
        }

        startTransition(() => {
            router.replace(target, { scroll: false })
        })
    }, [queryState, pathname, router])

    useEffect(() => {
        setRowSelection({})
    }, [requestQuery])

    const handleViewDetail = useCallback((order: AdminOrderListItem) => {
        setSelectedOrderId(order.id)
        setSelectedOrderSummary(order)
        setDrawerOpen(true)
    }, [])

    const handleDrawerChange = useCallback((open: boolean) => {
        setDrawerOpen(open)
        if (!open) {
            setSelectedOrderId(null)
            setSelectedOrderSummary(null)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        }
    }, [])

    const currentItems = tableSnapshot?.items ?? []
    const selectedOrderIds = useMemo(() => {
        if (!currentItems.length) {
            return []
        }

        const idsByKey = new Map<string, string>()
        currentItems.forEach((item, index) => {
            idsByKey.set(item.id, item.id)
            idsByKey.set(String(index), item.id)
        })

        const seen = new Set<string>()
        return Object.entries(rowSelection).reduce<string[]>((acc, [key, isSelected]) => {
            if (!isSelected) {
                return acc
            }
            const mappedId = idsByKey.get(key)
            if (mappedId && !seen.has(mappedId)) {
                seen.add(mappedId)
                acc.push(mappedId)
            }
            return acc
        }, [])
    }, [rowSelection, currentItems])

    const selectedCount = selectedOrderIds.length
    const totalOrders = tableSnapshot?.meta.total ?? 0

    const handleBulkStatusChange = useCallback(
        async (status: OrderStatus) => {
            if (!selectedOrderIds.length) {
                toast.info("请先选择订单")
                return
            }

            try {
                await bulkUpdateMutation.mutateAsync({
                    orderIds: selectedOrderIds,
                    status,
                })
                toast.success(`已批量更新为「${ORDER_STATUS_LABELS[status]}」`)
                setRowSelection({})
            } catch (error) {
                console.error(error)
                toast.error("批量更新失败")
            }
        },
        [bulkUpdateMutation, selectedOrderIds],
    )

    const handleSingleStatusChange = useCallback(
        async (orderId: string, status: OrderStatus) => {
            try {
                const updated = await updateStatusMutation.mutateAsync({
                    orderId,
                    status,
                })

                setSelectedOrderSummary((prev) => {
                    if (!prev || prev.id !== orderId || !updated) {
                        return prev
                    }
                    return {
                        ...prev,
                        status: updated.status,
                        assignmentType:
                            updated.assignment?.assignmentType ?? prev.assignmentType,
                        canUpdateStatus: !TERMINAL_ORDER_STATUSES.has(updated.status),
                    }
                })

                queryClient.setQueryData<
                    AdminOrderListResponse | undefined
                >(currentListQueryKey, (previous) => {
                    if (!previous || !updated) {
                        return previous
                    }

                    const nextItems = previous.items.map((item: AdminOrderListItem) =>
                        item.id === orderId
                            ? {
                                ...item,
                                status: updated.status,
                                assignmentType:
                                    updated.assignment?.assignmentType ?? item.assignmentType,
                                canUpdateStatus: !TERMINAL_ORDER_STATUSES.has(
                                    updated.status,
                                ),
                            }
                            : item,
                    )

                    return {
                        ...previous,
                        items: nextItems,
                    }
                })

                toast.success(`订单已标记为「${ORDER_STATUS_LABELS[status]}」`)
            } catch (error) {
                console.error(error)
                toast.error("更新订单状态失败")
            }
        },
        [currentListQueryKey, queryClient, updateStatusMutation],
    )

    const handleExportCsv = useCallback(() => {
        if (!currentItems.length) {
            toast.info("暂无可导出的记录")
            return
        }

        const header = [
            "订单编号",
            "状态",
            "用户",
            "服务人员",
            "服务名称",
            "分配方式",
            "预约时间",
            "订单金额(¥)",
            "已支付(¥)",
            "支付状态",
        ]
        const rows = currentItems.map((item) => [
            item.orderSerial,
            ORDER_STATUS_LABELS[item.status] ?? item.status,
            item.customer.name || item.customer.email,
            item.servicePersonnel?.name || "未分配",
            item.service.name,
            item.assignmentType ?? "未分配",
            new Date(item.appointmentTime).toLocaleString(),
            item.totalAmount.amount.toFixed(2),
            item.paidAmount.amount.toFixed(2),
            item.paymentStatus,
        ])

        const csvContent = `\uFEFF${[header, ...rows]
            .map((row) => row.map(escapeCsvCell).join(","))
            .join("\n")}`
        triggerDownload(
            new Blob([csvContent], {
                type: "text/csv;charset=utf-8;",
            }),
            `orders-${Date.now()}.csv`,
        )
        toast.success("已导出 CSV")
    }, [currentItems])

    const handleExportExcel = useCallback(() => {
        if (!currentItems.length) {
            toast.info("暂无可导出的记录")
            return
        }
        const header = [
            "订单编号",
            "状态",
            "用户",
            "服务人员",
            "服务名称",
            "分配方式",
            "预约时间",
            "订单金额(¥)",
            "已支付(¥)",
            "支付状态",
        ]
        const rows = currentItems.map((item) => [
            item.orderSerial,
            ORDER_STATUS_LABELS[item.status] ?? item.status,
            item.customer.name || item.customer.email,
            item.servicePersonnel?.name || "未分配",
            item.service.name,
            item.assignmentType ?? "未分配",
            new Date(item.appointmentTime).toLocaleString(),
            item.totalAmount.amount.toFixed(2),
            item.paidAmount.amount.toFixed(2),
            item.paymentStatus,
        ])
        const tableRows = [header, ...rows]
            .map(
                (row) =>
                    `<tr>${row
                        .map((cell) => `<td>${escapeHtml(cell)}</td>`)
                        .join("")}</tr>`,
            )
            .join("")
        const html = `<table>${tableRows}</table>`
        triggerDownload(
            new Blob([`\uFEFF${html}`], {
                type: "application/vnd.ms-excel",
            }),
            `orders-${Date.now()}.xls`,
        )
        toast.success("已导出 Excel")
    }, [currentItems])

    return (
        <div className="space-y-6">
            <PageHeader
                title="订单管理"
                description="综合查询、筛选和批量导出平台订单，支持状态流转和详情抽查。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/orders" },
                    { label: "订单管理" },
                ]}
                actions={
                    <div className="flex flex-wrap gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleRefresh}
                            disabled={isTableFetching}
                        >
                            <RefreshCcw
                                className={cn(
                                    "size-4",
                                    isTableFetching && "animate-spin",
                                )}
                            />
                            刷新
                        </Button>
                        <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="gap-1.5"
                                    disabled={!selectedCount || bulkUpdateMutation.isPending}
                                >
                                    <Layers className="size-4" />
                                    批量标记
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                                {BULK_STATUS_OPTIONS.map((status) => (
                                    <DropdownMenuItem
                                        key={status}
                                        onClick={() => handleBulkStatusChange(status)}
                                    >
                                        {ORDER_STATUS_LABELS[status]}
                                    </DropdownMenuItem>
                                ))}
                            </DropdownMenuContent>
                        </DropdownMenu>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExportCsv}
                        >
                            <Download className="size-4" />
                            导出 CSV
                        </Button>
                        <Button
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExportExcel}
                        >
                            <FileSpreadsheet className="size-4" />
                            导出 Excel
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>共 {totalOrders} 条订单，当前页 {currentItems.length} 条</span>
                    <span>
                        已选 {selectedCount} 条记录 · 当前筛选自动同步导出与批量操作
                    </span>
                </PageHeaderToolbar>
            </PageHeader>

            <OrdersFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<OrdersTableSkeleton />}>
                <OrdersTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    onPaginationChange={handlePaginationChange}
                    rowSelection={rowSelection}
                    onRowSelectionChange={setRowSelection}
                    columnVisibility={columnVisibility}
                    onColumnVisibilityChange={setColumnVisibility}
                    onViewDetail={handleViewDetail}
                    onUpdateStatus={handleSingleStatusChange}
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <OrderDetailDrawer
                orderId={selectedOrderId}
                open={isDrawerOpen}
                onOpenChange={handleDrawerChange}
                onUpdateStatus={handleSingleStatusChange}
                orderSummary={selectedOrderSummary}
            />
        </div>
    )
}

type OrdersTableContentProps = {
    query: OrdersQueryState
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    rowSelection: RowSelectionState
    onRowSelectionChange: (state: RowSelectionState) => void
    columnVisibility: VisibilityState
    onColumnVisibilityChange: (state: VisibilityState) => void
    onViewDetail: (order: AdminOrderListItem) => void
    onUpdateStatus: (orderId: string, status: OrderStatus) => void
    onDataChange: (data: AdminOrderListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function OrdersTableContent({
    query,
    page,
    limit,
    onPaginationChange,
    rowSelection,
    onRowSelectionChange,
    columnVisibility,
    onColumnVisibilityChange,
    onViewDetail,
    onUpdateStatus,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: OrdersTableContentProps) {
    const { data, refetch, isFetching } = useAdminOrders(query)

    useEffect(() => {
        onDataChange(data)
    }, [data, onDataChange])

    useEffect(() => {
        onFetchingChange(isFetching)
    }, [isFetching, onFetchingChange])

    useEffect(() => {
        const refresh = () => {
            void refetch()
        }
        onRegisterRefetch(refresh)
        return () => {
            onRegisterRefetch(null)
        }
    }, [refetch, onRegisterRefetch])

    return (
        <OrdersTable
            data={data.items}
            total={data.meta.total}
            page={page}
            limit={limit}
            onPaginationChange={onPaginationChange}
            rowSelection={rowSelection}
            onRowSelectionChange={onRowSelectionChange}
            columnVisibility={columnVisibility}
            onColumnVisibilityChange={onColumnVisibilityChange}
            onViewDetail={onViewDetail}
            onUpdateStatus={onUpdateStatus}
            isRefreshing={isFetching}
        />
    )
}

function toDateRange(start?: string, end?: string) {
    if (!start && !end) {
        return undefined
    }

    const parsedStart = start ? new Date(start) : undefined
    const parsedEnd = end ? new Date(end) : undefined

    return {
        from: parsedStart ?? parsedEnd ?? undefined,
        to: parsedEnd ?? parsedStart ?? undefined,
    }
}

function normalizeText(value?: string) {
    if (!value) {
        return undefined
    }
    const trimmed = value.trim()
    return trimmed.length ? trimmed : undefined
}

function parseAmount(value: string) {
    if (!value.trim()) {
        return undefined
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function triggerDownload(blob: Blob, filename: string) {
    const url = URL.createObjectURL(blob)
    const link = document.createElement("a")
    link.href = url
    link.download = filename
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
}

function escapeCsvCell(value: string) {
    if (value.includes(",") || value.includes('"')) {
        return `"${value.replace(/"/g, '""')}"`
    }
    return value
}

function escapeHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
}
