import { useQueryClient } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useEffect } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "@repo/mobile-ui/lib/toast";
import {
    reconcileOrderPaymentStatus,
    syncOrderRelatedQueries,
    type RetryConfig,
} from "@/lib/order-payment-sync";
import {
    clearPendingWechatPaymentSession,
    consumeWechatPayResultSnapshot,
    getPendingWechatPaymentSession,
    type PendingWechatPaymentSession,
} from "@/lib/wechat-payment-session";

const RETURN_POLL_CONFIG: RetryConfig = {
    retries: 4,
    interval: 800,
    errorMessage: "支付状态确认失败，请稍后查看订单列表",
};

const ERROR_FALLBACK_QUERY_CONFIG: RetryConfig = {
    retries: 1,
    interval: 300,
    errorMessage: "支付状态暂未确认，请稍后查看订单列表",
};

const isSnapshotMatchedSession = (
    session: PendingWechatPaymentSession,
    receivedAt: string,
    prepayId?: string | null,
) => {
    const sessionCreatedAt = new Date(session.createdAt).getTime();
    const callbackReceivedAt = new Date(receivedAt).getTime();

    if (
        !Number.isFinite(sessionCreatedAt) ||
        !Number.isFinite(callbackReceivedAt)
    ) {
        return true;
    }

    if (callbackReceivedAt + 5000 < sessionCreatedAt) {
        return false;
    }

    if (session.prepayId && prepayId && session.prepayId !== prepayId) {
        return false;
    }

    return true;
};

export default function WechatPaymentReturnScreen() {
    const router = useRouter();
    const queryClient = useQueryClient();

    useEffect(() => {
        let cancelled = false;

        const handleReturn = async () => {
            const pendingSession = getPendingWechatPaymentSession();
            if (!pendingSession) {
                router.replace({
                    pathname: "/(tabs)/orders",
                    params: {
                        requestId: String(Date.now()),
                    },
                });
                return;
            }

            clearPendingWechatPaymentSession();
            const payResultSnapshot = consumeWechatPayResultSnapshot();
            const matchedSnapshot =
                payResultSnapshot &&
                isSnapshotMatchedSession(
                    pendingSession,
                    payResultSnapshot.receivedAt,
                    payResultSnapshot.prepayId,
                )
                    ? payResultSnapshot
                    : null;

            try {
                if (matchedSnapshot?.errorCode === -2) {
                    await syncOrderRelatedQueries(
                        queryClient,
                        pendingSession.orderId,
                    );
                    if (cancelled) {
                        return;
                    }
                    toast.info("您已取消支付");
                    router.replace({
                        pathname: "/(tabs)/orders",
                        params: {
                            requestId: String(Date.now()),
                        },
                    });
                    return;
                }

                if (matchedSnapshot?.errorCode === -1) {
                    const quickCheckResult = await reconcileOrderPaymentStatus({
                        queryClient,
                        orderId: pendingSession.orderId,
                        retryConfig: ERROR_FALLBACK_QUERY_CONFIG,
                        clientResultCode: String(matchedSnapshot.errorCode),
                    });

                    if (cancelled) {
                        return;
                    }

                    if (quickCheckResult.success) {
                        toast.success("支付成功");
                        router.replace({
                            pathname: "/servicePersonnel/payment-result",
                            params: {
                                success: "true",
                                orderId: pendingSession.orderId,
                                amount: pendingSession.amount.toFixed(2),
                                paymentMethod: pendingSession.paymentMethod,
                            },
                        });
                        return;
                    }

                    if (quickCheckResult.action === "pending") {
                        toast.info(
                            "支付结果暂未确认，已返回订单列表，可稍后查看",
                        );
                        router.replace({
                            pathname: "/(tabs)/orders",
                            params: {
                                requestId: String(Date.now()),
                            },
                        });
                        return;
                    }

                    toast.error(
                        matchedSnapshot.errorMessage ||
                            "微信支付返回异常，请稍后查看订单状态",
                    );
                    router.replace({
                        pathname: "/(tabs)/orders",
                        params: {
                            requestId: String(Date.now()),
                        },
                    });
                    return;
                }

                const reconcileResult = await reconcileOrderPaymentStatus({
                    queryClient,
                    orderId: pendingSession.orderId,
                    retryConfig: RETURN_POLL_CONFIG,
                    clientResultCode:
                        matchedSnapshot &&
                        typeof matchedSnapshot.errorCode === "number"
                            ? String(matchedSnapshot.errorCode)
                            : undefined,
                });

                if (cancelled) {
                    return;
                }

                if (reconcileResult.success) {
                    toast.success("支付成功");
                    router.replace({
                        pathname: "/servicePersonnel/payment-result",
                        params: {
                            success: "true",
                            orderId: pendingSession.orderId,
                            amount: pendingSession.amount.toFixed(2),
                            paymentMethod: pendingSession.paymentMethod,
                        },
                    });
                    return;
                }

                if (reconcileResult.action === "pending") {
                    toast.info("支付结果暂未确认，已返回订单列表，可稍后查看");
                    router.replace({
                        pathname: "/(tabs)/orders",
                        params: {
                            requestId: String(Date.now()),
                        },
                    });
                    return;
                }

                toast.error(
                    reconcileResult.message ??
                        RETURN_POLL_CONFIG.errorMessage ??
                        "支付失败，请稍后重试",
                );
                router.replace({
                    pathname: "/servicePersonnel/payment-result",
                    params: {
                        success: "false",
                        orderId: pendingSession.orderId,
                        amount: pendingSession.amount.toFixed(2),
                        paymentMethod: pendingSession.paymentMethod,
                    },
                });
            } catch (error) {
                if (cancelled) {
                    return;
                }
                toast.error(
                    error instanceof Error
                        ? error.message
                        : "支付状态确认失败，请稍后查看订单列表",
                );
                router.replace({
                    pathname: "/(tabs)/orders",
                    params: {
                        requestId: String(Date.now()),
                    },
                });
            }
        };

        void handleReturn();

        return () => {
            cancelled = true;
        };
    }, [queryClient, router]);

    return (
        <View className="flex-1 items-center justify-center bg-background px-6">
            <ActivityIndicator size="large" />
            <Text className="mt-4 text-center text-sm text-muted-foreground">
                正在快速确认支付结果，若未完成支付将自动返回订单页...
            </Text>
        </View>
    );
}
