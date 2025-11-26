"use client"

import Link from "next/link"
import { Fragment, type ReactNode } from "react"
import {
    Breadcrumb,
    BreadcrumbItem,
    BreadcrumbLink,
    BreadcrumbList,
    BreadcrumbPage,
    BreadcrumbSeparator,
} from "@repo/web-ui/components/breadcrumb"
import { cn } from "@repo/web-ui/lib/utils"

export type PageHeaderBreadcrumbItem = {
    label: string
    href?: string
}

export type PageHeaderProps = React.HTMLAttributes<HTMLDivElement> & {
    title: ReactNode
    description?: ReactNode
    breadcrumbItems?: PageHeaderBreadcrumbItem[]
    actions?: ReactNode
    meta?: ReactNode
}

export function PageHeader({
    className,
    title,
    description,
    breadcrumbItems,
    actions,
    meta,
    children,
    ...props
}: PageHeaderProps) {
    return (
        <section className={cn("space-y-4", className)} {...props}>
            {breadcrumbItems?.length ? (
                <PageHeaderBreadcrumbs items={breadcrumbItems} />
            ) : null}
            <div className="flex flex-wrap items-start gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <div className="flex flex-col gap-1">
                        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
                        {description
                            ? typeof description === "string"
                                ? (
                                    <p className="text-muted-foreground text-sm">{description}</p>
                                )
                                : (
                                    <div className="text-muted-foreground text-sm">
                                        {description}
                                    </div>
                                )
                            : null}
                    </div>
                    {meta ? (
                        <div className="text-muted-foreground flex flex-wrap gap-2 text-sm">
                            {meta}
                        </div>
                    ) : null}
                    {children ? <div className="text-sm text-foreground">{children}</div> : null}
                </div>
                {actions ? (
                    <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto sm:justify-end">
                        {actions}
                    </div>
                ) : null}
            </div>
        </section>
    )
}

type PageHeaderBreadcrumbsProps = {
    items: PageHeaderBreadcrumbItem[]
    className?: string
}

export function PageHeaderBreadcrumbs({
    items,
    className,
}: PageHeaderBreadcrumbsProps) {
    if (!items.length) {
        return null
    }

    return (
        <Breadcrumb className={className}>
            <BreadcrumbList>
                {items.map((item, index) => (
                    <Fragment key={`${item.label}-${index}`}>
                        <BreadcrumbItem className="inline-flex items-center gap-1.5">
                            {item.href ? (
                                <BreadcrumbLink asChild>
                                    <Link href={item.href}>{item.label}</Link>
                                </BreadcrumbLink>
                            ) : (
                                <BreadcrumbPage>{item.label}</BreadcrumbPage>
                            )}
                        </BreadcrumbItem>
                        {index < items.length - 1 ? <BreadcrumbSeparator /> : null}
                    </Fragment>
                ))}
            </BreadcrumbList>
        </Breadcrumb>
    )
}

type PageHeaderToolbarProps = React.HTMLAttributes<HTMLDivElement>

export function PageHeaderToolbar({ className, ...props }: PageHeaderToolbarProps) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center gap-2 rounded-lg border bg-background/60 px-3 py-2 text-xs text-muted-foreground",
                className,
            )}
            {...props}
        />
    )
}
