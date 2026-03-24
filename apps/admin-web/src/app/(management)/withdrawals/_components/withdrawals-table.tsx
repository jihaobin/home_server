"use client"

import { useMemo } from "react"
import type {
    ColumnDef,
    PaginationState,
    Updater,
} from "@tanstack/react-table"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { AdminWithdrawal } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import {
    EntityTable,
    EntityTablePagination,
} from "@/components/common"

type WithdrawalsTableProps = {
    data: AdminWithdrawal[]
    total: number
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (withdrawal: AdminWithdrawal) => void
}

const STATUS_LABELS: Record<AdminWithdrawal["status"], string> = {
    pending: "待审核",
    approved: "待渠道处理",
    processing: "处理中",
    completed: "已完成",
    failed: "打款失败",
    cancelled: "已取消",
    rejected: "已驳回",
}

const STATUS_BADGE_CLASS: Record<AdminWithdrawal["status"], string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-sky-100 text-sky-700",
    processing: "bg-indigo-100 text-indigo-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    cancelled: "bg-slate-200 text-slate-700",
    rejected: "bg-rose-100 text-rose-700",
}

const METHOD_LABELS: Record<AdminWithdrawal["method"], string> = {
    alipay: "支付宝",
    wechat_pay: "微信支付",
    bank_transfer: "银行转账",
}

const ACCOUNT_TYPE_LABELS: Record<AdminWithdrawal["payeeAccountType"], string> =
    {
        ALIPAY_USER_ID: "支付宝 UID",
        ALIPAY_LOGON_ID: "支付宝登录号",
        ALIPAY_OPEN_ID: "支付宝 OpenID",
        WECHAT_OPENID: "微信 OpenID",
    }

export function WithdrawalsTable({
    data,
    total,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
}: WithdrawalsTableProps) {
    const columns = useMemo<ColumnDef<AdminWithdrawal>[]>(
        () => [
            {
                header: "申请时间",
                accessorKey: "requestedAt",
                cell: ({ row }) => (
                    <div className="flex flex-col gap-1 text-sm">
                        <span className="font-medium">
                            {formatDateTime(row.original.requestedAt)}
                        </span>
                        <Badge
                            className={cn(
                                "w-fit text-xs",
                                STATUS_BADGE_CLASS[row.original.status],
                            )}
                        >
                            {STATUS_LABELS[row.original.status]}
                        </Badge>
                    </div>
                ),
            },
            {
                header: "服务人员",
                cell: ({ row }) => {
                    const user = row.original.user
                    if (!user) {
                        return <span className="text-muted-foreground">—</span>
                    }
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">
                                {user.name ?? "未填写"}
                            </div>
                            <div className="text-muted-foreground text-xs">
                                {user.phoneNumber ?? user.email ?? "—"}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "提现金额",
                cell: ({ row }) => (
                    <div className="flex flex-col">
                        <span className="text-base font-semibold text-foreground">
                            {formatAmount(row.original)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            币种：{row.original.amount.currency}
                        </span>
                    </div>
                ),
            },
            {
                header: "收款账户",
                cell: ({ row }) => (
                    <div className="text-sm leading-5">
                        <div className="font-medium">
                            {METHOD_LABELS[row.original.method] ??
                                row.original.method}
                        </div>
                        <div className="text-muted-foreground text-xs">
                            {ACCOUNT_TYPE_LABELS[row.original.payeeAccountType]} ·{" "}
                            {row.original.payeeAccount}
                        </div>
                    </div>
                ),
            },
            {
                header: "审核信息",
                cell: ({ row }) => {
                    const reviewer = row.original.reviewer
                    return (
                        <div className="text-sm leading-5">
                            <div className="font-medium">
                                {reviewer
                                    ? reviewer.name ?? reviewer.id
                                    : "待分配"}
                            </div>
                            <div className="text-muted-foreground text-xs">
                                {row.original.reviewNote ?? "暂无备注"}
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
                typeof updater === "function" ? updater(current) : updater

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
                    title: "暂无提现申请",
                    description: "换个筛选条件试试，或稍后刷新。",
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

function formatAmount(withdrawal: AdminWithdrawal) {
    const amount = withdrawal.amount.amount ?? 0
    return `¥${amount.toFixed(2)}`
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
