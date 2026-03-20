import type { OrderStatus } from "@repo/types";

export function resolveCancelOrderReason(status: OrderStatus) {
    return status === "pending_payment"
        ? "支付前用户取消订单"
        : "用户取消预约";
}

export function resolveCancelOrderDescription(status: OrderStatus) {
    if (status === "pending_payment") {
        return "取消后订单将直接关闭，如需继续预约需要重新下单。此操作不可撤销。";
    }

    if (status === "pending_acceptance") {
        return "取消后将结束当前待接单预约，如需继续服务需要重新下单。此操作不可撤销。";
    }

    return "取消后当前预约将失效，如需继续服务需要重新下单。此操作不可撤销。";
}
