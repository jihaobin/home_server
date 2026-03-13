"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/web-ui/components/alert-dialog";
import { Badge } from "@repo/web-ui/components/badge";
import { Button } from "@repo/web-ui/components/button";
import {
    Card,
    CardContent,
    CardHeader,
    CardTitle,
} from "@repo/web-ui/components/card";
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from "@repo/web-ui/components/dialog";
import { Input } from "@repo/web-ui/components/input";
import { Label } from "@repo/web-ui/components/label";
import { ScrollArea } from "@repo/web-ui/components/scroll-area";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select";
import { Separator } from "@repo/web-ui/components/separator";
import { Switch } from "@repo/web-ui/components/switch";
import { Textarea } from "@repo/web-ui/components/textarea";
import { UploadField, type UploadValue } from "@repo/web-ui/upload";
import { cn } from "@repo/web-ui/lib/utils";
import {
    useAdminServiceCategories,
    useCreateAdminServiceCategory,
    useUpdateAdminServiceCategory,
    useDeleteAdminServiceCategory,
} from "@repo/hooks/api/ssr";
import { useUploadFile } from "@repo/hooks/api/files";
import {
    type AdminServiceCategory,
    type AdminServiceCategoryTree,
    type CategoryWithServices,
} from "@repo/types";
import {
    useCreateService,
    useDeleteService,
    useUpdateService,
    useServiceListSinglePage,
} from "@repo/hooks/api/service";
import { useForm, type AnyFieldApi } from "@tanstack/react-form";
import { z } from "zod/v4";
import { toast } from "sonner";
import {
    FolderTree,
    Loader2,
    PenSquare,
    PlusCircle,
    RefreshCcw,
    ShieldCheck,
    Sparkles,
    ToggleLeft,
    Trash2,
} from "lucide-react";
import { PageHeader, PageHeaderToolbar } from "@/components/common";
import { ApiClientError } from "@repo/utils/api-client";
import { resolveFileUrl } from "@/lib/files";
import Image from "next/image";

type DialogState =
    | { mode: "create"; parentId: string | null; open: boolean }
    | { mode: "edit"; categoryId: string; open: boolean };

type ServiceCategoryFormValues = {
    name: string;
    description: string;
    parentId: string | null;
    sortOrder: string;
    isActive: boolean;
    icon: UploadValue | null;
};

type ServiceDialogState =
    | { mode: "create"; categoryId: string | null; open: boolean }
    | { mode: "edit"; service: ServiceListItem; open: boolean };

type ServiceFormValues = {
    name: string;
    description: string;
    categoryId: string;
    isActive: boolean;
    image: UploadValue | null;
};

type ServiceListItem = CategoryWithServices["children"][number];

const ROOT_KEY = "__root__";

function normalizeIconUrl(value?: string | null) {
    if (!value) {
        return null;
    }
    const trimmed = value.trim();
    if (!trimmed) {
        return null;
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return trimmed;
    }
    return resolveFileUrl(trimmed) ?? null;
}

export function ServiceCategoriesPageContent() {
    const { data, refetch, isFetching } = useAdminServiceCategories();
    const queryClient = useQueryClient();
    const createMutation = useCreateAdminServiceCategory();
    const updateMutation = useUpdateAdminServiceCategory();
    const deleteCategoryMutation = useDeleteAdminServiceCategory();
    const createServiceMutation = useCreateService();
    const updateServiceMutation = useUpdateService();
    const deleteServiceMutation = useDeleteService();
    const uploadFile = useUploadFile();

    const [selectedCategoryIdState, setSelectedCategoryId] = useState<
        string | null
    >(data.flat[0]?.id ?? null);
    const [dialogState, setDialogState] = useState<DialogState | null>(null);
    const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
    const [serviceDialogState, setServiceDialogState] =
        useState<ServiceDialogState | null>(null);
    const [serviceToDelete, setServiceToDelete] =
        useState<ServiceListItem | null>(null);
    const [togglingServiceId, setTogglingServiceId] = useState<string | null>(
        null,
    );

    const selectedCategoryId = useMemo(() => {
        if (data.flat.length === 0) {
            return null;
        }
        const fallbackId = data.flat[0]?.id ?? null;
        if (!selectedCategoryIdState) {
            return fallbackId;
        }
        const exists = data.flat.some(
            (category) => category.id === selectedCategoryIdState,
        );
        return exists ? selectedCategoryIdState : fallbackId;
    }, [data.flat, selectedCategoryIdState]);

    const selectedCategory = useMemo(
        () =>
            data.flat.find((category) => category.id === selectedCategoryId) ??
            null,
        [data.flat, selectedCategoryId],
    );

    const {
        data: serviceListResponse,
        isFetching: isServiceFetching,
        refetch: refetchServices,
    } = useServiceListSinglePage({
        categoryId: selectedCategoryId ?? undefined,
        page: 1,
        limit: 200,
        enabled: Boolean(selectedCategoryId),
    });

    const serviceCategories: CategoryWithServices[] = useMemo(
        () => serviceListResponse?.items ?? [],
        [serviceListResponse],
    );

    const services = useMemo(() => {
        if (!selectedCategoryId) {
            return [];
        }
        const matched = serviceCategories.find(
            (item) => item.id === selectedCategoryId,
        );
        return matched?.children ?? [];
    }, [selectedCategoryId, serviceCategories]);

    const parentsMap = useMemo(() => {
        const map = new Map<string, AdminServiceCategory>();
        data.flat.forEach((category) => {
            map.set(category.id, category);
        });
        return map;
    }, [data.flat]);

    const rootCategories = useMemo(
        () => data.flat.filter((category) => category.dep === 1),
        [data.flat],
    );

    const childCounts = useMemo(() => {
        const map = new Map<string, number>();
        data.flat.forEach((category) => {
            if (!category.parentId) return;
            map.set(category.parentId, (map.get(category.parentId) ?? 0) + 1);
        });
        return map;
    }, [data.flat]);

    const totals = useMemo(() => {
        const total = data.flat.length;
        const level1 = rootCategories.length;
        const level2 = total - level1;
        return { total, level1, level2 };
    }, [data.flat.length, rootCategories.length]);

    const handleRefresh = useCallback(async () => {
        await Promise.all([
            refetch(),
            selectedCategoryId ? refetchServices() : Promise.resolve(),
        ]);
        toast.success("已刷新分类与服务数据");
    }, [refetch, refetchServices, selectedCategoryId]);

    const openCreateDialog = useCallback((parentId: string | null) => {
        setDialogState({ mode: "create", parentId, open: true });
    }, []);

    const openEditDialog = useCallback((categoryId: string) => {
        setDialogState({ mode: "edit", categoryId, open: true });
    }, []);

    const closeDialog = useCallback(() => {
        setDialogState(null);
    }, []);

    const handleUploadIcon = useCallback(
        async (file: File) => {
            const response = await uploadFile.mutateAsync({ file });
            return {
                id: response.id,
                url: response.fileUrl,
                name: response.originalName,
                mimeType: response.mimeType,
            };
        },
        [uploadFile],
    );

    const handleCreateCategory = useCallback(
        async (values: ServiceCategoryFormValues) => {
            try {
                await createMutation.mutateAsync({
                    name: values.name.trim(),
                    description: values.description.trim()
                        ? values.description.trim()
                        : null,
                    parentId: values.parentId,
                    sortOrder: Number(values.sortOrder) || 0,
                    isActive: values.isActive,
                    iconFileId: values.icon?.id ?? null,
                });
                toast.success("已创建分类");
                closeDialog();
            } catch (error) {
                handleFormError(error, "创建分类失败");
            }
        },
        [closeDialog, createMutation],
    );

    const handleUpdateCategory = useCallback(
        async (categoryId: string, values: ServiceCategoryFormValues) => {
            try {
                await updateMutation.mutateAsync({
                    id: categoryId,
                    data: {
                        name: values.name.trim(),
                        description: values.description.trim()
                            ? values.description.trim()
                            : null,
                        parentId: values.parentId,
                        sortOrder: Number(values.sortOrder) || 0,
                        isActive: values.isActive,
                        iconFileId: values.icon?.id ?? null,
                    },
                });
                toast.success("已更新分类信息");
                closeDialog();
            } catch (error) {
                handleFormError(error, "更新分类失败");
            }
        },
        [closeDialog, updateMutation],
    );

    const handleDeleteCategory = useCallback(async () => {
        if (!selectedCategory) return;
        try {
            await deleteCategoryMutation.mutateAsync(selectedCategory.id);
            toast.success(`已删除分类「${selectedCategory.name}」`);
            setDeleteDialogOpen(false);
        } catch (error) {
            handleFormError(error, "删除分类失败");
        }
    }, [deleteCategoryMutation, selectedCategory]);

    const handleToggleCategoryStatus = useCallback(async () => {
        if (!selectedCategory) {
            return;
        }

        const nextIsActive = !selectedCategory.isActive;

        try {
            await updateMutation.mutateAsync({
                id: selectedCategory.id,
                data: {
                    isActive: nextIsActive,
                },
            });
            toast.success(
                `已${nextIsActive ? "启用" : "停用"}分类「${selectedCategory.name}」`,
            );
        } catch (error) {
            handleFormError(error, "修改分类启用状态失败");
        }
    }, [selectedCategory, updateMutation]);

    const openCreateServiceDialog = useCallback(() => {
        if (!selectedCategoryId) {
            toast.error("请选择左侧分类后再添加服务");
            return;
        }
        setServiceDialogState({
            mode: "create",
            categoryId: selectedCategoryId,
            open: true,
        });
    }, [selectedCategoryId]);

    const openEditServiceDialog = useCallback((service: ServiceListItem) => {
        setServiceDialogState({ mode: "edit", service, open: true });
    }, []);

    const closeServiceDialog = useCallback(() => {
        setServiceDialogState(null);
    }, []);

    const refreshServices = useCallback(async () => {
        if (!selectedCategoryId) {
            return;
        }
        await Promise.all([
            refetchServices(),
            queryClient.invalidateQueries({ queryKey: ["service-list"] }),
            queryClient.invalidateQueries({
                queryKey: ["service-list-single"],
            }),
        ]);
    }, [queryClient, refetchServices, selectedCategoryId]);

    const handleCreateService = useCallback(
        async (values: ServiceFormValues) => {
            try {
                await createServiceMutation.mutateAsync({
                    name: values.name.trim(),
                    description: values.description.trim()
                        ? values.description.trim()
                        : null,
                    categoryId: values.categoryId,
                    imageFileId: values.image?.id ?? null,
                    isActive: values.isActive,
                });
                toast.success("已创建服务");
                closeServiceDialog();
                await refreshServices();
            } catch (error) {
                handleFormError(error, "创建服务失败");
            }
        },
        [closeServiceDialog, createServiceMutation, refreshServices],
    );

    const handleUpdateService = useCallback(
        async (serviceId: string, values: ServiceFormValues) => {
            try {
                await updateServiceMutation.mutateAsync({
                    id: serviceId,
                    data: {
                        name: values.name.trim(),
                        description: values.description.trim()
                            ? values.description.trim()
                            : null,
                        categoryId: values.categoryId,
                        imageFileId: values.image?.id ?? null,
                        isActive: values.isActive,
                    },
                });
                toast.success("已更新服务信息");
                closeServiceDialog();
                await refreshServices();
            } catch (error) {
                handleFormError(error, "更新服务失败");
            }
        },
        [closeServiceDialog, refreshServices, updateServiceMutation],
    );

    const handleDeleteService = useCallback(async () => {
        if (!serviceToDelete) {
            return;
        }
        try {
            await deleteServiceMutation.mutateAsync(serviceToDelete.id);
            toast.success(`已删除服务「${serviceToDelete.name}」`);
            setServiceToDelete(null);
            await refreshServices();
        } catch (error) {
            handleFormError(error, "删除服务失败");
        }
    }, [deleteServiceMutation, refreshServices, serviceToDelete]);

    const handleToggleServiceStatus = useCallback(
        async (service: ServiceListItem) => {
            const nextIsActive = !service.isActive;

            setTogglingServiceId(service.id);
            try {
                await updateServiceMutation.mutateAsync({
                    id: service.id,
                    data: {
                        isActive: nextIsActive,
                    },
                });
                toast.success(
                    `已${nextIsActive ? "启用" : "停用"}服务「${service.name}」`,
                );
                await refreshServices();
            } catch (error) {
                handleFormError(error, "修改服务启用状态失败");
            } finally {
                setTogglingServiceId((current) =>
                    current === service.id ? null : current,
                );
            }
        },
        [refreshServices, updateServiceMutation],
    );

    const editingCategory =
        dialogState?.mode === "edit"
            ? (data.flat.find(
                  (category) => category.id === dialogState.categoryId,
              ) ?? null)
            : null;

    const suggestedSortOrder =
        (dialogState
            ? (dialogState.mode === "create"
                  ? data.flat.filter(
                        (category) =>
                            (category.parentId ?? ROOT_KEY) ===
                            (dialogState.parentId ?? ROOT_KEY),
                    ).length
                  : data.flat.filter(
                        (category) =>
                            (category.parentId ?? ROOT_KEY) ===
                            (editingCategory?.parentId ?? ROOT_KEY),
                    ).length) + 1
            : 0) || 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="服务分类管理"
                description="维护两级分类树、排序、启用状态与图标。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/service-categories" },
                    { label: "服务分类管理" },
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
                            onClick={() => openCreateDialog(null)}
                        >
                            <PlusCircle className="size-4" />
                            新增一级分类
                        </Button>
                        <Button
                            size="sm"
                            variant="secondary"
                            className="gap-1.5"
                            onClick={() =>
                                openCreateDialog(
                                    selectedCategory?.dep === 1
                                        ? selectedCategory.id
                                        : null,
                                )
                            }
                            disabled={
                                !selectedCategory || selectedCategory.dep >= 2
                            }
                        >
                            <Sparkles className="size-4" />
                            新增子分类
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="flex-wrap gap-3">
                    <span className="text-xs text-muted-foreground">
                        共 {totals.total} 个分类（一级 {totals.level1}、二级{" "}
                        {totals.level2}）
                    </span>
                    <span className="text-xs text-muted-foreground">
                        图标上传复用 @repo/web-ui/upload，提交前请检查校验提示。
                    </span>
                </PageHeaderToolbar>
            </PageHeader>

            <Card>
                <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                        <FolderTree className="size-5 text-primary" />
                        分类树与详情
                    </CardTitle>
                </CardHeader>
                <CardContent className="grid gap-6 lg:grid-cols-[320px_1fr]">
                    <CategoryTreePanel
                        tree={data.tree}
                        selectedId={selectedCategory?.id ?? null}
                        onSelect={setSelectedCategoryId}
                        totals={totals}
                    />
                    <div className="space-y-4">
                        <CategoryDetailPanel
                            category={selectedCategory}
                            parent={
                                selectedCategory?.parentId
                                    ? (parentsMap.get(
                                          selectedCategory.parentId,
                                      ) ?? null)
                                    : null
                            }
                            childCount={
                                selectedCategory
                                    ? (childCounts.get(selectedCategory.id) ??
                                      0)
                                    : 0
                            }
                            onEdit={() =>
                                selectedCategory
                                    ? openEditDialog(selectedCategory.id)
                                    : undefined
                            }
                            onToggleStatus={() =>
                                void handleToggleCategoryStatus()
                            }
                            onDelete={() => setDeleteDialogOpen(true)}
                            isTogglingStatus={updateMutation.isPending}
                            isDeleting={deleteCategoryMutation.isPending}
                        />
                        <ServiceListPanel
                            category={selectedCategory}
                            services={services}
                            isLoading={isServiceFetching}
                            onAddService={openCreateServiceDialog}
                            onEditService={openEditServiceDialog}
                            onToggleServiceStatus={(service) =>
                                void handleToggleServiceStatus(service)
                            }
                            onDeleteService={setServiceToDelete}
                            togglingServiceId={togglingServiceId}
                            isUpdatingService={updateServiceMutation.isPending}
                        />
                    </div>
                </CardContent>
            </Card>

            {dialogState ? (
                <ServiceCategoryFormDialog
                    open={dialogState.open}
                    mode={dialogState.mode}
                    category={editingCategory}
                    parentId={
                        dialogState.mode === "create"
                            ? dialogState.parentId
                            : null
                    }
                    rootCategories={rootCategories}
                    disableParentChange={
                        dialogState.mode === "edit"
                            ? editingCategory?.dep !== 2
                            : false
                    }
                    onClose={closeDialog}
                    onSubmit={async (values) => {
                        if (dialogState.mode === "create") {
                            await handleCreateCategory(values);
                        } else if (editingCategory) {
                            await handleUpdateCategory(
                                editingCategory.id,
                                values,
                            );
                        }
                    }}
                    isSubmitting={
                        createMutation.isPending || updateMutation.isPending
                    }
                    uploadIcon={handleUploadIcon}
                    suggestedSortOrder={
                        dialogState.mode === "create"
                            ? suggestedSortOrder
                            : (editingCategory?.sortOrder ?? 0)
                    }
                />
            ) : null}

            {serviceDialogState ? (
                <ServiceFormDialog
                    open={serviceDialogState.open}
                    mode={serviceDialogState.mode}
                    service={
                        serviceDialogState.mode === "edit"
                            ? serviceDialogState.service
                            : null
                    }
                    categoryId={
                        serviceDialogState.mode === "create"
                            ? serviceDialogState.categoryId
                            : serviceDialogState.service.categoryId
                    }
                    categories={data.flat}
                    onClose={closeServiceDialog}
                    uploadImage={handleUploadIcon}
                    onSubmit={async (values) => {
                        if (serviceDialogState.mode === "create") {
                            await handleCreateService(values);
                        } else {
                            await handleUpdateService(
                                serviceDialogState.service.id,
                                values,
                            );
                        }
                    }}
                    isSubmitting={
                        createServiceMutation.isPending ||
                        updateServiceMutation.isPending
                    }
                />
            ) : null}

            <AlertDialog
                open={Boolean(serviceToDelete)}
                onOpenChange={(open) =>
                    !open ? setServiceToDelete(null) : undefined
                }
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除服务</AlertDialogTitle>
                        <AlertDialogDescription>
                            删除后不可恢复，且可能影响服务人员配置。确定删除
                            {serviceToDelete
                                ? `「${serviceToDelete.name}」`
                                : ""}
                            吗？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={deleteServiceMutation.isPending}
                        >
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDeleteService()}
                            disabled={deleteServiceMutation.isPending}
                        >
                            {deleteServiceMutation.isPending
                                ? "删除中..."
                                : "确认删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            <AlertDialog
                open={deleteDialogOpen}
                onOpenChange={setDeleteDialogOpen}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>确认删除</AlertDialogTitle>
                        <AlertDialogDescription>
                            删除后将无法恢复，且需确保该分类没有子分类或关联服务。确定继续吗？
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel
                            disabled={deleteCategoryMutation.isPending}
                        >
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => void handleDeleteCategory()}
                            disabled={deleteCategoryMutation.isPending}
                        >
                            {deleteCategoryMutation.isPending
                                ? "删除中..."
                                : "确认删除"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}

function CategoryTreePanel({
    tree,
    selectedId,
    onSelect,
    totals,
}: {
    tree: AdminServiceCategoryTree[];
    selectedId: string | null;
    onSelect: (id: string) => void;
    totals: { total: number; level1: number; level2: number };
}) {
    return (
        <div className="rounded-xl border bg-card">
            <div className="flex items-center justify-between border-b px-4 py-3">
                <div>
                    <p className="text-sm font-semibold text-foreground">
                        分类结构
                    </p>
                    <p className="text-xs text-muted-foreground">
                        一级 {totals.level1} · 二级 {totals.level2}
                    </p>
                </div>
            </div>
            <ScrollArea className="max-h-[420px] px-2 py-3">
                {tree.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground">
                        暂无分类，请先新增一级分类
                    </div>
                ) : (
                    <ul className="space-y-1.5">
                        {tree.map((node) => (
                            <CategoryTreeNode
                                key={node.id}
                                node={node}
                                depth={0}
                                selectedId={selectedId}
                                onSelect={onSelect}
                            />
                        ))}
                    </ul>
                )}
            </ScrollArea>
        </div>
    );
}

function CategoryTreeNode({
    node,
    depth,
    selectedId,
    onSelect,
}: {
    node: AdminServiceCategoryTree;
    depth: number;
    selectedId: string | null;
    onSelect: (id: string) => void;
}) {
    const isSelected = node.id === selectedId;
    return (
        <li>
            <button
                type="button"
                onClick={() => onSelect(node.id)}
                className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left transition-colors",
                    isSelected
                        ? "border-primary bg-primary/10 text-primary"
                        : "border-transparent hover:border-border hover:bg-muted/60",
                )}
            >
                <div className="flex items-center gap-2">
                    <div
                        className={cn(
                            "flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                            depth === 0
                                ? "bg-primary/15 text-primary"
                                : "bg-slate-200 text-slate-700",
                        )}
                    >
                        {depth + 1}
                    </div>
                    <div className="flex flex-col">
                        <span className="text-sm font-medium leading-tight">
                            {node.name}
                        </span>
                        <span className="text-xs text-muted-foreground">
                            排序 {node.sortOrder}
                        </span>
                    </div>
                </div>
                <Badge
                    variant={node.isActive ? "default" : "secondary"}
                    className="text-xs"
                >
                    {node.isActive ? "启用" : "停用"}
                </Badge>
            </button>
            {Array.isArray(node.children) && node.children.length > 0 ? (
                <ul className="ml-4 mt-1 space-y-1 border-l border-dashed border-border pl-3">
                    {node.children.map((child: AdminServiceCategoryTree) => (
                        <CategoryTreeNode
                            key={child.id}
                            node={child}
                            depth={depth + 1}
                            selectedId={selectedId}
                            onSelect={onSelect}
                        />
                    ))}
                </ul>
            ) : null}
        </li>
    );
}

function CategoryDetailPanel({
    category,
    parent,
    childCount,
    onEdit,
    onToggleStatus,
    onDelete,
    isTogglingStatus,
    isDeleting,
}: {
    category: AdminServiceCategory | null;
    parent: AdminServiceCategory | null;
    childCount: number;
    onEdit?: () => void;
    onToggleStatus?: () => void;
    onDelete?: () => void;
    isTogglingStatus: boolean;
    isDeleting: boolean;
}) {
    if (!category) {
        return (
            <div className="flex h-full flex-col items-center justify-center rounded-xl border border-dashed">
                <p className="text-sm text-muted-foreground">
                    请选择左侧分类以查看详情
                </p>
            </div>
        );
    }

    const iconUrl = normalizeIconUrl(category.iconFileUrl);

    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                    <div className="flex items-center gap-2">
                        <h3 className="text-base font-semibold">
                            {category.name}
                        </h3>
                        <Badge
                            variant={
                                category.isActive ? "default" : "secondary"
                            }
                        >
                            {category.isActive ? "启用" : "停用"}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                        {category.dep === 1 ? "一级分类" : "二级分类"}
                        {parent ? ` · 上级：${parent.name}` : null}
                    </p>
                </div>
                <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={onEdit}>
                        <PenSquare className="mr-1.5 size-4" />
                        编辑
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={onToggleStatus}
                        disabled={isTogglingStatus}
                    >
                        <ToggleLeft className="mr-1.5 size-4" />
                        {category.isActive ? "停用" : "启用"}
                    </Button>
                    <Button
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        size="sm"
                        onClick={onDelete}
                        disabled={isDeleting}
                    >
                        <Trash2 className="mr-1.5 size-4" />
                        删除
                    </Button>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="grid gap-4 md:grid-cols-2">
                <div>
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                        描述
                    </p>
                    <p className="mt-1 text-sm text-foreground">
                        {category.description || "暂无描述"}
                    </p>
                </div>
                <div className="space-y-1">
                    <p className="text-xs font-medium uppercase text-muted-foreground">
                        元信息
                    </p>
                    <div className="text-sm text-foreground">
                        <p>排序值：{category.sortOrder}</p>
                        <p>子分类：{childCount}</p>
                    </div>
                </div>
            </div>

            <Separator className="my-4" />

            <div className="space-y-2">
                <p className="text-xs font-medium uppercase text-muted-foreground">
                    图标
                </p>
            </div>
            <div className="flex items-center gap-3">
                <div className="relative flex size-16 items-center justify-center overflow-hidden rounded-lg border bg-muted">
                    {iconUrl ? (
                        <Image
                            src={iconUrl}
                            alt={`${category.name} 图标`}
                            className="size-full object-cover"
                            width={200}
                            height={200}
                            unoptimized
                        />
                    ) : (
                        <ShieldCheck className="size-6 text-muted-foreground" />
                    )}
                </div>
                <div className="text-xs text-muted-foreground">
                    {iconUrl ? "点击编辑可替换图标" : "暂未上传图标"}
                </div>
            </div>
        </div>
    );
}

function ServiceListPanel({
    category,
    services,
    isLoading,
    onAddService,
    onEditService,
    onToggleServiceStatus,
    onDeleteService,
    togglingServiceId,
    isUpdatingService,
}: {
    category: AdminServiceCategory | null;
    services: ServiceListItem[];
    isLoading: boolean;
    onAddService: () => void;
    onEditService: (service: ServiceListItem) => void;
    onToggleServiceStatus: (service: ServiceListItem) => void;
    onDeleteService: (service: ServiceListItem) => void;
    togglingServiceId: string | null;
    isUpdatingService: boolean;
}) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                <div className="space-y-1">
                    <p className="text-base font-semibold text-foreground">
                        分类下的服务
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {category
                            ? `已选分类：${category.name}`
                            : "请选择左侧分类以查看服务列表"}
                    </p>
                </div>
                <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={onAddService}
                    disabled={!category}
                >
                    <PlusCircle className="size-4" />
                    新增服务
                </Button>
            </div>

            <Separator className="my-3" />

            {!category ? (
                <div className="flex h-24 items-center justify-center text-sm text-muted-foreground">
                    请选择分类后进行服务维护
                </div>
            ) : isLoading ? (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="size-4 animate-spin" />
                    <span>服务加载中...</span>
                </div>
            ) : services.length === 0 ? (
                <div className="flex flex-col gap-3 rounded-lg border border-dashed p-4">
                    <p className="text-sm text-muted-foreground">
                        该分类暂无服务
                    </p>
                    <Button
                        size="sm"
                        variant="secondary"
                        className="w-fit gap-1.5"
                        onClick={onAddService}
                    >
                        <PlusCircle className="size-4" />
                        立即添加
                    </Button>
                </div>
            ) : (
                <div className="space-y-3">
                    {services.map((service) => {
                        const imageUrl = normalizeIconUrl(
                            service.imageFileUrl ?? service.imageFileId ?? null,
                        );
                        return (
                            <div
                                key={service.id}
                                className="flex flex-col gap-3 rounded-lg border px-3 py-2 md:flex-row md:items-center md:justify-between"
                            >
                                <div className="flex gap-3">
                                    <div className="relative h-16 w-16 overflow-hidden rounded-md border bg-muted">
                                        {imageUrl ? (
                                            <Image
                                                src={imageUrl}
                                                alt={service.name}
                                                className="h-full w-full object-cover"
                                                width={160}
                                                height={160}
                                                unoptimized
                                            />
                                        ) : (
                                            <div className="flex h-full w-full items-center justify-center text-muted-foreground">
                                                <Sparkles className="size-5" />
                                            </div>
                                        )}
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2">
                                            <p className="text-sm font-semibold leading-tight">
                                                {service.name}
                                            </p>
                                            <Badge
                                                variant={
                                                    service.isActive
                                                        ? "default"
                                                        : "secondary"
                                                }
                                            >
                                                {service.isActive
                                                    ? "启用"
                                                    : "停用"}
                                            </Badge>
                                        </div>
                                        <p className="text-xs text-muted-foreground">
                                            {service.description || "暂无描述"}
                                        </p>
                                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                                            <span>ID {service.id}</span>
                                        </div>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() => onEditService(service)}
                                    >
                                        <PenSquare className="mr-1.5 size-4" />
                                        编辑
                                    </Button>
                                    <Button
                                        variant="outline"
                                        size="sm"
                                        onClick={() =>
                                            onToggleServiceStatus(service)
                                        }
                                        disabled={
                                            isUpdatingService &&
                                            togglingServiceId === service.id
                                        }
                                    >
                                        <ToggleLeft className="mr-1.5 size-4" />
                                        {service.isActive ? "停用" : "启用"}
                                    </Button>
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="text-destructive hover:text-destructive"
                                        onClick={() => onDeleteService(service)}
                                    >
                                        <Trash2 className="mr-1.5 size-4" />
                                        删除
                                    </Button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
}

function ServiceCategoryFormDialog({
    open,
    mode,
    category,
    parentId,
    rootCategories,
    disableParentChange,
    onClose,
    onSubmit,
    isSubmitting,
    uploadIcon,
    suggestedSortOrder,
}: {
    open: boolean;
    mode: "create" | "edit";
    category: AdminServiceCategory | null;
    parentId: string | null;
    rootCategories: AdminServiceCategory[];
    disableParentChange?: boolean;
    onClose: () => void;
    onSubmit: (values: ServiceCategoryFormValues) => Promise<void>;
    isSubmitting: boolean;
    uploadIcon: (file: File) => Promise<UploadValue>;
    suggestedSortOrder: number;
}) {
    const defaultValues: ServiceCategoryFormValues = {
        name: category?.name ?? "",
        description: category?.description ?? "",
        parentId: mode === "edit" ? (category?.parentId ?? null) : parentId,
        isActive: category?.isActive ?? true,
        sortOrder:
            category?.sortOrder !== undefined
                ? String(category.sortOrder)
                : String(suggestedSortOrder ?? 0),
        icon: category?.iconFileId
            ? {
                  id: category.iconFileId,
                  url: normalizeIconUrl(category.iconFileUrl) ?? "",
              }
            : null,
    };

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            await onSubmit(value);
        },
    });

    useEffect(() => {
        if (open) {
            form.reset(defaultValues);
        }
    }, [open, defaultValues, form]);

    const parentOptions = [
        { label: "无（一级分类）", value: ROOT_KEY },
        ...rootCategories.map((item) => ({
            label: item.name,
            value: item.id,
        })),
    ];

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "新增服务分类" : "编辑服务分类"}
                    </DialogTitle>
                    <DialogDescription>
                        支持最多两级分类，排序值越小越靠前。表单校验由 TanStack
                        Form + Zod 驱动。
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                            name="name"
                            validators={{
                                onChange: z
                                    .string()
                                    .min(1, "分类名称不能为空")
                                    .max(100, "名称不超过 100 字"),
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>分类名称</Label>
                                    <Input
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value,
                                            )
                                        }
                                        onBlur={field.handleBlur}
                                        placeholder="如 家庭保洁"
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="parentId">
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>所属层级</Label>
                                    <Select
                                        value={
                                            field.state.value
                                                ? field.state.value
                                                : ROOT_KEY
                                        }
                                        onValueChange={(value) =>
                                            field.handleChange(
                                                value === ROOT_KEY
                                                    ? null
                                                    : value,
                                            )
                                        }
                                        disabled={disableParentChange}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择所属层级" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {parentOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        仅允许二级分类挂载在一级节点下
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <form.Field
                        name="description"
                        validators={{
                            onChange: z.string().max(300, "描述不超过 300 字"),
                        }}
                    >
                        {(field) => (
                            <div className="space-y-2">
                                <Label>描述</Label>
                                <Textarea
                                    placeholder="补充分类亮点、适用场景..."
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                    rows={3}
                                />
                                <FieldError field={field} />
                            </div>
                        )}
                    </form.Field>

                    <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                            name="sortOrder"
                            validators={{
                                onChange: z
                                    .string()
                                    .refine(
                                        (value) => /^\d+$/.test(value.trim()),
                                        "请输入大于等于 0 的整数",
                                    ),
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>排序值</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value,
                                            )
                                        }
                                        onBlur={field.handleBlur}
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>

                        <form.Field name="isActive">
                            {(field) => (
                                <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                    <div>
                                        <p className="text-sm font-medium text-foreground">
                                            启用状态
                                        </p>
                                        <p className="text-xs text-muted-foreground">
                                            关闭后前台及下游端不可用
                                        </p>
                                    </div>
                                    <Switch
                                        checked={field.state.value}
                                        onCheckedChange={(checked) =>
                                            field.handleChange(Boolean(checked))
                                        }
                                    />
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <form.Field name="icon">
                        {(field) => (
                            <UploadField
                                label="分类图标"
                                description="推荐 SVG/PNG，尺寸 256x256"
                                value={field.state.value}
                                onChange={field.handleChange}
                                onUpload={uploadIcon}
                                accept="image/png,image/jpeg,image/svg+xml"
                                helperText="上传后自动生成文件标识，可在详情中预览"
                            />
                        )}
                    </form.Field>

                    <DialogFooter>
                        <form.Subscribe
                            selector={(state) => [
                                state.canSubmit,
                                state.isSubmitting,
                            ]}
                        >
                            {([canSubmit, isFormSubmitting]) => (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={
                                            !canSubmit ||
                                            isSubmitting ||
                                            isFormSubmitting
                                        }
                                    >
                                        {isSubmitting || isFormSubmitting
                                            ? "提交中..."
                                            : "保存"}
                                    </Button>
                                </>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function ServiceFormDialog({
    open,
    mode,
    service,
    categoryId,
    categories,
    onClose,
    uploadImage,
    onSubmit,
    isSubmitting,
}: {
    open: boolean;
    mode: "create" | "edit";
    service: ServiceListItem | null;
    categoryId: string | null;
    categories: AdminServiceCategory[];
    onClose: () => void;
    uploadImage: (file: File) => Promise<UploadValue>;
    onSubmit: (values: ServiceFormValues) => Promise<void>;
    isSubmitting: boolean;
}) {
    const defaultValues: ServiceFormValues = {
        name: service?.name ?? "",
        description: service?.description ?? "",
        categoryId: service?.categoryId ?? categoryId ?? "",
        isActive: service?.isActive ?? true,
        image:
            service?.imageFileUrl || service?.imageFileId
                ? {
                      id: service.imageFileId ?? "",
                      url:
                          normalizeIconUrl(
                              service.imageFileUrl ?? service.imageFileId,
                          ) ?? "",
                  }
                : null,
    };

    const form = useForm({
        defaultValues,
        onSubmit: async ({ value }) => {
            await onSubmit(value);
        },
    });

    useEffect(() => {
        if (open) {
            form.reset(defaultValues);
        }
    }, [defaultValues, form, open]);

    const categoryOptions = categories.map((item) => ({
        label: `${item.dep === 2 ? "二级" : "一级"} · ${item.name}`,
        value: item.id,
    }));

    return (
        <Dialog
            open={open}
            onOpenChange={(nextOpen) => (!nextOpen ? onClose() : undefined)}
        >
            <DialogContent className="max-w-2xl">
                <DialogHeader>
                    <DialogTitle>
                        {mode === "create" ? "新增服务" : "编辑服务"}
                    </DialogTitle>
                    <DialogDescription>
                        维护服务名称、描述、展示图片与所属分类，字段校验遵循后台服务接口要求。
                    </DialogDescription>
                </DialogHeader>

                <form
                    className="space-y-5"
                    onSubmit={(event) => {
                        event.preventDefault();
                        void form.handleSubmit();
                    }}
                >
                    <div className="grid gap-4 md:grid-cols-2">
                        <form.Field
                            name="name"
                            validators={{
                                onChange: z
                                    .string()
                                    .min(1, "服务名称不能为空")
                                    .max(100, "名称不超过 100 字"),
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>服务名称</Label>
                                    <Input
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value,
                                            )
                                        }
                                        onBlur={field.handleBlur}
                                        placeholder="如 房间收纳"
                                    />
                                    <FieldError field={field} />
                                </div>
                            )}
                        </form.Field>

                        <form.Field
                            name="categoryId"
                            validators={{
                                onChange: z.string().min(1, "请选择所属分类"),
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>所属分类</Label>
                                    <Select
                                        value={field.state.value}
                                        onValueChange={(value) =>
                                            field.handleChange(value)
                                        }
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="选择分类" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categoryOptions.map((option) => (
                                                <SelectItem
                                                    key={option.value}
                                                    value={option.value}
                                                >
                                                    {option.label}
                                                </SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                    <p className="text-xs text-muted-foreground">
                                        建议在叶子节点维护服务，便于前台检索展示。
                                    </p>
                                </div>
                            )}
                        </form.Field>
                    </div>

                    <form.Field
                        name="description"
                        validators={{
                            onChange: z.string().max(300, "描述不超过 300 字"),
                        }}
                    >
                        {(field) => (
                            <div className="space-y-2">
                                <Label>描述</Label>
                                <Textarea
                                    placeholder="服务亮点、范围说明等"
                                    value={field.state.value}
                                    onChange={(event) =>
                                        field.handleChange(event.target.value)
                                    }
                                    onBlur={field.handleBlur}
                                    rows={3}
                                />
                                <FieldError field={field} />
                            </div>
                        )}
                    </form.Field>

                    <form.Field name="image">
                        {(field) => (
                            <UploadField
                                label="服务图片"
                                description="建议 800x800，支持 PNG/JPEG/WebP"
                                value={field.state.value}
                                onChange={field.handleChange}
                                onUpload={uploadImage}
                                accept="image/png,image/jpeg,image/webp"
                                helperText="用于前台服务展示，非必填"
                            />
                        )}
                    </form.Field>

                    <form.Field name="isActive">
                        {(field) => (
                            <div className="flex items-center justify-between rounded-lg border px-3 py-2">
                                <div>
                                    <p className="text-sm font-medium text-foreground">
                                        启用状态
                                    </p>
                                    <p className="text-xs text-muted-foreground">
                                        关闭后前台不可选购
                                    </p>
                                </div>
                                <Switch
                                    checked={field.state.value}
                                    onCheckedChange={(checked) =>
                                        field.handleChange(Boolean(checked))
                                    }
                                />
                            </div>
                        )}
                    </form.Field>

                    <DialogFooter>
                        <form.Subscribe
                            selector={(state) => [
                                state.canSubmit,
                                state.isSubmitting,
                            ]}
                        >
                            {([canSubmit, isFormSubmitting]) => (
                                <>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={onClose}
                                        disabled={isSubmitting}
                                    >
                                        取消
                                    </Button>
                                    <Button
                                        type="submit"
                                        disabled={
                                            !canSubmit ||
                                            isSubmitting ||
                                            isFormSubmitting
                                        }
                                    >
                                        {isSubmitting || isFormSubmitting
                                            ? "提交中..."
                                            : "保存"}
                                    </Button>
                                </>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}

function FieldError({ field }: { field: AnyFieldApi }) {
    if (!field.state.meta.errors.length) return null;
    return (
        <p className="text-xs text-destructive">
            {String(field.state.meta.errors[0]?.message)}
        </p>
    );
}

function handleFormError(error: unknown, fallbackMessage: string) {
    if (error instanceof ApiClientError) {
        toast.error(error.message);
    } else if (error instanceof Error) {
        toast.error(error.message ?? fallbackMessage);
    } else {
        toast.error(fallbackMessage);
    }
}
