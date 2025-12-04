"use client"

import type { HTMLAttributes, MouseEvent, ReactNode } from "react"
import {
    flexRender,
    type Table as ReactTable,
} from "@tanstack/react-table"
import { Button } from "@repo/web-ui/components/button"
import {
    Empty,
    EmptyContent,
    EmptyDescription,
    EmptyHeader,
    EmptyTitle,
} from "@repo/web-ui/components/empty"
import {
    Pagination,
    PaginationContent,
    PaginationItem,
    PaginationNext,
    PaginationPrevious,
} from "@repo/web-ui/components/pagination"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from "@repo/web-ui/components/table"
import { cn } from "@repo/web-ui/lib/utils"

export type EntityTableProps<TData> = HTMLAttributes<HTMLDivElement> & {
    table: ReactTable<TData>
    isLoading?: boolean
    isError?: boolean
    errorTitle?: ReactNode
    errorDescription?: ReactNode
    onRetry?: () => void
    loadingRows?: number
    emptyState?: {
        title?: ReactNode
        description?: ReactNode
        action?: ReactNode
    }
}

export function EntityTable<TData>({
    className,
    table,
    isLoading,
    isError,
    errorTitle = "数据加载失败",
    errorDescription = "请稍后重试，或刷新页面重新获取数据。",
    onRetry,
    loadingRows = 5,
    emptyState,
    ...props
}: EntityTableProps<TData>) {
    const visibleColumns = table.getVisibleLeafColumns()
    const colSpan = Math.max(visibleColumns.length, 1)
    const rows = table.getRowModel().rows

    return (
        <div
            className={cn("rounded-2xl border bg-background shadow-xs", className)}
            {...props}
        >
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
                    {isLoading
                        ? renderLoadingRows(visibleColumns.length, loadingRows)
                        : null}
                    {!isLoading && isError ? (
                        <EntityTableMessageRow colSpan={colSpan}>
                            <EntityTableMessage
                                title={errorTitle}
                                description={errorDescription}
                                action={
                                    onRetry ? (
                                        <Button variant="outline" size="sm" onClick={onRetry}>
                                            重试
                                        </Button>
                                    ) : null
                                }
                            />
                        </EntityTableMessageRow>
                    ) : null}
                    {!isLoading && !isError && rows.length === 0 ? (
                        <EntityTableMessageRow colSpan={colSpan}>
                            <EntityTableMessage
                                title={emptyState?.title ?? "暂无数据"}
                                description={
                                    emptyState?.description ??
                                    "调整筛选条件或稍后再试。"
                                }
                                action={emptyState?.action}
                            />
                        </EntityTableMessageRow>
                    ) : null}
                    {!isLoading && !isError
                        ? rows.map((row) => (
                              <TableRow
                                  key={row.id}
                                  data-state={row.getIsSelected() ? "selected" : undefined}
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
                          ))
                        : null}
                </TableBody>
            </Table>
        </div>
    )
}

function renderLoadingRows(columns: number, loadingRows: number) {
    const skeletonColumns = columns || 1
    return Array.from({ length: loadingRows }).map((_, rowIndex) => (
        <TableRow key={`loading-${rowIndex}`}>
            {Array.from({ length: skeletonColumns }).map((__, columnIndex) => (
                <TableCell key={`loading-${rowIndex}-${columnIndex}`}>
                    <Skeleton className="h-4 w-full" />
                </TableCell>
            ))}
        </TableRow>
    ))
}

function EntityTableMessageRow({
    colSpan,
    children,
}: {
    colSpan: number
    children: ReactNode
}) {
    return (
        <TableRow>
            <TableCell colSpan={colSpan}>
                <div className="flex w-full justify-center py-12">{children}</div>
            </TableCell>
        </TableRow>
    )
}

function EntityTableMessage({
    title,
    description,
    action,
}: {
    title: ReactNode
    description?: ReactNode
    action?: ReactNode
}) {
    return (
        <Empty>
            <EmptyHeader>
                <EmptyTitle>{title}</EmptyTitle>
                {description ? (
                    <EmptyDescription>{description}</EmptyDescription>
                ) : null}
            </EmptyHeader>
            <EmptyContent>
                {action ?? (
                    <EmptyDescription className="text-xs">
                        若问题持续出现，请联系管理员。
                    </EmptyDescription>
                )}
            </EmptyContent>
        </Empty>
    )
}

export type EntityTablePaginationProps<TData> = HTMLAttributes<HTMLDivElement> & {
    table: ReactTable<TData>
    pageSizeOptions?: number[]
    totalItems?: number
    pageSize?: number
    pageIndex?: number
    pageCount?: number
    canPreviousPage?: boolean
    canNextPage?: boolean
    onPageSizeChange?: (pageSize: number) => void
}

export function EntityTablePagination<TData>({
    className,
    table,
    pageSizeOptions = [10, 20, 50],
    totalItems,
    pageSize: controlledPageSize,
    pageIndex: controlledPageIndex,
    pageCount: controlledPageCount,
    canPreviousPage: controlledCanPreviousPage,
    canNextPage: controlledCanNextPage,
    onPageSizeChange,
    ...props
}: EntityTablePaginationProps<TData>) {
    const pagination = table.getState().pagination
    const fallbackPageIndex = pagination?.pageIndex ?? 0
    const pageIndex =
        typeof controlledPageIndex === "number"
            ? controlledPageIndex
            : fallbackPageIndex
    const pageSizeFromTable = pagination?.pageSize ?? pageSizeOptions[0]
    const pageSize =
        typeof controlledPageSize === "number" ? controlledPageSize : pageSizeFromTable
    const computedPageCount = table.getPageCount()
    const fallbackPageCount =
        computedPageCount === -1
            ? fallbackPageIndex + 1
            : Math.max(computedPageCount, 1)
    const pageCount =
        typeof controlledPageCount === "number"
            ? Math.max(controlledPageCount, 1)
            : fallbackPageCount
    const canPreviousPage =
        typeof controlledCanPreviousPage === "boolean"
            ? controlledCanPreviousPage
            : table.getCanPreviousPage()
    const canNextPage =
        typeof controlledCanNextPage === "boolean"
            ? controlledCanNextPage
            : table.getCanNextPage()
    const fallbackRowCount = table.getFilteredRowModel().rows.length
    const rowCount = typeof totalItems === "number" ? totalItems : fallbackRowCount

    const goToPrevious = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        if (!canPreviousPage) {
            return
        }
        table.previousPage()
    }

    const goToNext = (event: MouseEvent<HTMLAnchorElement>) => {
        event.preventDefault()
        if (!canNextPage) {
            return
        }
        table.nextPage()
    }

    return (
        <div
            className={cn(
                "flex flex-col gap-3 border-t px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between",
                className,
            )}
            {...props}
        >
            <div className="flex flex-wrap items-center gap-3 text-muted-foreground">
                <span>共 {rowCount} 条结果</span>
                <Select
                    value={String(pageSize)}
                    onValueChange={(value) => {
                        const size = Number(value)
                        if (Number.isNaN(size)) {
                            return
                        }
                        if (onPageSizeChange) {
                            onPageSizeChange(size)
                        } else {
                            table.setPageSize(size)
                        }
                    }}
                >
                    <SelectTrigger className="w-32">
                        <SelectValue placeholder="每页条数" />
                    </SelectTrigger>
                    <SelectContent>
                        {pageSizeOptions.map((size) => (
                            <SelectItem key={size} value={String(size)}>
                                每页 {size} 条
                            </SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>
            <Pagination>
                <PaginationContent>
                    <PaginationItem>
                        <PaginationPrevious
                            href="#"
                            className={cn(!canPreviousPage && "pointer-events-none opacity-50")}
                            onClick={goToPrevious}
                        />
                    </PaginationItem>
                    <PaginationItem>
                        <span className="text-sm">
                            第 {pageIndex + 1} / {pageCount} 页
                        </span>
                    </PaginationItem>
                    <PaginationItem>
                        <PaginationNext
                            href="#"
                            className={cn(!canNextPage && "pointer-events-none opacity-50")}
                            onClick={goToNext}
                        />
                    </PaginationItem>
                </PaginationContent>
            </Pagination>
        </div>
    )
}
