import type { QueryClient } from "@tanstack/react-query";
import { apiClient } from "@repo/lib/http-client";
import type { QueryPaymentStatusResponse } from "@repo/types";

export type RetryConfig = {
    retries: number;
    interval: number;
    errorMessage?: string;
};

export type PollResult = {
    success: boolean;
    paymentStatus: QueryPaymentStatusResponse["paymentStatus"];
    message?: string;
    channelStatus?: string;
    transactionId?: string;
};

export type ReconcileAction = "success" | "cancelled" | "pending" | "failed";

export type ReconcilePaymentResult = {
    success: boolean;
    action: ReconcileAction;
    paymentStatus: QueryPaymentStatusResponse["paymentStatus"];
    message?: string;
    clientResultCode?: string;
};

export type ReconcilePaymentOptions = {
    queryClient: QueryClient;
    orderId: string;
    retryConfig: RetryConfig;
    clientResultCode?: string;
    cancelled?: boolean;
    pendingAction?: Extract<ReconcileAction, "pending" | "failed">;
};

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export async function pollOrderPaymentStatus(
    orderId: string,
    config: RetryConfig,
): Promise<PollResult> {
    let lastSnapshot: QueryPaymentStatusResponse | null = null;

    for (let attempt = 0; attempt < config.retries; attempt++) {
        if (attempt > 0) {
            await delay(config.interval);
        }

        try {
            const response = await apiClient.get<QueryPaymentStatusResponse>(
                `/pay/orders/${orderId}/payment-status`,
            );

            lastSnapshot = response.data;

            if (response.data.paymentStatus !== "pending") {
                return {
                    success: response.data.paymentStatus === "succeeded",
                    paymentStatus: response.data.paymentStatus,
                    message: response.data.message,
                    channelStatus: response.data.channelStatus,
                    transactionId: response.data.transactionId,
                };
            }
        } catch {
            lastSnapshot = lastSnapshot ?? null;
        }
    }

    return {
        success: false,
        paymentStatus: lastSnapshot?.paymentStatus ?? "pending",
        message: lastSnapshot?.message,
        channelStatus: lastSnapshot?.channelStatus,
        transactionId: lastSnapshot?.transactionId,
    };
}

export async function syncOrderRelatedQueries(
    queryClient: QueryClient,
    orderId: string,
) {
    await Promise.allSettled([
        queryClient.invalidateQueries({ queryKey: ["orders-list"] }),
        queryClient.invalidateQueries({ queryKey: ["orders-list-infinite"] }),
        queryClient.invalidateQueries({
            queryKey: ["order-cards-list-infinite"],
        }),
        queryClient.invalidateQueries({ queryKey: ["order-detail", orderId] }),
        queryClient.refetchQueries(
            {
                queryKey: ["orders-list"],
                type: "all",
            },
            {
                throwOnError: false,
            },
        ),
        queryClient.refetchQueries(
            {
                queryKey: ["orders-list-infinite"],
                type: "all",
            },
            {
                throwOnError: false,
            },
        ),
        queryClient.refetchQueries(
            {
                queryKey: ["order-cards-list-infinite"],
                type: "all",
            },
            {
                throwOnError: false,
            },
        ),
        queryClient.refetchQueries(
            {
                queryKey: ["order-detail", orderId],
                type: "all",
            },
            {
                throwOnError: false,
            },
        ),
    ]);
}

export async function reconcileOrderPaymentStatus({
    queryClient,
    orderId,
    retryConfig,
    clientResultCode,
    cancelled = false,
    pendingAction = "pending",
}: ReconcilePaymentOptions): Promise<ReconcilePaymentResult> {
    const pollResult = await pollOrderPaymentStatus(orderId, retryConfig);
    await syncOrderRelatedQueries(queryClient, orderId);

    if (pollResult.success) {
        return {
            success: true,
            action: "success",
            paymentStatus: pollResult.paymentStatus,
            message: pollResult.message,
            clientResultCode,
        };
    }

    if (pollResult.paymentStatus === "pending") {
        return {
            success: false,
            action: pendingAction,
            paymentStatus: pollResult.paymentStatus,
            message: pollResult.message,
            clientResultCode,
        };
    }

    if (cancelled) {
        return {
            success: false,
            action: "cancelled",
            paymentStatus: pollResult.paymentStatus,
            message: pollResult.message,
            clientResultCode,
        };
    }

    return {
        success: false,
        action: "failed",
        paymentStatus: pollResult.paymentStatus,
        message: pollResult.message,
        clientResultCode,
    };
}
