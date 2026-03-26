import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import { ActivityIndicator, View } from "react-native";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "@repo/mobile-ui/lib/toast";
import { useOrderPayment } from "@/hooks/useOrderPayment";
import {
    PaymentMethodSheet,
    type SupportedMobilePaymentMethod,
} from "./PaymentMethodSheet";

export interface ExistingOrderPaySheetProps {
    visible: boolean;
    onClose: () => void;
    orderId: string;
    totalAmount: number;
    paymentExpiresAt?: Date | string | null;
    onPaymentSuccess?: (orderId: string) => void;
    onPaymentFailed?: (orderId: string, message: string) => void;
    onPaymentCancelled?: () => void;
}

export function ExistingOrderPaySheet({
    visible,
    onClose,
    orderId,
    totalAmount,
    paymentExpiresAt,
    onPaymentSuccess,
    onPaymentFailed,
    onPaymentCancelled,
}: ExistingOrderPaySheetProps) {
    const router = useRouter();
    const [selectedPayment, setSelectedPayment] =
        useState<SupportedMobilePaymentMethod>("wechat_pay");
    const [isLaunchingPayment, setIsLaunchingPayment] = useState(false);
    const { payOrder, isPaying } = useOrderPayment();
    const processingRef = useRef(false);
    const launchOverlayTimeoutRef = useRef<ReturnType<
        typeof setTimeout
    > | null>(null);

    useEffect(() => {
        if (visible) {
            setSelectedPayment("wechat_pay");
        }
    }, [visible, orderId]);

    const waitForModalDismissal = () =>
        new Promise<void>((resolve) => setTimeout(resolve, 250));

    const showLaunchOverlay = () => {
        if (launchOverlayTimeoutRef.current) {
            clearTimeout(launchOverlayTimeoutRef.current);
            launchOverlayTimeoutRef.current = null;
        }

        setIsLaunchingPayment(true);
        launchOverlayTimeoutRef.current = setTimeout(() => {
            setIsLaunchingPayment(false);
            launchOverlayTimeoutRef.current = null;
        }, 2500);
    };

    const hideLaunchOverlay = () => {
        if (launchOverlayTimeoutRef.current) {
            clearTimeout(launchOverlayTimeoutRef.current);
            launchOverlayTimeoutRef.current = null;
        }

        setIsLaunchingPayment(false);
    };

    useEffect(() => {
        return () => {
            if (launchOverlayTimeoutRef.current) {
                clearTimeout(launchOverlayTimeoutRef.current);
                launchOverlayTimeoutRef.current = null;
            }
        };
    }, []);

    const handlePayment = async () => {
        if (!selectedPayment) {
            toast.error("请选择支付方式");
            return;
        }

        if (isPaying || processingRef.current) {
            return;
        }

        processingRef.current = true;

        try {
            showLaunchOverlay();
            onClose();
            await waitForModalDismissal();

            const paymentResult = await payOrder({
                orderId,
                displayAmount: totalAmount,
                paymentExpiresAt,
                payType: selectedPayment,
            });

            if (paymentResult.success) {
                onPaymentSuccess?.(orderId);
                router.push({
                    pathname: "/servicePersonnel/payment-result",
                    params: {
                        success: "true",
                        orderId,
                        amount: totalAmount.toFixed(2),
                        paymentMethod: selectedPayment,
                    },
                });
                return;
            }

            if (paymentResult.action === "cancelled") {
                onPaymentCancelled?.();
                router.push({
                    pathname: "/(tabs)/orders",
                    params: {
                        requestId: String(Date.now()),
                    },
                });
                return;
            }

            if (paymentResult.action === "pending") {
                router.push({
                    pathname: "/(tabs)/orders",
                    params: {
                        requestId: String(Date.now()),
                    },
                });
                return;
            }

            if (paymentResult.action === "external_pending") {
                return;
            }

            const failureMessage =
                paymentResult.message ?? "支付失败，请稍后重试";
            onPaymentFailed?.(orderId, failureMessage);
            router.push({
                pathname: "/servicePersonnel/payment-result",
                params: {
                    success: "false",
                    orderId,
                    amount: totalAmount.toFixed(2),
                    paymentMethod: selectedPayment,
                    message: failureMessage,
                },
            });
        } finally {
            hideLaunchOverlay();
            processingRef.current = false;
        }
    };

    return (
        <>
            <PaymentMethodSheet
                visible={visible}
                onClose={onClose}
                totalAmount={totalAmount}
                selectedPayment={selectedPayment}
                onSelectPayment={setSelectedPayment}
                onConfirm={() => {
                    void handlePayment();
                }}
                isProcessingPayment={isPaying}
            />
            {isLaunchingPayment ? (
                <View
                    className="absolute inset-0 items-center justify-center"
                    pointerEvents="auto"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.35)" }}
                >
                    <View className="items-center rounded-2xl bg-card px-6 py-5">
                        <ActivityIndicator size="large" />
                        <Text className="mt-3 text-sm text-foreground">
                            支付中，请稍候...
                        </Text>
                    </View>
                </View>
            ) : null}
        </>
    );
}
