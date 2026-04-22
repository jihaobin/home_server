"use client"

import { useMemo } from "react"
import type {
    ColumnDef,
    PaginationState,
    Updater,
} from "@tanstack/react-table"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { AdminMerchantJoinRequest } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import {
    EntityTable,
    EntityTablePagination,
} from "@/components/common"

type MerchantJoinRequestsTableProps = {
    data: AdminMerchantJoinRequest[]
    total: number
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (request: AdminMerchantJoinRequest) => void
}

const CONTACT_STATUS_LABELS = {
    true: "已联系",
    false: "未联系",
} as const

const CONTACT_STATUS_BADGE_CLASS = {
    true: "bg-emerald-100 text-emerald-700",
    false: "bg-amber-100 text-amber-800",
} as const

export function MerchantJoinRequestsTable({
    data,
    total,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
}: MerchantJoinRequestsTableProps) {
    const columns = useMemo<ColumnDef<AdminMerchantJoinRequest>[]>(
        () => [
            {
                header: "提交时间",
                accessorKey: "createdAt",
                cell: ({ row }) => {
                    const contactKey = String(row.original.isContacted) as keyof typeof CONTACT_STATUS_LABELS

                    return (
                        <div className="flex flex-col gap-1 text-sm">
                            <span className="font-medium">
                                {formatDateTime(row.original.createdAt)}
                            </span>
                            <Badge
                                className={cn(
                                    "w-fit text-xs",
                                    CONTACT_STATUS_BADGE_CLASS[contactKey],
                                )}
                            >
                                {CONTACT_STATUS_LABELS[contactKey]}
                            </Badge>
                        </div>
                    )
                },
            },
            {
                header: "申请人",
                cell: ({ row }) => (
                    <div className="text-sm leading-5">
                        <div className="font-medium">{row.original.merchantName}</div>
                        <div className="text-muted-foreground text-xs">
                            {row.original.phone}
                        </div>
                    </div>
                ),
            },
            {
                header: "基础信息",
                cell: ({ row }) => (
                    <div className="text-sm leading-5">
                        <div className="font-medium">
                            {formatGender(row.original.gender)} · {row.original.age} 岁
                        </div>
                        <div className="text-muted-foreground text-xs">
                            意向城市：{row.original.intentCity}
                        </div>
                    </div>
                ),
            },
            {
                header: "照片",
                cell: ({ row }) => {
                    if (!row.original.photoFileUrl) {
                        return <span className="text-sm text-muted-foreground">未上传</span>
                    }

                    return (
                        <div className="text-sm leading-5">
                            <a
                                className="font-medium text-primary underline-offset-4 hover:underline"
                                href={row.original.photoFileUrl}
                                target="_blank"
                                rel="noreferrer"
                            >
                                查看照片
                            </a>
                            <div className="text-muted-foreground text-xs break-all">
                                {row.original.photoFileId}
                            </div>
                        </div>
                    )
                },
            },
            {
                header: "跟进备注",
                cell: ({ row }) => (
                    <div className="text-sm leading-5">
                        <div className="font-medium line-clamp-2">
                            {row.original.adminRemark?.trim() || "暂无备注"}
                        </div>
                        <div className="text-muted-foreground text-xs">
                            联系时间：{formatDateTime(row.original.contactedAt) || "—"}
                        </div>
                    </div>
                ),
            },
            {
                header: "操作",
                cell: ({ row }) => (
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onViewDetail(row.original)}
                    >
                        查看/处理
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
                    title: "暂无商户加盟申请",
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

function formatGender(value: AdminMerchantJoinRequest["gender"]) {
    return value === "male" ? "男" : "女"
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
