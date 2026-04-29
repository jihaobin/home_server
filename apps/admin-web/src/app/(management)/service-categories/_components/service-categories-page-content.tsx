"use client";

import Link from "next/link";
import {
    type ComponentProps,
    type ReactNode,
    Fragment,
    useCallback,
    useEffect,
    useMemo,
    useState,
} from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
    DragDropProvider,
    DragOverlay,
    useDraggable,
    useDroppable,
} from "@dnd-kit/react";
import {
    type ColumnDef,
    type ExpandedState,
    flexRender,
    getCoreRowModel,
    getExpandedRowModel,
    useReactTable,
} from "@tanstack/react-table";
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select";
import { Switch } from "@repo/web-ui/components/switch";
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/web-ui/components/table";
import { Textarea } from "@repo/web-ui/components/textarea";
import { UploadField, type UploadValue } from "@repo/web-ui/upload";
import { cn } from "@repo/web-ui/lib/utils";
import {
    useAdminServiceCategories,
    useAdminServiceTags,
    useCreateAdminServiceCategory,
    useUpdateAdminServiceCategory,
    useDeleteAdminServiceCategory,
} from "@repo/hooks/api/ssr";
import { useUploadFile } from "@repo/hooks/api/files";
import {
    type AdminServiceCategory,
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
    ChevronDown,
    ChevronRight,
    FolderTree,
    GripVertical,
    ImageIcon,
    PenSquare,
    PlusCircle,
    RefreshCcw,
    ToggleLeft,
    Trash2,
} from "lucide-react";
import { PageHeader, PageHeaderToolbar } from "@/components/common";
import { ApiClientError } from "@repo/utils/api-client";
import { resolveFileUrl } from "@/lib/files";
import Image from "next/image"

type DialogState =
    | { mode: "create"; open: boolean }
    | { mode: "edit"; categoryId: string; open: boolean };

type ServiceCategoryFormValues = {
    name: string;
    description: string;
    sortOrder: string;
    commissionRate: string;
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
    serviceTagId: string;
    isActive: boolean;
    image: UploadValue | null;
};

type ServiceTagOption = {
    value: string;
    label: string;
};

const UNSET_SERVICE_TAG_SELECT_VALUE = "__unset_service_tag__";

type ServiceListItem = CategoryWithServices["children"][number];

type ParentServiceItem = {
    service: ServiceListItem;
    category: AdminServiceCategory | null;
};

type ParentCategoryRow = {
    id: string;
    category: AdminServiceCategory;
    services: ParentServiceItem[];
};

type MoveServiceCategoryInput = {
    serviceId: string;
    targetCategoryId: string;
};

type CategoryStatusFilter = "all" | "active" | "inactive";

type ServiceCategoryTreeNode = AdminServiceCategory & {
    children?: ServiceCategoryTreeNode[];
};

type DragServiceMeta = {
    serviceId: string;
    serviceName: string;
    sourceCategoryId: string;
};

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

function matchesCategoryStatus(
    category: Pick<AdminServiceCategory, "isActive">,
    filter: CategoryStatusFilter,
) {
    if (filter === "all") {
        return true;
    }

    return filter === "active" ? category.isActive : !category.isActive;
}

function collectVisibleCategoryIds(
    categories: ServiceCategoryTreeNode[],
    filter: CategoryStatusFilter,
) {
    const visibleIds = new Set<string>();

    const visit = (category: ServiceCategoryTreeNode) => {
        const childMatched = (category.children ?? []).some((child) =>
            visit(child),
        );
        const selfMatched = matchesCategoryStatus(category, filter);
        const shouldShow = selfMatched || childMatched;

        if (shouldShow) {
            visibleIds.add(category.id);
        }

        return shouldShow;
    };

    categories.forEach((category) => {
        visit(category);
    });

    return visibleIds;
}

function CategoryIconThumbnail({
    iconUrl,
    alt,
    className,
    iconClassName,
}: {
    iconUrl: string | null;
    alt: string;
    className?: string;
    iconClassName?: string;
}) {
    const [hasImageError, setHasImageError] = useState(false);

    useEffect(() => {
        setHasImageError(false);
    }, [iconUrl]);

    const shouldShowImage = Boolean(iconUrl && !hasImageError);

    return (
        <div
            className={cn(
                "relative flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border bg-muted",
                className,
            )}
        >
            {shouldShowImage ? (
                <Image
                    src={iconUrl!}
                    alt={alt}
                    content="fill"
                    width={40}
                    height={40}
                    className="size-full object-cover"
                    onError={() => setHasImageError(true)}
                />
            ) : (
                <ImageIcon
                    className={cn(
                        "size-4 text-muted-foreground",
                        iconClassName,
                    )}
                />
            )}
        </div>
    );
}

function CategoryIconPreviewPanel({
    iconUrl,
    categoryName,
}: {
    iconUrl: string | null;
    categoryName: string;
}) {
    return (
        <div className="rounded-lg border bg-muted/20 p-4">
            <div className="flex items-center gap-4">
                <CategoryIconThumbnail
                    iconUrl={iconUrl}
                    alt={`${categoryName} 图标预览`}
                    className="size-20 rounded-xl"
                    iconClassName="size-8"
                />
                <div className="space-y-1">
                    <p className="text-sm font-medium text-foreground">
                        当前图标预览
                    </p>
                    <p className="text-xs text-muted-foreground">
                        {iconUrl
                            ? "该图标会直接显示在分类列表中。"
                            : "未设置图标时，列表中会显示默认占位图标。"}
                    </p>
                </div>
            </div>
        </div>
    );
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
    const [togglingCategoryId, setTogglingCategoryId] = useState<string | null>(
        null,
    );
    const [togglingServiceId, setTogglingServiceId] = useState<string | null>(
        null,
    );
    const [statusFilter, setStatusFilter] =
        useState<CategoryStatusFilter>("all");

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
        page: 1,
        limit: 500,
    });
    const { data: serviceTagsResponse } = useAdminServiceTags({
        domain: "massage",
        status: "all",
    });

    const serviceCategories: CategoryWithServices[] = useMemo(
        () => serviceListResponse?.items ?? [],
        [serviceListResponse],
    );

    const parentsMap = useMemo(() => {
        const map = new Map<string, AdminServiceCategory>();
        data.flat.forEach((category) => {
            map.set(category.id, category);
        });
        return map;
    }, [data.flat]);

    const servicesByCategoryId = useMemo(() => {
        const map = new Map<string, ServiceListItem[]>();
        serviceCategories.forEach((category) => {
            map.set(category.id, category.children ?? []);
        });
        return map;
    }, [serviceCategories]);

    const servicesById = useMemo(() => {
        const map = new Map<string, ServiceListItem>();
        serviceCategories.forEach((category) => {
            (category.children ?? []).forEach((service) => {
                map.set(service.id, service);
            });
        });
        return map;
    }, [serviceCategories]);

    const categories = useMemo(
        () =>
            [...data.flat].sort(
                (left, right) =>
                    left.sortOrder - right.sortOrder ||
                    left.name.localeCompare(right.name, "zh-CN"),
            ),
        [data.flat],
    );

    const serviceTagOptions = useMemo<ServiceTagOption[]>(() => {
        const activeOptions = serviceTagsResponse.items
            .filter((tag) => tag.isActive)
            .map((tag) => ({
                value: tag.id,
                label: tag.name,
            }));

        if (serviceDialogState?.mode !== "edit") {
            return activeOptions;
        }

        const currentServiceTagId = serviceDialogState.service.serviceTagId;
        if (!currentServiceTagId) {
            return activeOptions;
        }

        const currentTag = serviceTagsResponse.items.find(
            (tag) => tag.id === currentServiceTagId,
        );
        if (!currentTag || currentTag.isActive) {
            return activeOptions;
        }

        return [
            ...activeOptions,
            {
                value: currentTag.id,
                label: `${currentTag.name}（已停用）`,
            },
        ];
    }, [serviceDialogState, serviceTagsResponse.items]);

    const visibleCategoryIds = useMemo(
        () =>
            collectVisibleCategoryIds(
                data.tree as ServiceCategoryTreeNode[],
                statusFilter,
            ),
        [data.tree, statusFilter],
    );

    const filteredCategories = useMemo(
        () =>
            categories.filter((category) =>
                visibleCategoryIds.has(category.id),
            ),
        [categories, visibleCategoryIds],
    );

    const parentCategoryRows = useMemo<ParentCategoryRow[]>(() => {
        return filteredCategories.map((category) => {
            const services = (servicesByCategoryId.get(category.id) ?? [])
                .filter((service) =>
                    matchesCategoryStatus(service, statusFilter),
                )
                .map((service) => ({
                    service,
                    category: parentsMap.get(service.categoryId) ?? null,
                }))
                .sort((left, right) =>
                    left.service.name.localeCompare(
                        right.service.name,
                        "zh-CN",
                    ),
                );

            return {
                id: category.id,
                category,
                services,
            };
        });
    }, [filteredCategories, parentsMap, servicesByCategoryId, statusFilter]);

    const totals = useMemo(() => {
        return {
            total: categories.length,
            visible: filteredCategories.length,
        };
    }, [categories.length, filteredCategories.length]);

    const handleRefresh = useCallback(async () => {
        await Promise.all([refetch(), refetchServices()]);
        toast.success("已刷新分类与服务数据");
    }, [refetch, refetchServices]);

    const openCreateDialog = useCallback(() => {
        setDialogState({ mode: "create", open: true });
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
                url: resolveFileUrl(response.fileUrl ?? response.id) ?? "",
                name: response.originalName,
                mimeType: response.mimeType,
            };
        },
        [uploadFile],
    );

    const handleCreateCategory = useCallback(
        async (values: ServiceCategoryFormValues) => {
            try {
                const payload = {
                    name: values.name.trim(),
                    description: values.description.trim()
                        ? values.description.trim()
                        : null,
                    parentId: null,
                    sortOrder: Number(values.sortOrder) || 0,
                    commissionRate: Number(values.commissionRate) || 0,
                    isActive: values.isActive,
                    iconFileId: values.icon?.id ?? null,
                };
                await createMutation.mutateAsync(payload);
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
                const data = {
                    name: values.name.trim(),
                    description: values.description.trim()
                        ? values.description.trim()
                        : null,
                    parentId: null,
                    sortOrder: Number(values.sortOrder) || 0,
                    commissionRate: Number(values.commissionRate) || 0,
                    isActive: values.isActive,
                    iconFileId: values.icon?.id ?? null,
                };
                await updateMutation.mutateAsync({
                    id: categoryId,
                    data,
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

    const handleToggleCategoryStatus = useCallback(
        async (category: AdminServiceCategory) => {
            const nextIsActive = !category.isActive;

            setTogglingCategoryId(category.id);
            try {
                await updateMutation.mutateAsync({
                    id: category.id,
                    data: {
                        isActive: nextIsActive,
                    },
                });
                toast.success(
                    `已${nextIsActive ? "启用" : "停用"}分类「${category.name}」`,
                );
            } catch (error) {
                handleFormError(error, "修改分类启用状态失败");
            } finally {
                setTogglingCategoryId((current) =>
                    current === category.id ? null : current,
                );
            }
        },
        [updateMutation],
    );

    const handleRequestDeleteCategory = useCallback(
        (category: AdminServiceCategory) => {
            setSelectedCategoryId(category.id);
            setDeleteDialogOpen(true);
        },
        [],
    );

    const openCreateServiceDialog = useCallback(
        (preferredCategoryId?: string | null) => {
            const defaultCategoryId = categories[0]?.id ?? null;
            const resolvedCategoryId =
                preferredCategoryId ?? selectedCategoryId ?? defaultCategoryId;

            if (!resolvedCategoryId) {
                toast.error("请先创建分类后再新增服务");
                return;
            }

            setServiceDialogState({
                mode: "create",
                categoryId: resolvedCategoryId,
                open: true,
            });
        },
        [categories, selectedCategoryId],
    );

    const openEditServiceDialog = useCallback((service: ServiceListItem) => {
        setServiceDialogState({ mode: "edit", service, open: true });
    }, []);

    const closeServiceDialog = useCallback(() => {
        setServiceDialogState(null);
    }, []);

    const refreshServices = useCallback(async () => {
        await Promise.all([
            refetchServices(),
            queryClient.invalidateQueries({ queryKey: ["service-list"] }),
            queryClient.invalidateQueries({
                queryKey: ["service-list-single"],
            }),
        ]);
    }, [queryClient, refetchServices]);

    const handleCreateService = useCallback(
        async (values: ServiceFormValues) => {
            try {
                await createServiceMutation.mutateAsync({
                    name: values.name.trim(),
                    description: values.description.trim()
                        ? values.description.trim()
                        : null,
                    categoryId: values.categoryId,
                    serviceTagId: values.serviceTagId || null,
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
                        serviceTagId: values.serviceTagId || null,
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

    const handleMoveServiceCategory = useCallback(
        async ({ serviceId, targetCategoryId }: MoveServiceCategoryInput) => {
            const service = servicesById.get(serviceId);
            const targetCategory = parentsMap.get(targetCategoryId);

            if (!service || !targetCategory) {
                return;
            }

            if (service.categoryId === targetCategoryId) {
                return;
            }

            try {
                await updateServiceMutation.mutateAsync({
                    id: service.id,
                    data: {
                        categoryId: targetCategoryId,
                    },
                });
                toast.success(
                    `已将服务「${service.name}」移动到分类「${targetCategory.name}」`,
                );
                await refreshServices();
            } catch (error) {
                handleFormError(error, "移动服务分类失败");
            }
        },
        [parentsMap, refreshServices, servicesById, updateServiceMutation],
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
                ? categories.length
                : (editingCategory?.sortOrder ?? categories.length)) + 1
            : 0) || 0;

    return (
        <div className="space-y-6">
            <PageHeader
                title="服务分类管理"
                description="通过分类展开查看服务，减少来回切换。"
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
                            onClick={openCreateDialog}
                        >
                            <PlusCircle className="size-4" />
                            新增分类
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="flex-wrap gap-3">
                    <div className="flex items-center gap-2">
                        <span className="text-xs text-muted-foreground">
                            分类状态
                        </span>
                        <Select
                            value={statusFilter}
                            onValueChange={(value) =>
                                setStatusFilter(value as CategoryStatusFilter)
                            }
                        >
                            <SelectTrigger className="h-8 w-35">
                                <SelectValue placeholder="全部状态" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">全部状态</SelectItem>
                                <SelectItem value="active">启用</SelectItem>
                                <SelectItem value="inactive">停用</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <span className="text-xs text-muted-foreground">
                        {statusFilter === "all"
                            ? `共 ${totals.total} 个分类`
                            : `筛选结果 ${totals.visible} / ${totals.total} 个分类`}
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
                        分类与服务总览
                    </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                    <CategoryServiceTablePanel
                        rows={parentCategoryRows}
                        isLoading={isServiceFetching}
                        onEditCategory={(category) => {
                            setSelectedCategoryId(category.id);
                            openEditDialog(category.id);
                        }}
                        onToggleCategoryStatus={(category) =>
                            void handleToggleCategoryStatus(category)
                        }
                        onDeleteCategory={handleRequestDeleteCategory}
                        onAddService={(categoryId) =>
                            openCreateServiceDialog(categoryId)
                        }
                        onEditService={openEditServiceDialog}
                        onToggleServiceStatus={(service) =>
                            void handleToggleServiceStatus(service)
                        }
                        onDeleteService={setServiceToDelete}
                        onMoveServiceCategory={(
                            input: MoveServiceCategoryInput,
                        ) => void handleMoveServiceCategory(input)}
                        togglingCategoryId={togglingCategoryId}
                        togglingServiceId={togglingServiceId}
                        isUpdatingService={updateServiceMutation.isPending}
                        isUpdatingCategory={updateMutation.isPending}
                        isDeletingCategory={deleteCategoryMutation.isPending}
                        statusFilter={statusFilter}
                        emptyMessage={
                            statusFilter === "all"
                                ? "暂无分类数据，请先新增分类。"
                                : "当前筛选条件下暂无匹配的分类。"
                        }
                    />
                </CardContent>
            </Card>

            {dialogState ? (
                <ServiceCategoryFormDialog
                    open={dialogState.open}
                    mode={dialogState.mode}
                    category={editingCategory}
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
                    categories={categories}
                    serviceTagOptions={serviceTagOptions}
                    onClose={closeServiceDialog}
                    uploadImage={handleUploadIcon}
                    onSubmit={async (values) => {
                        const lockedCategoryId =
                            serviceDialogState.mode === "create"
                                ? serviceDialogState.categoryId
                                : serviceDialogState.service.categoryId;

                        if (serviceDialogState.mode === "create") {
                            await handleCreateService({
                                ...values,
                                categoryId:
                                    lockedCategoryId ?? values.categoryId,
                            });
                        } else {
                            await handleUpdateService(
                                serviceDialogState.service.id,
                                {
                                    ...values,
                                    categoryId:
                                        lockedCategoryId ?? values.categoryId,
                                },
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
                            删除后将无法恢复，且需确保该分类没有关联服务。确定删除
                            {selectedCategory
                                ? `「${selectedCategory.name}」`
                                : "该分类"}
                            吗？
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

function CategoryServiceTablePanel({
    rows,
    isLoading,
    onEditCategory,
    onToggleCategoryStatus,
    onDeleteCategory,
    onAddService,
    onEditService,
    onToggleServiceStatus,
    onDeleteService,
    onMoveServiceCategory,
    togglingCategoryId,
    togglingServiceId,
    isUpdatingService,
    isUpdatingCategory,
    isDeletingCategory,
    statusFilter,
    emptyMessage,
}: {
    rows: ParentCategoryRow[];
    isLoading: boolean;
    onEditCategory: (category: AdminServiceCategory) => void;
    onToggleCategoryStatus: (category: AdminServiceCategory) => void;
    onDeleteCategory: (category: AdminServiceCategory) => void;
    onAddService: (categoryId: string | null) => void;
    onEditService: (service: ServiceListItem) => void;
    onToggleServiceStatus: (service: ServiceListItem) => void;
    onDeleteService: (service: ServiceListItem) => void;
    onMoveServiceCategory: (input: MoveServiceCategoryInput) => void;
    togglingCategoryId: string | null;
    togglingServiceId: string | null;
    isUpdatingService: boolean;
    isUpdatingCategory: boolean;
    isDeletingCategory: boolean;
    statusFilter: CategoryStatusFilter;
    emptyMessage: string;
}) {
    const [expanded, setExpanded] = useState<ExpandedState>({});
    const [activeDragService, setActiveDragService] =
        useState<DragServiceMeta | null>(null);

    const columns = useMemo<ColumnDef<ParentCategoryRow>[]>(
        () => [
            {
                id: "expander",
                header: () => <span className="sr-only">展开</span>,
                cell: ({ row }) => (
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-7"
                        onClick={row.getToggleExpandedHandler()}
                        disabled={!row.getCanExpand()}
                        aria-label={
                            row.getIsExpanded()
                                ? `收起${row.original.category.name}`
                                : `展开${row.original.category.name}`
                        }
                    >
                        {row.getIsExpanded() ? (
                            <ChevronDown className="size-4" />
                        ) : (
                            <ChevronRight className="size-4" />
                        )}
                    </Button>
                ),
            },
            {
                id: "category",
                header: "分类",
                cell: ({ row }) => {
                    const iconUrl = normalizeIconUrl(
                        row.original.category.iconFileUrl,
                    );

                    return (
                        <div className="flex items-start gap-3">
                            <CategoryIconThumbnail
                                iconUrl={iconUrl}
                                alt={`${row.original.category.name} 图标`}
                            />
                            <div className="space-y-1">
                                <p className="text-sm font-semibold text-foreground">
                                    {row.original.category.name}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                    {row.original.category.description ||
                                        "暂无描述"}
                                </p>
                            </div>
                        </div>
                    );
                },
            },
            {
                id: "services",
                header: "服务数",
                cell: ({ row }) => {
                    const activeCount = row.original.services.filter(
                        (item) => item.service.isActive,
                    ).length;
                    return (
                        <div className="text-xs text-muted-foreground">
                            {activeCount} / {row.original.services.length} 启用
                        </div>
                    );
                },
            },
            {
                id: "commissionRate",
                header: "抽成比例",
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">
                        {readCategoryCommissionRate(row.original.category)}%
                    </span>
                ),
            },
            {
                id: "status",
                header: "状态",
                cell: ({ row }) => (
                    <Badge
                        variant={
                            row.original.category.isActive
                                ? "default"
                                : "secondary"
                        }
                    >
                        {row.original.category.isActive ? "启用" : "停用"}
                    </Badge>
                ),
            },
            {
                id: "actions",
                header: "操作",
                cell: ({ row }) => {
                    const isCategoryToggling =
                        isUpdatingCategory &&
                        togglingCategoryId === row.original.category.id;

                    return (
                        <div className="flex flex-wrap gap-2">
                            {row.original.category.name === "上门按摩" ? (
                                <Button variant="outline" size="sm" asChild>
                                    <Link
                                        href={`/service-categories/${row.original.category.id}/commission-strategy`}
                                    >
                                        抽成策略
                                    </Link>
                                </Button>
                            ) : null}
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    onEditCategory(row.original.category)
                                }
                            >
                                编辑
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                onClick={() =>
                                    onAddService(row.original.category.id)
                                }
                            >
                                新增服务
                            </Button>
                            <Button
                                variant="outline"
                                size="sm"
                                disabled={isCategoryToggling}
                                onClick={() =>
                                    onToggleCategoryStatus(
                                        row.original.category,
                                    )
                                }
                            >
                                {isCategoryToggling
                                    ? "处理中..."
                                    : row.original.category.isActive
                                        ? "停用"
                                        : "启用"}
                            </Button>
                            <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive hover:text-destructive"
                                disabled={isDeletingCategory}
                                onClick={() =>
                                    onDeleteCategory(row.original.category)
                                }
                            >
                                删除
                            </Button>
                        </div>
                    );
                },
            },
        ],
        [
            isDeletingCategory,
            isUpdatingCategory,
            onAddService,
            onDeleteCategory,
            onEditCategory,
            onToggleCategoryStatus,
            togglingCategoryId,
        ],
    );

    const table = useReactTable({
        data: rows,
        columns,
        state: {
            expanded,
        },
        getRowCanExpand: (row) => row.original.services.length > 0,
        getRowId: (row) => row.id,
        onExpandedChange: setExpanded,
        getCoreRowModel: getCoreRowModel(),
        getExpandedRowModel: getExpandedRowModel(),
    });

    const handleDragEnd = useCallback(
        (
            event: Parameters<
                NonNullable<
                    ComponentProps<typeof DragDropProvider>["onDragEnd"]
                >
            >[0],
        ) => {
            setActiveDragService(null);

            if (event.canceled) {
                return;
            }

            const sourceData = (event.operation.source?.data ??
                null) as DragServiceMeta | null;
            const targetData = (event.operation.target?.data ?? null) as {
                categoryId?: string;
            } | null;

            const serviceId = sourceData?.serviceId;
            const sourceCategoryId = sourceData?.sourceCategoryId;
            const targetCategoryId = targetData?.categoryId;

            if (!serviceId || !targetCategoryId) {
                return;
            }

            if (sourceCategoryId === targetCategoryId) {
                return;
            }

            onMoveServiceCategory({ serviceId, targetCategoryId });
        },
        [onMoveServiceCategory],
    );

    const handleDragStart = useCallback(
        (
            event: Parameters<
                NonNullable<
                    ComponentProps<typeof DragDropProvider>["onDragStart"]
                >
            >[0],
        ) => {
            const sourceData = (event.operation.source?.data ??
                null) as DragServiceMeta | null;
            if (!sourceData?.serviceId) {
                return;
            }
            setActiveDragService(sourceData);
        },
        [],
    );

    if (rows.length === 0 && !isLoading) {
        return (
            <div className="rounded-lg border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
                {emptyMessage}
            </div>
        );
    }

    return (
        <DragDropProvider
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        >
            <div className="rounded-xl border">
                <Table>
                    <TableHeader>
                        {table.getHeaderGroups().map((headerGroup) => (
                            <TableRow key={headerGroup.id}>
                                {headerGroup.headers.map((header) => (
                                    <TableHead key={header.id}>
                                        {header.isPlaceholder
                                            ? null
                                            : flexRender(
                                                header.column.columnDef
                                                    .header,
                                                header.getContext(),
                                            )}
                                    </TableHead>
                                ))}
                            </TableRow>
                        ))}
                    </TableHeader>
                    <TableBody>
                        {isLoading
                            ? Array.from({ length: 3 }).map((_, index) => (
                                <TableRow key={`loading-${index}`}>
                                    <TableCell
                                        colSpan={columns.length}
                                        className="py-6 text-sm text-muted-foreground"
                                    >
                                        服务数据加载中...
                                    </TableCell>
                                </TableRow>
                            ))
                            : table.getRowModel().rows.map((row) => (
                                <Fragment key={row.id}>
                                    <DroppableCategoryRow
                                        categoryId={row.original.category.id}
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef
                                                        .cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </DroppableCategoryRow>
                                    {row.getIsExpanded() ? (
                                        <TableRow className="bg-muted/25 hover:bg-muted/25">
                                            <TableCell
                                                colSpan={
                                                    row.getVisibleCells()
                                                        .length
                                                }
                                            >
                                                <ParentCategoryExpandedPanel
                                                    row={row.original}
                                                    statusFilter={
                                                        statusFilter
                                                    }
                                                    onAddService={
                                                        onAddService
                                                    }
                                                    onEditService={
                                                        onEditService
                                                    }
                                                    onToggleServiceStatus={
                                                        onToggleServiceStatus
                                                    }
                                                    onDeleteService={
                                                        onDeleteService
                                                    }
                                                    togglingServiceId={
                                                        togglingServiceId
                                                    }
                                                    isUpdatingService={
                                                        isUpdatingService
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </Fragment>
                            ))}
                    </TableBody>
                </Table>
            </div>
            <DragOverlay>
                {activeDragService ? (
                    <div className="rounded-md border bg-background px-3 py-2 text-sm font-medium shadow-md">
                        {activeDragService.serviceName}
                    </div>
                ) : null}
            </DragOverlay>
        </DragDropProvider>
    );
}

function DroppableCategoryRow({
    categoryId,
    children,
}: {
    categoryId: string;
    children: ReactNode;
}) {
    const { ref, isDropTarget } = useDroppable({
        id: `category-drop-${categoryId}`,
        data: {
            categoryId,
        },
    });

    return (
        <tr
            ref={ref}
            className={cn(
                "hover:bg-muted/50 border-b transition-colors",
                isDropTarget && "bg-primary/10 ring-1 ring-primary/30",
            )}
        >
            {children}
        </tr>
    );
}

function DraggableServiceTableRow({
    item,
    onEditService,
    onToggleServiceStatus,
    onDeleteService,
    togglingServiceId,
    isUpdatingService,
}: {
    item: ParentServiceItem;
    onEditService: (service: ServiceListItem) => void;
    onToggleServiceStatus: (service: ServiceListItem) => void;
    onDeleteService: (service: ServiceListItem) => void;
    togglingServiceId: string | null;
    isUpdatingService: boolean;
}) {
    const { ref, handleRef, isDragging } = useDraggable({
        id: `service-drag-${item.service.id}`,
        data: {
            serviceId: item.service.id,
            serviceName: item.service.name,
            sourceCategoryId: item.service.categoryId,
        } satisfies DragServiceMeta,
    });

    return (
        <tr
            ref={ref}
            className={cn(
                "hover:bg-muted/50 border-b transition-colors",
                isDragging && "bg-primary/5 opacity-60",
            )}
        >
            <TableCell>
                <Button
                    ref={handleRef}
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="size-7 cursor-grab active:cursor-grabbing"
                    aria-label={`拖拽移动服务 ${item.service.name}`}
                >
                    <GripVertical className="size-4 text-muted-foreground" />
                </Button>
            </TableCell>
            <TableCell>
                <p className="text-sm font-medium text-foreground">
                    {item.service.name}
                </p>
            </TableCell>
            <TableCell>
                <span className="text-xs text-muted-foreground">
                    {item.category?.name ?? "未分类"}
                </span>
            </TableCell>
            <TableCell>
                <Badge
                    variant={item.service.isActive ? "default" : "secondary"}
                >
                    {item.service.isActive ? "启用" : "停用"}
                </Badge>
            </TableCell>
            <TableCell>
                <span className="text-xs text-muted-foreground">
                    {item.service.description || "暂无描述"}
                </span>
            </TableCell>
            <TableCell>
                <div className="flex flex-wrap gap-2">
                    <Button
                        variant="outline"
                        size="sm"
                        onClick={() => onEditService(item.service)}
                    >
                        <PenSquare className="mr-1.5 size-4" />
                        编辑
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        disabled={
                            isUpdatingService &&
                            togglingServiceId === item.service.id
                        }
                        onClick={() => onToggleServiceStatus(item.service)}
                    >
                        <ToggleLeft className="mr-1.5 size-4" />
                        {item.service.isActive ? "停用" : "启用"}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-destructive hover:text-destructive"
                        onClick={() => onDeleteService(item.service)}
                    >
                        <Trash2 className="mr-1.5 size-4" />
                        删除
                    </Button>
                </div>
            </TableCell>
        </tr>
    );
}

function ParentCategoryExpandedPanel({
    row,
    statusFilter,
    onAddService,
    onEditService,
    onToggleServiceStatus,
    onDeleteService,
    togglingServiceId,
    isUpdatingService,
}: {
    row: ParentCategoryRow;
    statusFilter: CategoryStatusFilter;
    onAddService: (categoryId: string | null) => void;
    onEditService: (service: ServiceListItem) => void;
    onToggleServiceStatus: (service: ServiceListItem) => void;
    onDeleteService: (service: ServiceListItem) => void;
    togglingServiceId: string | null;
    isUpdatingService: boolean;
}) {
    return (
        <div className="space-y-4 rounded-lg border bg-background p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                    <p className="text-sm font-semibold text-foreground">
                        {row.category.name} · 服务列表
                    </p>
                    <p className="text-xs text-muted-foreground">
                        服务 {row.services.length} 个
                    </p>
                </div>
                <Button
                    size="sm"
                    className="gap-1.5"
                    onClick={() => onAddService(row.category.id)}
                >
                    <PlusCircle className="size-4" />
                    在该分类下新增服务
                </Button>
            </div>

            <div className="rounded-md border">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead className="w-12">拖拽</TableHead>
                            <TableHead>服务名称</TableHead>
                            <TableHead>所属分类</TableHead>
                            <TableHead>状态</TableHead>
                            <TableHead>描述</TableHead>
                            <TableHead>操作</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {row.services.length === 0 ? (
                            <TableRow>
                                <TableCell
                                    colSpan={6}
                                    className="py-5 text-sm text-muted-foreground"
                                >
                                    {statusFilter === "all"
                                        ? "该分类下暂无服务，点击上方按钮可快速新增。"
                                        : "当前筛选条件下，该分类暂无匹配服务。"}
                                </TableCell>
                            </TableRow>
                        ) : (
                            row.services.map((item) => (
                                <DraggableServiceTableRow
                                    key={item.service.id}
                                    item={item}
                                    onEditService={onEditService}
                                    onToggleServiceStatus={
                                        onToggleServiceStatus
                                    }
                                    onDeleteService={onDeleteService}
                                    togglingServiceId={togglingServiceId}
                                    isUpdatingService={isUpdatingService}
                                />
                            ))
                        )}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function ServiceCategoryFormDialog({
    open,
    mode,
    category,
    onClose,
    onSubmit,
    isSubmitting,
    uploadIcon,
    suggestedSortOrder,
}: {
    open: boolean;
    mode: "create" | "edit";
    category: AdminServiceCategory | null;
    onClose: () => void;
    onSubmit: (values: ServiceCategoryFormValues) => Promise<void>;
    isSubmitting: boolean;
    uploadIcon: (file: File) => Promise<UploadValue>;
    suggestedSortOrder: number;
}) {
    const defaultValues = useMemo<ServiceCategoryFormValues>(() => ({
        name: category?.name ?? "",
        description: category?.description ?? "",
        isActive: category?.isActive ?? true,
        sortOrder:
            category?.sortOrder !== undefined
                ? String(category.sortOrder)
                : String(suggestedSortOrder ?? 0),
        commissionRate: String(readCategoryCommissionRate(category)),
        icon: category?.iconFileId
            ? {
                id: category.iconFileId,
                url: normalizeIconUrl(category.iconFileUrl) ?? "",
            }
            : null,
    }), [category, suggestedSortOrder]);

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
                        维护分类名称、排序、状态与图标。排序值越小越靠前。
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

                        <form.Field
                            name="commissionRate"
                            validators={{
                                onChange: z
                                    .string()
                                    .refine(
                                        (value) => /^\d+$/.test(value.trim()),
                                        "请输入 0-100 的整数",
                                    )
                                    .refine((value) => {
                                        const parsed = Number(value.trim());
                                        return parsed >= 0 && parsed <= 100;
                                    }, "抽成比例必须在 0-100 之间"),
                            }}
                        >
                            {(field) => (
                                <div className="space-y-2">
                                    <Label>抽成比例（%）</Label>
                                    <Input
                                        type="number"
                                        min={0}
                                        max={100}
                                        value={field.state.value}
                                        onChange={(event) =>
                                            field.handleChange(
                                                event.target.value,
                                            )
                                        }
                                        onBlur={field.handleBlur}
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        填写平台对该分类订单统一抽成的百分比。
                                    </p>
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
                            <div className="space-y-3">
                                <CategoryIconPreviewPanel
                                    iconUrl={field.state.value?.url ?? null}
                                    categoryName={category?.name ?? "服务分类"}
                                />
                                <UploadField
                                    label="分类图标"
                                    description="推荐 SVG/PNG，尺寸 256x256"
                                    value={field.state.value}
                                    onChange={field.handleChange}
                                    onUpload={uploadIcon}
                                    accept="image/png,image/jpeg,image/svg+xml"
                                    helperText="上传后可在上方直接查看最终展示效果"
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

function readCategoryCommissionRate(
    category: AdminServiceCategory | null | undefined,
) {
    const rawValue = (category as Record<string, unknown> | null)
        ?.commissionRate;
    return typeof rawValue === "number" && Number.isFinite(rawValue)
        ? rawValue
        : 30;
}

function ServiceFormDialog({
    open,
    mode,
    service,
    categoryId,
    categories,
    serviceTagOptions,
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
    serviceTagOptions: ServiceTagOption[];
    onClose: () => void;
    uploadImage: (file: File) => Promise<UploadValue>;
    onSubmit: (values: ServiceFormValues) => Promise<void>;
    isSubmitting: boolean;
}) {
    const defaultValues = useMemo<ServiceFormValues>(() => ({
        name: service?.name ?? "",
        description: service?.description ?? "",
        categoryId: service?.categoryId ?? categoryId ?? "",
        serviceTagId: service?.serviceTagId ?? "",
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
    }), [service, categoryId]);

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

    const fixedCategoryLabel =
        categories.find((item) => item.id === defaultValues.categoryId)?.name ??
        "未匹配分类";

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
                        维护服务名称、描述与展示图片。服务归属分类由入口决定，如需调整请在列表中拖拽服务到目标分类。
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
                        <div className="space-y-2">
                            <Label>所属分类</Label>
                            <div className="rounded-lg border bg-muted/30 px-3 py-2 text-sm font-medium text-foreground">
                                {fixedCategoryLabel}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                新增/编辑时分类不可在弹窗中修改，可在列表中拖拽服务调整分类。
                            </p>
                        </div>
                    </div>

                    <form.Field name="serviceTagId">
                        {(field) => (
                            <div className="space-y-2">
                                <Label>服务标签</Label>
                                <Select
                                    value={
                                        field.state.value ||
                                        UNSET_SERVICE_TAG_SELECT_VALUE
                                    }
                                    onValueChange={(value) =>
                                        field.handleChange(
                                            value ===
                                                UNSET_SERVICE_TAG_SELECT_VALUE
                                                ? ""
                                                : value,
                                        )
                                    }
                                >
                                    <SelectTrigger>
                                        <SelectValue placeholder="请选择服务标签" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem
                                            value={
                                                UNSET_SERVICE_TAG_SELECT_VALUE
                                            }
                                        >
                                            未设置标签
                                        </SelectItem>
                                        {serviceTagOptions.map((option) => (
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
                                    仅可新绑启用标签；已停用历史绑定可保留回显
                                </p>
                            </div>
                        )}
                    </form.Field>

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
