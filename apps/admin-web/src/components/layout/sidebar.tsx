"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Badge } from "@repo/web-ui/components/badge"
import {
    Sidebar,
    SidebarContent,
    SidebarFooter,
    SidebarGroup,
    SidebarGroupContent,
    SidebarGroupLabel,
    SidebarHeader,
    SidebarMenu,
    SidebarMenuButton,
    SidebarMenuItem,
    SidebarSeparator,
} from "@repo/web-ui/components/sidebar"
import { cn } from "@repo/web-ui/lib/utils"
import { AppLogo } from "@/components/layout/app-logo"
import { sidebarNavigation } from "@/components/layout/nav-config"

export function AdminSidebar() {
    const pathname = usePathname()

    return (
        <Sidebar collapsible="icon" variant="floating">
            <SidebarHeader>
                <AppLogo />
            </SidebarHeader>
            <SidebarContent>
                {sidebarNavigation.map((section) => (
                    <SidebarGroup key={section.title}>
                        <SidebarGroupLabel>{section.title}</SidebarGroupLabel>
                        <SidebarGroupContent>
                            <SidebarMenu>
                                {section.items.map((item) => {
                                    const Icon = item.icon
                                    const isActive =
                                        pathname === item.href ||
                                        (pathname?.startsWith(item.href) && item.href !== "/")
                                    return (
                                        <SidebarMenuItem key={item.href}>
                                            <SidebarMenuButton asChild isActive={isActive}>
                                                <Link href={item.href} className="flex items-center gap-2">
                                                    <Icon className="size-4" />
                                                    <span className="truncate">{item.label}</span>
                                                </Link>
                                            </SidebarMenuButton>
                                        </SidebarMenuItem>
                                    )
                                })}
                            </SidebarMenu>
                        </SidebarGroupContent>
                    </SidebarGroup>
                ))}
            </SidebarContent>
            <SidebarSeparator />
            <SidebarFooter>
                <div className="flex items-center justify-between rounded-lg border px-3 py-2 text-xs">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-muted-foreground">环境</span>
                        <span className="font-medium text-foreground">开发中</span>
                    </div>
                    <Badge variant="secondary" className={cn("uppercase tracking-wide")}>
                        beta
                    </Badge>
                </div>
            </SidebarFooter>
        </Sidebar>
    )
}
