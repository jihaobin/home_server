import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { PaymentMethod } from "@repo/types";
import { Image } from "expo-image";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { Pressable, ScrollView, View } from "react-native";

const ICON_MAP = lucideIconRegistry;

export type SupportedMobilePaymentMethod = Extract<
    PaymentMethod,
    "wechat_pay" | "alipay"
>;

interface PaymentOption {
    id: SupportedMobilePaymentMethod;
    name: string;
}

const paymentOptions: PaymentOption[] = [
    {
        id: "wechat_pay",
        name: "微信支付",
    },
    {
        id: "alipay",
        name: "支付宝支付",
    },
];

export interface PaymentMethodSheetProps {
    visible: boolean;
    onClose: () => void;
    totalAmount: number;
    selectedPayment: SupportedMobilePaymentMethod;
    onSelectPayment: (method: SupportedMobilePaymentMethod) => void;
    onConfirm: () => void;
    isProcessingPayment?: boolean;
    title?: string;
    confirmText?: string;
}

export function PaymentMethodSheet({
    visible,
    onClose,
    totalAmount,
    selectedPayment,
    onSelectPayment,
    onConfirm,
    isProcessingPayment = false,
    title = "选择支付方式",
    confirmText = "确认支付",
}: PaymentMethodSheetProps) {
    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            initialHeightRatio={0.45}
        >
            <ScrollView className="flex-1 px-4">
                <Text className="mb-4 text-xl font-bold text-foreground">
                    {title}
                </Text>

                <View className="flex flex-col gap-3">
                    {paymentOptions.map((option) => (
                        <Pressable
                            key={option.id}
                            onPress={() => onSelectPayment(option.id)}
                            className={`flex-row items-center rounded-xl border-2 p-4 ${
                                selectedPayment === option.id
                                    ? "border-primary bg-secondary"
                                    : "border-border bg-card"
                            }`}
                        >
                            <View className="h-12 w-12 items-center justify-center rounded-full">
                                {option.id === "alipay" ? (
                                    <Image
                                        source={require("@/assets/images/alipay-svgrepo-com.png")}
                                        contentFit="contain"
                                        style={{ width: 48, height: 48 }}
                                    />
                                ) : (
                                    <Image
                                        source={require("@/assets/images/wechat-logo-svgrepo-com.png")}
                                        contentFit="contain"
                                        style={{ width: 48, height: 48 }}
                                    />
                                )}
                            </View>
                            <Text className="ml-3 flex-1 text-base font-semibold text-foreground">
                                {option.name}
                            </Text>
                            {selectedPayment === option.id ? (
                                <Icon
                                    as={ICON_MAP.Check}
                                    size={24}
                                    className="text-primary"
                                />
                            ) : null}
                        </Pressable>
                    ))}
                </View>

                <View className="mt-6 flex-row items-center justify-between border-t border-border pt-4">
                    <View>
                        <Text className="text-sm text-muted-foreground">
                            支付金额
                        </Text>
                        <View className="mt-1 flex-row items-baseline">
                            <Text className="text-xs text-primary">¥</Text>
                            <Text className="text-2xl font-bold text-primary">
                                {totalAmount.toFixed(2)}
                            </Text>
                        </View>
                    </View>
                    <Button
                        onPress={onConfirm}
                        disabled={isProcessingPayment}
                        className="h-12 rounded-full bg-primary px-8"
                    >
                        <Text className="text-base font-semibold text-primary-foreground">
                            {isProcessingPayment ? "处理中..." : confirmText}
                        </Text>
                    </Button>
                </View>
            </ScrollView>
        </BottomSheetModal>
    );
}
