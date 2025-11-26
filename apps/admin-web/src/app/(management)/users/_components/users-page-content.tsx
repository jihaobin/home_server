"use client"

import { Suspense, useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react"
import { Download, FileSpreadsheet, RefreshCcw } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { useQueryClient } from "@tanstack/react-query"
import type { AdminUserListItem, PaginatedData, UserRole } from "@repo/types"
import {
    adminUsersQueryOptions,
    useAdminUsers,
    useUpdateAdminUserRole,
    useUpdateAdminUserStatus,
} from "@repo/hooks/api/ssr"
import { Button } from "@repo/web-ui/components/button"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"
import { toast } from "sonner"
import type { UsersQueryState } from "../_utils/query"
import { buildUsersSearchParams, normalizeUsersQuery } from "../_utils/query"
import { UsersFilterBar, type UsersFilterValues } from "./users-filter-bar"
import { UsersTable } from "./users-table"
import { UsersTableSkeleton } from "./users-table-skeleton"
import { UserDetailDrawer } from "./user-detail-drawer"

type UsersPageContentProps = {
    initialQuery: UsersQueryState
}

type AdminUsersListResponse = PaginatedData<AdminUserListItem>

export function UsersPageContent({ initialQuery }: UsersPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const queryClient = useQueryClient()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<UsersQueryState>(() =>
        normalizeUsersQuery(initialQuery),
    )
    const [selectedUserId, setSelectedUserId] = useState<string | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [exportingFormat, setExportingFormat] = useState<"csv" | "excel" | null>(
        null,
    )
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(() => ({ ...queryState }), [queryState])
    const currentListQueryKey = useMemo(
        () => adminUsersQueryOptions(requestQuery).queryKey,
        [requestQuery],
    )
    const [tableSnapshot, setTableSnapshot] =
        useState<AdminUsersListResponse | null>(() => {
            return (
                queryClient.getQueryData<AdminUsersListResponse>(currentListQueryKey) ??
                null
            )
        })
    const [isTableFetching, setIsTableFetching] = useState(false)
    const handleDataChange = useCallback((data: AdminUsersListResponse) => {
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
            queryClient.getQueryData<AdminUsersListResponse>(currentListQueryKey) ??
            null
        if (cached) {
            setTableSnapshot(cached)
        }
    }, [currentListQueryKey, queryClient])
    const updateStatusMutation = useUpdateAdminUserStatus()
    const updateRoleMutation = useUpdateAdminUserRole()

    const filterDefaults = useMemo<UsersFilterValues>(
        () => ({
            name: queryState.name ?? "",
            phone: queryState.phone ?? "",
            role: queryState.role ?? "all",
            status: queryState.status ?? "all",
        }),
        [queryState.name, queryState.phone, queryState.role, queryState.status],
    )

    const updateQuery = useCallback(
        (updater: (prev: UsersQueryState) => UsersQueryState) => {
            setQueryState((prev) => {
                const next = normalizeUsersQuery(updater(prev))
                return next
            })
        },
        [],
    )

    const handleApplyFilters = useCallback(
        (values: UsersFilterValues) => {
            updateQuery((prev) => ({
                ...prev,
                page: 1,
                name: values.name.trim() ? values.name.trim() : undefined,
                phone: values.phone.trim() ? values.phone.trim() : undefined,
                role:
                    values.role === "all" ? undefined : (values.role as UserRole),
                status:
                    values.status === "all"
                        ? undefined
                        : (values.status as "active" | "inactive"),
            }))
        },
        [updateQuery],
    )

    const handleResetFilters = useCallback(() => {
        updateQuery((prev) => ({
            ...prev,
            page: 1,
            name: undefined,
            phone: undefined,
            role: undefined,
            status: undefined,
        }))
    }, [updateQuery])

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

    useEffect(() => {
        const search = buildUsersSearchParams(queryState)
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

    const currentItems = tableSnapshot?.items ?? []

    const handleViewDetail = useCallback((userId: string) => {
        setSelectedUserId(userId)
        setDrawerOpen(true)
    }, [])

    const handleDrawerChange = useCallback((open: boolean) => {
        setDrawerOpen(open)
        if (!open) {
            setSelectedUserId(null)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        }
    }, [])

    const handleStatusChange = useCallback(
        async (userId: string, nextActive: boolean) => {
            try {
                await updateStatusMutation.mutateAsync({
                    userId,
                    payload: { isActive: nextActive },
                })
                toast.success(`用户已${nextActive ? "启用" : "禁用"}`)
            } catch (error) {
                console.error(error)
                toast.error("更新用户状态失败")
            }
        },
        [updateStatusMutation],
    )

    const handleRoleChange = useCallback(
        async (userId: string, role: UserRole) => {
            try {
                await updateRoleMutation.mutateAsync({
                    userId,
                    payload: { role },
                })
                toast.success("用户角色已更新")
            } catch (error) {
                console.error(error)
                toast.error("更新用户角色失败")
            }
        },
        [updateRoleMutation],
    )

    const handleExportCsv = useCallback(() => {
        if (!currentItems.length) {
            toast.info("暂无可导出的记录")
            return
        }
        setExportingFormat("csv")
        try {
            const header = [
                "用户ID",
                "姓名",
                "邮箱",
                "手机号",
                "角色",
                "状态",
                "累计订单",
                "完成订单",
                "取消订单",
                "总消费(¥)",
            ]
            const rows = currentItems.map((item) => [
                item.id,
                item.name || "",
                item.email,
                item.phoneNumber || "",
                roleLabel(item.role),
                item.isActive ? "启用" : "禁用",
                String(item.stats.totalOrders),
                String(item.stats.completedOrders),
                String(item.stats.cancelledOrders),
                item.stats.totalSpent.amount.toFixed(2),
            ])
            const csvContent = `\uFEFF${[header, ...rows]
                .map((row) => row.map(escapeCsvCell).join(","))
                .join("\n")}`
            triggerDownload(
                new Blob([csvContent], {
                    type: "text/csv;charset=utf-8;",
                }),
                `users-${Date.now()}.csv`,
            )
            toast.success("已导出 CSV")
        } finally {
            setExportingFormat(null)
        }
    }, [currentItems])

    const handleExportExcel = useCallback(() => {
        if (!currentItems.length) {
            toast.info("暂无可导出的记录")
            return
        }
        setExportingFormat("excel")
        try {
            const header = [
                "用户ID",
                "姓名",
                "邮箱",
                "手机号",
                "角色",
                "状态",
                "累计订单",
                "完成订单",
                "取消订单",
                "总消费(¥)",
            ]
            const rows = currentItems.map((item) => [
                item.id,
                item.name || "",
                item.email,
                item.phoneNumber || "",
                roleLabel(item.role),
                item.isActive ? "启用" : "禁用",
                item.stats.totalOrders.toString(),
                item.stats.completedOrders.toString(),
                item.stats.cancelledOrders.toString(),
                item.stats.totalSpent.amount.toFixed(2),
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
                `users-${Date.now()}.xls`,
            )
            toast.success("已导出 Excel")
        } finally {
            setExportingFormat(null)
        }
    }, [currentItems])

    const currentPageActive = useMemo(
        () => currentItems.filter((item) => item.isActive).length,
        [currentItems],
    )

    const totalUsers = tableSnapshot?.meta.total ?? 0

    return (
        <div className="space-y-6">
            <PageHeader
                title="用户管理"
                description="查询、筛选并导出平台注册用户，支持查看详情与禁用操作。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/users" },
                    { label: "用户管理" },
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
                            variant="ghost"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExportCsv}
                            disabled={exportingFormat !== null}
                        >
                            <Download className="size-4" />
                            导出 CSV
                        </Button>
                        <Button
                            variant="default"
                            size="sm"
                            className="gap-1.5"
                            onClick={handleExportExcel}
                            disabled={exportingFormat !== null}
                        >
                            <FileSpreadsheet className="size-4" />
                            导出 Excel
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>当前共有 {totalUsers} 位平台注册用户</span>
                    <span>
                        本页启用 {currentPageActive} 人 / 禁用{" "}
                        {currentItems.length - currentPageActive} 人
                    </span>
                </PageHeaderToolbar>
            </PageHeader>

            <UsersFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<UsersTableSkeleton />}>
                <UsersTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    onPaginationChange={handlePaginationChange}
                    onToggleStatus={handleStatusChange}
                    onViewDetail={handleViewDetail}
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <UserDetailDrawer
                userId={selectedUserId}
                open={isDrawerOpen}
                onOpenChange={handleDrawerChange}
                onToggleStatus={handleStatusChange}
                onRoleChange={handleRoleChange}
            />
        </div>
    )
}

type UsersTableContentProps = {
    query: UsersQueryState
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onToggleStatus: (userId: string, nextActive: boolean) => void
    onViewDetail: (userId: string) => void
    onDataChange: (data: AdminUsersListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function UsersTableContent({
    query,
    page,
    limit,
    onPaginationChange,
    onToggleStatus,
    onViewDetail,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: UsersTableContentProps) {
    const { data, refetch, isFetching } = useAdminUsers(query)

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
        <UsersTable
            data={data.items}
            total={data.meta.total}
            page={page}
            limit={limit}
            onPaginationChange={onPaginationChange}
            onToggleStatus={onToggleStatus}
            onViewDetail={onViewDetail}
        />
    )
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

function roleLabel(role: UserRole) {
    switch (role) {
        case "customer":
            return "普通用户"
        case "service_personnel":
            return "服务人员"
        case "shop_admin":
            return "店铺管理员"
        case "admin":
            return "管理员"
        case "super_admin":
            return "超级管理员"
        default:
            return role
    }
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
