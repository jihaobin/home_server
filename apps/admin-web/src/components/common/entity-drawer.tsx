"use client"

import type { ComponentProps, HTMLAttributes, ReactNode } from "react"
import {
    Drawer as EntityDrawer,
    DrawerClose as EntityDrawerClose,
    DrawerContent,
    DrawerDescription as EntityDrawerDescription,
    DrawerFooter as EntityDrawerFooter,
    DrawerHeader as EntityDrawerHeader,
    DrawerTitle as EntityDrawerTitle,
    DrawerTrigger as EntityDrawerTrigger,
} from "@repo/web-ui/components/drawer"
import { ScrollArea } from "@repo/web-ui/components/scroll-area"
import { Separator } from "@repo/web-ui/components/separator"
import { cn } from "@repo/web-ui/lib/utils"

const drawerWidthVariants = {
    sm: "sm:max-w-md",
    md: "sm:max-w-xl",
    lg: "sm:max-w-3xl",
}

export type EntityDrawerContentProps = ComponentProps<typeof DrawerContent> & {
    width?: keyof typeof drawerWidthVariants
    withSeparator?: boolean
}

export function EntityDrawerContent({
    className,
    width = "md",
    withSeparator = true,
    children,
    ...props
}: EntityDrawerContentProps) {
    return (
        <DrawerContent
            direction="right"
            className={cn(
                "p-0 data-[vaul-drawer-direction=right]:w-full",
                drawerWidthVariants[width],
                className,
            )}
            {...props}
        >
            {withSeparator ? <Separator className="opacity-50" /> : null}
            {children}
        </DrawerContent>
    )
}

type EntityDrawerBodyProps = HTMLAttributes<HTMLDivElement>

export function EntityDrawerBody({ className, ...props }: EntityDrawerBodyProps) {
    return (
        <ScrollArea className="h-full">
            <div
                className={cn("flex flex-col gap-4 px-5 py-5 text-sm", className)}
                {...props}
            />
        </ScrollArea>
    )
}

type EntityDrawerSectionProps = HTMLAttributes<HTMLDivElement> & {
    title?: ReactNode
    description?: ReactNode
}

export function EntityDrawerSection({
    className,
    title,
    description,
    children,
    ...props
}: EntityDrawerSectionProps) {
    return (
        <section className={cn("space-y-2", className)} {...props}>
            {(title || description) && (
                <div className="space-y-1">
                    {title ? (
                        <h3 className="text-base font-semibold leading-tight">{title}</h3>
                    ) : null}
                    {description ? (
                        <p className="text-muted-foreground text-xs">{description}</p>
                    ) : null}
                </div>
            )}
            {children}
        </section>
    )
}

type EntityDrawerPropertyProps = HTMLAttributes<HTMLDivElement> & {
    label: ReactNode
    value?: ReactNode
}

export function EntityDrawerProperty({
    className,
    label,
    value,
    children,
    ...props
}: EntityDrawerPropertyProps) {
    return (
        <div
            className={cn(
                "grid grid-cols-[120px_1fr] gap-3 text-sm text-foreground",
                className,
            )}
            {...props}
        >
            <span className="text-muted-foreground">{label}</span>
            <div className="font-medium text-sm leading-relaxed">{value ?? children}</div>
        </div>
    )
}

export {
    EntityDrawer,
    EntityDrawerTrigger,
    EntityDrawerClose,
    EntityDrawerTitle,
    EntityDrawerDescription,
    EntityDrawerHeader,
    EntityDrawerFooter,
}
