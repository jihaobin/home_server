import type { AssignmentType, OrderStatus, PaymentStatus } from "@repo/types"

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
    pending_payment: "待支付",
    payment_timeout: "支付超时",
    pending_acceptance: "待接单",
    paid: "待服务/待完成确认",
    staff_rejected: "服务人员拒单",
    completed: "已完成",
    cancelled: "已取消",
    refunded: "已退款",
}

export const ORDER_STATUS_BADGE_CLASSES: Record<OrderStatus, string> = {
    pending_payment: "bg-amber-100 text-amber-700",
    payment_timeout: "bg-rose-100 text-rose-700",
    pending_acceptance: "bg-amber-100 text-amber-700",
    paid: "bg-blue-100 text-blue-700",
    staff_rejected: "bg-orange-100 text-orange-700",
    completed: "bg-emerald-100 text-emerald-700",
    cancelled: "bg-muted text-muted-foreground",
    refunded: "bg-rose-100 text-rose-700",
}

export const ASSIGNMENT_TYPE_LABELS: Record<AssignmentType, string> = {
    system_auto: "系统指派",
    customer_designated: "用户指定",
    grab: "抢单",
}

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
    pending: "待支付",
    succeeded: "支付成功",
    failed: "支付失败",
    refunded: "已退款",
}

export const PAYMENT_STATUS_BADGE_CLASSES: Record<PaymentStatus, string> = {
    pending: "bg-muted text-muted-foreground",
    succeeded: "bg-emerald-100 text-emerald-700",
    failed: "bg-rose-100 text-rose-700",
    refunded: "bg-slate-100 text-slate-600",
}
