"use client"

import { Suspense, useMemo, useState } from "react"
import { ShieldAlert, UserCog } from "lucide-react"
import type { UserRole } from "@repo/types"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@repo/web-ui/components/card"
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from "@repo/web-ui/components/select"
import { Skeleton } from "@repo/web-ui/components/skeleton"
import { cn } from "@repo/web-ui/lib/utils"
import { useAdminUserDetail } from "@repo/hooks/api/ssr"
import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"

const ROLE_OPTIONS: UserRole[] = [
    "customer",
    "service_personnel",
    "shop_admin",
    "admin",
]

const ROLE_LABELS: Record<UserRole, string> = {
    customer: "普通用户",
    service_personnel: "服务人员",
    shop_admin: "店铺管理员",
    admin: "管理员",
    super_admin: "超级管理员",
}

type UserDetailDrawerProps = {
    userId: string | null
    open: boolean
    onOpenChange: (open: boolean) => void
    onToggleStatus: (userId: string, nextActive: boolean) => Promise<void>
    onRoleChange: (userId: string, role: UserRole) => Promise<void>
}

export function UserDetailDrawer({
    userId,
    open,
    onOpenChange,
    onToggleStatus,
    onRoleChange,
}: UserDetailDrawerProps) {
    return (
        <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
            <EntityDrawerContent width="lg">
                <EntityDrawerHeader>
                    <EntityDrawerTitle>用户详情</EntityDrawerTitle>
                </EntityDrawerHeader>
                {userId ? (
                    <Suspense
                        fallback={
                            <EntityDrawerBody>
                                <UserDetailSkeleton />
                            </EntityDrawerBody>
                        }
                    >
                        <UserDetailContent
                            userId={userId}
                            onToggleStatus={onToggleStatus}
                            onRoleChange={onRoleChange}
                        />
                    </Suspense>
                ) : (
                    <EntityDrawerBody>
                        <UserDetailSkeleton />
                    </EntityDrawerBody>
                )}
            </EntityDrawerContent>
        </EntityDrawer>
    )
}

type UserDetailContentProps = {
    userId: string
    onToggleStatus: (userId: string, nextActive: boolean) => Promise<void>
    onRoleChange: (userId: string, role: UserRole) => Promise<void>
}

function UserDetailContent({
    userId,
    onToggleStatus,
    onRoleChange,
}: UserDetailContentProps) {
    const { data } = useAdminUserDetail(userId)
    const [isStatusUpdating, setStatusUpdating] = useState(false)
    const [isRoleUpdating, setRoleUpdating] = useState(false)

    const summary = useMemo(
        () => ({
            name: data.name ?? data.email,
            statusText: data.isActive ? "启用" : "禁用",
        }),
        [data.email, data.isActive, data.name],
    )

    const handleToggleStatus = async () => {
        setStatusUpdating(true)
        try {
            await onToggleStatus(userId, !data.isActive)
        } finally {
            setStatusUpdating(false)
        }
    }

    const handleRoleChange = async (role: UserRole) => {
        if (role === data.role) return
        setRoleUpdating(true)
        try {
            await onRoleChange(userId, role)
        } finally {
            setRoleUpdating(false)
        }
    }

    return (
        <EntityDrawerBody className="gap-6">
            <section className="space-y-3 rounded-2xl border bg-card/60 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold leading-tight">
                            {summary.name}
                        </span>
                        <span className="text-muted-foreground text-xs">{data.email}</span>
                    </div>
                    <Badge
                        className={cn(
                            "ml-auto w-fit",
                            data.isActive
                                ? "bg-emerald-500/10 text-emerald-700"
                                : "bg-muted text-muted-foreground",
                        )}
                    >
                        {summary.statusText}
                    </Badge>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                    <Select
                        value={data.role}
                        onValueChange={(value) => handleRoleChange(value as UserRole)}
                        disabled={isRoleUpdating}
                    >
                        <SelectTrigger className="w-48">
                            <SelectValue placeholder="选择角色" />
                        </SelectTrigger>
                        <SelectContent>
                            {ROLE_OPTIONS.map((role) => (
                                <SelectItem key={role} value={role}>
                                    {ROLE_LABELS[role]}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button
                        variant={data.isActive ? "destructive" : "default"}
                        size="sm"
                        onClick={handleToggleStatus}
                        disabled={isStatusUpdating}
                    >
                        {isStatusUpdating
                            ? "更新中..."
                            : data.isActive
                            ? "立即禁用"
                            : "恢复启用"}
                    </Button>
                </div>
            </section>

            <EntityDrawerSection title="基础信息">
                <div className="space-y-3 rounded-xl border px-4 py-3">
                    <EntityDrawerProperty label="用户 ID" value={data.id} />
                    <EntityDrawerProperty
                        label="手机号"
                        value={data.phoneNumber ?? "未填写"}
                    />
                    <EntityDrawerProperty
                        label="角色"
                        value={ROLE_LABELS[data.role] ?? data.role}
                    />
                    <EntityDrawerProperty
                        label="邮箱验证"
                        value={data.emailVerified ? "已验证" : "未验证"}
                    />
                    <EntityDrawerProperty
                        label="手机号验证"
                        value={data.phoneNumberVerified ? "已验证" : "未验证"}
                    />
                    <EntityDrawerProperty
                        label="创建时间"
                        value={formatDateTime(data.createdAt)}
                    />
                    <EntityDrawerProperty
                        label="最近更新"
                        value={formatDateTime(data.updatedAt)}
                    />
                </div>
            </EntityDrawerSection>

            {data.profile?.realName || data.profile?.idCardNumber ? (
                <EntityDrawerSection
                    title="实名信息"
                    description="用户完成实名认证后将展示真实姓名与证件号码"
                >
                    <EntityDrawerProperty
                        label="真实姓名"
                        value={data.profile.realName ?? "—"}
                    />
                    <EntityDrawerProperty
                        label="证件号码"
                        value={data.profile.idCardNumber ?? "—"}
                    />
                </EntityDrawerSection>
            ) : null}

            <EntityDrawerSection title="订单概览">
                <div className="grid gap-3 sm:grid-cols-2">
                    <StatCard
                        title="累计订单"
                        value={`${data.stats.totalOrders} 单`}
                        helper={`已完成 ${data.stats.completedOrders} 单`}
                    />
                    <StatCard
                        title="取消订单"
                        value={`${data.stats.cancelledOrders} 单`}
                        helper="包含用户与平台侧取消"
                    />
                    <StatCard
                        title="总消费金额"
                        value={`¥${data.stats.totalSpent.amount.toFixed(2)}`}
                        helper="含退款后的净额"
                    />
                    <StatCard
                        title="最近下单"
                        value={
                            data.stats.lastOrderAt
                                ? formatDateTime(data.stats.lastOrderAt)
                                : "暂无记录"
                        }
                        helper="无订单时展示空状态"
                    />
                </div>
            </EntityDrawerSection>

            {!data.isActive ? (
                <div className="flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-50 px-3 py-2 text-sm text-amber-700">
                    <ShieldAlert className="size-4" />
                    该用户已被禁用，无法访问任何客户端或管理端功能。
                </div>
            ) : null}
        </EntityDrawerBody>
    )
}

function StatCard({
    title,
    value,
    helper,
}: {
    title: string
    value: string
    helper?: string
}) {
    return (
        <Card className="border-muted">
            <CardHeader className="py-3">
                <CardTitle className="text-xs font-medium text-muted-foreground">
                    {title}
                </CardTitle>
            </CardHeader>
            <CardContent className="space-y-1">
                <p className="text-lg font-semibold">{value}</p>
                {helper ? (
                    <p className="text-xs text-muted-foreground">{helper}</p>
                ) : null}
            </CardContent>
        </Card>
    )
}

function UserDetailSkeleton() {
    return (
        <div className="space-y-4">
            {Array.from({ length: 4 }).map((_, index) => (
                <Skeleton key={index} className="h-20 w-full rounded-xl" />
            ))}
        </div>
    )
}

function formatDateTime(value: string) {
    return new Date(value).toLocaleString()
}
