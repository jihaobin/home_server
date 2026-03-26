import { useCallback, useRef, useState } from "react";
import { useInitiatePayment } from "@repo/hooks/api/pay";
import { useQueryClient } from "@tanstack/react-query";
import {
    aliPay,
    ensureWeChatAppRegistered,
    isWeChatAppInstalled,
    wechatPay,
} from "@repo/lib/pay";
import type { PaymentMethod, QueryPaymentStatusResponse } from "@repo/types";
import { toast } from "@repo/mobile-ui/lib/toast";
import {
    reconcileOrderPaymentStatus,
    syncOrderRelatedQueries,
    type RetryConfig,
} from "@/lib/order-payment-sync";
import {
    clearWechatPayResultSnapshot,
    clearPendingWechatPaymentSession,
    setPendingWechatPaymentSession,
} from "@/lib/wechat-payment-session";

type PaymentFlowResult = {
    success: boolean;
    action: "success" | "cancelled" | "pending" | "failed" | "external_pending";
    paymentStatus: QueryPaymentStatusResponse["paymentStatus"];
    message?: string;
    clientResultCode?: string;
};

type PayOrderParams = {
    orderId: string;
    displayAmount: number;
    paymentExpiresAt?: Date | string | null;
    payType?: Extract<PaymentMethod, "alipay" | "wechat_pay">;
};

const FALLBACK_CONFIG: RetryConfig = {
    retries: 3,
    interval: 2000,
    errorMessage: "支付失败，请稍后重试",
};

const ALIPAY_RESULT_STATUS_CONFIG: Record<string, RetryConfig> = {
    "9000": {
        retries: 3,
        interval: 1500,
        errorMessage: "支付结果确认失败，请稍后重试",
    },
    "8000": {
        retries: 10,
        interval: 3000,
        errorMessage: "支付结果尚未确认，请稍后重试",
    },
    "6004": {
        retries: 10,
        interval: 3000,
        errorMessage: "支付结果尚未确认，请稍后重试",
    },
    "6001": {
        retries: 1,
        interval: 1500,
        errorMessage: "您已取消支付",
    },
    "6002": {
        retries: 5,
        interval: 2000,
        errorMessage: "网络异常，请稍后查看支付结果",
    },
    "4000": {
        retries: 3,
        interval: 2000,
        errorMessage: "支付失败，请稍后重试",
    },
    "5000": {
        retries: 3,
        interval: 2000,
        errorMessage: "支付请求重复或失败，请稍后重试",
    },
};

const resolveAlipayRetryConfig = (code?: string | null): RetryConfig => {
    return {
        ...FALLBACK_CONFIG,
        ...(code ? (ALIPAY_RESULT_STATUS_CONFIG[code] ?? {}) : {}),
    };
};

const resolveErrorMessage = (error: unknown) => {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    return "操作失败，请稍后重试";
};

const wait = (ms: number) =>
    new Promise<void>((resolve) => setTimeout(resolve, ms));

const isPaymentExpired = (value?: Date | string | null) => {
    if (!value) {
        return false;
    }
    const expiresAt = typeof value === "string" ? new Date(value) : value;
    const timestamp = expiresAt.getTime();
    if (Number.isNaN(timestamp)) {
        return false;
    }
    return timestamp <= Date.now();
};

export function useOrderPayment() {
    const initiatePayment = useInitiatePayment();
    const queryClient = useQueryClient();
    const [isPaying, setIsPaying] = useState(false);
    const payingRef = useRef(false);

    const syncOrderCaches = useCallback(
        async (orderId: string) => {
            await syncOrderRelatedQueries(queryClient, orderId);
        },
        [queryClient],
    );

    const payOrder = useCallback(
        async ({
            orderId,
            displayAmount,
            paymentExpiresAt,
            payType = "alipay",
        }: PayOrderParams): Promise<PaymentFlowResult> => {
            if (!orderId) {
                toast.error("订单信息缺失，请稍后重试");
                return {
                    success: false,
                    action: "failed",
                    paymentStatus: "pending",
                    message: "订单信息缺失",
                };
            }

            const amount = Number(displayAmount);
            if (!Number.isFinite(amount) || amount <= 0) {
                toast.error("订单金额异常，请稍后重试");
                return {
                    success: false,
                    action: "failed",
                    paymentStatus: "pending",
                    message: "订单金额异常",
                };
            }

            if (isPaymentExpired(paymentExpiresAt)) {
                toast.error("订单支付已超时，请重新下单");
                return {
                    success: false,
                    action: "failed",
                    paymentStatus: "pending",
                    message: "支付已超时",
                };
            }

            if (isPaying || payingRef.current) {
                return {
                    success: false,
                    action: "pending",
                    paymentStatus: "pending",
                    message: "支付处理中，请稍候",
                };
            }

            payingRef.current = true;
            setIsPaying(true);

            try {
                const paymentResponse = await initiatePayment.mutateAsync({
                    orderId,
                    data: {
                        payType,
                        displayAmount: amount,
                    },
                });

                if (paymentResponse.data.payType === "alipay") {
                    const alipayResult = await aliPay(
                        paymentResponse.data.orderString,
                    );

                    const resultStatus =
                        alipayResult?.resultStatus ?? "unknown";
                    const config = resolveAlipayRetryConfig(resultStatus);

                    const reconcileResult = await reconcileOrderPaymentStatus({
                        queryClient,
                        orderId,
                        retryConfig: config,
                        clientResultCode: resultStatus,
                        cancelled: resultStatus === "6001",
                    });

                    if (reconcileResult.success) {
                        toast.success("支付成功");
                    } else if (reconcileResult.action === "failed") {
                        toast.error(
                            reconcileResult.message ??
                                config.errorMessage ??
                                "支付失败，请稍后重试",
                        );
                    }

                    return {
                        success: reconcileResult.success,
                        action: reconcileResult.action,
                        paymentStatus: reconcileResult.paymentStatus,
                        message: reconcileResult.message ?? config.errorMessage,
                        clientResultCode: reconcileResult.clientResultCode,
                    };
                }

                const universalLink =
                    process.env.EXPO_PUBLIC_WECHAT_USER_UNIVERSAL_LINK?.trim() ||
                    process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK?.trim();

                await ensureWeChatAppRegistered({
                    appId: paymentResponse.data.wechatPayRequest.appId,
                    universalLink: universalLink ?? "",
                });

                const installed = await isWeChatAppInstalled();
                if (!installed) {
                    throw new Error("请先安装微信客户端");
                }

                clearWechatPayResultSnapshot();

                setPendingWechatPaymentSession({
                    orderId,
                    amount,
                    paymentMethod: "wechat_pay",
                    createdAt: new Date().toISOString(),
                    paymentExpiresAt:
                        typeof paymentExpiresAt === "string"
                            ? paymentExpiresAt
                            : (paymentExpiresAt?.toISOString() ?? null),
                    prepayId: paymentResponse.data.wechatPayRequest.prepayId,
                });

                const wechatDispatchPromise = wechatPay(
                    paymentResponse.data.wechatPayRequest,
                )
                    .then((dispatched) => ({
                        kind: "resolved" as const,
                        dispatched,
                    }))
                    .catch((error: unknown) => ({
                        kind: "error" as const,
                        error,
                    }));

                const wechatDispatchOutcome = await Promise.race([
                    wechatDispatchPromise,
                    wait(1200).then(() => ({
                        kind: "timeout" as const,
                    })),
                ]);

                if (
                    wechatDispatchOutcome.kind === "resolved" &&
                    !wechatDispatchOutcome.dispatched
                ) {
                    throw new Error("微信支付拉起失败，请稍后重试");
                }

                if (wechatDispatchOutcome.kind === "error") {
                    throw wechatDispatchOutcome.error;
                }

                return {
                    success: false,
                    action: "external_pending",
                    paymentStatus: "pending",
                    message: "微信支付已拉起，请返回应用确认结果",
                    clientResultCode: "dispatched",
                };
            } catch (error) {
                const message = resolveErrorMessage(error);
                clearPendingWechatPaymentSession();
                await syncOrderCaches(orderId);
                toast.error(message);
                return {
                    success: false,
                    action: "failed",
                    paymentStatus: "failed",
                    message,
                };
            } finally {
                void syncOrderCaches(orderId);
                payingRef.current = false;
                setIsPaying(false);
            }
        },
        [initiatePayment, isPaying, syncOrderCaches],
    );

    return {
        payOrder,
        isPaying,
    };
}
