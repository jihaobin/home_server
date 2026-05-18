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
import type {
    AdminServiceOfferingListItem,
    PaginatedData,
    ServiceOfferingLifecycleFilter,
} from "@repo/types"
import {
    useAdminServiceOfferings,
    useApproveAdminServiceOfferingDraft,
    useApproveServiceOfferingAppeal,
    useRejectAdminServiceOfferingDraft,
    useRejectServiceOfferingAppeal,
    useTakeDownAdminServiceOffering,
} from "@repo/hooks/api/ssr"
import { Tabs, TabsList, TabsTrigger } from "@repo/web-ui/components/tabs"
import { toast } from "sonner"
import { PageHeader } from "@/components/common"
import type {
    ServiceOfferingsGroupMode,
    ServiceOfferingsQueryState,
} from "../_utils/query"
import {
    buildServiceOfferingsSearchParams,
    normalizeServiceOfferingsQuery,
    toAdminServiceOfferingsQueryInput,
} from "../_utils/query"
import { ServiceOfferingDetailSheet } from "./service-offering-detail-sheet"
import { ServiceOfferingReasonAlert } from "./service-offering-reason-alert"
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
    | { type: "rejectAppeal"; offering: PublishedItem }
    | null

const LIFECYCLE_TABS: Array<{
    value: ServiceOfferingLifecycleFilter
    label: string
}> = [
        { value: "pending_review", label: "待审核" },
        { value: "active", label: "已上架" },
        { value: "rejected", label: "已拒绝" },
        { value: "taken_down", label: "已下架" },
        { value: "all", label: "全部" },
    ]

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
    const [detailItem, setDetailItem] =
        useState<AdminServiceOfferingListItem | null>(null)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(
        () => toAdminServiceOfferingsQueryInput(queryState),
        [queryState],
    )
    const approveMutation = useApproveAdminServiceOfferingDraft(requestQuery)
    const rejectMutation = useRejectAdminServiceOfferingDraft(requestQuery)
    const takeDownMutation = useTakeDownAdminServiceOffering(requestQuery)
    const approveAppealMutation = useApproveServiceOfferingAppeal(requestQuery)
    const rejectAppealMutation = useRejectServiceOfferingAppeal(requestQuery)
    const isActionPending =
        approveMutation.isPending ||
        rejectMutation.isPending ||
        takeDownMutation.isPending ||
        approveAppealMutation.isPending ||
        rejectAppealMutation.isPending

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

    const filterDefaults = useMemo<ServiceOfferingsFilterValues>(
        () => ({
            keyword: queryState.keyword,
            groupMode: queryState.groupMode,
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
                    groupMode: values.groupMode,
                }),
            )
        },
        [],
    )

    const handleLifecycleChange = useCallback(
        (lifecycle: ServiceOfferingLifecycleFilter) => {
            setQueryState((current) =>
                normalizeServiceOfferingsQuery({
                    ...current,
                    page: 1,
                    lifecycle,
                }),
            )
        },
        [],
    )

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
            setDetailItem(null)
        },
        [approveMutation],
    )

    const handleApproveAppeal = useCallback(
        async (offering: PublishedItem) => {
            const appealId = offering.appeal?.id
            if (!appealId) {
                toast.error("申诉记录不存在")
                return
            }

            const result = await approveAppealMutation.mutateAsync(appealId)
            if (result.status === "approved") {
                toast.success(result.message ?? "申诉已通过，服务已恢复上线")
            } else if (result.status === "canceled") {
                toast.info(result.message ?? "申诉已取消，服务状态未变更")
            } else {
                toast.success(result.message ?? "申诉已通过")
            }
            setDetailItem(null)
        },
        [approveAppealMutation],
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
                setDetailItem(null)
                return
            }

            if (reasonDialog.type === "rejectAppeal") {
                const appealId = reasonDialog.offering.appeal?.id
                if (!appealId) {
                    toast.error("申诉记录不存在")
                    return
                }

                const result = await rejectAppealMutation.mutateAsync({
                    appealId,
                    reason,
                })
                if (result.status === "rejected") {
                    toast.success(result.message ?? "申诉已驳回")
                } else {
                    toast.info(result.message ?? "申诉状态未变更")
                }
                setReasonDialog(null)
                setDetailItem(null)
                return
            }

            await takeDownMutation.mutateAsync({
                personnelId: reasonDialog.offering.personnel.id,
                serviceId: reasonDialog.offering.service.id,
                reason,
            })
            toast.success("服务已下架")
            setReasonDialog(null)
            setDetailItem(null)
        },
        [reasonDialog, rejectAppealMutation, rejectMutation, takeDownMutation],
    )

    const handleRefresh = useCallback(() => {
        void refetchRef.current?.()
    }, [])

    return (
        <div className="space-y-5">
            <PageHeader
                title="服务发布管理"
                description="审核服务人员提交的服务草稿，处理已发布服务下架。"
            />

            <Tabs
                value={queryState.lifecycle}
                onValueChange={(value) =>
                    handleLifecycleChange(
                        value as ServiceOfferingLifecycleFilter,
                    )
                }
            >
                <TabsList>
                    {LIFECYCLE_TABS.map((tab) => (
                        <TabsTrigger key={tab.value} value={tab.value}>
                            {tab.label}
                        </TabsTrigger>
                    ))}
                </TabsList>
            </Tabs>

            <ServiceOfferingsFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onRefresh={handleRefresh}
                isFetching={isTableFetching}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<ServiceOfferingsTableSkeleton />}>
                <ServiceOfferingsTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    groupMode={queryState.groupMode}
                    isActionPending={isActionPending}
                    onPaginationChange={handlePaginationChange}
                    onOpenDetail={setDetailItem}
                    onApproveDraft={(draft) => {
                        void handleApproveDraft(draft)
                    }}
                    onRejectDraft={(draft) =>
                        setReasonDialog({ type: "reject", draft })
                    }
                    onTakeDown={(offering) =>
                        setReasonDialog({ type: "takeDown", offering })
                    }
                    onApproveAppeal={(offering) => {
                        void handleApproveAppeal(offering)
                    }}
                    onRejectAppeal={(offering) =>
                        setReasonDialog({ type: "rejectAppeal", offering })
                    }
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <ServiceOfferingDetailSheet
                item={detailItem}
                open={detailItem !== null}
                isActionPending={isActionPending}
                onOpenChange={(open) => {
                    if (!open) {
                        setDetailItem(null)
                    }
                }}
                onApproveDraft={(draft) => {
                    void handleApproveDraft(draft)
                }}
                onRejectDraft={(draft) =>
                    setReasonDialog({ type: "reject", draft })
                }
                onTakeDown={(offering) =>
                    setReasonDialog({ type: "takeDown", offering })
                }
                onApproveAppeal={(offering) => {
                    void handleApproveAppeal(offering)
                }}
                onRejectAppeal={(offering) =>
                    setReasonDialog({ type: "rejectAppeal", offering })
                }
            />

            <ServiceOfferingReasonAlert
                open={reasonDialog !== null}
                title={
                    reasonDialog?.type === "takeDown"
                        ? "下架服务"
                        : reasonDialog?.type === "rejectAppeal"
                          ? "驳回申诉"
                          : "拒绝审核"
                }
                description={
                    reasonDialog?.type === "takeDown"
                        ? "下架原因会发送给服务人员，并在相关页面展示。"
                        : reasonDialog?.type === "rejectAppeal"
                          ? "驳回原因会发送给服务人员，服务会继续保持下架。"
                        : "拒绝原因会发送给服务人员，用于修改后重新提交。"
                }
                confirmLabel={
                    reasonDialog?.type === "takeDown"
                        ? "确认下架"
                        : reasonDialog?.type === "rejectAppeal"
                          ? "确认驳回"
                        : "确认拒绝"
                }
                isPending={
                    rejectMutation.isPending ||
                    takeDownMutation.isPending ||
                    rejectAppealMutation.isPending
                }
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
    groupMode: ServiceOfferingsGroupMode
    isActionPending?: boolean
    onPaginationChange: (next: { page: number; limit: number }) => void
    onOpenDetail: (item: AdminServiceOfferingListItem) => void
    onApproveDraft: (draft: DraftItem) => void
    onRejectDraft: (draft: DraftItem) => void
    onTakeDown: (offering: PublishedItem) => void
    onApproveAppeal: (offering: PublishedItem) => void
    onRejectAppeal: (offering: PublishedItem) => void
    onDataChange: (data: ServiceOfferingsListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function ServiceOfferingsTableContent({
    query,
    page,
    limit,
    groupMode,
    isActionPending,
    onPaginationChange,
    onOpenDetail,
    onApproveDraft,
    onRejectDraft,
    onTakeDown,
    onApproveAppeal,
    onRejectAppeal,
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
            groupMode={groupMode}
            isActionPending={isActionPending}
            onPaginationChange={onPaginationChange}
            onOpenDetail={onOpenDetail}
            onApproveDraft={onApproveDraft}
            onRejectDraft={onRejectDraft}
            onTakeDown={onTakeDown}
            onApproveAppeal={onApproveAppeal}
            onRejectAppeal={onRejectAppeal}
        />
    )
}
