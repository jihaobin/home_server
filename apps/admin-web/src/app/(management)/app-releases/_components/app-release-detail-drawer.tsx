"use client"

import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerFooter,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"
import type { AppReleaseListItem } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { Separator } from "@repo/web-ui/components/separator"
import { cn } from "@repo/web-ui/lib/utils"
import { Copy, Download, History, PencilLine } from "lucide-react"

type AppReleaseDetailDrawerProps = {
    release: AppReleaseListItem | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onEdit: (release: AppReleaseListItem) => void
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

export function AppReleaseDetailDrawer({
    release,
    open,
    onOpenChange,
    onEdit,
    onCopyLink,
    onRollback,
    rollingBackId,
}: AppReleaseDetailDrawerProps) {
    const downloadLink = release ? getDownloadLink(release) : null
    const isRollingBack = Boolean(
        release?.id && rollingBackId === release.id,
    )

    return (
        <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
            <EntityDrawerContent width="lg">
                <EntityDrawerHeader className="flex items-start justify-between gap-3 px-5 py-4">
                    <div className="space-y-2">
                        <EntityDrawerTitle>
                            {release ? `v${release.version}` : "版本详情"}
                        </EntityDrawerTitle>
                        {release ? (
                            <div className="flex flex-wrap items-center gap-2">
                                {release.isActive ? (
                                    <Badge variant="outline" className="border-emerald-200 text-emerald-700">
                                        允许下载
                                    </Badge>
                                ) : (
                                    <Badge variant="outline" className="border-amber-200 text-amber-700">
                                        已下架
                                    </Badge>
                                )}
                            </div>
                        ) : null}
                    </div>
                    {release ? (
                        <div className="flex flex-wrap items-center gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => onEdit(release)}
                            >
                                <PencilLine className="size-4" />
                                编辑
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-2"
                                onClick={() => onCopyLink(release)}
                                disabled={!downloadLink}
                            >
                                <Copy className="size-4" />
                                复制链接
                            </Button>
                            <Button
                                variant="default"
                                size="sm"
                                className="gap-2"
                                onClick={() => onRollback(release)}
                                disabled={isRollingBack}
                            >
                                <History className="size-4" />
                                {isRollingBack ? "回滚中..." : "回滚"}
                            </Button>
                        </div>
                    ) : null}
                </EntityDrawerHeader>
                <Separator />
                <EntityDrawerBody>
                    <EntityDrawerSection title="基础信息">
                        <EntityDrawerProperty
                            label="应用"
                            value={release ? APP_LABELS[release.app] : "—"}
                        />
                        <EntityDrawerProperty
                            label="平台"
                            value={release ? PLATFORM_LABELS[release.platform] : "—"}
                        />
                        <EntityDrawerProperty
                            label="版本号"
                            value={release ? `v${release.version}` : "—"}
                        />
                        <EntityDrawerProperty
                            label="构建号"
                            value={
                                typeof release?.buildNumber === "number"
                                    ? release.buildNumber
                                    : "未填写"
                            }
                        />
                    </EntityDrawerSection>
                    <EntityDrawerSection title="更新策略">
                        <EntityDrawerProperty
                            label="强制更新"
                            value={release?.forceUpdate ? "是" : "否"}
                        />
                        <EntityDrawerProperty
                            label="最低兼容版本"
                            value={release?.minSupportedVersion ?? "未设置"}
                        />
                        <EntityDrawerProperty
                            label="更新说明"
                            value={release?.changelog ?? "暂无"}
                        />
                    </EntityDrawerSection>
                    <EntityDrawerSection title="文件与下载">
                        <EntityDrawerProperty
                            label="下载方式"
                            value={
                                release?.downloadUrlOverride
                                    ? "外部链接"
                                    : "对象存储"
                            }
                        />
                        <EntityDrawerProperty
                            label="文件大小"
                            value={formatFileSize(release?.file?.fileSize)}
                        />
                        <EntityDrawerProperty
                            label="文件哈希"
                            value={release?.file?.fileHash ?? "暂无"}
                        />
                        <EntityDrawerProperty
                            label="下载链接"
                            value={downloadLink ?? "暂无"}
                        />
                        {downloadLink ? (
                            <Button asChild variant="outline" size="sm" className="w-fit gap-2">
                                <a href={downloadLink} target="_blank" rel="noreferrer">
                                    <Download className="size-4" />
                                    打开下载
                                </a>
                            </Button>
                        ) : null}
                    </EntityDrawerSection>
                    <EntityDrawerSection title="发布与审计">
                        <EntityDrawerProperty
                            label="创建人"
                            value={release?.createdBy ?? "未知"}
                        />
                        <EntityDrawerProperty
                            label="发布人"
                            value={release?.publishedBy ?? "未发布"}
                        />
                        <EntityDrawerProperty
                            label="创建时间"
                            value={formatDateTime(release?.createdAt)}
                        />
                        <EntityDrawerProperty
                            label="发布时间"
                            value={formatDateTime(release?.publishedAt)}
                        />
                        <EntityDrawerProperty
                            label="回滚来源"
                            value={release?.rollbackFromId ?? "—"}
                        />
                    </EntityDrawerSection>
                </EntityDrawerBody>
                <EntityDrawerFooter className={cn("flex flex-col gap-2 px-5 py-4 text-xs text-muted-foreground")}>
                    <div>
                        下载次数：{release?.downloadCount ?? 0}，强更拦截：{release?.forceUpdateCount ?? 0}
                    </div>
                    <div>如需替换 APK 或更新强制策略，请使用「编辑」操作。</div>
                </EntityDrawerFooter>
            </EntityDrawerContent>
        </EntityDrawer>
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
