"use client"

import { useState } from "react"
import { Bell, LogOut } from "lucide-react"
import { usePathname, useRouter } from "next/navigation"
import { Avatar, AvatarFallback } from "@repo/web-ui/components/avatar"
import { Button } from "@repo/web-ui/components/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@repo/web-ui/components/dropdown-menu"
import { Separator } from "@repo/web-ui/components/separator"
import { SidebarTrigger } from "@repo/web-ui/components/sidebar"
import { useAdminProfile } from "@repo/hooks/api/ssr"
import { toast } from "sonner"
import { adminLogout } from "@/lib/auth"
import { getNavItemByPath } from "@/components/layout/nav-config"

export function TopBar() {
    const pathname = usePathname() ?? "/dashboard"
    const active = getNavItemByPath(pathname)
    const { data: profile } = useAdminProfile()
    const avatarFallback = getAvatarInitials(profile?.name, profile?.email)
    const roleSummary = profile?.roles?.join(" · ")
    const router = useRouter()
    const [isLoggingOut, setIsLoggingOut] = useState(false)

    const handleLogout = async () => {
        if (isLoggingOut) return

        setIsLoggingOut(true)
        try {
            await adminLogout()
            router.replace("/auth/login")
        } catch (error) {
            console.error(error)
            toast.error("退出登录失败，请稍后重试")
        } finally {
            setIsLoggingOut(false)
        }
    }

    return (
        <header className="bg-background/95 supports-backdrop-filter:bg-background/80 sticky top-0 z-30 flex items-center gap-3 border-b px-4 py-3 backdrop-blur">
            <SidebarTrigger className="md:hidden" />
            <div className="hidden items-center gap-3 md:flex">
                <SidebarTrigger />
                <Separator orientation="vertical" className="h-6" />
            </div>
            <div className="flex flex-col text-sm">
                <span className="text-muted-foreground text-xs">当前位置</span>
                <span className="font-semibold leading-tight">{active?.label ?? "控制面板"}</span>
            </div>
            <div className="ml-auto flex items-center gap-3">
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Bell className="size-4" />
                    <span className="sr-only">查看通知</span>
                </Button>
                <div className="hidden flex-col items-end text-right md:flex">
                    <span className="text-sm font-semibold leading-tight">
                        {profile?.name ?? profile?.email ?? "管理员"}
                    </span>
                    <span className="text-xs text-muted-foreground">
                        {roleSummary ?? "admin"}
                    </span>
                </div>
                <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                        <button
                            type="button"
                            className="rounded-full border p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                        >
                            <Avatar className="size-9">
                                <AvatarFallback className="text-sm font-semibold uppercase">
                                    {avatarFallback}
                                </AvatarFallback>
                            </Avatar>
                            <span className="sr-only">打开账户菜单</span>
                        </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-56">
                        <DropdownMenuLabel>
                            {profile?.name ?? profile?.email ?? "管理员"}
                        </DropdownMenuLabel>
                        <p className="px-2 text-xs text-muted-foreground">
                            {profile?.email ?? ""}
                        </p>
                        <DropdownMenuSeparator />
                        <DropdownMenuItem
                            onClick={handleLogout}
                            disabled={isLoggingOut}
                            className="text-destructive focus:text-destructive"
                        >
                            <LogOut className="size-4" />
                            {isLoggingOut ? "正在退出..." : "退出登录"}
                        </DropdownMenuItem>
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>
        </header>
    )
}

function getAvatarInitials(name?: string | null, email?: string | null) {
    if (name && name.trim().length > 0) {
        return name
            .trim()
            .split(/\s+/)
            .slice(0, 2)
            .map((part) => part[0])
            .join("")
            .toUpperCase()
    }

    if (email) {
        return email.slice(0, 2).toUpperCase()
    }

    return "AD"
}
