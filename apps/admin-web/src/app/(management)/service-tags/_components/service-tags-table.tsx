"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { AdminServiceTag } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { EntityTable } from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"

type ServiceTagsTableProps = {
    items: AdminServiceTag[]
    onEdit: (tag: AdminServiceTag) => void
    onToggle: (tag: AdminServiceTag) => void
    onDelete: (tag: AdminServiceTag) => void
    togglingTagId?: string | null
    deletingTagId?: string
}

export function ServiceTagsTable({
    items,
    onEdit,
    onToggle,
    onDelete,
    togglingTagId,
    deletingTagId,
}: ServiceTagsTableProps) {
    const columns = useMemo<ColumnDef<AdminServiceTag>[]>(
        () => [
            {
                header: "标签",
                cell: ({ row }) => {
                    const tag = row.original
                    return (
                        <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                                <span className="font-semibold">{tag.name}</span>
                                <Badge variant="outline" className="font-mono text-xs">
                                    {tag.slug}
                                </Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">
                                {tag.description ?? "暂无描述"}
                            </p>
                        </div>
                    )
                },
            },
            {
                header: "状态",
                cell: ({ row }) => {
                    const tag = row.original
                    return (
                        <Badge
                            className={cn(
                                "w-fit",
                                tag.isActive
                                    ? "bg-emerald-500/10 text-emerald-700"
                                    : "bg-muted text-muted-foreground",
                            )}
                        >
                            {tag.isActive ? "启用" : "停用"}
                        </Badge>
                    )
                },
            },
            {
                header: "排序",
                cell: ({ row }) => (
                    <span className="font-medium">{row.original.sortOrder}</span>
                ),
            },
            {
                header: "已绑定服务",
                cell: ({ row }) => (
                    <span className="text-sm text-muted-foreground">
                        {row.original.serviceCount} 个
                    </span>
                ),
            },
            {
                header: "操作",
                cell: ({ row }) => {
                    const tag = row.original
                    const isToggling = togglingTagId === tag.id
                    const isDeleting = deletingTagId === tag.id

                    return (
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() => onEdit(tag)}
                                disabled={isToggling || isDeleting}
                            >
                                编辑
                            </Button>
                            <Button
                                variant={tag.isActive ? "secondary" : "default"}
                                size="sm"
                                onClick={() => onToggle(tag)}
                                disabled={isToggling || isDeleting}
                            >
                                {isToggling
                                    ? "提交中..."
                                    : tag.isActive
                                      ? "停用"
                                      : "启用"}
                            </Button>
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => onDelete(tag)}
                                disabled={isToggling || isDeleting}
                            >
                                {isDeleting ? "删除中..." : "删除"}
                            </Button>
                        </div>
                    )
                },
            },
        ],
        [deletingTagId, onDelete, onEdit, onToggle, togglingTagId],
    )

    const table = useReactTable({
        data: items,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <EntityTable
            table={table}
            className="rounded-2xl border bg-card"
            emptyState={{
                title: "暂无服务标签",
                description: "当前筛选条件下还没有可管理的服务标签。",
            }}
        />
    )
}
