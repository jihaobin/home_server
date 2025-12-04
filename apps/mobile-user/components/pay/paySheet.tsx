import { useCreateDesignatedOrder } from "@repo/hooks/api/order";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { PaymentMethod } from "@repo/types";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { toast } from "sonner-native";
import { useOrderPayment } from "@/hooks/useOrderPayment";

const ICON_MAP = lucideIconRegistry;

interface PaymentOption {
	id: PaymentMethod;
	name: string;
	icon: keyof typeof ICON_MAP;
	iconColor: string;
}

const paymentOptions: PaymentOption[] = [
	{
		id: "wechat_pay",
		name: "微信支付",
		icon: "Smartphone",
		iconColor: "#07C160",
	},
	{
		id: "alipay",
		name: "支付宝支付",
		icon: "Wallet",
		iconColor: "#1677FF",
	},
];

export interface PaySheetProps {
	visible: boolean;
	onClose: () => void;
	orderData: {
		customerId: string;
		serviceId: string;
		addressId: string;
		appointmentTime: string;
		designatedPersonnelId: string;
		specificationId: string;
		displayPrice: number;
	};
	totalAmount: number;
	onPaymentSuccess?: (orderId: string) => void;
	onPaymentFailed?: (orderId: string, message: string) => void;
	onPaymentCancelled?: () => void;
}

export function PaySheet({
	visible,
	onClose,
	orderData,
	totalAmount,
	onPaymentSuccess,
	onPaymentFailed,
	onPaymentCancelled,
}: PaySheetProps) {
	const router = useRouter();
	const [selectedPayment, setSelectedPayment] =
		useState<PaymentMethod>("alipay");
	const [isCreatingOrder, setIsCreatingOrder] = useState(false);

	const { mutateAsync: createOrderAsync } = useCreateDesignatedOrder();
	const { payOrder, isPaying } = useOrderPayment();

	const isProcessingPayment = isCreatingOrder || isPaying;

	const waitForModalDismissal = () =>
		new Promise<void>((resolve) => setTimeout(resolve, 250));

	// 处理支付
	const handlePayment = async () => {
		if (!selectedPayment) {
			toast.error("请选择支付方式");
			return;
		}

		if (selectedPayment !== "alipay") {
			toast.error("当前仅支持支付宝支付");
			return;
		}

		if (isProcessingPayment) {
			return;
		}

		try {
			setIsCreatingOrder(true);
			toast.dismiss();
			toast.loading("正在创建订单...");

			const createdOrderResponse = await createOrderAsync(orderData);
			toast.dismiss();

			const createdOrderId = createdOrderResponse.data.orderId;
			// 关闭模态框并等待卸载，再跳转到外部支付，避免回调时原生视图仍在绘制
			onClose();
			await waitForModalDismissal();
			const paymentResult = await payOrder({
				orderId: createdOrderId,
				displayAmount: totalAmount,
			});

			if (paymentResult.success) {
				onPaymentSuccess?.(createdOrderId);
				router.push({
					pathname: "/servicePersonnel/payment-result",
					params: {
						success: "true",
						orderId: createdOrderId,
						amount: totalAmount.toFixed(2),
						paymentMethod: selectedPayment,
					},
				});
				return;
			}

			if (paymentResult.clientResultCode === "6001") {
				onPaymentCancelled?.();
				router.push("/orders");
				return;
			}

			if (paymentResult.paymentStatus === "pending") {
				onPaymentCancelled?.();
				router.push("/orders");
				return;
			}

			const failureMessage =
				paymentResult.message ?? "支付失败，请稍后重试";
			onPaymentFailed?.(createdOrderId, failureMessage);
			router.push({
				pathname: "/servicePersonnel/payment-result",
				params: {
					success: "false",
					orderId: createdOrderId,
					amount: totalAmount.toFixed(2),
					paymentMethod: selectedPayment,
					message: failureMessage,
				},
			});
		} catch (error) {
			toast.dismiss();
			const message =
				error instanceof Error
					? error.message
					: "创建订单失败，请稍后重试";
			toast.error(message);
		} finally {
			setIsCreatingOrder(false);
		}
	};

	return (
		<BottomSheetModal
			visible={visible}
			onClose={onClose}
			initialHeightRatio={0.45}
		>
			<ScrollView className="flex-1 px-4">
				<Text className="mb-4 text-xl font-bold text-foreground">
					选择支付方式
				</Text>

				<View className="flex flex-col gap-3">
					{paymentOptions.map((option) => (
						<Pressable
							key={option.id}
							onPress={() => setSelectedPayment(option.id)}
							className={`flex-row items-center rounded-xl border-2 p-4 active:bg-muted/50 ${selectedPayment === option.id
								? "border-primary bg-primary/5"
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
							{selectedPayment === option.id && (
								<Icon as={ICON_MAP.Check} size={24} className="text-primary" />
							)}
						</Pressable>
					))}
				</View>

				<View className="mt-6 flex-row items-center justify-between border-t border-border pt-4">
					<View>
						<Text className="text-sm text-muted-foreground">支付金额</Text>
						<View className="mt-1 flex-row items-baseline">
							<Text className="text-xs text-primary">¥</Text>
							<Text className="text-2xl font-bold text-primary">
								{totalAmount.toFixed(2)}
							</Text>
						</View>
					</View>
					<Button
						onPress={handlePayment}
						disabled={isProcessingPayment}
						className="h-12 rounded-full bg-primary px-8"
					>
						<Text className="text-base font-semibold text-primary-foreground">
							{isProcessingPayment ? "处理中..." : "确认支付"}
						</Text>
					</Button>
				</View>
			</ScrollView>
		</BottomSheetModal>
	);
}
