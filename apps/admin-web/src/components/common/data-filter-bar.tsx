"use client"

import type { ComponentProps, FormHTMLAttributes, HTMLAttributes } from "react"
import { Button } from "@repo/web-ui/components/button"
import { Separator } from "@repo/web-ui/components/separator"
import { cn } from "@repo/web-ui/lib/utils"

type DataFilterBarProps = FormHTMLAttributes<HTMLFormElement> & {
    sticky?: boolean
}

export function DataFilterBar({
    className,
    sticky = false,
    ...props
}: DataFilterBarProps) {
    return (
        <form
            className={cn(
                "bg-background/95 border shadow-sm flex flex-col gap-4 rounded-2xl px-4 py-4 md:px-6",
                sticky && "lg:sticky lg:top-[84px] lg:z-20",
                className,
            )}
            {...props}
        />
    )
}

type DataFilterBarContentProps = HTMLAttributes<HTMLDivElement>

export function DataFilterBarContent({
    className,
    ...props
}: DataFilterBarContentProps) {
    return (
        <div
            className={cn(
                "grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
                className,
            )}
            {...props}
        />
    )
}

type DataFilterBarActionsProps = HTMLAttributes<HTMLDivElement>

export function DataFilterBarActions({
    className,
    ...props
}: DataFilterBarActionsProps) {
    return (
        <div
            className={cn(
                "flex flex-wrap items-center justify-end gap-2 text-sm",
                className,
            )}
            {...props}
        />
    )
}

type DataFilterBarFooterProps = HTMLAttributes<HTMLDivElement>

export function DataFilterBarFooter({
    className,
    ...props
}: DataFilterBarFooterProps) {
    return (
        <div
            className={cn(
                "bg-muted/40 text-muted-foreground flex flex-wrap items-center gap-2 rounded-xl px-3 py-2 text-xs",
                className,
            )}
            {...props}
        />
    )
}

export function DataFilterBarResetButton({
    className,
    children = "重置",
    ...props
}: ComponentProps<typeof Button>) {
    return (
        <Button
            type="button"
            variant="ghost"
            size="sm"
            className={cn("text-muted-foreground", className)}
            {...props}
        >
            {children}
        </Button>
    )
}

type DataFilterBarDividerProps = React.ComponentProps<typeof Separator>

export function DataFilterBarDivider({
    className,
    ...props
}: DataFilterBarDividerProps) {
    return (
        <Separator className={cn("my-1", className)} {...props} />
    )
}
