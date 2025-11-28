"use client"

import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
    useTransition,
} from "react"
import { usePathname, useRouter } from "next/navigation"
import { Download, RefreshCcw } from "lucide-react"
import type { AdminWithdrawal, PaginatedData, PaymentMethod, WithdrawalStatus } from "@repo/types"
import { useAdminWithdrawals } from "@repo/hooks/api/ssr"
import { Button } from "@repo/web-ui/components/button"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"
import { toast } from "sonner"
import type { WithdrawalsQueryState } from "../_utils/query"
import {
    buildWithdrawalsSearchParams,
    normalizeWithdrawalsQuery,
} from "../_utils/query"
import {
    WithdrawalsFilterBar,
    type WithdrawalsFilterValues,
} from "./withdrawals-filter-bar"
import { WithdrawalsTable } from "./withdrawals-table"
import { WithdrawalsTableSkeleton } from "./withdrawals-table-skeleton"
import { WithdrawalDetailDrawer } from "./withdrawal-detail-drawer"

type WithdrawalsPageContentProps = {
    initialQuery: WithdrawalsQueryState
}

type WithdrawalsListResponse = PaginatedData<AdminWithdrawal>

export function WithdrawalsPageContent({
    initialQuery,
}: WithdrawalsPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<WithdrawalsQueryState>(() =>
        normalizeWithdrawalsQuery(initialQuery),
    )
    const [selectedWithdrawal, setSelectedWithdrawal] =
        useState<AdminWithdrawal | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [tableSnapshot, setTableSnapshot] =
        useState<WithdrawalsListResponse | null>(null)
    const [isTableFetching, setIsTableFetching] = useState(false)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(() => ({ ...queryState }), [queryState])
    const filterDefaults = useMemo<WithdrawalsFilterValues>(
        () => ({
            status: queryState.status ?? "all",
            method: queryState.method ?? "all",
            keyword: queryState.keyword ?? "",
            dateRange: toDateRange(queryState.startDate, queryState.endDate),
            minAmount: queryState.minAmount?.toString() ?? "",
            maxAmount: queryState.maxAmount?.toString() ?? "",
        }),
        [
            queryState.endDate,
            queryState.keyword,
            queryState.limit,
            queryState.maxAmount,
            queryState.minAmount,
            queryState.method,
            queryState.startDate,
            queryState.status,
        ],
    )

    useEffect(() => {
        const search = buildWithdrawalsSearchParams(queryState)
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

    const currentItems = tableSnapshot?.items ?? []
    const totalItems = tableSnapshot?.meta.total ?? 0
    const pendingOnPage = currentItems.filter(
        (item) => item.status === "pending",
    ).length

    const handleDataChange = useCallback((data: WithdrawalsListResponse) => {
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

    const handleApplyFilters = useCallback(
        (values: WithdrawalsFilterValues) => {
            const range = toIsoRange(values.dateRange)
            const minAmount = toNumberOrUndefined(values.minAmount)
            const maxAmount = toNumberOrUndefined(values.maxAmount)
            setQueryState((prev) =>
                normalizeWithdrawalsQuery({
                    ...prev,
                    page: 1,
                    startDate: range.startDate,
                    endDate: range.endDate,
                    status:
                        values.status === "all"
                            ? undefined
                            : (values.status as WithdrawalStatus),
                    method:
                        values.method === "all"
                            ? undefined
                            : (values.method as PaymentMethod),
                    keyword: values.keyword.trim() ? values.keyword.trim() : undefined,
                    minAmount,
                    maxAmount,
                }),
            )
        },
        [],
    )

    const handleResetFilters = useCallback(() => {
        setQueryState((prev) =>
            normalizeWithdrawalsQuery({
                ...prev,
                page: 1,
                startDate: undefined,
                endDate: undefined,
                status: undefined,
                method: undefined,
                keyword: undefined,
                minAmount: undefined,
                maxAmount: undefined,
            }),
        )
    }, [])

    const handlePaginationChange = useCallback(
        ({ page, limit }: { page: number; limit: number }) => {
            setQueryState((prev) =>
                normalizeWithdrawalsQuery({
                    ...prev,
                    page,
                    limit,
                }),
            )
        },
        [],
    )

    const handleViewDetail = useCallback((withdrawal: AdminWithdrawal) => {
        setSelectedWithdrawal(withdrawal)
        setDrawerOpen(true)
    }, [])

    const handleDrawerChange = useCallback((open: boolean) => {
        setDrawerOpen(open)
        if (!open) {
            setSelectedWithdrawal(null)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        } else {
            toast.info("暂无可刷新的内容")
        }
    }, [])

    const handleExportCsv = useCallback(() => {
        if (!currentItems.length) {
            toast.info("当前列表暂无可导出的数据")
            return
        }

        const header = [
            "记录ID",
            "状态",
            "提现金额",
            "币种",
            "申请时间",
            "完成时间",
            "提现方式",
            "收款账号类型",
            "收款账号",
            "服务人员",
            "用户备注",
            "审核人",
            "审核备注",
            "打款流水号",
        ]

        const rows = currentItems.map((item) => [
            item.id,
            formatStatus(item.status),
            (item.amount.amount ?? 0).toFixed(2),
            item.amount.currency,
            formatDateTime(item.requestedAt),
            formatDateTime(item.processedAt),
            formatMethod(item.method),
            formatAccountType(item.payeeAccountType),
            item.payeeAccount,
            item.user?.name ?? item.user?.email ?? item.user?.id ?? "",
            item.remark ?? "",
            item.reviewer?.name ?? item.reviewer?.id ?? "",
            item.reviewNote ?? "",
            item.payoutReferenceId ?? "",
        ])

        const csvContent = `\uFEFF${[header, ...rows]
            .map((row) => row.map(escapeCsvCell).join(","))
            .join("\n")}`
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        })
        triggerDownload(blob, `withdrawals-${Date.now()}.csv`)
        toast.success("已导出提现记录 CSV")
    }, [currentItems])

    const handleWithdrawalUpdated = useCallback((updated: AdminWithdrawal) => {
        setSelectedWithdrawal(updated)
    }, [])

    return (
        <div className="space-y-6">
            <PageHeader
                title="提现记录"
                description="审核服务人员提现申请，支持备注记录与审批历史查询。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/withdrawals" },
                    { label: "提现记录" },
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
                    <span>当前筛选命中 {totalItems} 条申请</span>
                    <span>本页待审核 {pendingOnPage} 条</span>
                </PageHeaderToolbar>
            </PageHeader>

            <WithdrawalsFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<WithdrawalsTableSkeleton />}>
                <WithdrawalsTableContent
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

            <WithdrawalDetailDrawer
                withdrawal={selectedWithdrawal}
                open={isDrawerOpen}
                onOpenChange={handleDrawerChange}
                query={requestQuery}
                onWithdrawalUpdated={handleWithdrawalUpdated}
            />
        </div>
    )
}

type WithdrawalsTableContentProps = {
    query: WithdrawalsQueryState
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (withdrawal: AdminWithdrawal) => void
    onDataChange: (data: WithdrawalsListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function WithdrawalsTableContent({
    query,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: WithdrawalsTableContentProps) {
    const { data, refetch, isFetching } = useAdminWithdrawals(query)

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
        <WithdrawalsTable
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

function formatStatus(status: WithdrawalStatus) {
    switch (status) {
        case "pending":
            return "待审核"
        case "approved":
            return "已通过"
        case "completed":
            return "已完成"
        case "rejected":
            return "已驳回"
        default:
            return status
    }
}

function formatMethod(method: PaymentMethod) {
    switch (method) {
        case "alipay":
            return "支付宝"
        case "wechat_pay":
            return "微信支付"
        case "bank_transfer":
            return "银行转账"
        default:
            return method
    }
}

function formatAccountType(value: AdminWithdrawal["payeeAccountType"]) {
    switch (value) {
        case "ALIPAY_USER_ID":
            return "支付宝 UID"
        case "ALIPAY_LOGON_ID":
            return "支付宝登录号"
        case "ALIPAY_OPEN_ID":
            return "支付宝 OpenID"
        default:
            return value
    }
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return ""
    }
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
