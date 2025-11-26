"use client"

import type { AdminRevenueLog } from "@repo/types"
import {
    Badge,
    badgeVariants,
} from "@repo/web-ui/components/badge"
import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"
import { cn } from "@repo/web-ui/lib/utils"

type RevenueLogDetailDrawerProps = {
    log: AdminRevenueLog | null
    open: boolean
    onOpenChange: (open: boolean) => void
}

export function RevenueLogDetailDrawer({
    log,
    open,
    onOpenChange,
}: RevenueLogDetailDrawerProps) {
    return (
        <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
            <EntityDrawerContent width="lg">
                <EntityDrawerHeader>
                    <EntityDrawerTitle>流水详情</EntityDrawerTitle>
                </EntityDrawerHeader>
                <EntityDrawerBody className="gap-6">
                    {log ? <RevenueLogDetail log={log} /> : <EmptyState />}
                </EntityDrawerBody>
            </EntityDrawerContent>
        </EntityDrawer>
    )
}

function RevenueLogDetail({ log }: { log: AdminRevenueLog }) {
    return (
        <>
            <section className="space-y-2 rounded-2xl border bg-card/60 px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                    <div className="flex flex-col">
                        <span className="text-lg font-semibold leading-tight">
                            {formatTransactionType(log.transactionType)}
                        </span>
                        <span className="text-muted-foreground text-xs">
                            记录 ID：{log.id}
                        </span>
                    </div>
                    <Badge
                        className={cn(
                            "ml-auto",
                            badgeVariants({
                                variant: log.direction === "expense" ? "destructive" : "default",
                            }),
                        )}
                    >
                        {log.direction === "expense" ? "支出" : "收入"} {formatAmount(log)}
                    </Badge>
                </div>
                <p className="text-sm text-muted-foreground">
                    {log.description ?? "暂无描述"}
                </p>
            </section>

            <EntityDrawerSection title="基础信息">
                <div className="space-y-3 rounded-xl border px-4 py-3">
                    <EntityDrawerProperty
                        label="创建时间"
                        value={formatDateTime(log.createdAt)}
                    />
                    <EntityDrawerProperty
                        label="交易类型"
                        value={formatTransactionType(log.transactionType)}
                    />
                    <EntityDrawerProperty
                        label="金额"
                        value={`${formatAmount(log)} ${log.amount.currency}`}
                    />
                    <EntityDrawerProperty
                        label="外部引用号"
                        value={log.referenceId ?? "—"}
                    />
                    <EntityDrawerProperty
                        label="元数据"
                        value={log.metadata ?? "—"}
                    />
                </div>
            </EntityDrawerSection>

            <EntityDrawerSection title="关联信息">
                <div className="space-y-3 rounded-xl border px-4 py-3">
                    <EntityDrawerProperty
                        label="订单"
                        value={
                            log.order
                                ? `${log.order.orderSerial ?? log.order.id} (${log.order.status ?? "未知状态"})`
                                : "—"
                        }
                    />
                    <EntityDrawerProperty
                        label="用户"
                        value={
                            log.user
                                ? `${log.user.name ?? log.user.email ?? log.user.id}`
                                : "—"
                        }
                    />
                    <EntityDrawerProperty
                        label="提现记录"
                        value={
                            log.withdrawal
                                ? `${log.withdrawal.id}（${formatWithdrawalStatus(
                                      log.withdrawal.status,
                                  )}）`
                                : "—"
                        }
                    />
                </div>
            </EntityDrawerSection>
        </>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
            请选择一条流水查看详情
        </div>
    )
}

function formatTransactionType(type: AdminRevenueLog["transactionType"]) {
    switch (type) {
        case "payment_received":
            return "订单收款"
        case "service_earning":
            return "服务分成"
        case "platform_fee":
            return "平台手续费"
        case "withdrawal":
            return "提现"
        case "refund_paid":
            return "退款支出"
        case "bonus":
            return "奖金"
        case "penalty":
            return "罚金"
        case "adjustment":
            return "调整"
        default:
            return type
    }
}

function formatWithdrawalStatus(status: string) {
    switch (status) {
        case "pending":
            return "待处理"
        case "approved":
            return "已通过"
        case "rejected":
            return "已驳回"
        default:
            return status
    }
}

function formatAmount(log: AdminRevenueLog) {
    const amount = Math.abs(log.amount.amount ?? 0).toFixed(2)
    return `${log.direction === "expense" ? "-" : "+"}${amount}`
}

function formatDateTime(value: string) {
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) {
        return value
    }
    return date.toLocaleString("zh-CN", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
    })
}
