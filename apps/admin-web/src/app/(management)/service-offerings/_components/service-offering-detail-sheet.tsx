"use client"

import { useState } from "react"
import type {
    AdminServiceOfferingListItem,
    AdminServiceOfferingPersonnelSummary,
    AdminServiceOfferingSpecification,
    FileAccessInfo,
    ServiceOfferingSubmittedSnapshot,
} from "@repo/types"
import { AlertCircle, ExternalLink, FileCheck2, Maximize2 } from "lucide-react"
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
    Sheet,
    SheetContent,
    SheetDescription,
    SheetFooter,
    SheetHeader,
    SheetTitle,
} from "@repo/web-ui/components/sheet"
import { ScrollArea } from "@repo/web-ui/components/scroll-area"
import { Separator } from "@repo/web-ui/components/separator"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/web-ui/components/table"
import { cn } from "@repo/web-ui/lib/utils"
import { ServiceOfferingLifecycleBadge } from "./service-offering-lifecycle-badge"

type DraftItem = Extract<AdminServiceOfferingListItem, { kind: "draft" }>
type PublishedItem = Extract<AdminServiceOfferingListItem, { kind: "published" }>

type ServiceOfferingDetailSheetProps = {
    item: AdminServiceOfferingListItem | null
    open: boolean
    isActionPending?: boolean
    onOpenChange: (open: boolean) => void
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onApproveAppeal: (offering: PublishedItem) => void
    onRejectAppeal: (offering: PublishedItem) => void
}

export function ServiceOfferingDetailSheet({
    item,
    open,
    isActionPending,
    onOpenChange,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
}: ServiceOfferingDetailSheetProps) {
    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent className="w-full sm:max-w-2xl">
                {item ? (
                    <DetailContent
                        item={item}
                        isActionPending={isActionPending}
                        onApproveDraft={onApproveDraft}
                        onRejectDraft={onRejectDraft}
                        onTakeDown={onTakeDown}
                        onApproveAppeal={onApproveAppeal}
                        onRejectAppeal={onRejectAppeal}
                    />
                ) : null}
            </SheetContent>
        </Sheet>
    )
}

function DetailContent({
    item,
    isActionPending,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
}: {
    item: AdminServiceOfferingListItem
    isActionPending?: boolean
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onApproveAppeal: (offering: PublishedItem) => void
    onRejectAppeal: (offering: PublishedItem) => void
}) {
    const services = getServicesFromItem(item)
    const reason = getReason(item)
    const reasonLabel = getReasonLabel(item)
    const qualificationStatus = computeQualificationStatus(item, services)

    return (
        <>
            <SheetHeader className="border-b">
                <div className="flex items-start justify-between gap-3 pr-8">
                    <div className="space-y-1">
                        <SheetTitle className="text-base">
                            {item.personnel.name || "未填写姓名"}
                        </SheetTitle>
                        <SheetDescription className="text-xs">
                            {item.personnel.phoneNumber || "未绑定手机号"}
                            {" · "}
                            {formatDateTime(item.updatedAt)}
                        </SheetDescription>
                    </div>
                    <ServiceOfferingLifecycleBadge lifecycle={item.lifecycle} />
                </div>
            </SheetHeader>

            <ScrollArea className="flex-1 min-h-0">
                <div className="space-y-5 px-5 py-4 text-sm">
                    {qualificationStatus.requiresQualification &&
                    !qualificationStatus.hasQualification ? (
                        <div className="flex gap-2 rounded-md border border-rose-200 bg-rose-50 p-3 text-rose-800">
                            <AlertCircle className="mt-0.5 size-4 shrink-0" />
                            <div className="space-y-1">
                                <div className="text-sm font-medium">
                                    缺少资质
                                </div>
                                <div className="text-xs">
                                    上门按摩服务需要商家资质或职业资质二选一，建议拒绝或要求补交。
                                </div>
                            </div>
                        </div>
                    ) : null}

                    {reason ? (
                        <div className="rounded-md border bg-muted/40 p-3">
                            <div className="text-xs font-medium text-muted-foreground">
                                {reasonLabel}
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                {reason}
                            </p>
                        </div>
                    ) : null}

                    {item.kind === "published" &&
                    item.appeal?.status === "pending" ? (
                        <div className="rounded-md border border-sky-100 bg-sky-50 p-3 text-sky-900">
                            <div className="text-xs font-medium text-sky-700">
                                申诉说明
                            </div>
                            <p className="mt-1 whitespace-pre-wrap text-sm leading-6">
                                {item.appeal.appealReason}
                            </p>
                        </div>
                    ) : null}

                    {services.length > 0 ? (
                        services.map((service, index) => (
                            <ServiceSection
                                key={service.serviceId || index}
                                service={service}
                            />
                        ))
                    ) : (
                        <div className="rounded-md border bg-muted/30 p-4 text-center text-muted-foreground">
                            暂无服务信息
                        </div>
                    )}

                    {qualificationStatus.requiresQualification ? (
                        <QualificationPanel personnel={item.personnel} />
                    ) : null}
                </div>
            </ScrollArea>

            <Separator />
            <SheetFooter className="flex-row justify-end gap-2">
                {item.kind === "draft" && item.reviewStatus === "pending" ? (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isActionPending}
                            onClick={() => onRejectDraft(item)}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            审核拒绝
                        </Button>
                        <Button
                            type="button"
                            disabled={isActionPending}
                            onClick={() => onApproveDraft(item)}
                        >
                            审核通过
                        </Button>
                    </>
                ) : null}
                {item.kind === "published" &&
                item.appeal?.status === "pending" ? (
                    <>
                        <Button
                            type="button"
                            variant="outline"
                            disabled={isActionPending}
                            onClick={() => onRejectAppeal(item)}
                            className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        >
                            驳回申诉
                        </Button>
                        <Button
                            type="button"
                            disabled={isActionPending}
                            onClick={() => onApproveAppeal(item)}
                        >
                            通过申诉
                        </Button>
                    </>
                ) : null}
                {item.kind === "published" &&
                item.publicationStatus === "active" ? (
                    <Button
                        type="button"
                        variant="outline"
                        disabled={isActionPending}
                        onClick={() => onTakeDown(item)}
                        className="border-destructive/40 text-destructive hover:bg-destructive/10 hover:text-destructive"
                    >
                        下架
                    </Button>
                ) : null}
            </SheetFooter>
        </>
    )
}

function ServiceSection({ service }: { service: NormalizedService }) {
    return (
        <section className="space-y-3 rounded-md border p-4">
            <div className="space-y-0.5">
                <div className="flex items-center gap-2 text-sm font-medium">
                    {service.name || "未命名服务"}
                    {service.categoryName ? (
                        <Badge variant="secondary" className="font-normal">
                            {service.categoryName}
                        </Badge>
                    ) : null}
                </div>
                {service.serviceId ? (
                    <div className="font-mono text-[11px] text-muted-foreground">
                        {service.serviceId}
                    </div>
                ) : null}
            </div>

            <DescriptionBlock description={service.description} />
            <GalleryGrid gallery={service.gallery ?? []} />
            <SpecificationsBlock specifications={service.specifications} />
        </section>
    )
}

function DescriptionBlock({ description }: { description?: string | null }) {
    const [expanded, setExpanded] = useState(false)

    if (!description?.trim()) {
        return (
            <div className="rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                未填写服务描述
            </div>
        )
    }

    const shouldToggle = description.length > 160

    return (
        <div className="rounded-md bg-muted/40 px-3 py-2">
            <p
                className={cn(
                    "whitespace-pre-wrap text-sm leading-6",
                    !expanded && shouldToggle && "line-clamp-4",
                )}
            >
                {description}
            </p>
            {shouldToggle ? (
                <Button
                    type="button"
                    variant="link"
                    size="sm"
                    className="mt-1 h-auto px-0 text-xs"
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

    if (gallery.length === 0) {
        return null
    }

    return (
        <>
            <div className="flex flex-wrap gap-2">
                {gallery.map((file, index) => (
                    <button
                        key={file.fileId}
                        type="button"
                        className="group relative size-24 overflow-hidden rounded-md border bg-muted text-left"
                        onClick={() => setPreviewFile(file)}
                    >
                        <img
                            src={file.url}
                            alt={`宣传图 ${index + 1}`}
                            className="size-full object-cover transition-transform group-hover:scale-105"
                        />
                        <span className="absolute right-1 top-1 rounded bg-background/80 p-0.5 opacity-0 shadow-sm transition-opacity group-hover:opacity-100">
                            <Maximize2 className="size-3" />
                        </span>
                    </button>
                ))}
            </div>
            <Dialog
                open={Boolean(previewFile)}
                onOpenChange={(next) => {
                    if (!next) {
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
                            <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                asChild
                            >
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

function SpecificationsBlock({
    specifications,
}: {
    specifications: AdminServiceOfferingSpecification[]
}) {
    const validSpecs = specifications.filter((spec) => spec.isActive !== false)

    if (validSpecs.length === 0) {
        return (
            <div className="rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                暂无规格
            </div>
        )
    }

    return (
        <div className="overflow-hidden rounded-md border">
            <Table>
                <TableHeader>
                    <TableRow>
                        <TableHead>规格</TableHead>
                        <TableHead>价格</TableHead>
                        <TableHead>预计耗时</TableHead>
                    </TableRow>
                </TableHeader>
                <TableBody>
                    {validSpecs.map((spec) => (
                        <TableRow key={spec.id}>
                            <TableCell>
                                {spec.name || "未命名规格"}
                            </TableCell>
                            <TableCell>
                                {formatPrice(spec.price, spec.currency)}
                            </TableCell>
                            <TableCell>
                                {spec.estimatedDurationMinutes
                                    ? `${spec.estimatedDurationMinutes} 分钟`
                                    : "未填写"}
                            </TableCell>
                        </TableRow>
                    ))}
                </TableBody>
            </Table>
        </div>
    )
}

function QualificationPanel({
    personnel,
}: {
    personnel: AdminServiceOfferingPersonnelSummary
}) {
    return (
        <section className="space-y-2 rounded-md border bg-muted/20 p-3">
            <div className="text-sm font-medium">上门按摩资质</div>
            <p className="text-xs text-muted-foreground">
                商家资质或职业资质二选一上传。
            </p>
            <div className="grid gap-2 md:grid-cols-2">
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
        </section>
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
        <div className="flex min-w-0 items-center justify-between gap-2 rounded-md bg-background px-2 py-1.5">
            <div className="flex min-w-0 items-center gap-2">
                {file?.url ? (
                    <img
                        src={file.url}
                        alt={label}
                        className="size-10 shrink-0 rounded border object-cover"
                    />
                ) : (
                    <div className="flex size-10 shrink-0 items-center justify-center rounded border bg-muted">
                        <FileCheck2 className="size-4 text-muted-foreground" />
                    </div>
                )}
                <div className="min-w-0">
                    <div className="text-xs font-medium">{label}</div>
                    <div className="truncate text-[11px] text-muted-foreground">
                        {file?.fileName || (fileId ? "已上传" : "未上传")}
                    </div>
                </div>
            </div>
            {file?.url ? (
                <Button type="button" variant="ghost" size="sm" asChild>
                    <a href={file.url} target="_blank" rel="noreferrer">
                        <ExternalLink className="size-3.5" />
                    </a>
                </Button>
            ) : null}
        </div>
    )
}

type NormalizedService = {
    serviceId: string
    name: string
    categoryName: string | null
    description: string | null | undefined
    gallery: FileAccessInfo[]
    specifications: AdminServiceOfferingSpecification[]
}

function getServicesFromItem(
    item: AdminServiceOfferingListItem,
): NormalizedService[] {
    if (item.kind === "published") {
        return [
            {
                serviceId: item.service.id,
                name: item.service.name,
                categoryName: item.service.categoryName ?? null,
                description: item.service.description,
                gallery: item.service.gallery ?? [],
                specifications: item.specifications,
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
                gallery?: FileAccessInfo[]
            }
        >
    }

    return (snapshot.services ?? []).map((service) => ({
        serviceId: service.serviceId,
        name: service.serviceName ?? "",
        categoryName: service.categoryName ?? null,
        description: service.description,
        gallery: service.gallery ?? [],
        specifications: (service.specifications ?? []) as AdminServiceOfferingSpecification[],
    }))
}

function getReason(item: AdminServiceOfferingListItem) {
    if (item.kind === "draft") {
        return item.rejectionReason ?? null
    }
    return item.takeDownReason ?? null
}

function getReasonLabel(item: AdminServiceOfferingListItem) {
    return item.kind === "draft" ? "拒绝原因" : "下架原因"
}

function computeQualificationStatus(
    item: AdminServiceOfferingListItem,
    services: NormalizedService[],
) {
    const requiresQualification = services.some(
        (service) => service.categoryName?.includes("按摩") ?? false,
    )
    const hasQualification = Boolean(
        item.personnel.merchantQualificationFileId ||
            item.personnel.vocationalQualificationFileId ||
            item.personnel.merchantQualification ||
            item.personnel.vocationalQualification,
    )
    return { requiresQualification, hasQualification }
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
