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
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/web-ui/components/alert-dialog"
import { Button } from "@repo/web-ui/components/button"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import {
    useAdminAppReleases,
    useRollbackAdminAppRelease,
    type AdminAppReleasesQueryInput,
} from "@repo/hooks/api/ssr"
import type {
    AppReleaseApp,
    AppReleaseListItem,
    AppReleasePlatform,
} from "@repo/types"
import { cn } from "@repo/web-ui/lib/utils"
import { toast } from "sonner"
import { Plus, RefreshCcw } from "lucide-react"
import type { AppReleasesQueryState } from "../_utils/query"
import {
    buildAppReleasesSearchParams,
    normalizeAppReleasesQuery,
} from "../_utils/query"
import {
    AppReleasesFilterBar,
    type AppReleasesFilterValues,
} from "./app-releases-filter-bar"
import { AppReleasesTable } from "./app-releases-table"
import { AppReleasesTableSkeleton } from "./app-releases-table-skeleton"
import { AppReleaseFormDialog } from "./app-release-form-dialog"
import { AppReleaseDetailDrawer } from "./app-release-detail-drawer"

type AppReleasesPageContentProps = {
    initialQuery: AppReleasesQueryState
}

export function AppReleasesPageContent({
    initialQuery,
}: AppReleasesPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<AppReleasesQueryState>(() =>
        normalizeAppReleasesQuery(initialQuery),
    )
    const [tableData, setTableData] = useState<AppReleaseListItem[]>([])
    const [isTableFetching, setIsTableFetching] = useState(false)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editingRelease, setEditingRelease] =
        useState<AppReleaseListItem | null>(null)
    const [detailRelease, setDetailRelease] =
        useState<AppReleaseListItem | null>(null)
    const [rollbackTarget, setRollbackTarget] =
        useState<AppReleaseListItem | null>(null)
    const rollbackMutation = useRollbackAdminAppRelease()

    const requestQuery = useMemo<AdminAppReleasesQueryInput>(
        () => ({
            app: queryState.app,
            platform: queryState.platform,
            isActive: queryState.isActive,
        }),
        [queryState],
    )

    const filterDefaults = useMemo<AppReleasesFilterValues>(
        () => ({
            app: queryState.app ?? "all",
            platform: queryState.platform ?? "all",
            activeOnly: queryState.isActive ?? false,
        }),
        [
            queryState.app,
            queryState.isActive,
            queryState.platform,
        ],
    )

    const stats = useMemo(() => {
        const total = tableData.length
        const active = tableData.filter((item) => item.isActive).length
        return { total, active }
    }, [tableData])

    useEffect(() => {
        const search = buildAppReleasesSearchParams(queryState)
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
        (values: AppReleasesFilterValues) => {
            setQueryState(
                normalizeAppReleasesQuery({
                    app:
                        values.app === "all"
                            ? undefined
                            : (values.app as AppReleaseApp),
                    platform:
                        values.platform === "all"
                            ? undefined
                            : (values.platform as AppReleasePlatform),
                    isActive: values.activeOnly ? true : undefined,
                }),
            )
        },
        [],
    )

    const handleResetFilters = useCallback(() => {
        setQueryState({})
    }, [])

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        } else {
            toast.info("暂无可刷新的内容")
        }
    }, [])

    const handleCopyLink = useCallback((release: AppReleaseListItem) => {
        const link = getDownloadLink(release)
        if (!link) {
            toast.info("当前版本暂无下载链接")
            return
        }
        if (typeof navigator === "undefined" || !navigator.clipboard) {
            toast.error("当前环境不支持复制，请手动复制链接")
            return
        }
        void navigator.clipboard.writeText(link).then(() => {
            toast.success("已复制下载链接")
        })
    }, [])

    const handleRollback = useCallback((release: AppReleaseListItem) => {
        setRollbackTarget(release)
    }, [])

    const confirmRollback = useCallback(async () => {
        if (!rollbackTarget) {
            return
        }
        try {
            await rollbackMutation.mutateAsync(rollbackTarget.id)
            toast.success(`已回滚至 ${rollbackTarget.version}`)
            setRollbackTarget(null)
        } catch (error) {
            const message = error instanceof Error ? error.message : "回滚失败"
            toast.error(message)
        }
    }, [rollbackMutation, rollbackTarget])

    const handleAfterSubmit = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        }
    }, [])

    const rollingBackId =
        rollbackMutation.isPending && rollbackTarget
            ? rollbackTarget.id
            : undefined

    return (
        <div className="space-y-6">
            <PageHeader
                title="应用版本管理"
                description="管理移动端 APK 上传、发布与回滚，支持强制更新和灰度控制。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/app-releases" },
                    { label: "应用版本管理" },
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
                            onClick={() => setCreateDialogOpen(true)}
                        >
                            <Plus className="size-4" />
                            新建版本
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>共 {stats.total} 个版本</span>
                    <span>允许下载 {stats.active} 个</span>
                </PageHeaderToolbar>
            </PageHeader>

            <AppReleasesFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<AppReleasesTableSkeleton />}>
                <AppReleasesTableContent
                    query={requestQuery}
                    onDataChange={(data) => setTableData(data)}
                    onFetchingChange={(status) => setIsTableFetching(status)}
                    onRegisterRefetch={(fn) => {
                        refetchRef.current = fn
                    }}
                    onEdit={(release) => setEditingRelease(release)}
                    onViewDetail={(release) => setDetailRelease(release)}
                    onCopyLink={handleCopyLink}
                    onRollback={handleRollback}
                    rollingBackId={rollingBackId}
                />
            </Suspense>

            <AppReleaseFormDialog
                open={createDialogOpen}
                onOpenChange={setCreateDialogOpen}
                mode="create"
                onSuccess={handleAfterSubmit}
            />
            <AppReleaseFormDialog
                open={Boolean(editingRelease)}
                onOpenChange={(open) => {
                    if (!open) {
                        setEditingRelease(null)
                    }
                }}
                mode="edit"
                initialData={editingRelease ?? undefined}
                onSuccess={() => {
                    setEditingRelease(null)
                    handleAfterSubmit()
                }}
            />
            <AppReleaseDetailDrawer
                release={detailRelease}
                open={Boolean(detailRelease)}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailRelease(null)
                    }
                }}
                onEdit={(release) => setEditingRelease(release)}
                onCopyLink={handleCopyLink}
                onRollback={handleRollback}
                rollingBackId={rollingBackId}
            />

            <AlertDialog open={Boolean(rollbackTarget)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认回滚到上一版本？</AlertDialogTitle>
                        <AlertDialogDescription>
                            确认后将把 {rollbackTarget?.version ?? ""} 标记为已回滚，
                            并激活上一已发布版本。此操作不可撤销。
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            onClick={() => setRollbackTarget(null)}
                            disabled={rollbackMutation.isPending}
                        >
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction asChild>
                            <Button
                                variant="destructive"
                                onClick={confirmRollback}
                                disabled={rollbackMutation.isPending}
                            >
                                {rollbackMutation.isPending ? "回滚中..." : "确认回滚"}
                            </Button>
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    )
}

type AppReleasesTableContentProps = {
    query: AdminAppReleasesQueryInput
    onDataChange: (data: AppReleaseListItem[]) => void
    onFetchingChange: (status: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
    onEdit: (release: AppReleaseListItem) => void
    onViewDetail: (release: AppReleaseListItem) => void
    onCopyLink: (release: AppReleaseListItem) => void
    onRollback: (release: AppReleaseListItem) => void
    rollingBackId?: string
}

function AppReleasesTableContent({
    query,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
    onEdit,
    onViewDetail,
    onCopyLink,
    onRollback,
    rollingBackId,
}: AppReleasesTableContentProps) {
    const { data, isFetching, refetch } = useAdminAppReleases(query)

    useEffect(() => {
        onDataChange(data)
    }, [data, onDataChange])

    useEffect(() => {
        onFetchingChange(isFetching)
    }, [isFetching, onFetchingChange])

    useEffect(() => {
        const refresh = () => refetch()
        onRegisterRefetch(refresh)
        return () => {
            onRegisterRefetch(null)
        }
    }, [onRegisterRefetch, refetch])

    return (
        <AppReleasesTable
            data={data}
            onEdit={onEdit}
            onViewDetail={onViewDetail}
            onCopyLink={onCopyLink}
            onRollback={onRollback}
            rollingBackId={rollingBackId}
        />
    )
}

function getDownloadLink(release: AppReleaseListItem) {
    return release.downloadUrl ?? release.downloadUrlOverride ?? null
}
