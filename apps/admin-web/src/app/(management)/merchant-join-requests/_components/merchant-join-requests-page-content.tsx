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
import { Download, RefreshCcw } from "lucide-react"
import type { AdminMerchantJoinRequest, PaginatedData } from "@repo/types"
import {
    getAdminMerchantJoinRequestsExportUrl,
    useAdminMerchantJoinRequests,
} from "@repo/hooks/api/ssr"
import { Button } from "@repo/web-ui/components/button"
import { cn } from "@repo/web-ui/lib/utils"
import { PageHeader, PageHeaderToolbar } from "@/components/common"
import type { MerchantJoinRequestsQueryState } from "../_utils/query"
import {
    buildMerchantJoinRequestsSearchParams,
    normalizeMerchantJoinRequestsQuery,
} from "../_utils/query"
import {
    MerchantJoinRequestsFilterBar,
    type MerchantJoinRequestsFilterValues,
} from "./merchant-join-requests-filter-bar"
import { MerchantJoinRequestDetailDrawer } from "./merchant-join-request-detail-drawer"
import { MerchantJoinRequestsTable } from "./merchant-join-requests-table"
import { MerchantJoinRequestsTableSkeleton } from "./merchant-join-requests-table-skeleton"

type MerchantJoinRequestsPageContentProps = {
    initialQuery: MerchantJoinRequestsQueryState
}

type MerchantJoinRequestsListResponse = PaginatedData<AdminMerchantJoinRequest>

export function MerchantJoinRequestsPageContent({
    initialQuery,
}: MerchantJoinRequestsPageContentProps) {
    const router = useRouter()
    const pathname = usePathname()
    const [isNavigating, startTransition] = useTransition()
    const [queryState, setQueryState] = useState<MerchantJoinRequestsQueryState>(() =>
        normalizeMerchantJoinRequestsQuery(initialQuery),
    )
    const [selectedMerchantJoinRequest, setSelectedMerchantJoinRequest] =
        useState<AdminMerchantJoinRequest | null>(null)
    const [isDrawerOpen, setDrawerOpen] = useState(false)
    const [tableSnapshot, setTableSnapshot] =
        useState<MerchantJoinRequestsListResponse | null>(null)
    const [isTableFetching, setIsTableFetching] = useState(false)
    const refetchRef = useRef<(() => Promise<unknown> | void) | null>(null)

    const requestQuery = useMemo(() => ({ ...queryState }), [queryState])
    const filterDefaults = useMemo<MerchantJoinRequestsFilterValues>(
        () => ({
            keyword: queryState.keyword ?? "",
            contactStatus: queryState.contactStatus,
        }),
        [queryState.contactStatus, queryState.keyword],
    )

    useEffect(() => {
        const search = buildMerchantJoinRequestsSearchParams(queryState)
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
    const contactedOnPage = currentItems.filter((item) => item.isContacted).length
    const uncontactedOnPage = currentItems.filter((item) => !item.isContacted).length

    const handleDataChange = useCallback((data: MerchantJoinRequestsListResponse) => {
        setTableSnapshot(data)
    }, [])

    const handleFetchingChange = useCallback((next: boolean) => {
        setIsTableFetching(next)
    }, [])

    const handleRegisterRefetch = useCallback(
        (fn: (() => Promise<unknown> | void) | null) => {
            refetchRef.current = fn ?? null
        },
        [],
    )

    const handleApplyFilters = useCallback(
        (values: MerchantJoinRequestsFilterValues) => {
            setQueryState((prev) =>
                normalizeMerchantJoinRequestsQuery({
                    ...prev,
                    page: 1,
                    keyword: values.keyword.trim() ? values.keyword.trim() : undefined,
                    contactStatus:
                        values.contactStatus === "all"
                            ? "all"
                            : values.contactStatus === "contacted"
                              ? "contacted"
                              : "uncontacted",
                }),
            )
        },
        [],
    )

    const handleResetFilters = useCallback(() => {
        setQueryState((prev) =>
            normalizeMerchantJoinRequestsQuery({
                ...prev,
                page: 1,
                keyword: undefined,
                contactStatus: "all",
            }),
        )
    }, [])

    const handlePaginationChange = useCallback(
        ({ page, limit }: { page: number; limit: number }) => {
            setQueryState((prev) =>
                normalizeMerchantJoinRequestsQuery({
                    ...prev,
                    page,
                    limit,
                }),
            )
        },
        [],
    )

    const handleViewDetail = useCallback((request: AdminMerchantJoinRequest) => {
        setSelectedMerchantJoinRequest(request)
        setDrawerOpen(true)
    }, [])

    const handleDrawerChange = useCallback((open: boolean) => {
        setDrawerOpen(open)
        if (!open) {
            setSelectedMerchantJoinRequest(null)
        }
    }, [])

    const handleRefresh = useCallback(() => {
        if (refetchRef.current) {
            void refetchRef.current()
        }
    }, [])

    const handleExportCsv = useCallback(() => {
        window.location.href = getAdminMerchantJoinRequestsExportUrl()
    }, [])

    const handleMerchantJoinRequestUpdated = useCallback(
        (updated: AdminMerchantJoinRequest) => {
            setSelectedMerchantJoinRequest(updated)
        },
        [],
    )

    return (
        <div className="space-y-6">
            <PageHeader
                title="商户加盟申请"
                description="集中查看加盟线索，补充备注并跟进联系状态。"
                breadcrumbItems={[
                    { label: "运营管理", href: "/merchant-join-requests" },
                    { label: "商户加盟申请" },
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
                            onClick={handleExportCsv}
                        >
                            <Download className="size-4" />
                            导出 CSV
                        </Button>
                    </div>
                }
            >
                <PageHeaderToolbar className="gap-3">
                    <span>当前筛选命中 {totalItems} 条线索</span>
                    <span>本页未联系 {uncontactedOnPage} 条</span>
                    <span>本页已联系 {contactedOnPage} 条</span>
                </PageHeaderToolbar>
            </PageHeader>

            <MerchantJoinRequestsFilterBar
                defaultValues={filterDefaults}
                onApply={handleApplyFilters}
                onReset={handleResetFilters}
                isSubmitting={isNavigating}
            />

            <Suspense fallback={<MerchantJoinRequestsTableSkeleton />}>
                <MerchantJoinRequestsTableContent
                    query={requestQuery}
                    page={queryState.page}
                    limit={queryState.limit}
                    onPaginationChange={handlePaginationChange}
                    onViewDetail={handleViewDetail}
                    onDataChange={handleDataChange}
                    onFetchingChange={handleFetchingChange}
                    onRegisterRefetch={handleRegisterRefetch}
                />
            </Suspense>

            <MerchantJoinRequestDetailDrawer
                merchantJoinRequest={selectedMerchantJoinRequest}
                open={isDrawerOpen}
                onOpenChange={handleDrawerChange}
                query={requestQuery}
                onMerchantJoinRequestUpdated={handleMerchantJoinRequestUpdated}
            />
        </div>
    )
}

type MerchantJoinRequestsTableContentProps = {
    query: MerchantJoinRequestsQueryState
    page: number
    limit: number
    onPaginationChange: (next: { page: number; limit: number }) => void
    onViewDetail: (request: AdminMerchantJoinRequest) => void
    onDataChange: (data: MerchantJoinRequestsListResponse) => void
    onFetchingChange: (isFetching: boolean) => void
    onRegisterRefetch: (fn: (() => Promise<unknown> | void) | null) => void
}

function MerchantJoinRequestsTableContent({
    query,
    page,
    limit,
    onPaginationChange,
    onViewDetail,
    onDataChange,
    onFetchingChange,
    onRegisterRefetch,
}: MerchantJoinRequestsTableContentProps) {
    const { data, refetch, isFetching } = useAdminMerchantJoinRequests(query)

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
        <MerchantJoinRequestsTable
            data={data.items}
            total={data.meta.total}
            page={page}
            limit={limit}
            onPaginationChange={onPaginationChange}
            onViewDetail={onViewDetail}
        />
    )
}
