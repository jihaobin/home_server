"use client"

import { useCallback, useMemo } from "react"
import {
    getCoreRowModel,
    type PaginationState,
    type Updater,
    useReactTable,
    type ColumnDef,
} from "@tanstack/react-table"
import type { AdminUserListItem, UserRole } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import { EntityTable, EntityTablePagination } from "@/components/common"

type UsersTableProps = {
    data: AdminUserListItem[]
    total: number
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (userId: string) => void
    onToggleStatus: (userId: string, nextActive: boolean) => void
    isRefreshing?: boolean
}

const roleLabels: Record<UserRole, string> = {
    customer: "普通用户",
    service_personnel: "服务人员",
    shop_admin: "店铺管理员",
    admin: "管理员",
    super_admin: "超级管理员",
}

const formatRoles = (roles: UserRole[]) => {
    if (!roles.length) {
        return "—"
    }
    return roles.map((role) => roleLabels[role] ?? role).join("、")
}

export function UsersTable({
    data,
    total,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
    onToggleStatus,
}: UsersTableProps) {
    const columns = useMemo<ColumnDef<AdminUserListItem>[]>(
        () => [
            {
                header: "用户",
                cell: ({ row }) => {
                    const user = row.original
                    return (
                        <div className="flex flex-col">
                            <span className="font-medium">{user.name || "未填写"}</span>
                            <span className="text-muted-foreground text-xs">{user.email}</span>
                        </div>
                    )
                },
            },
            {
                header: "角色",
                accessorKey: "role",
                cell: ({ row }) => {
                    const user = row.original
                    return (
                        <Badge variant="outline" className="capitalize">
                            {formatRoles(user.role)}
                        </Badge>
                    )
                },
            },
            {
                header: "手机号",
                accessorKey: "phoneNumber",
                cell: ({ row }) => row.original.phoneNumber ?? "—",
            },
            {
                header: "订单统计",
                cell: ({ row }) => {
                    const { stats } = row.original
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">
                                累计 {stats.totalOrders} 单 / 完成 {stats.completedOrders} 单
                            </div>
                            <div className="text-muted-foreground text-xs">
                                取消 {stats.cancelledOrders} 单 · 总消费 ¥
                                {stats.totalSpent.amount.toFixed(2)}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "最近下单",
                cell: ({ row }) => {
                    const lastOrderAt = row.original.stats.lastOrderAt
                    return (
                        <span className="text-sm text-muted-foreground">
                            {lastOrderAt ? formatDateTime(lastOrderAt) : "暂无记录"}
                        </span>
                    )
                },
            },
            {
                header: "状态/操作",
                cell: ({ row }) => {
                    const user = row.original
                    return (
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Badge
                                className={cn(
                                    "w-fit",
                                    user.isActive
                                        ? "bg-emerald-500/10 text-emerald-700"
                                        : "bg-muted text-muted-foreground",
                                )}
                            >
                                {user.isActive ? "启用" : "禁用"}
                            </Badge>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onViewDetail(user.id)}
                            >
                                查看详情
                            </Button>
                            <Button
                                variant={user.isActive ? "destructive" : "default"}
                                size="sm"
                                onClick={() => onToggleStatus(user.id, !user.isActive)}
                                title={
                                    user.isActive
                                        ? "禁用后用户将无法登录"
                                        : "启用后用户可重新访问"
                                }
                            >
                                {user.isActive ? "禁用" : "启用"}
                            </Button>
                        </div>
                    )
                },
            },
        ],
        [onToggleStatus, onViewDetail],
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
                    title: "暂无用户数据",
                    description: "尝试调整筛选条件或稍后再试。",
                }}
            />
            <EntityTablePagination
                table={table}
                totalItems={total}
                pageSize={limit}
                onPageSizeChange={handlePageSizeChange}
                className="rounded-b-2xl border-t"
            />
        </div>
    )
}

function formatDateTime(input: string) {
    const date = new Date(input)
    return `${date.toLocaleDateString()} ${date.toLocaleTimeString([], {
        hour: "2-digit",
        minute: "2-digit",
    })}`
}
