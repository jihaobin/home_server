import type { LucideIcon } from "lucide-react"
import {
    ClipboardList,
    LayoutDashboard,
    Layers3,
    LineChart,
    Smartphone,
    Tags,
    Users2,
    WalletMinimal,
} from "lucide-react"

export type NavItem = {
    label: string
    href: string
    icon: LucideIcon
    description?: string
}

export type NavSection = {
    title: string
    items: NavItem[]
}

const dashboardNav: NavItem[] = [
    {
        label: "数据总览",
        href: "/dashboard",
        icon: LayoutDashboard,
        description: "关键指标与实时趋势",
    },
]

const managementNav: NavItem[] = [
    {
        label: "用户管理",
        href: "/users",
        icon: Users2,
        description: "注册用户、角色与状态",
    },
    {
        label: "订单管理",
        href: "/orders",
        icon: ClipboardList,
        description: "订单筛选、导出与批量处理",
    },
    {
        label: "服务分类",
        href: "/service-categories",
        icon: Layers3,
        description: "分类层级、图标与排序",
    },
    {
        label: "服务标签",
        href: "/service-tags",
        icon: Tags,
        description: "按摩标签维护与启停",
    },
    {
        label: "收益记录",
        href: "/revenue-logs",
        icon: LineChart,
        description: "平台收益流水与结算",
    },
    {
        label: "应用版本管理",
        href: "/app-releases",
        icon: Smartphone,
        description: "APK 上传、发布与回滚",
    },
    {
        label: "提现审核",
        href: "/withdrawals",
        icon: WalletMinimal,
        description: "服务人员提现、审批流转",
    },
]

export const sidebarNavigation: NavSection[] = [
    {
        title: "工作台",
        items: dashboardNav,
    },
    {
        title: "运营管理",
        items: managementNav,
    },
]

const flatNavItems = sidebarNavigation.flatMap((section) => section.items)

export function getNavItemByPath(pathname: string) {
    if (!pathname) {
        return undefined
    }

    const normalized = pathname.endsWith("/") && pathname !== "/" ? pathname.slice(0, -1) : pathname
    return flatNavItems
        .slice()
        .sort((a, b) => b.href.length - a.href.length)
        .find((item) => normalized === item.href || normalized.startsWith(`${item.href}/`))
}
