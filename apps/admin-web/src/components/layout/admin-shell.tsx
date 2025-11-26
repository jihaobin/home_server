"use client"

import { Suspense } from "react"
import { AlertTriangle } from "lucide-react"
import { ErrorBoundary } from "react-error-boundary"
import { QueryErrorResetBoundary } from "@tanstack/react-query"
import { Button } from "@repo/web-ui/components/button"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import { SidebarInset, SidebarProvider } from "@repo/web-ui/components/sidebar"
import { AdminSidebar } from "@/components/layout/sidebar"
import { PageContainer } from "@/components/layout/page-container"
import { TopBar } from "@/components/layout/top-bar"

type AdminShellProps = {
    children: React.ReactNode
    className?: string
}

export function AdminShell({ children, className }: AdminShellProps) {
    return (
        <SidebarProvider>
            <div className="bg-background text-foreground flex min-h-screen w-full">
                <AdminSidebar />
                <SidebarInset className="flex flex-1 flex-col">
                    <QueryErrorResetBoundary>
                        {({ reset }) => (
                            <ErrorBoundary
                                onReset={reset}
                                fallbackRender={({ error, resetErrorBoundary }) => (
                                    <TopBarError error={error} onRetry={resetErrorBoundary} />
                                )}
                            >
                                <Suspense fallback={<TopBarFallback />}>
                                    <TopBar />
                                </Suspense>
                            </ErrorBoundary>
                        )}
                    </QueryErrorResetBoundary>
                    <Suspense fallback={<PageFallback />}>
                        <PageContainer className={className}>{children}</PageContainer>
                    </Suspense>
                </SidebarInset>
            </div>
        </SidebarProvider>
    )
}

function PageFallback() {
    return (
        <PageContainer>
            <div className="space-y-6">
                <Skeleton className="h-10 w-2/3" />
                <Skeleton className="h-32 w-full" />
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    <Skeleton className="h-48 w-full" />
                    <Skeleton className="h-48 w-full" />
                </div>
            </div>
        </PageContainer>
    )
}

function TopBarFallback() {
    return (
        <header className="bg-background/80 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
            <div className="hidden gap-3 md:flex">
                <Skeleton className="h-10 w-10 rounded-full" />
                <Skeleton className="h-10 w-px" />
            </div>
            <div className="flex flex-col gap-1 text-sm">
                <Skeleton className="h-3 w-24" />
                <Skeleton className="h-4 w-40" />
            </div>
            <div className="ml-auto flex items-center gap-2">
                <Skeleton className="h-9 w-9 rounded-full" />
                <div className="hidden flex-col items-end gap-1 md:flex">
                    <Skeleton className="h-3 w-20" />
                    <Skeleton className="h-3 w-24" />
                </div>
            </div>
        </header>
    )
}

type TopBarErrorProps = {
    error?: Error
    onRetry: () => void
}

function TopBarError({ error, onRetry }: TopBarErrorProps) {
    return (
        <header className="bg-destructive/10 text-destructive flex items-center gap-3 border-b border-destructive/30 px-4 py-3">
            <AlertTriangle className="size-5" aria-hidden="true" />
            <div className="flex flex-1 flex-col">
                <span className="text-sm font-semibold">管理员信息加载失败</span>
                <span className="text-xs opacity-80">{error?.message ?? "请稍后重试"}</span>
            </div>
            <Button size="sm" variant="outline" onClick={onRetry}>
                重试
            </Button>
        </header>
    )
}
