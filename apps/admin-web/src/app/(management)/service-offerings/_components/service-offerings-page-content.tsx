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
import { RefreshCcw } from "lucide-react"
import type { AdminServiceOfferingListItem, PaginatedData } from "@repo/types"
import {
    useAdminServiceOfferings,
    useApproveAdminServiceOfferingDraft,
    useRejectAdminServiceOfferingDraft,
    useTakeDownAdminServiceOffering,
} from "@repo/hooks/api/ssr"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import { toast } from "sonner"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import type { ServiceOfferingsQueryState } from "../_utils/query"
import {
    buildServiceOfferingsSearchParams,
    normalizeServiceOfferingsQuery,
    toAdminServiceOfferingsQueryInput,
} from "../_utils/query"
import { ServiceOfferingReasonDialog } from "./service-offering-reason-dialog"
import {
    ServiceOfferingsFilterBar,
    type ServiceOfferingsFilterValues,
} from "./service-offerings-filter-bar"
import { ServiceOfferingsTable } from "./service-offerings-table"
import { ServiceOfferingsTableSkeleton } from "./service-offerings-table-skeleton"

type ServiceOfferingsPageContentProps = {
    initialQuery: ServiceOfferingsQueryState
}

type ServiceOfferingsListResponse = PaginatedData<AdminServiceOfferingListItem>
type DraftItem = Extract<AdminServiceOfferingListItem, { kind: "draft" }>
type PublishedItem = Extract<AdminServiceOfferingListItem, { kind: "published" }>

type ReasonDialogState =
    | { type: "reject"; draft: DraftItem }
    | { type: "takeDown"; offering: PublishedItem }
    | null

export function ServiceOfferingsPageContent({
    initialQuery,
}: ServiceOfferingsPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<ServiceOfferingsQueryState>(() =>
        normalizeServiceOfferingsQuery(initialQuery),
    )
    const [tableSnapshot, setTableSnapshot] =
        useState<ServiceOfferingsListResponse | null>(null)
    const [isTableFetching, setIsTableFetching] = useState(false)
    const [reasonDialog, setReasonDialog] = useState<ReasonDialogState>(null)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(
        () => toAdminServiceOfferingsQueryInput(queryState),
        [queryState],
    )
    const approveMutation = useApproveAdminServiceOfferingDraft(requestQuery)
    const rejectMutation = useRejectAdminServiceOfferingDraft(requestQuery)
    const takeDownMutation = useTakeDownAdminServiceOffering(requestQuery)
    const isActionPending =
        approveMutation.isPending ||
        rejectMutation.isPending ||
        takeDownMutation.isPending

    useEffect(() => {
        const search = buildServiceOfferingsSearchParams(queryState)
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

    const currentItems = tableSnapshot?.items ?? []
    const totalItems = tableSnapshot?.meta.total ?? 0
    const pendingCount = currentItems.filter(
        (item) => item.kind === "draft" && item.reviewStatus === "pending",
    ).length
    const activeCount = currentItems.filter(
        (item) => item.kind === "published" && item.publicationStatus === "active",
    ).length
    const takenDownCount = currentItems.filter(
        (item) =>
            item.kind === "published" && item.publicationStatus === "taken_down",
    ).length

    const filterDefaults = useMemo<ServiceOfferingsFilterValues>(
        () => ({
            keyword: queryState.keyword,
            status: queryState.status,
            reviewStatus: queryState.reviewStatus,
            publicationStatus: queryState.publicationStatus,
        }),
        [queryState],
    )

    const handleDataChange = useCallback((data: ServiceOfferingsListResponse) => {
        setTableSnapshot(data)
    }, [])

    const handleFetchingChange = useCallback((next: boolean) => {
        setIsTableFetching(next)
    }, [])

    const handleRegisterRefetch = useCallback(
        (fn: (() => Promise<unknown> | void) | null) => {
            refetchRef.current = fn
        },
        [],
    )

    const handleApplyFilters = useCallback(
        (values: ServiceOfferingsFilterValues) => {
            setQueryState((current) =>
                normalizeServiceOfferingsQuery({
                    ...current,
                    page: 1,
                    keyword: values.keyword,
                    status: values.status as ServiceOfferingsQueryState["status"],
                    reviewStatus:
                        values.reviewStatus as ServiceOfferingsQueryState["reviewStatus"],
                    publicationStatus:
                        values.publicationStatus as ServiceOfferingsQueryState["publicationStatus"],
                }),
            )
        },
        [],
    )

    const handleResetFilters = useCallback(() => {
        setQueryState((current) =>
            normalizeServiceOfferingsQuery({
                page: 1,
                limit: current.limit,
            }),
        )
    }, [])

    const handlePaginationChange = useCallback(
        (next: { page: number; limit: number }) => {
            setQueryState((current) =>
                normalizeServiceOfferingsQuery({
                    ...current,
                    ...next,
                }),
            )
        },
        [],
    )

    const handleApproveDraft = useCallback(
        async (draft: DraftItem) => {
            await approveMutation.mutateAsync(draft.draftId)
            toast.success("服务发布草稿已通过")
        },
        [approveMutation],
    )

    const handleConfirmReason = useCallback(
        async (reason: string) => {
            if (!reasonDialog) {
                return
            }

            if (reasonDialog.type === "reject") {
                await rejectMutation.mutateAsync({
                    draftId: reasonDialog.draft.draftId,
                    reason,
                })
                toast.success("服务发布草稿已拒绝")
                setReasonDialog(null)
                return
            }

            await takeDownMutation.mutateAsync({
                personnelId: reasonDialog.offering.personnel.id,
                serviceId: reasonDialog.offering.service.id,
                reason,
            })
            toast.success("服务已下架")
            setReasonDialog(null)
        },
        [reasonDialog, rejectMutation, takeDownMutation],
    )

    return (
        <div className="space-y-6">
            <PageHeader
                title="服务发布管理"
                description="审核服务人员提交的服务草稿，处理已发布服务下架。"
            >
                <PageHeaderToolbar>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isTableFetching || isNavigating}
                        onClick={() => {
                            void refetchRef.current?.()
                        }}
                    >
                        <RefreshCcw
                            className={cn(
                                "mr-2 size-4",
                                isTableFetching ? "animate-spin" : undefined,
                            )}
                        />
                        刷新
                    </Button>
                </PageHeaderToolbar>
            </PageHeader>

            <ServiceOfferingsFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <div className="grid gap-3 md:grid-cols-4">
                <SummaryTile label="当前页记录" value={currentItems.length} />
                <SummaryTile label="待审核" value={pendingCount} />
                <SummaryTile label="上架中" value={activeCount} />
                <SummaryTile label="已下架" value={takenDownCount} />
            </div>

            <Suspense fallback={<ServiceOfferingsTableSkeleton />}>
                <ServiceOfferingsTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    isActionPending={isActionPending}
                    onPaginationChange={handlePaginationChange}
                    onApproveDraft={(draft) => {
                        void handleApproveDraft(draft)
                    }}
                    onRejectDraft={(draft) =>
                        setReasonDialog({
                            type: "reject",
                            draft,
                        })
                    }
                    onTakeDown={(offering) =>
                        setReasonDialog({
                            type: "takeDown",
                            offering,
                        })
                    }
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <ServiceOfferingReasonDialog
                open={reasonDialog !== null}
                title={reasonDialog?.type === "takeDown" ? "下架服务" : "拒绝审核"}
                description={
                    reasonDialog?.type === "takeDown"
                        ? "下架原因会发送给服务人员，并在相关页面展示。"
                        : "拒绝原因会发送给服务人员，用于修改后重新提交。"
                }
                confirmLabel={reasonDialog?.type === "takeDown" ? "确认下架" : "确认拒绝"}
                isPending={rejectMutation.isPending || takeDownMutation.isPending}
                onOpenChange={(open) => {
                    if (!open) {
                        setReasonDialog(null)
                    }
                }}
                onConfirm={handleConfirmReason}
            />
        </div>
    )
}

type ServiceOfferingsTableContentProps = {
    query: ReturnType<typeof toAdminServiceOfferingsQueryInput>
    page: number
    limit: number
    isActionPending?: boolean
    onPaginationChange: (next: { page: number; limit: number }) => void
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onDataChange: (data: ServiceOfferingsListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function ServiceOfferingsTableContent({
    query,
    page,
    limit,
    isActionPending,
    onPaginationChange,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: ServiceOfferingsTableContentProps) {
    const { data, refetch, isFetching } = useAdminServiceOfferings(query)

    useEffect(() => {
        onDataChange(data)
    }, [data, onDataChange])

    useEffect(() => {
        onFetchingChange(isFetching)
    }, [isFetching, onFetchingChange])

    useEffect(() => {
        const refresh = () => {
            void refetch()
        }

        onRegisterRefetch(refresh)

        return () => {
            onRegisterRefetch(null)
        }
    }, [onRegisterRefetch, refetch])

    return (
        <ServiceOfferingsTable
            data={data.items}
            total={data.meta.total}
            page={page}
            limit={limit}
            isActionPending={isActionPending}
            onPaginationChange={onPaginationChange}
            onApproveDraft={onApproveDraft}
            onRejectDraft={onRejectDraft}
            onTakeDown={onTakeDown}
        />
    )
}

function SummaryTile({ label, value }: { label: string; value: number }) {
    return (
        <div className="rounded-xl border bg-card p-4">
            <div className="text-sm text-muted-foreground">{label}</div>
            <div className="mt-2 text-2xl font-semibold">{value}</div>
        </div>
    )
}
