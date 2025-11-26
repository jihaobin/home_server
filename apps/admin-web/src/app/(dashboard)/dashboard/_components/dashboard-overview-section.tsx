"use client"

import { Suspense, useMemo, useState, useCallback, useId } from "react"
import { Download, RefreshCcw } from "lucide-react"
import { Area, AreaChart, CartesianGrid, XAxis, YAxis } from "recharts"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { ErrorBoundary } from "react-error-boundary"
import { Button } from "@repo/web-ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@repo/web-ui/components/card"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import {
    ChartContainer,
    ChartTooltip,
    ChartTooltipContent,
    ChartLegend,
    ChartLegendContent,
} from "@repo/web-ui/components/chart"
import { cn } from "@repo/web-ui/lib/utils"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import {
    useAdminDashboardOverview,
    useAdminProfile,
} from "@repo/hooks/api/ssr"
import type { AdminDashboardRange } from "@repo/types"
import { useRouter } from "next/navigation"

const rangeOptions: Array<{ label: string; value: AdminDashboardRange }> = [
    { label: "近 7 天", value: "7d" },
    { label: "近 30 天", value: "30d" },
    { label: "近 90 天", value: "90d" },
]

const rangeDaysMap: Record<AdminDashboardRange, number> = {
    "7d": 7,
    "30d": 30,
    "90d": 90,
}

type DashboardOverviewSectionProps = {
    initialRange: AdminDashboardRange
}

export function DashboardOverviewSection({ initialRange }: DashboardOverviewSectionProps) {
    return (
        <QueryErrorResetBoundary>
            {({ reset }) => (
                <ErrorBoundary
                    onReset={reset}
                    fallbackRender={({ resetErrorBoundary, error }) => (
                        <DashboardOverviewError
                            onRetry={resetErrorBoundary}
                            errorMessage={error.message}
                        />
                    )}
                >
                    <DashboardOverviewSuspense initialRange={initialRange} />
                </ErrorBoundary>
            )}
        </QueryErrorResetBoundary>
    )
}

function DashboardOverviewSuspense({ initialRange }: DashboardOverviewSectionProps) {
    return (
        <SuspenseFallback>
            <DashboardOverviewContent initialRange={initialRange} />
        </SuspenseFallback>
    )
}

type SuspenseFallbackProps = {
    children: React.ReactNode
}

function SuspenseFallback({ children }: SuspenseFallbackProps) {
    return <Suspense fallback={<DashboardOverviewSkeleton />}>{children}</Suspense>
}

function DashboardOverviewContent({ initialRange }: DashboardOverviewSectionProps) {
    const router = useRouter()
    const [range, setRange] = useState<AdminDashboardRange>(initialRange)
    const { data, refetch, isFetching } = useAdminDashboardOverview(range)
    const { data: adminProfile } = useAdminProfile()
    const chartId = useId().replace(/:/g, "")
    const orderGradientId = `${chartId}-orders`
    const revenueGradientId = `${chartId}-revenue`

    const canExport = useMemo(() => {
        const roles = adminProfile?.roles ?? []
        return roles.includes("super_admin") || roles.includes("admin")
    }, [adminProfile?.roles])

    const formattedSummary = useMemo(() => buildSummary(data, range), [data, range])
    const formattedChartData = useMemo(() => buildChartData(data), [data])

    const handleRefresh = useCallback(() => {
        refetch()
    }, [refetch])

    const handleRangeChange = useCallback(
        (nextRange: AdminDashboardRange) => {
            if (nextRange === range) {
                return
            }
            setRange(nextRange)
            router.replace(`?range=${nextRange}`, { scroll: false })
        },
        [range, router],
    )

    const handleExport = useCallback(() => {
        if (!canExport) return
        const rows = [
            ["日期", "订单数", "净收益"],
            ...data.charts.daily.map((item) => [
                item.date,
                item.orderCount.toString(),
                item.revenue.toFixed(2),
            ]),
        ]
        const csvContent = `\uFEFF${rows.map((row) => row.join(",")).join("\n")}`
        const blob = new Blob([csvContent], {
            type: "text/csv;charset=utf-8;",
        })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `dashboard-${range}-${data.period.startDate.substring(0, 10)}.csv`
        link.click()
        URL.revokeObjectURL(url)
    }, [canExport, data.charts.daily, data.period.startDate, range])

    return (
        <div className="space-y-6">
            <PageHeader
                title="数据总览"
                description="聚合展示平台注册与订单指标，可在不同时间范围内切换趋势。"
                breadcrumbItems={[
                    { label: "工作台", href: "/dashboard" },
                    { label: "数据总览" },
                ]}
                actions={
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            size="sm"
                            onClick={handleRefresh}
                            disabled={isFetching}
                            className="gap-1.5"
                        >
                            <RefreshCcw className={cn("size-4", isFetching && "animate-spin")}
                            />
                            刷新
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            onClick={handleExport}
                            disabled={!canExport}
                            className="gap-1.5"
                            title={canExport ? undefined : "仅管理员可导出"}
                        >
                            <Download className="size-4" />
                            导出 CSV
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className="text-muted-foreground">统计范围：</span>
                        <div className="flex gap-1">
                            {rangeOptions.map((option) => (
                                <Button
                                    key={option.value}
                                    size="sm"
                                    variant={
                                        option.value === range ? "default" : "outline"
                                    }
                                    onClick={() => handleRangeChange(option.value)}
                                >
                                    {option.label}
                                </Button>
                            ))}
                        </div>
                    </div>
                    <span>
                        当前统计周期：{formatDateRange(data.period.startDate, data.period.endDate)}
                    </span>
                    <span>最新生成于 {formatDateTime(data.generatedAt)}</span>
                </PageHeaderToolbar>
            </PageHeader>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {formattedSummary.map((item) => (
                    <Card key={item.key}>
                        <CardHeader className="space-y-1">
                            <CardDescription>{item.label}</CardDescription>
                            <CardTitle className="text-3xl">
                                {item.displayValue}
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="text-xs text-muted-foreground">
                            {item.helperText}
                        </CardContent>
                    </Card>
                ))}
            </div>

            <Card className="space-y-0">
                <CardHeader>
                    <CardTitle>订单与收益趋势</CardTitle>
                    <CardDescription>
                        展示所选时间范围内的每日订单量与净收益走势
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <ChartContainer
                        config={{
                            orderCount: {
                                label: "订单数",
                                color: "var(--chart-1)",
                            },
                            revenue: {
                                label: "净收益",
                                color: "var(--chart-2)",
                            },
                        }}
                        className="min-h-80 w-full"
                    >
                        <AreaChart data={formattedChartData} margin={{ left: 12, right: 12 }}>
                            <defs>
                                <linearGradient id={orderGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-orderCount)" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="var(--color-orderCount)" stopOpacity={0.05} />
                                </linearGradient>
                                <linearGradient id={revenueGradientId} x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="var(--color-revenue)" stopOpacity={0.35} />
                                    <stop offset="95%" stopColor="var(--color-revenue)" stopOpacity={0.05} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid vertical={false} strokeDasharray="3 3" stroke="hsl(var(--border))" />
                            <XAxis
                                dataKey="date"
                                tickFormatter={formatChartDate}
                                tickLine={false}
                                axisLine={false}
                                tickMargin={12}
                                minTickGap={32}
                            />
                            <YAxis
                                yAxisId="orders"
                                allowDecimals={false}
                                tickLine={false}
                                axisLine={false}
                                width={40}
                            />
                            <YAxis
                                yAxisId="revenue"
                                orientation="right"
                                tickFormatter={(value) => formatCurrency(value)}
                                tickLine={false}
                                axisLine={false}
                                width={60}
                            />
                            <ChartTooltip
                                cursor={{ stroke: "hsl(var(--muted-foreground))", strokeDasharray: "4 4" }}
                                content={<ChartTooltipContent indicator="dot" />}
                            />
                            <ChartLegend content={<ChartLegendContent />} />
                            <Area
                                type="monotone"
                                dataKey="orderCount"
                                stroke="var(--color-orderCount)"
                                fill={`url(#${orderGradientId})`}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                yAxisId="orders"
                            />
                            <Area
                                type="monotone"
                                dataKey="revenue"
                                stroke="var(--color-revenue)"
                                fill={`url(#${revenueGradientId})`}
                                strokeWidth={2}
                                dot={false}
                                activeDot={{ r: 4 }}
                                yAxisId="revenue"
                            />
                        </AreaChart>
                    </ChartContainer>
                </CardContent>
            </Card>
        </div>
    )
}

type SummaryItem = {
    key: string
    label: string
    displayValue: string
    helperText: string
}

function buildSummary(data: ReturnType<typeof useAdminDashboardOverview>["data"], range: AdminDashboardRange): SummaryItem[] {
    const { totals, period } = data
    const rangeDays = rangeDaysMap[range]
    return [
        {
            key: "registeredUsers",
            label: "平台注册用户",
            displayValue: formatNumber(totals.registeredUsers),
            helperText: "累计注册并完成激活的用户",
        },
        {
            key: "servicePersonnel",
            label: "服务人员",
            displayValue: formatNumber(totals.servicePersonnel),
            helperText: "活跃中并具备服务资质的人员",
        },
        {
            key: "periodOrders",
            label: `近 ${rangeDays} 天订单`,
            displayValue: formatNumber(period.orderCount),
            helperText: `统计周期：${formatDateRange(period.startDate, period.endDate)}`,
        },
        {
            key: "periodRevenue",
            label: `近 ${rangeDays} 天净收益`,
            displayValue: formatCurrency(period.revenue.amount, period.revenue.currency),
            helperText: `平台全量收益：${formatCurrency(totals.totalRevenue.amount, totals.totalRevenue.currency)}`,
        },
    ]
}

function buildChartData(data: ReturnType<typeof useAdminDashboardOverview>["data"]) {
    return data.charts.daily.map((item) => ({
        date: item.date,
        orderCount: item.orderCount,
        revenue: Number(item.revenue.toFixed(2)),
    }))
}

type DashboardOverviewErrorProps = {
    onRetry: () => void
    errorMessage?: string
}

function DashboardOverviewError({ onRetry, errorMessage }: DashboardOverviewErrorProps) {
    return (
        <div className="space-y-4 rounded-lg border border-destructive/30 bg-destructive/5 p-6">
            <div className="text-destructive text-sm font-medium">
                数据面板加载失败：{errorMessage ?? "未知错误"}
            </div>
            <Button variant="outline" size="sm" onClick={onRetry} className="gap-1.5">
                <RefreshCcw className="size-4" />
                重试
            </Button>
        </div>
    )
}

function DashboardOverviewSkeleton() {
    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <Skeleton className="h-8 w-40" />
                <Skeleton className="h-4 w-1/2" />
                <Skeleton className="h-10 w-full" />
            </div>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {[...Array(4)].map((_, index) => (
                    <Card key={index}>
                        <CardHeader>
                            <Skeleton className="h-4 w-24" />
                            <Skeleton className="h-8 w-32" />
                        </CardHeader>
                        <CardContent>
                            <Skeleton className="h-4 w-40" />
                        </CardContent>
                    </Card>
                ))}
            </div>
            <Card>
                <CardHeader>
                    <Skeleton className="h-5 w-32" />
                    <Skeleton className="h-4 w-48" />
                </CardHeader>
                <CardContent>
                    <Skeleton className="h-72 w-full" />
                </CardContent>
            </Card>
        </div>
    )
}

function formatNumber(value: number) {
    return new Intl.NumberFormat("zh-CN", { maximumFractionDigits: 0 }).format(value)
}

function formatCurrency(value: number, currency = "CNY") {
    return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
    }).format(value)
}

function formatChartDate(value: string) {
    return new Intl.DateTimeFormat("zh-CN", {
        month: "numeric",
        day: "numeric",
        timeZone: "UTC",
    }).format(new Date(value))
}

function formatDateRange(start: string, end: string) {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        timeZone: "UTC",
    })
    return `${formatter.format(new Date(start))} - ${formatter.format(new Date(end))}`
}

function formatDateTime(value: string) {
    const formatter = new Intl.DateTimeFormat("zh-CN", {
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        timeZone: "UTC",
    })
    return formatter.format(new Date(value))
}
