"use client"

import { Fragment, useMemo, useState } from "react"
import type {
    AdminServiceOfferingListItem,
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
import { ChevronDown, ChevronRight, ImageIcon } from "lucide-react"
import { Button } from "@repo/web-ui/components/button"
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
import {
    LIFECYCLE_LABELS,
    ServiceOfferingLifecycleBadge,
} from "./service-offering-lifecycle-badge"

type ServiceOfferingsTableProps = {
    data: AdminServiceOfferingListItem[]
    total: number
    page: number
    limit: number
    groupMode: "flat" | "by-personnel"
    isActionPending?: boolean
    onPaginationChange: (next: { page: number; limit: number }) => void
    onOpenDetail: (item: AdminServiceOfferingListItem) => void
    onApproveDraft: (
        draft: Extract<AdminServiceOfferingListItem, { kind: "draft" }>,
    ) => void
    onRejectDraft: (
        draft: Extract<AdminServiceOfferingListItem, { kind: "draft" }>,
    ) => void
    onTakeDown: (
        offering: Extract<AdminServiceOfferingListItem, { kind: "published" }>,
    ) => void
    onApproveAppeal: (
        offering: Extract<AdminServiceOfferingListItem, { kind: "published" }>,
    ) => void
    onRejectAppeal: (
        offering: Extract<AdminServiceOfferingListItem, { kind: "published" }>,
    ) => void
}

type DraftItem = Extract<AdminServiceOfferingListItem, { kind: "draft" }>
type PublishedItem = Extract<AdminServiceOfferingListItem, { kind: "published" }>

export function ServiceOfferingsTable(props: ServiceOfferingsTableProps) {
    if (props.groupMode === "by-personnel") {
        return <PersonnelGroupedTable {...props} />
    }
    return <FlatTable {...props} />
}

function FlatTable({
    data,
    total,
    page,
    limit,
    isActionPending,
    onPaginationChange,
    onOpenDetail,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
}: ServiceOfferingsTableProps) {
    const columns = useMemo<ColumnDef<AdminServiceOfferingListItem>[]>(
        () => [
            {
                header: "服务人员",
                cell: ({ row }) => (
                    <div className="space-y-0.5 text-sm">
                        <div className="font-medium">
                            {row.original.personnel.name || "未填写姓名"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {row.original.personnel.phoneNumber || "未绑定"}
                        </div>
                    </div>
                ),
            },
            {
                header: "服务",
                cell: ({ row }) => <ServiceCell item={row.original} />,
            },
            {
                header: "状态",
                cell: ({ row }) => (
                    <ServiceOfferingLifecycleBadge
                        lifecycle={row.original.lifecycle}
                    />
                ),
            },
            {
                header: "更新时间",
                accessorKey: "updatedAt",
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">
                        {formatDateTime(row.original.updatedAt)}
                    </span>
                ),
            },
            {
                id: "actions",
                header: () => <div className="text-right">操作</div>,
                cell: ({ row }) => (
                    <div className="flex justify-end gap-2">
                        <ActionButtons
                            item={row.original}
                            isActionPending={isActionPending}
                            onApproveDraft={onApproveDraft}
                            onRejectDraft={onRejectDraft}
                            onTakeDown={onTakeDown}
                            onApproveAppeal={onApproveAppeal}
                            onRejectAppeal={onRejectAppeal}
                            onOpenDetail={onOpenDetail}
                        />
                    </div>
                ),
            },
        ],
        [
            isActionPending,
            onApproveDraft,
            onRejectDraft,
            onTakeDown,
            onApproveAppeal,
            onRejectAppeal,
            onOpenDetail,
        ],
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
                            <TableRow
                                key={row.id}
                                className="cursor-pointer hover:bg-muted/40"
                                onClick={() => onOpenDetail(row.original)}
                            >
                                {row.getVisibleCells().map((cell) => (
                                    <TableCell
                                        key={cell.id}
                                        onClick={(event) => {
                                            if (cell.column.id === "actions") {
                                                event.stopPropagation()
                                            }
                                        }}
                                    >
                                        {flexRender(
                                            cell.column.columnDef.cell,
                                            cell.getContext(),
                                        )}
                                    </TableCell>
                                ))}
                            </TableRow>
                        ))
                    ) : (
                        <TableRow>
                            <TableCell colSpan={colSpan}>
                                <EmptyState />
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
                    const maxPage = Math.max(
                        Math.ceil(total / Math.max(size, 1)),
                        1,
                    )
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

type PersonnelRow = {
    personnelId: string
    personnelName: string
    phoneNumber: string
    items: AdminServiceOfferingListItem[]
    updatedAt: string
}

function PersonnelGroupedTable({
    data,
    total,
    page,
    limit,
    isActionPending,
    onPaginationChange,
    onOpenDetail,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
}: ServiceOfferingsTableProps) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
    const rows = useMemo(() => groupByPersonnel(data), [data])

    const columns = useMemo<ColumnDef<PersonnelRow>[]>(
        () => [
            {
                id: "expand",
                header: "",
                cell: ({ row }) => {
                    const isOpen = expanded.has(row.original.personnelId)
                    return (
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="size-7"
                        >
                            {isOpen ? (
                                <ChevronDown className="size-4" />
                            ) : (
                                <ChevronRight className="size-4" />
                            )}
                        </Button>
                    )
                },
            },
            {
                header: "服务人员",
                cell: ({ row }) => (
                    <div className="space-y-0.5 text-sm">
                        <div className="font-medium">
                            {row.original.personnelName || "未填写姓名"}
                        </div>
                        <div className="text-xs text-muted-foreground">
                            {row.original.phoneNumber || "未绑定"}
                        </div>
                    </div>
                ),
            },
            {
                header: "服务数量",
                cell: ({ row }) => (
                    <span className="text-sm">
                        <span className="font-medium">
                            {row.original.items.length}
                        </span>
                        <span className="text-muted-foreground"> 项</span>
                    </span>
                ),
            },
            {
                header: "状态分布",
                cell: ({ row }) => (
                    <LifecycleSummary items={row.original.items} />
                ),
            },
            {
                header: "最近更新",
                cell: ({ row }) => (
                    <span className="text-xs text-muted-foreground">
                        {formatDateTime(row.original.updatedAt)}
                    </span>
                ),
            },
        ],
        [expanded],
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

    const toggle = (id: string) => {
        setExpanded((current) => {
            const next = new Set(current)
            if (next.has(id)) {
                next.delete(id)
            } else {
                next.add(id)
            }
            return next
        })
    }

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
                        table.getRowModel().rows.map((row) => {
                            const isOpen = expanded.has(
                                row.original.personnelId,
                            )
                            return (
                                <Fragment key={row.id}>
                                    <TableRow
                                        className="cursor-pointer hover:bg-muted/40"
                                        onClick={() =>
                                            toggle(row.original.personnelId)
                                        }
                                    >
                                        {row.getVisibleCells().map((cell) => (
                                            <TableCell key={cell.id}>
                                                {flexRender(
                                                    cell.column.columnDef.cell,
                                                    cell.getContext(),
                                                )}
                                            </TableCell>
                                        ))}
                                    </TableRow>
                                    {isOpen ? (
                                        <TableRow className="bg-muted/20 hover:bg-muted/20">
                                            <TableCell
                                                colSpan={colSpan}
                                                className="p-0"
                                            >
                                                <PersonnelItemsList
                                                    items={row.original.items}
                                                    isActionPending={
                                                        isActionPending
                                                    }
                                                    onOpenDetail={onOpenDetail}
                                                    onApproveDraft={
                                                        onApproveDraft
                                                    }
                                                    onRejectDraft={
                                                        onRejectDraft
                                                    }
                                                    onTakeDown={onTakeDown}
                                                    onApproveAppeal={
                                                        onApproveAppeal
                                                    }
                                                    onRejectAppeal={
                                                        onRejectAppeal
                                                    }
                                                />
                                            </TableCell>
                                        </TableRow>
                                    ) : null}
                                </Fragment>
                            )
                        })
                    ) : (
                        <TableRow>
                            <TableCell colSpan={colSpan}>
                                <EmptyState />
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
                    const maxPage = Math.max(
                        Math.ceil(total / Math.max(size, 1)),
                        1,
                    )
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

function PersonnelItemsList({
    items,
    isActionPending,
    onOpenDetail,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
}: {
    items: AdminServiceOfferingListItem[]
    isActionPending?: boolean
    onOpenDetail: (item: AdminServiceOfferingListItem) => void
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onApproveAppeal: (offering: PublishedItem) => void
    onRejectAppeal: (offering: PublishedItem) => void
}) {
    return (
        <div className="divide-y">
            {items.map((item) => (
                <div
                    key={getItemId(item)}
                    className="flex w-full items-center justify-between gap-4 px-6 py-3 text-left hover:bg-muted/40"
                >
                    <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-4 text-left"
                        onClick={() => onOpenDetail(item)}
                    >
                        <div className="min-w-0 flex-1 space-y-1">
                            <ServiceCell item={item} />
                        </div>
                        <ServiceOfferingLifecycleBadge
                            lifecycle={item.lifecycle}
                        />
                        <span className="w-32 shrink-0 text-xs text-muted-foreground">
                            {formatDateTime(item.updatedAt)}
                        </span>
                    </button>
                    <div className="flex shrink-0 gap-2">
                        <ActionButtons
                            item={item}
                            isActionPending={isActionPending}
                            onApproveDraft={onApproveDraft}
                            onRejectDraft={onRejectDraft}
                            onTakeDown={onTakeDown}
                            onApproveAppeal={onApproveAppeal}
                            onRejectAppeal={onRejectAppeal}
                            onOpenDetail={onOpenDetail}
                        />
                    </div>
                </div>
            ))}
        </div>
    )
}

function ServiceCell({ item }: { item: AdminServiceOfferingListItem }) {
    const services = getServicesFromItem(item)
    const galleryCount = services.reduce(
        (count, service) => count + (service.gallery?.length ?? 0),
        0,
    )
    const description = services
        .map((service) => service.description?.trim())
        .find((value): value is string => Boolean(value))
    const primaryService = services[0]

    return (
        <div className="min-w-0 space-y-0.5">
            <div className="flex items-center gap-2 text-sm font-medium">
                <span className="truncate">
                    {primaryService?.name || "未提供服务名称"}
                </span>
                {primaryService?.categoryName ? (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        {primaryService.categoryName}
                    </span>
                ) : null}
            </div>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {description ? (
                    <span className="line-clamp-1 max-w-md">{description}</span>
                ) : (
                    <span className="italic">未填写描述</span>
                )}
                {galleryCount > 0 ? (
                    <span className="flex shrink-0 items-center gap-1">
                        <ImageIcon className="size-3" />
                        {galleryCount}
                    </span>
                ) : null}
            </div>
            {item.kind === "published" &&
            item.appeal?.status === "pending" ? (
                <div className="mt-2 line-clamp-2 rounded-md bg-sky-50 px-2 py-1.5 text-xs text-sky-800">
                    申诉说明：{item.appeal.appealReason}
                </div>
            ) : null}
        </div>
    )
}

function ActionButtons({
    item,
    isActionPending,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
    onOpenDetail,
}: {
    item: AdminServiceOfferingListItem
    isActionPending?: boolean
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onApproveAppeal: (offering: PublishedItem) => void
    onRejectAppeal: (offering: PublishedItem) => void
    onOpenDetail: (item: AdminServiceOfferingListItem) => void
}) {
    if (item.kind === "draft" && item.reviewStatus === "pending") {
        return (
            <>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isActionPending}
                    onClick={(event) => {
                        event.stopPropagation()
                        onRejectDraft(item)
                    }}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    拒绝
                </Button>
                <Button
                    type="button"
                    size="sm"
                    disabled={isActionPending}
                    onClick={(event) => {
                        event.stopPropagation()
                        onApproveDraft(item)
                    }}
                >
                    通过
                </Button>
            </>
        )
    }
    if (
        item.kind === "published" &&
        item.appeal?.status === "pending"
    ) {
        return (
            <>
                <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={isActionPending}
                    onClick={(event) => {
                        event.stopPropagation()
                        onRejectAppeal(item)
                    }}
                    className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                >
                    驳回申诉
                </Button>
                <Button
                    type="button"
                    size="sm"
                    disabled={isActionPending}
                    onClick={(event) => {
                        event.stopPropagation()
                        onApproveAppeal(item)
                    }}
                >
                    通过申诉
                </Button>
            </>
        )
    }
    if (item.kind === "published" && item.publicationStatus === "active") {
        return (
            <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isActionPending}
                onClick={(event) => {
                    event.stopPropagation()
                    onTakeDown(item)
                }}
                className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
            >
                下架
            </Button>
        )
    }
    return (
        <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={(event) => {
                event.stopPropagation()
                onOpenDetail(item)
            }}
        >
            查看
        </Button>
    )
}

function LifecycleSummary({
    items,
}: {
    items: AdminServiceOfferingListItem[]
}) {
    const counts = items.reduce<Record<string, number>>((acc, item) => {
        acc[item.lifecycle] = (acc[item.lifecycle] ?? 0) + 1
        return acc
    }, {})

    const order = [
        "pending_review",
        "rejected",
        "active",
        "appeal_pending",
        "taken_down",
    ] as const
    const visible = order.filter((key) => counts[key])

    if (visible.length === 0) {
        return <span className="text-xs text-muted-foreground">—</span>
    }

    return (
        <div className="flex flex-wrap gap-1.5">
            {visible.map((key) => (
                <span
                    key={key}
                    className={cn(
                        "rounded px-1.5 py-0.5 text-[11px] font-medium",
                        BADGE_STYLES[key],
                    )}
                >
                    {LIFECYCLE_LABELS[key]} {counts[key]}
                </span>
            ))}
        </div>
    )
}

const BADGE_STYLES = {
    pending_review: "bg-amber-100 text-amber-800",
    rejected: "bg-rose-100 text-rose-700",
    active: "bg-emerald-100 text-emerald-700",
    appeal_pending: "bg-sky-100 text-sky-800",
    taken_down: "bg-slate-200 text-slate-700",
} as const

function EmptyState() {
    return (
        <div className="py-16 text-center">
            <div className="font-medium">暂无服务发布记录</div>
            <div className="mt-1 text-sm text-muted-foreground">
                换个筛选条件试试，或稍后刷新。
            </div>
        </div>
    )
}

function getItemId(item: AdminServiceOfferingListItem) {
    return item.kind === "draft"
        ? `draft-${item.draftId}`
        : `published-${item.personnel.id}-${item.service.id}`
}

function groupByPersonnel(
    data: AdminServiceOfferingListItem[],
): PersonnelRow[] {
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
            items: [item],
            updatedAt: item.updatedAt,
        })
    }
    return Array.from(map.values())
}

function getServicesFromItem(item: AdminServiceOfferingListItem) {
    if (item.kind === "published") {
        return [
            {
                serviceId: item.service.id,
                name: item.service.name,
                categoryName: item.service.categoryName,
                description: item.service.description,
                gallery: item.service.gallery ?? [],
            },
        ]
    }

    const snapshot = item.submittedSnapshot as Omit<
        Partial<ServiceOfferingSubmittedSnapshot>,
        "services"
    > & {
        services?: Array<
            ServiceOfferingSubmittedSnapshot["services"][number] & {
                serviceName?: string | null
                categoryName?: string | null
                gallery?: import("@repo/types").FileAccessInfo[]
            }
        >
    }
    return (snapshot.services ?? []).map((service) => ({
        serviceId: service.serviceId,
        name: service.serviceName ?? "",
        categoryName: service.categoryName ?? null,
        description: service.description,
        gallery: service.gallery ?? [],
    }))
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
