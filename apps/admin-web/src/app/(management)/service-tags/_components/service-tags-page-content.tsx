"use client"

import { useCallback, useEffect, useMemo, useState, useTransition } from "react"
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
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@repo/web-ui/components/card"
import { Input } from "@repo/web-ui/components/input"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import {
    useAdminServiceTags,
    useCreateAdminServiceTag,
    useDeleteAdminServiceTag,
    useUpdateAdminServiceTag,
} from "@repo/hooks/api/ssr"
import type {
    AdminServiceTag,
    CreateAdminServiceTagInput,
    UpdateAdminServiceTagInput,
} from "@repo/types"
import { ApiClientError } from "@repo/utils/api-client"
import { cn } from "@repo/web-ui/lib/utils"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import { Plus, RefreshCcw } from "lucide-react"
import { toast } from "sonner"
import type { ServiceTagsQueryState } from "../_utils/query"
import {
    buildServiceTagsSearchParams,
    normalizeServiceTagsQuery,
} from "../_utils/query"
import { ServiceTagFormDialog } from "./service-tag-form-dialog"
import { ServiceTagsTable } from "./service-tags-table"

type ServiceTagsPageContentProps = {
    initialQuery: ServiceTagsQueryState
}

export function ServiceTagsPageContent({
    initialQuery,
}: ServiceTagsPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<ServiceTagsQueryState>(() =>
        normalizeServiceTagsQuery(initialQuery),
    )
    const [createDialogOpen, setCreateDialogOpen] = useState(false)
    const [editingTag, setEditingTag] = useState<AdminServiceTag | null>(null)
    const [tagToDelete, setTagToDelete] = useState<AdminServiceTag | null>(null)
    const [togglingTagId, setTogglingTagId] = useState<string | null>(null)

    const requestQuery = useMemo(
        () => normalizeServiceTagsQuery(queryState),
        [queryState],
    )
    const { data, refetch, isFetching } = useAdminServiceTags(requestQuery)
    const createMutation = useCreateAdminServiceTag(requestQuery)
    const updateMutation = useUpdateAdminServiceTag(requestQuery)
    const deleteMutation = useDeleteAdminServiceTag(requestQuery)

    useEffect(() => {
        const search = buildServiceTagsSearchParams(queryState)
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

    const stats = useMemo(() => {
        const total = data.items.length
        const active = data.items.filter((item) => item.isActive).length
        const inactive = total - active
        return { total, active, inactive }
    }, [data.items])

    const handleRefresh = useCallback(async () => {
        try {
            await refetch()
            toast.success("已刷新服务标签列表")
        } catch (error) {
            handleMutationError(error, "刷新服务标签失败")
        }
    }, [refetch])

    const handleCreate = useCallback(
        async (payload: CreateAdminServiceTagInput) => {
            try {
                await createMutation.mutateAsync(payload)
                toast.success("已创建服务标签")
                setCreateDialogOpen(false)
            } catch (error) {
                handleMutationError(error, "创建服务标签失败")
                throw error
            }
        },
        [createMutation],
    )

    const handleUpdate = useCallback(
        async (payload: UpdateAdminServiceTagInput) => {
            if (!editingTag) {
                return
            }

            try {
                await updateMutation.mutateAsync({
                    id: editingTag.id,
                    data: payload,
                })
                toast.success("已更新服务标签")
                setEditingTag(null)
            } catch (error) {
                handleMutationError(error, "更新服务标签失败")
                throw error
            }
        },
        [editingTag, updateMutation],
    )

    const handleToggle = useCallback(
        async (tag: AdminServiceTag) => {
            setTogglingTagId(tag.id)

            try {
                await updateMutation.mutateAsync({
                    id: tag.id,
                    data: { isActive: !tag.isActive },
                })
                toast.success(`已${tag.isActive ? "停用" : "启用"}服务标签`)
            } catch (error) {
                handleMutationError(
                    error,
                    `${tag.isActive ? "停用" : "启用"}服务标签失败`,
                )
            } finally {
                setTogglingTagId(null)
            }
        },
        [updateMutation],
    )

    const handleDelete = useCallback(async () => {
        if (!tagToDelete) {
            return
        }

        try {
            await deleteMutation.mutateAsync(tagToDelete.id)
            toast.success(`已删除服务标签「${tagToDelete.name}」`)
            setTagToDelete(null)
        } catch (error) {
            handleMutationError(error, "删除服务标签失败")
        }
    }, [deleteMutation, tagToDelete])

    return (
        <>
            <div className="space-y-6">
                <PageHeader
                    title="服务标签"
                    description="维护按摩频道服务标签，并为服务编辑提供可绑定选项。"
                    breadcrumbItems={[
                        { label: "运营管理", href: "/service-tags" },
                        { label: "服务标签" },
                    ]}
                    actions={
                        <div className="flex flex-wrap gap-2">
                            <Button
                                variant="outline"
                                size="sm"
                                className="gap-1.5"
                                onClick={() => void handleRefresh()}
                                disabled={isFetching}
                            >
                                <RefreshCcw
                                    className={cn(
                                        "size-4",
                                        isFetching && "animate-spin",
                                    )}
                                />
                                刷新
                            </Button>
                            <Button
                                size="sm"
                                className="gap-1.5"
                                onClick={() => setCreateDialogOpen(true)}
                            >
                                <Plus className="size-4" />
                                新增标签
                            </Button>
                        </div>
                    }
                >
                    <PageHeaderToolbar className="gap-3">
                        <span>当前列表 {stats.total} 个标签</span>
                        <span>启用 {stats.active} 个</span>
                        <span>停用 {stats.inactive} 个</span>
                    </PageHeaderToolbar>
                </PageHeader>

                <Card>
                    <CardHeader>
                        <CardTitle>当前业务域：上门按摩（massage）</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-3 md:flex-row">
                        <Input
                            value={queryState.keyword ?? ""}
                            placeholder="搜索标签名称或 slug"
                            onChange={(event) =>
                                setQueryState((prev) =>
                                    normalizeServiceTagsQuery({
                                        ...prev,
                                        keyword: event.target.value,
                                    }),
                                )
                            }
                            className="md:max-w-sm"
                        />
                        <Select
                            value={queryState.status}
                            onValueChange={(status) =>
                                setQueryState((prev) =>
                                    normalizeServiceTagsQuery({
                                        ...prev,
                                        status:
                                            status as ServiceTagsQueryState["status"],
                                    }),
                                )
                            }
                        >
                            <SelectTrigger className="w-full md:w-40">
                                <SelectValue placeholder="全部状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="active">仅启用</SelectItem>
                                <SelectItem value="inactive">仅停用</SelectItem>
                            </SelectContent>
                        </Select>
                        <div className="flex items-center text-xs text-muted-foreground">
                            仅开放 `massage` 域标签维护
                        </div>
                    </CardContent>
                </Card>

                <ServiceTagsTable
                    items={data.items}
                    onEdit={setEditingTag}
                    onToggle={(tag) => void handleToggle(tag)}
                    onDelete={setTagToDelete}
                    togglingTagId={togglingTagId}
                    deletingTagId={
                        deleteMutation.isPending ? tagToDelete?.id : undefined
                    }
                />
            </div>

            <ServiceTagFormDialog
                open={createDialogOpen}
                mode="create"
                onClose={() => setCreateDialogOpen(false)}
                onSubmit={handleCreate}
                isSubmitting={createMutation.isPending}
            />

            <ServiceTagFormDialog
                open={Boolean(editingTag)}
                mode="edit"
                tag={editingTag}
                onClose={() => setEditingTag(null)}
                onSubmit={handleUpdate}
                isSubmitting={updateMutation.isPending}
            />

            <AlertDialog
                open={Boolean(tagToDelete)}
                onOpenChange={(open) => {
                    if (!open) {
                        setTagToDelete(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除服务标签？</AlertDialogTitle>
                        <AlertDialogDescription>
                            {tagToDelete
                                ? `删除后将不可恢复。若标签仍被 ${tagToDelete.serviceCount} 个服务引用，后端会拒绝删除；此时请改为停用。`
                                : "删除后将不可恢复。"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={deleteMutation.isPending}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            disabled={deleteMutation.isPending}
                            onClick={() => void handleDelete()}
                        >
                            {deleteMutation.isPending ? "删除中..." : "确认删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function handleMutationError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiClientError) {
        toast.error(error.message)
        return
    }

    if (error instanceof Error) {
        toast.error(error.message || fallbackMessage)
        return
    }

    toast.error(fallbackMessage)
}
