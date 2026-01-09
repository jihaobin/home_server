"use client"

import { useMemo } from "react"
import type { ColumnDef } from "@tanstack/react-table"
import { getCoreRowModel, useReactTable } from "@tanstack/react-table"
import type { AppReleaseListItem } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@repo/web-ui/components/dropdown-menu"
import { Tooltip, TooltipContent, TooltipTrigger } from "@repo/web-ui/components/tooltip"
import { cn } from "@repo/web-ui/lib/utils"
import {
    EntityTable,
} from "@/components/common"
import { Copy, Download, History, Info, MoreVertical, PencilLine } from "lucide-react"

type AppReleasesTableProps = {
    data: AppReleaseListItem[]
    onEdit: (release: AppReleaseListItem) => void
    onViewDetail: (release: AppReleaseListItem) => void
    onCopyLink: (release: AppReleaseListItem) => void
    onRollback: (release: AppReleaseListItem) => void
    rollingBackId?: string
}

const APP_LABELS: Record<AppReleaseListItem["app"], string> = {
    "mobile-user": "用户端",
    "mobile-worker": "服务人员端",
}

const PLATFORM_LABELS: Record<AppReleaseListItem["platform"], string> = {
    android: "Android",
    ios: "iOS",
}

export function AppReleasesTable({
    data,
    onEdit,
    onViewDetail,
    onCopyLink,
    onRollback,
    rollingBackId,
}: AppReleasesTableProps) {
    const columns = useMemo<ColumnDef<AppReleaseListItem>[]>(
        () => [
            {
                header: "版本信息",
                cell: ({ row }) => (
                    <div className="flex flex-col gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="text-base font-semibold leading-tight">
                                v{row.original.version}
                            </span>
                            {typeof row.original.buildNumber === "number" ? (
                                <Badge variant="outline" className="text-xs">
                                    build {row.original.buildNumber}
                                </Badge>
                            ) : null}
                        </div>
                        <div className="flex flex-wrap items-center gap-2">
                            {row.original.isActive ? (
                                <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                    允许下载
                                </Badge>
                            ) : (
                                <Badge variant="outline" className="border-amber-200 text-amber-700">
                                    已下架
                                </Badge>
                            )}
                        </div>
                        {row.original.changelog ? (
                            <p className="text-sm text-muted-foreground line-clamp-2">
                                更新说明：{row.original.changelog}
                            </p>
                        ) : null}
                    </div>
                ),
            },
            {
                header: "应用/平台",
                cell: ({ row }) => (
                    <div className="flex flex-col gap-2">
                        <Badge variant="secondary" className="w-fit">
                            {APP_LABELS[row.original.app]}
                        </Badge>
                        <Badge variant="outline" className="w-fit">
                            {PLATFORM_LABELS[row.original.platform]}
                        </Badge>
                        {row.original.minSupportedVersion ? (
                            <p className="text-xs text-muted-foreground">
                                最低兼容：{row.original.minSupportedVersion}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">未设置最低兼容</p>
                        )}
                    </div>
                ),
            },
            {
                header: "更新策略",
                cell: ({ row }) => (
                    <div className="space-y-2 text-sm">
                        <div className="flex items-center gap-2">
                            <Badge
                                variant={row.original.forceUpdate ? "destructive" : "outline"}
                                className={cn(
                                    "w-fit",
                                    row.original.forceUpdate && "bg-rose-100 text-rose-700",
                                )}
                            >
                                {row.original.forceUpdate ? "强制更新" : "可选更新"}
                            </Badge>
                        </div>
                        {row.original.downloadUrlOverride ? (
                            <p className="text-xs text-muted-foreground break-all">
                                外链：{row.original.downloadUrlOverride}
                            </p>
                        ) : (
                            <p className="text-xs text-muted-foreground">
                                通过对象存储提供下载
                            </p>
                        )}
                    </div>
                ),
            },
            {
                header: "文件与链接",
                cell: ({ row }) => {
                    const file = row.original.file
                    const link = getDownloadLink(row.original)
                    return (
                        <div className="space-y-2 text-sm">
                            <div className="flex flex-wrap items-center gap-2">
                                <Badge variant="outline" className="w-fit">
                                    {file?.mimeType ?? "APK"}
                                </Badge>
                                <span className="text-muted-foreground text-xs">
                                    {formatFileSize(file?.fileSize)}
                                </span>
                            </div>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <p className="text-xs text-muted-foreground line-clamp-2 break-all">
                                        哈希：{file?.fileHash ?? "—"}
                                    </p>
                                </TooltipTrigger>
                                <TooltipContent>{file?.fileHash ?? "暂无哈希"}</TooltipContent>
                            </Tooltip>
                            <Button
                                asChild
                                variant="outline"
                                size="sm"
                                disabled={!link}
                                className="gap-2"
                            >
                                {link ? (
                                    <a href={link} target="_blank" rel="noreferrer">
                                        <Download className="size-4" />
                                        下载
                                    </a>
                                ) : (
                                    <span className="flex items-center gap-2">
                                        <Download className="size-4" />
                                        暂无链接
                                    </span>
                                )}
                            </Button>
                        </div>
                    )
                },
            },
            {
                header: "时间与指标",
                cell: ({ row }) => (
                    <div className="text-sm leading-6">
                        <p>
                            上传：{formatDateTime(row.original.createdAt)}
                        </p>
                        <p>
                            发布：{formatDateTime(row.original.publishedAt)}
                        </p>
                        <div className="flex gap-3 text-xs text-muted-foreground">
                            <span>下载 {row.original.downloadCount ?? 0}</span>
                            <span>强更拦截 {row.original.forceUpdateCount ?? 0}</span>
                        </div>
                    </div>
                ),
            },
            {
                header: "操作",
                cell: ({ row }) => {
                    const isRollingBack = rollingBackId === row.original.id
                    return (
                        <div className="flex items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => onViewDetail(row.original)}
                            >
                                <Info className="size-4" />
                                详情
                            </Button>
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" size="icon" aria-label="更多操作">
                                        <MoreVertical className="size-4" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                    <DropdownMenuLabel>操作</DropdownMenuLabel>
                                    <DropdownMenuItem onClick={() => onEdit(row.original)}>
                                        <PencilLine className="mr-2 size-4" />
                                        编辑/发布
                                    </DropdownMenuItem>
                                    <DropdownMenuItem
                                        onClick={() => onCopyLink(row.original)}
                                        disabled={!getDownloadLink(row.original)}
                                    >
                                        <Copy className="mr-2 size-4" />
                                        复制下载链接
                                    </DropdownMenuItem>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                        onClick={() => onRollback(row.original)}
                                        disabled={
                                            isRollingBack
                                        }
                                    >
                                        <History className="mr-2 size-4" />
                                        {isRollingBack ? "回滚中..." : "回滚到上一版本"}
                                    </DropdownMenuItem>
                                </DropdownMenuContent>
                            </DropdownMenu>
                        </div>
                    )
                },
            },
        ],
        [onCopyLink, onEdit, onRollback, onViewDetail, rollingBackId],
    )

    const table = useReactTable({
        data,
        columns,
        getCoreRowModel: getCoreRowModel(),
    })

    return (
        <EntityTable
            table={table}
            className="rounded-2xl border bg-card shadow-xs"
            emptyState={{
                title: "暂无版本记录",
                description: "先上传 APK 或创建记录，再进行发布与回滚操作。",
            }}
        />
    )
}

function getDownloadLink(release: AppReleaseListItem) {
    if (!release.isActive) return null
    return release.downloadUrl ?? release.downloadUrlOverride ?? null
}

function formatFileSize(size?: number | null) {
    if (!size) {
        return "大小未知"
    }
    if (size < 1024) {
        return `${size} B`
    }
    const kb = size / 1024
    if (kb < 1024) {
        return `${kb.toFixed(2)} KB`
    }
    const mb = kb / 1024
    if (mb < 1024) {
        return `${mb.toFixed(2)} MB`
    }
    const gb = mb / 1024
    return `${gb.toFixed(2)} GB`
}

function formatDateTime(value?: string | Date | null) {
    if (!value) {
        return "—"
    }
    const date = value instanceof Date ? value : new Date(value)
    if (Number.isNaN(date.getTime())) {
        return "—"
    }
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}
