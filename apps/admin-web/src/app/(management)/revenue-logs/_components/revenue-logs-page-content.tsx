"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { usePathname, useRouter } from "next/navigation"
import { Download, RefreshCcw } from "lucide-react"
import type {
    AdminRevenueDirection,
    AdminRevenueLog,
    PaginatedData,
    TransactionType,
} from "@repo/types"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import type { RevenueLogsQueryState } from "../_utils/query"
import {
    buildRevenueLogsSearchParams,
    normalizeRevenueLogsQuery,
} from "../_utils/query"
import { RevenueLogsFilterBar, type RevenueLogsFilterValues } from "./revenue-logs-filter-bar"
import { RevenueLogsTable } from "./revenue-logs-table"
import { RevenueLogsTableSkeleton } from "./revenue-logs-table-skeleton"
import { RevenueLogDetailDrawer } from "./revenue-log-detail-drawer"
import { useAdminRevenueLogs } from "@repo/hooks/api/ssr"
import { toast } from "sonner"

type RevenueLogsPageContentProps = {
    initialQuery: RevenueLogsQueryState
}

type RevenueLogsListResponse = PaginatedData<AdminRevenueLog>

export function RevenueLogsPageContent({ initialQuery }: RevenueLogsPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<RevenueLogsQueryState>(() =>
        normalizeRevenueLogsQuery(initialQuery),
    )
    const [selectedLog, setSelectedLog] = useState<AdminRevenueLog | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [tableSnapshot, setTableSnapshot] = useState<RevenueLogsListResponse | null>(null)
    const [isTableFetching, setIsTableFetching] = useState(false)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(() => ({ ...queryState }), [queryState])
    const currentItems = tableSnapshot?.items ?? []

    const filterDefaults = useMemo<RevenueLogsFilterValues>(
        () => ({
            transactionType: queryState.transactionType ?? "all",
            direction: queryState.direction ?? "all",
            dateRange: toDateRange(queryState.startDate, queryState.endDate),
            minAmount: queryState.minAmount?.toString() ?? "",
            maxAmount: queryState.maxAmount?.toString() ?? "",
        }),
        [
            queryState.direction,
            queryState.endDate,
            queryState.maxAmount,
            queryState.minAmount,
            queryState.startDate,
            queryState.transactionType,
        ],
    )

    useEffect(() => {
        const search = buildRevenueLogsSearchParams(queryState)
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
    }, [pathname, queryState, router])

    const handleApplyFilters = useCallback(
        (values: RevenueLogsFilterValues) => {
            setQueryState((prev) => {
                const range = toIsoRange(values.dateRange)
                const minAmount = toNumberOrUndefined(values.minAmount)
                const maxAmount = toNumberOrUndefined(values.maxAmount)
                return normalizeRevenueLogsQuery({
                    ...prev,
                    page: 1,
                    startDate: range.startDate,
                    endDate: range.endDate,
                    transactionType:
                        values.transactionType === "all"
                            ? undefined
                            : (values.transactionType as TransactionType),
                    direction:
                        values.direction === "all"
                            ? undefined
                            : (values.direction as AdminRevenueDirection),
                    minAmount,
                    maxAmount,
                })
            })
        },
        [],
    )

    const handleResetFilters = useCallback(() => {
        setQueryState((prev) =>
            normalizeRevenueLogsQuery({
                ...prev,
                page: 1,
                startDate: undefined,
                endDate: undefined,
                transactionType: undefined,
                direction: undefined,
                minAmount: undefined,
                maxAmount: undefined,
            }),
        )
    }, [])

    const handlePaginationChange = useCallback(
        ({ page, limit }: { page: number; limit: number }) => {
            setQueryState((prev) =>
                normalizeRevenueLogsQuery({
                    ...prev,
                    page,
                    limit,
                }),
            )
        },
        [],
    )

    const handleViewDetail = useCallback((log: AdminRevenueLog) => {
        setSelectedLog(log)
        setDrawerOpen(true)
    }, [])

    const handleDrawerChange = useCallback((open: boolean) => {
        setDrawerOpen(open)
        if (!open) {
            setSelectedLog(null)
        }
    }, [])

    const handleDataChange = useCallback((data: RevenueLogsListResponse) => {
        setTableSnapshot(data)
    }, [])

    const handleFetchingChange = useCallback((status: boolean) => {
        setIsTableFetching(status)
    }, [])

    const handleRegisterRefetch = useCallback(
        (fn: (() => Promise<unknown> | void) | null) => {
            refetchRef.current = fn
        },
        [],
    )

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        }
    }, [])

    const handleExportCsv = useCallback(() => {
        if (!currentItems.length) {
            toast.info("暂无可导出的记录")
            return
        }

        const header = [
            "记录ID",
            "发生时间",
            "类型",
            "方向",
            "金额",
            "币种",
            "描述",
            "关联订单",
            "关联用户",
            "外部引用号",
        ]
        const rows = currentItems.map((item) => [
            item.id,
            formatDateTime(item.createdAt),
            formatTransactionType(item.transactionType),
            item.direction === "expense" ? "支出" : "收入",
            formatAmount(item),
            item.amount.currency,
            item.description ?? "",
            item.order?.orderSerial ?? item.order?.id ?? "",
            item.user?.name ?? item.user?.email ?? "",
            item.referenceId ?? "",
        ])
        const csvContent = `\uFEFF${[header, ...rows]
            .map((row) => row.map(escapeCsvCell).join(","))
            .join("\n")}`
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        })
        triggerDownload(blob, `revenue-logs-${Date.now()}.csv`)
        toast.success("已导出 CSV")
    }, [currentItems])

    const totals = useMemo(
        () =>
            currentItems.reduce(
                (acc, item) => {
                    const amount = Math.abs(item.amount.amount ?? 0)
                    if (item.direction === "expense") {
                        acc.expense += amount
                    } else {
                        acc.income += amount
                    }
                    return acc
                },
                { income: 0, expense: 0 },
            ),
        [currentItems],
    )

    const totalItems = tableSnapshot?.meta.total ?? 0

    return (
        <div className="space-y-6">
            <PageHeader
                title="平台收益记录"
                description="聚合平台侧收入与支出流水，支持时间、类型与金额筛选，并可追溯关联订单。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/revenue-logs" },
                    { label: "平台收益记录" },
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
                        <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExportCsv}
                        >
                            <Download className="size-4" />
                            导出 CSV
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>当前筛选命中 {totalItems} 条流水</span>
                    <span>
                        本页收入 ¥{totals.income.toFixed(2)} / 支出 ¥
                        {totals.expense.toFixed(2)}
                    </span>
                </PageHeaderToolbar>
            </PageHeader>

            <RevenueLogsFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<RevenueLogsTableSkeleton />}>
                <RevenueLogsTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    onPaginationChange={handlePaginationChange}
                    onViewDetail={handleViewDetail}
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <RevenueLogDetailDrawer
                log={selectedLog}
                open={isDrawerOpen}
                onOpenChange={handleDrawerChange}
            />
        </div>
    )
}

type RevenueLogsTableContentProps = {
    query: RevenueLogsQueryState
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (log: AdminRevenueLog) => void
    onDataChange: (data: RevenueLogsListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function RevenueLogsTableContent({
    query,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: RevenueLogsTableContentProps) {
    const { data, refetch, isFetching } = useAdminRevenueLogs(query)

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
    }, [onRegisterRefetch, refetch])

    return (
        <RevenueLogsTable
            data={data.items}
            total={data.meta.total}
            page={page}
            limit={limit}
            onPaginationChange={onPaginationChange}
            onViewDetail={onViewDetail}
        />
    )
}

function toNumberOrUndefined(value: string) {
    if (!value.trim()) {
        return undefined
    }
    const parsed = Number(value)
    return Number.isFinite(parsed) ? parsed : undefined
}

function toIsoRange(range?: { from?: Date; to?: Date }) {
    if (!range) {
        return { startDate: undefined, endDate: undefined }
    }
    const startDate = range.from
        ? new Date(
              Date.UTC(
                  range.from.getFullYear(),
                  range.from.getMonth(),
                  range.from.getDate(),
                  0,
                  0,
                  0,
              ),
          ).toISOString()
        : undefined
    const end = range.to ?? range.from
    const endDate = end
        ? new Date(
              Date.UTC(
                  end.getFullYear(),
                  end.getMonth(),
                  end.getDate(),
                  23,
                  59,
                  59,
                  999,
              ),
          ).toISOString()
        : undefined

    return { startDate, endDate }
}

function toDateRange(start?: string, end?: string) {
    if (!start && !end) {
        return undefined
    }
    const from = start ? new Date(start) : undefined
    const to = end ? new Date(end) : undefined
    if ((from && Number.isNaN(from.getTime())) || (to && Number.isNaN(to.getTime()))) {
        return undefined
    }
    return { from: from ?? to, to: to ?? from }
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

function formatTransactionType(type: TransactionType) {
    switch (type) {
        case "payment_received":
            return "订单收款"
        case "service_earning":
            return "服务分成"
        case "platform_fee":
            return "平台手续费"
        case "withdrawal":
            return "提现"
        case "refund_paid":
            return "退款支出"
        case "bonus":
            return "奖金"
        case "penalty":
            return "罚金"
        case "adjustment":
            return "调整"
        default:
            return type
    }
}

function formatAmount(log: AdminRevenueLog) {
    const amount = Math.abs(log.amount.amount ?? 0).toFixed(2)
    return `${log.direction === "expense" ? "-" : "+"}${amount}`
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
