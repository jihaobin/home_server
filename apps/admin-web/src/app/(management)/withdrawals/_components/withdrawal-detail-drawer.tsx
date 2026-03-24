"use client"

import { useState } from "react"
import type { AdminWithdrawal } from "@repo/types"
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from "@repo/web-ui/components/alert-dialog"
import { Badge } from "@repo/web-ui/components/badge"
import { Button } from "@repo/web-ui/components/button"
import { Label } from "@repo/web-ui/components/label"
import { Textarea } from "@repo/web-ui/components/textarea"
import { cn } from "@repo/web-ui/lib/utils"
import { useReviewAdminWithdrawal } from "@repo/hooks/api/ssr"
import {
    EntityDrawer,
    EntityDrawerBody,
    EntityDrawerContent,
    EntityDrawerHeader,
    EntityDrawerProperty,
    EntityDrawerSection,
    EntityDrawerTitle,
} from "@/components/common"
import type { WithdrawalsQueryState } from "../_utils/query"
import { toast } from "sonner"

type WithdrawalDetailDrawerProps = {
    withdrawal: AdminWithdrawal | null
    open: boolean
    onOpenChange: (open: boolean) => void
    query: WithdrawalsQueryState
    onWithdrawalUpdated?: (withdrawal: AdminWithdrawal) => void
}

export function WithdrawalDetailDrawer({
    withdrawal,
    open,
    onOpenChange,
    query,
    onWithdrawalUpdated,
}: WithdrawalDetailDrawerProps) {
    const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({})
    const [pendingAction, setPendingAction] = useState<"approve" | "reject" | null>(
        null,
    )
    const reviewMutation = useReviewAdminWithdrawal(query)

    const activeWithdrawalId = withdrawal?.id ?? null
    const serverNote = withdrawal?.reviewNote ?? ""
    const note =
        activeWithdrawalId ? noteDrafts[activeWithdrawalId] ?? serverNote : ""

    const handleNoteChange = (value: string) => {
        if (!activeWithdrawalId) {
            return
        }
        setNoteDrafts((prev) => ({
            ...prev,
            [activeWithdrawalId]: value,
        }))
    }

    const canReview = withdrawal?.status === "pending"

    const handleConfirm = async () => {
        if (!withdrawal || !pendingAction) {
            return
        }
        const trimmedNote = note.trim()
        const targetWithdrawalId = withdrawal.id
        if (pendingAction === "reject" && !trimmedNote) {
            toast.error("驳回时请填写备注")
            return
        }

        try {
            const updated = await reviewMutation.mutateAsync({
                withdrawalId: withdrawal.id,
                payload: {
                    action: pendingAction,
                    note: trimmedNote || undefined,
                },
            })
            onWithdrawalUpdated?.(updated)
            setNoteDrafts((prev) => {
                if (!targetWithdrawalId) {
                    return prev
                }
                const next = { ...prev }
                delete next[targetWithdrawalId]
                return next
            })
            toast.success(
                pendingAction === "approve"
                    ? getApproveSuccessMessage(updated.status)
                    : "提现已驳回，冻结余额已解冻",
            )
            setPendingAction(null)
        } catch (error) {
            toast.error(`审核提现失败：${(error as Error).message}`)
        }
    }

    const statusBadgeClass = withdrawal
        ? STATUS_BADGE_CLASS[withdrawal.status]
        : undefined

    return (
        <>
            <EntityDrawer open={open} onOpenChange={onOpenChange} direction="right">
                <EntityDrawerContent width="lg">
                    <EntityDrawerHeader>
                        <EntityDrawerTitle>提现详情</EntityDrawerTitle>
                    </EntityDrawerHeader>
                    <EntityDrawerBody className="gap-6">
                        {withdrawal ? (
                            <>
                                <section className="space-y-3 rounded-2xl border bg-card/60 px-5 py-4">
                                    <div className="flex flex-wrap items-center gap-3">
                                        <div className="flex flex-col">
                                            <span className="text-lg font-semibold leading-tight">
                                                {withdrawal.user?.name ??
                                                    withdrawal.user?.email ??
                                                    withdrawal.user?.id ??
                                                    "服务人员"}
                                            </span>
                                            <span className="text-muted-foreground text-xs">
                                                提现 ID：{withdrawal.id}
                                            </span>
                                        </div>
                                        <Badge
                                            className={cn(
                                                "ml-auto",
                                                statusBadgeClass,
                                            )}
                                        >
                                            {STATUS_LABELS[withdrawal.status]}
                                        </Badge>
                                    </div>
                                    <div className="grid gap-6 md:grid-cols-2">
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                提现金额
                                            </p>
                                            <p className="text-2xl font-semibold">
                                                {formatAmount(withdrawal)}
                                            </p>
                                        </div>
                                        <div>
                                            <p className="text-sm text-muted-foreground">
                                                收款账户
                                            </p>
                                            <p className="font-medium">
                                                {METHOD_LABELS[withdrawal.method] ??
                                                    withdrawal.method}
                                            </p>
                                            <p className="text-xs text-muted-foreground">
                                                {ACCOUNT_TYPE_LABELS[
                                                    withdrawal.payeeAccountType
                                                ] ?? withdrawal.payeeAccountType}
                                                ：{withdrawal.payeeAccount}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="space-y-2 rounded-xl border px-4 py-3">
                                        <Label htmlFor="review-note">审核备注</Label>
                                        <Textarea
                                            id="review-note"
                                            placeholder="记录本次审核的备注信息"
                                            value={note}
                                            onChange={(event) => handleNoteChange(event.target.value)}
                                            disabled={!canReview || reviewMutation.isPending}
                                            rows={3}
                                        />
                                        <div className="flex flex-wrap gap-2">
                                            <Button
                                                variant="default"
                                                size="sm"
                                                className="gap-1.5"
                                                disabled={!canReview || reviewMutation.isPending}
                                                onClick={() => setPendingAction("approve")}
                                            >
                                                通过并发起打款
                                            </Button>
                                            <Button
                                                variant="destructive"
                                                size="sm"
                                                className="gap-1.5"
                                                disabled={!canReview || reviewMutation.isPending}
                                                onClick={() => setPendingAction("reject")}
                                            >
                                                驳回申请
                                            </Button>
                                        </div>
                                        {!canReview ? (
                                            <p className="text-xs text-muted-foreground">
                                                仅待审核的记录支持再次审批。
                                            </p>
                                        ) : null}
                                    </div>
                                </section>

                                <EntityDrawerSection title="提现信息">
                                    <div className="space-y-3 rounded-xl border px-4 py-3">
                                        <EntityDrawerProperty
                                            label="申请时间"
                                            value={formatDateTime(withdrawal.requestedAt)}
                                        />
                                        <EntityDrawerProperty
                                            label="终态时间"
                                            value={
                                                withdrawal.processedAt
                                                    ? formatDateTime(withdrawal.processedAt)
                                                    : "—"
                                            }
                                        />
                                        <EntityDrawerProperty
                                            label="用户备注"
                                            value={withdrawal.remark ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="打款流水号"
                                            value={withdrawal.payoutReferenceId ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="渠道状态"
                                            value={withdrawal.providerState ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="渠道单号"
                                            value={withdrawal.providerBillNo ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="渠道 AppID"
                                            value={withdrawal.providerAppId ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="渠道补充信息"
                                            value={withdrawal.providerPackageInfo ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="失败原因"
                                            value={withdrawal.failureReason ?? "—"}
                                        />
                                    </div>
                                </EntityDrawerSection>

                                <EntityDrawerSection title="服务人员信息">
                                    <div className="space-y-3 rounded-xl border px-4 py-3">
                                        <EntityDrawerProperty
                                            label="姓名"
                                            value={withdrawal.user?.name ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="邮箱"
                                            value={withdrawal.user?.email ?? "—"}
                                        />
                                        <EntityDrawerProperty
                                            label="手机号"
                                            value={withdrawal.user?.phoneNumber ?? "—"}
                                        />
                                    </div>
                                </EntityDrawerSection>

                                <EntityDrawerSection title="审核信息">
                                    <div className="space-y-3 rounded-xl border px-4 py-3">
                                        <EntityDrawerProperty
                                            label="审核人"
                                            value={
                                                withdrawal.reviewer
                                                    ? withdrawal.reviewer.name ??
                                                    withdrawal.reviewer.id
                                                    : "待分配"
                                            }
                                        />
                                        <EntityDrawerProperty
                                            label="审核时间"
                                            value={
                                                withdrawal.reviewedAt
                                                    ? formatDateTime(withdrawal.reviewedAt)
                                                    : "—"
                                            }
                                        />
                                        <EntityDrawerProperty
                                            label="审核备注"
                                            value={withdrawal.reviewNote ?? "—"}
                                        />
                                    </div>
                                </EntityDrawerSection>
                            </>
                        ) : (
                            <EmptyState />
                        )}
                    </EntityDrawerBody>
                </EntityDrawerContent>
            </EntityDrawer>

            <AlertDialog
                open={pendingAction !== null}
                onOpenChange={(open) => {
                    if (!open) {
                        setPendingAction(null)
                    }
                }}
            >
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>
                            {pendingAction === "approve" ? "确认通过提现" : "确认驳回提现"}
                        </AlertDialogTitle>
                        <AlertDialogDescription>
                            {pendingAction === "approve"
                                ? "系统将触发渠道打款并回写渠道状态；审核通过不代表已经到账，请确保账户余额与收款信息无误。"
                                : "驳回后会将冻结金额退回服务人员余额并记录备注。"}
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={reviewMutation.isPending}>
                            取消
                        </AlertDialogCancel>
                        <AlertDialogAction
                            className={cn(
                                pendingAction === "reject" && "bg-destructive text-destructive-foreground hover:bg-destructive/90",
                            )}
                            disabled={reviewMutation.isPending}
                            onClick={handleConfirm}
                        >
                            {pendingAction === "approve" ? "确认通过" : "确认驳回"}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </>
    )
}

function EmptyState() {
    return (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed px-6 py-16 text-center text-sm text-muted-foreground">
            请选择一条提现记录查看详情
        </div>
    )
}

const STATUS_LABELS: Record<AdminWithdrawal["status"], string> = {
    pending: "待审核",
    approved: "待渠道处理",
    processing: "处理中",
    completed: "已完成",
    failed: "打款失败",
    cancelled: "已取消",
    rejected: "已驳回",
}

const STATUS_BADGE_CLASS: Record<AdminWithdrawal["status"], string> = {
    pending: "bg-amber-100 text-amber-800",
    approved: "bg-sky-100 text-sky-700",
    processing: "bg-indigo-100 text-indigo-700",
    completed: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    cancelled: "bg-slate-200 text-slate-700",
    rejected: "bg-rose-100 text-rose-700",
}

const METHOD_LABELS: Record<AdminWithdrawal["method"], string> = {
    alipay: "支付宝",
    wechat_pay: "微信支付",
    bank_transfer: "银行转账",
}

const ACCOUNT_TYPE_LABELS: Record<AdminWithdrawal["payeeAccountType"], string> =
{
    ALIPAY_USER_ID: "支付宝 UID",
    ALIPAY_LOGON_ID: "支付宝登录号",
    ALIPAY_OPEN_ID: "支付宝 OpenID",
    WECHAT_OPENID: "微信 OpenID",
}

function getApproveSuccessMessage(status: AdminWithdrawal["status"]) {
    switch (status) {
        case "completed":
            return "提现已完成"
        case "approved":
        case "processing":
            return "提现已审核通过，渠道处理中"
        case "failed":
            return "提现已审核通过，但渠道返回失败"
        case "cancelled":
            return "提现已审核通过，但渠道已取消"
        default:
            return `提现状态已更新为${STATUS_LABELS[status]}`
    }
}

function formatAmount(withdrawal: AdminWithdrawal) {
    const amount = withdrawal.amount.amount ?? 0
    return `¥${amount.toFixed(2)}`
}

function formatDateTime(value: string | null) {
    if (!value) {
        return "—"
    }
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
