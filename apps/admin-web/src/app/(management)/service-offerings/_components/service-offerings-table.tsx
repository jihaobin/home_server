"use client"

import { Fragment, useMemo, useState } from "react"
import type {
    AdminServiceOfferingListItem,
    FileAccessInfo,
    ServiceOfferingSubmittedSnapshot,
} from "@repo/types"
import type {
    ColumnDef,
    PaginationState,
    Updater,
} from "@tanstack/react-table"
import {
    flexRender,
    getCoreRowModel,
    useReactTable,
} from "@tanstack/react-table"
import {
    ChevronDown,
    ChevronRight,
    ExternalLink,
    FileCheck2,
    ImageIcon,
    Maximize2,
} from "lucide-react"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from "@repo/web-ui/components/dialog"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/web-ui/components/table"
import { cn } from "@repo/web-ui/lib/utils"
import { EntityTablePagination } from "@/components/common"

type ServiceOfferingsTableProps = {
    data: AdminServiceOfferingListItem[]
    total: number
    page: number
    limit: number
    isActionPending?: boolean
    onPaginationChange: (next: { page: number; limit: number }) => void
    onApproveDraft: (draft: Extract<AdminServiceOfferingListItem, { kind: "draft" }>) => void
    onRejectDraft: (draft: Extract<AdminServiceOfferingListItem, { kind: "draft" }>) => void
    onTakeDown: (
        offering: Extract<AdminServiceOfferingListItem, { kind: "published" }>,
    ) => void
}

type PersonnelRow = {
    personnelId: string
    personnelName: string
    phoneNumber: string
    personnel: AdminServiceOfferingListItem["personnel"]
    items: AdminServiceOfferingListItem[]
    updatedAt: string
}

type DraftItem = Extract<AdminServiceOfferingListItem, { kind: "draft" }>
type PublishedItem = Extract<AdminServiceOfferingListItem, { kind: "published" }>
type ServiceSnapshotService = ServiceOfferingSubmittedSnapshot["services"][number] & {
    gallery?: FileAccessInfo[]
}

const REVIEW_STATUS_LABELS = {
    pending: "待审核",
    approved: "已通过",
    rejected: "已拒绝",
} as const

const PUBLICATION_STATUS_LABELS = {
    active: "上架中",
    taken_down: "已下架",
} as const

const REVIEW_STATUS_BADGE_CLASS = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-rose-100 text-rose-700",
} as const

const PUBLICATION_STATUS_BADGE_CLASS = {
    active: "bg-emerald-100 text-emerald-700",
    taken_down: "bg-slate-100 text-slate-700",
} as const

export function ServiceOfferingsTable({
    data,
    total,
    page,
    limit,
    isActionPending,
    onPaginationChange,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
}: ServiceOfferingsTableProps) {
    const [expandedPersonnelIds, setExpandedPersonnelIds] = useState<Set<string>>(
        () => new Set(),
    )

    const rows = useMemo(() => groupByPersonnel(data), [data])
    const columns = useMemo<ColumnDef<PersonnelRow>[]>(
        () => [
            {
                header: "",
                id: "expand",
                cell: ({ row }) => {
                    const expanded = expandedPersonnelIds.has(row.original.personnelId)
                    return (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => {
                                setExpandedPersonnelIds((current) => {
                                    const next = new Set(current)
                                    if (next.has(row.original.personnelId)) {
                                        next.delete(row.original.personnelId)
                                    } else {
                                        next.add(row.original.personnelId)
                                    }
                                    return next
                                })
                            }}
                            aria-label={expanded ? "收起服务" : "展开服务"}
                        >
                            {expanded ? (
                                <ChevronDown className="size-4" />
                            ) : (
                                <ChevronRight className="size-4" />
                            )}
                        </Button>
                    )
                },
                enableSorting: false,
            },
            {
                header: "服务人员",
                cell: ({ row }) => (
                    <div className="space-y-2 text-sm">
                        <div className="font-medium">
                            {row.original.personnelName || "未填写姓名"}
                        </div>
                        <div className="text-muted-foreground">
                            {row.original.phoneNumber || "未绑定手机号"}
                        </div>
                        <QualificationBadges personnel={row.original.personnel} />
                    </div>
                ),
            },
            {
                header: "服务数量",
                cell: ({ row }) => (
                    <div className="text-sm">
                        <span className="font-medium">{row.original.items.length}</span>
                        <span className="text-muted-foreground"> 项</span>
                    </div>
                ),
            },
            {
                header: "状态概览",
                cell: ({ row }) => <StatusSummary items={row.original.items} />,
            },
            {
                header: "最近更新",
                accessorKey: "updatedAt",
                cell: ({ row }) => (
                    <span className="text-sm text-muted-foreground">
                        {formatDateTime(row.original.updatedAt)}
                    </span>
                ),
            },
        ],
        [expandedPersonnelIds],
    )

    const table = useReactTable({
        data: rows,
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

    const visibleColumns = table.getVisibleLeafColumns()
    const colSpan = Math.max(visibleColumns.length, 1)

    return (
        <div className="rounded-2xl border bg-card">
            <Table>
                <TableHeader>
                    {table.getHeaderGroups().map((headerGroup) => (
                        <TableRow key={headerGroup.id}>
                            {headerGroup.headers.map((header) => (
                                <TableHead key={header.id}>
                                    {header.isPlaceholder
                                        ? null
                                        : flexRender(
                                              header.column.columnDef.header,
                                              header.getContext(),
                                          )}
                                </TableHead>
                            ))}
                        </TableRow>
                    ))}
                </TableHeader>
                <TableBody>
                    {table.getRowModel().rows.length ? (
                        table.getRowModel().rows.map((row) => (
                            <Fragment key={row.id}>
                                <TableRow>
                                    {row.getVisibleCells().map((cell) => (
                                        <TableCell key={cell.id}>
                                            {flexRender(
                                                cell.column.columnDef.cell,
                                                cell.getContext(),
                                            )}
                                        </TableCell>
                                    ))}
                                </TableRow>
                                {expandedPersonnelIds.has(
                                    row.original.personnelId,
                                ) ? (
                                    <TableRow className="bg-muted/20 hover:bg-muted/20">
                                        <TableCell colSpan={colSpan} className="p-0">
                                            <ServiceItemsTable
                                                items={row.original.items}
                                                isActionPending={isActionPending}
                                                onApproveDraft={onApproveDraft}
                                                onRejectDraft={onRejectDraft}
                                                onTakeDown={onTakeDown}
                                            />
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </Fragment>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={colSpan}>
                                <div className="py-12 text-center">
                                    <div className="font-medium">
                                        暂无服务发布记录
                                    </div>
                                    <div className="mt-1 text-sm text-muted-foreground">
                                        换个筛选条件试试，或稍后刷新。
                                    </div>
                                </div>
                            </TableCell>
                        </TableRow>
                    )}
                </TableBody>
            </Table>
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

function ServiceItemsTable({
    items,
    isActionPending,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
}: {
    items: AdminServiceOfferingListItem[]
    isActionPending?: boolean
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
}) {
    const [expandedItemIds, setExpandedItemIds] = useState<Set<string>>(
        () => new Set(),
    )

    return (
        <div className="p-4">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead className="w-10" />
                        <TableHead>服务</TableHead>
                        <TableHead>审核状态</TableHead>
                        <TableHead>发布状态</TableHead>
                        <TableHead>时间</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {items.map((item) => {
                        const itemId = getItemId(item)
                        const expanded = expandedItemIds.has(itemId)
                        return (
                            <Fragment key={itemId}>
                                <TableRow>
                                    <TableCell>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="icon"
                                            className="size-8"
                                            onClick={() => {
                                                setExpandedItemIds((current) => {
                                                    const next = new Set(current)
                                                    if (next.has(itemId)) {
                                                        next.delete(itemId)
                                                    } else {
                                                        next.add(itemId)
                                                    }
                                                    return next
                                                })
                                            }}
                                            aria-label={expanded ? "收起规格" : "展开规格"}
                                        >
                                            {expanded ? (
                                                <ChevronDown className="size-4" />
                                            ) : (
                                                <ChevronRight className="size-4" />
                                            )}
                                        </Button>
                                    </TableCell>
                                    <TableCell>
                                        <ServiceTitle item={item} />
                                    </TableCell>
                                    <TableCell>
                                        <ReviewStatusBadge status={item.reviewStatus} />
                                    </TableCell>
                                    <TableCell>
                                        {item.kind === "published" ? (
                                            <PublicationStatusBadge
                                                status={item.publicationStatus}
                                            />
                                        ) : (
                                            <span className="text-sm text-muted-foreground">
                                                待审核后发布
                                            </span>
                                        )}
                                    </TableCell>
                                    <TableCell>
                                        <span className="text-sm text-muted-foreground">
                                            {formatDateTime(item.updatedAt)}
                                        </span>
                                    </TableCell>
                                    <TableCell>
                                        <div className="flex justify-end gap-2">
                                            {item.kind === "draft" &&
                                            item.reviewStatus === "pending" ? (
                                                <>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        disabled={isActionPending}
                                                        onClick={() =>
                                                            onApproveDraft(item)
                                                        }
                                                    >
                                                        审核通过
                                                    </Button>
                                                    <Button
                                                        type="button"
                                                        size="sm"
                                                        variant="outline"
                                                        disabled={isActionPending}
                                                        onClick={() =>
                                                            onRejectDraft(item)
                                                        }
                                                    >
                                                        审核拒绝
                                                    </Button>
                                                </>
                                            ) : null}
                                            {item.kind === "published" &&
                                            item.publicationStatus === "active" ? (
                                                <Button
                                                    type="button"
                                                    size="sm"
                                                    variant="outline"
                                                    disabled={isActionPending}
                                                    onClick={() => onTakeDown(item)}
                                                >
                                                    下架
                                                </Button>
                                            ) : null}
                                            {item.kind === "published" &&
                                            item.publicationStatus ===
                                                "taken_down" ? (
                                                <span className="text-sm text-muted-foreground">
                                                    仅展示下架原因
                                                </span>
                                            ) : null}
                                        </div>
                                    </TableCell>
                                </TableRow>
                                {expanded ? (
                                    <TableRow className="bg-background hover:bg-background">
                                        <TableCell colSpan={6} className="p-0">
                                            <SpecificationsTable item={item} />
                                        </TableCell>
                                    </TableRow>
                                ) : null}
                            </Fragment>
                        )
                    })}
                </TableBody>
            </Table>
        </div>
    )
}

function SpecificationsTable({ item }: { item: AdminServiceOfferingListItem }) {
    const services = getServicesFromItem(item)

    return (
        <div className="space-y-4 border-t bg-background p-4">
            <QualificationPanel personnel={item.personnel} />
            {getReason(item) ? (
                <div className="rounded-md bg-muted p-3 text-sm">
                    <span className="font-medium">{getReasonLabel(item)}：</span>
                    <span className="text-muted-foreground">{getReason(item)}</span>
                </div>
            ) : null}
            {services.length ? (
                services.map((service) => (
                    <div
                        key={service.serviceId}
                        className="space-y-3 rounded-md border bg-card p-3"
                    >
                        <div className="space-y-1">
                            <div className="text-sm font-medium">
                                {service.name || service.serviceId}
                            </div>
                            <div className="text-xs text-muted-foreground">
                                服务描述和宣传图
                            </div>
                        </div>
                        <DescriptionBlock description={service.description} />
                        <GalleryGrid gallery={service.gallery ?? []} />
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>规格</TableHead>
                                    <TableHead>价格</TableHead>
                                    <TableHead>预计耗时</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {service.specifications.length ? (
                                    service.specifications.map((specification) => (
                                        <TableRow key={specification.id}>
                                            <TableCell>
                                                {specification.name || "未命名规格"}
                                            </TableCell>
                                            <TableCell>
                                                {formatPrice(
                                                    specification.price,
                                                    specification.currency,
                                                )}
                                            </TableCell>
                                            <TableCell>
                                                {specification.estimatedDurationMinutes
                                                    ? `${specification.estimatedDurationMinutes} 分钟`
                                                    : "未填写"}
                                            </TableCell>
                                        </TableRow>
                                    ))
                                ) : (
                                    <TableRow>
                                        <TableCell colSpan={3}>
                                            <span className="text-sm text-muted-foreground">
                                                暂无规格
                                            </span>
                                        </TableCell>
                                    </TableRow>
                                )}
                            </TableBody>
                        </Table>
                    </div>
                ))
            ) : (
                <div className="text-sm text-muted-foreground">暂无规格信息</div>
            )}
        </div>
    )
}

function StatusSummary({ items }: { items: AdminServiceOfferingListItem[] }) {
    const pending = items.filter(
        (item) => item.kind === "draft" && item.reviewStatus === "pending",
    ).length
    const active = items.filter(
        (item) => item.kind === "published" && item.publicationStatus === "active",
    ).length
    const takenDown = items.filter(
        (item) =>
            item.kind === "published" && item.publicationStatus === "taken_down",
    ).length

    return (
        <div className="flex flex-wrap gap-2">
            <Badge className="bg-amber-100 text-amber-800">待审核 {pending}</Badge>
            <Badge className="bg-emerald-100 text-emerald-700">
                上架中 {active}
            </Badge>
            <Badge className="bg-slate-100 text-slate-700">
                已下架 {takenDown}
            </Badge>
        </div>
    )
}

function ServiceTitle({ item }: { item: AdminServiceOfferingListItem }) {
    const services = getServicesFromItem(item)

    if (item.kind === "published") {
        const [service] = services
        return (
            <div className="space-y-1 text-sm">
                <div className="font-medium">{item.service.name}</div>
                <div className="text-muted-foreground">
                    {item.service.categoryName || "未分类"}
                </div>
                <ServiceContentSummary
                    description={service?.description}
                    galleryCount={service?.gallery?.length ?? 0}
                />
            </div>
        )
    }

    return (
        <div className="space-y-1 text-sm">
            <div className="font-medium">待审核草稿</div>
            <div className="text-muted-foreground">
                {services.length
                    ? services.map((service) => service.name).join("、")
                    : "暂无服务快照"}
            </div>
            <ServiceContentSummary
                description={services.map((service) => service.description).find(Boolean)}
                galleryCount={services.reduce(
                    (count, service) => count + (service.gallery?.length ?? 0),
                    0,
                )}
            />
        </div>
    )
}

function ServiceContentSummary({
    description,
    galleryCount,
}: {
    description?: string | null
    galleryCount: number
}) {
    if (!description && galleryCount === 0) {
        return (
            <div className="text-xs text-muted-foreground">
                未填写描述，未上传宣传图
            </div>
        )
    }

    return (
        <div className="space-y-1">
            {description ? (
                <p className="line-clamp-2 max-w-xl text-xs leading-5 text-muted-foreground">
                    {description}
                </p>
            ) : (
                <p className="text-xs text-muted-foreground">未填写描述</p>
            )}
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <ImageIcon className="size-3.5" />
                <span>宣传图 {galleryCount} 张</span>
            </div>
        </div>
    )
}

function QualificationBadges({
    personnel,
}: {
    personnel: AdminServiceOfferingListItem["personnel"]
}) {
    return (
        <div className="flex flex-wrap gap-1.5">
            <Badge variant="outline" className="text-xs">
                商家资质{personnel.merchantQualificationFileId ? "已传" : "未传"}
            </Badge>
            <Badge variant="outline" className="text-xs">
                职业资质{personnel.vocationalQualificationFileId ? "已传" : "未传"}
            </Badge>
        </div>
    )
}

function QualificationPanel({
    personnel,
}: {
    personnel: AdminServiceOfferingListItem["personnel"]
}) {
    return (
        <div className="grid gap-3 rounded-md border bg-muted/30 p-3 md:grid-cols-2">
            <QualificationFile
                label="商家资质"
                file={personnel.merchantQualification}
                fileId={personnel.merchantQualificationFileId}
            />
            <QualificationFile
                label="职业资质"
                file={personnel.vocationalQualification}
                fileId={personnel.vocationalQualificationFileId}
            />
        </div>
    )
}

function QualificationFile({
    label,
    file,
    fileId,
}: {
    label: string
    file?: FileAccessInfo | null
    fileId?: string | null
}) {
    return (
        <div className="flex min-w-0 items-center justify-between gap-3 rounded-md bg-background px-3 py-2">
            <div className="flex min-w-0 items-center gap-2">
                <FileCheck2 className="size-4 shrink-0 text-muted-foreground" />
                <div className="min-w-0">
                    <div className="text-sm font-medium">{label}</div>
                    <div className="truncate text-xs text-muted-foreground">
                        {file?.fileName || fileId || "未上传"}
                    </div>
                </div>
            </div>
            {file?.url ? (
                <Button type="button" variant="outline" size="sm" asChild>
                    <a href={file.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" />
                        查看
                    </a>
                </Button>
            ) : null}
        </div>
    )
}

function DescriptionBlock({ description }: { description?: string | null }) {
    const [expanded, setExpanded] = useState(false)

    if (!description?.trim()) {
        return (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-sm text-muted-foreground">
                服务人员未填写服务描述。
            </div>
        )
    }

    const shouldToggle = description.length > 160

    return (
        <div className="rounded-md bg-muted/40 px-3 py-2">
            <p
                className={cn(
                    "whitespace-pre-wrap text-sm leading-6 text-muted-foreground",
                    !expanded && "line-clamp-4",
                )}
            >
                {description}
            </p>
            {shouldToggle ? (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto px-0"
                    onClick={() => setExpanded((current) => !current)}
                >
                    {expanded ? "收起全文" : "展开全文"}
                </Button>
            ) : null}
        </div>
    )
}

function GalleryGrid({ gallery }: { gallery: FileAccessInfo[] }) {
    const [previewFile, setPreviewFile] = useState<FileAccessInfo | null>(null)
    const visibleGallery = gallery.slice(0, 5)

    if (visibleGallery.length === 0) {
        return (
            <div className="flex h-20 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
                暂无宣传图
            </div>
        )
    }

    return (
        <>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
                {visibleGallery.map((file, index) => (
                    <button
                        key={file.fileId}
                        type="button"
                        className="group relative aspect-[4/3] overflow-hidden rounded-md border bg-muted text-left"
                        onClick={() => setPreviewFile(file)}
                    >
                        <img
                            src={file.url}
                            alt={`宣传图 ${index + 1}`}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                        <span className="absolute right-1.5 top-1.5 rounded bg-background/90 p-1 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                            <Maximize2 className="size-3.5" />
                        </span>
                    </button>
                ))}
            </div>
            <Dialog
                open={Boolean(previewFile)}
                onOpenChange={(open) => {
                    if (!open) {
                        setPreviewFile(null)
                    }
                }}
            >
                <DialogContent className="max-w-4xl">
                    <DialogHeader>
                        <DialogTitle>宣传图预览</DialogTitle>
                        <DialogDescription>
                            {previewFile?.fileName || "服务人员上传的宣传图"}
                        </DialogDescription>
                    </DialogHeader>
                    {previewFile ? (
                        <div className="space-y-3">
                            <img
                                src={previewFile.url}
                                alt={previewFile.fileName}
                                className="max-h-[70vh] w-full rounded-md border object-contain"
                            />
                            <Button type="button" variant="outline" size="sm" asChild>
                                <a
                                    href={previewFile.url}
                                    target="_blank"
                                    rel="noreferrer"
                                >
                                    <ExternalLink className="size-3.5" />
                                    新标签页查看原图
                                </a>
                            </Button>
                        </div>
                    ) : null}
                </DialogContent>
            </Dialog>
        </>
    )
}

function ReviewStatusBadge({
    status,
}: {
    status: AdminServiceOfferingListItem["reviewStatus"]
}) {
    return (
        <Badge className={cn("w-fit text-xs", REVIEW_STATUS_BADGE_CLASS[status])}>
            {REVIEW_STATUS_LABELS[status]}
        </Badge>
    )
}

function PublicationStatusBadge({
    status,
}: {
    status: PublishedItem["publicationStatus"]
}) {
    return (
        <Badge
            className={cn("w-fit text-xs", PUBLICATION_STATUS_BADGE_CLASS[status])}
        >
            {PUBLICATION_STATUS_LABELS[status]}
        </Badge>
    )
}

function groupByPersonnel(data: AdminServiceOfferingListItem[]): PersonnelRow[] {
    const map = new Map<string, PersonnelRow>()
    for (const item of data) {
        const existing = map.get(item.personnel.id)
        if (existing) {
            existing.items.push(item)
            if (item.updatedAt > existing.updatedAt) {
                existing.updatedAt = item.updatedAt
            }
            continue
        }

        map.set(item.personnel.id, {
            personnelId: item.personnel.id,
            personnelName: item.personnel.name ?? "",
            phoneNumber: item.personnel.phoneNumber ?? "",
            personnel: item.personnel,
            items: [item],
            updatedAt: item.updatedAt,
        })
    }

    return Array.from(map.values())
}

function getItemId(item: AdminServiceOfferingListItem) {
    return item.kind === "draft"
        ? `draft-${item.draftId}`
        : `published-${item.personnel.id}-${item.service.id}`
}

function getServicesFromItem(item: AdminServiceOfferingListItem) {
    if (item.kind === "published") {
        return [
            {
                serviceId: item.service.id,
                name: item.service.name,
                description: item.service.description,
                gallery: item.service.gallery ?? [],
                specifications: item.specifications,
            },
        ]
    }

    return getServicesFromDraft(item)
}

function getServicesFromDraft(item: DraftItem) {
    const snapshot = item.submittedSnapshot as Partial<ServiceOfferingSubmittedSnapshot>
    return (snapshot.services ?? []).map((service) => ({
        serviceId: service.serviceId,
        name: service.serviceId,
        description: service.description,
        gallery: (service as ServiceSnapshotService).gallery ?? [],
        specifications: service.specifications ?? [],
    }))
}

function getReason(item: AdminServiceOfferingListItem) {
    if (item.kind === "draft") {
        return item.rejectionReason
    }

    return item.takeDownReason
}

function getReasonLabel(item: AdminServiceOfferingListItem) {
    return item.kind === "draft" ? "拒绝原因" : "下架原因"
}

function formatDateTime(value?: string | null) {
    if (!value) {
        return "未记录"
    }

    return new Intl.DateTimeFormat("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    }).format(new Date(value))
}

function formatPrice(price: string, currency = "CNY") {
    const numeric = Number(price)
    if (!Number.isFinite(numeric)) {
        return `${price} ${currency}`
    }

    return new Intl.NumberFormat("zh-CN", {
        style: "currency",
        currency,
    }).format(numeric)
}
