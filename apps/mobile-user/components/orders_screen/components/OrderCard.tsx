import { useCallback, useMemo } from "react";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { useRouter } from "expo-router";
import {
	ActivityIndicator,
	Alert,
	GestureResponderEvent,
	Image,
	TouchableOpacity,
	View,
} from "react-native";
import { STATUS_LABEL_MAP } from "../mock";
import type { OrderCardProps } from "../types";
import { formatCurrency, formatDateTime } from "../utils";
import { useOrderActions } from "../hooks/useOrderActions";

type ActionButtonProps = {
	label: string;
	variant?: "primary" | "secondary";
	onPress: () => void;
	loading?: boolean;
};

const ActionButton = ({
	label,
	variant = "secondary",
	onPress,
	loading = false,
}: ActionButtonProps) => {
	const baseClasses =
		variant === "primary"
			? "rounded-full bg-primary px-4 py-1.5"
			: "rounded-full border border-border px-4 py-1.5";
	const textClasses =
		variant === "primary"
			? "text-xs font-medium text-primary-foreground"
			: "text-xs text-foreground";
	const indicatorColor = variant === "primary" ? "#ffffff" : "#111827";

	return (
		<TouchableOpacity
			activeOpacity={0.8}
			disabled={loading}
			onPress={(event: GestureResponderEvent) => {
				event.stopPropagation();
				onPress();
			}}
			className={cn(
				baseClasses,
				"min-w-[88px] flex-row items-center justify-center",
				loading ? "opacity-70" : "",
			)}
		>
			{loading ? (
				<ActivityIndicator size="small" color={indicatorColor} />
			) : (
				<Text className={textClasses}>{label}</Text>
			)}
		</TouchableOpacity>
	);
};

export function OrderCard({ order, section }: OrderCardProps) {
	const router = useRouter();
	const {
		payExistingOrder,
		isPaying,
		cancelOrder,
		isCancelling,
		completeOrder,
		isCompleting,
		reorder,
	} = useOrderActions();
	const appointmentDisplay = formatDateTime(order.appointmentTime);
	const statusLabel = STATUS_LABEL_MAP[order.status];

	const handleNavigateDetail = useCallback(() => {
		router.push(`/order/${order.id}` as any);
	}, [router, order.id]);

	const handlePayOrder = useCallback(() => {
		void payExistingOrder({
			orderId: order.id,
			amount: Number(order.totalAmount),
		});
	}, [order.id, order.totalAmount, payExistingOrder]);

	const handleCancelOrder = useCallback(() => {
		const cancelReason =
			order.status === "pending_payment"
				? "支付前用户取消订单"
				: "用户取消预约";
		Alert.alert("确认要取消该订单吗？", "取消后需要重新下单才能继续服务。", [
			{ text: "再想想", style: "cancel" },
			{
				text: "确认取消",
				style: "destructive",
				onPress: () => {
					void cancelOrder({ orderId: order.id, reason: cancelReason });
				},
			},
		]);
	}, [cancelOrder, order.id, order.status]);

	const handleCompleteOrder = useCallback(() => {
		Alert.alert("确认服务已完成？", "确认后订单将被标记为已完成。", [
			{ text: "稍后再说", style: "cancel" },
			{
				text: "确认完成",
				onPress: () => {
					void completeOrder({ orderId: order.id });
				},
			},
		]);
	}, [completeOrder, order.id]);

	const handleReorder = useCallback(() => {
		reorder();
	}, [reorder]);

	const actionButtons = useMemo(() => {
		const buttons: ActionButtonProps[] = [];

		switch (order.status) {
			case "pending_payment":
				buttons.push({
					label: "取消订单",
					variant: "secondary",
					onPress: handleCancelOrder,
					loading: isCancelling,
				});
				buttons.push({
					label: "立即支付",
					variant: "primary",
					onPress: handlePayOrder,
					loading: isPaying,
				});
				break;
			case "paid":
				buttons.push({
					label: "取消订单",
					variant: "secondary",
					onPress: handleCancelOrder,
					loading: isCancelling,
				});
				buttons.push({
					label: "查看详情",
					variant: "primary",
					onPress: handleNavigateDetail,
				});
				break;
			case "in_progress":
				buttons.push({
					label: "确认完成",
					variant: "primary",
					onPress: handleCompleteOrder,
					loading: isCompleting,
				});
				buttons.push({
					label: "查看详情",
					variant: "secondary",
					onPress: handleNavigateDetail,
				});
				break;
			case "completed":
				buttons.push({
					label: "再次预约",
					variant: "primary",
					onPress: handleReorder,
				});
				buttons.push({
					label: "查看详情",
					variant: "secondary",
					onPress: handleNavigateDetail,
				});
				break;
			case "cancelled":
			case "refunded":
				buttons.push({
					label: "再次预约",
					variant: "primary",
					onPress: handleReorder,
				});
				buttons.push({
					label: "查看详情",
					variant: "secondary",
					onPress: handleNavigateDetail,
				});
				break;
			default:
				buttons.push({
					label: "查看详情",
					variant: "secondary",
					onPress: handleNavigateDetail,
				});
				break;
		}

		return buttons;
	}, [
		handleCancelOrder,
		handleCompleteOrder,
		handleNavigateDetail,
		handlePayOrder,
		handleReorder,
		isCancelling,
		isCompleting,
		isPaying,
		order.status,
	]);

	return (
		<TouchableOpacity
			activeOpacity={0.7}
			onPress={handleNavigateDetail}
			className={cn("mt-3 rounded-2xl border px-4 py-4", section.cardClassName)}
		>
			{/* 顶部状态栏：订单状态和服务人员 */}
			<View className="flex-row items-center justify-between mb-3">
				<Text className="text-sm text-foreground">
					{statusLabel}
				</Text>
				<Text className="text-sm text-foreground">
					{order.servicePersonnelName} {'>'}
				</Text>
			</View>

			{/* 顶部：图片、服务名称、价格 */}
			<View className="flex-row items-center gap-3">
				{/* 服务人员图片 */}
				<View className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
					{order.servicePersonnelImage ? (
						<Image
							source={{ uri: order.servicePersonnelImage }}
							className="w-full h-full"
							resizeMode="cover"
						/>
					) : (
						<View className="w-full h-full bg-muted items-center justify-center">
							<Text className="text-xs text-muted-foreground">暂无图片</Text>
						</View>
					)}
				</View>

				{/* 中间：服务名称和描述 */}
				<View className="flex-1 justify-center">
					<Text className="text-base font-semibold text-foreground leading-5">
						{order.serviceName}
					</Text>
					<Text className="mt-1 text-xs text-muted-foreground leading-4">
						{order.serviceSpecifications || "暂无服务描述"}
					</Text>
				</View>

				{/* 右侧：价格和数量 */}
				<View className="items-end justify-center shrink-0">
					<Text className="text-base font-semibold text-foreground">
						{formatCurrency(Number(order.totalAmount))}
					</Text>
					<Text className="mt-0.5 text-xs text-muted-foreground">
						×1
					</Text>
				</View>
			</View>

			{/* 预约时间和实付款 */}
			<View className="mt-3 pt-3 border-t border-border/30 flex-row items-center justify-between">
				<View>
					<Text className="text-xs text-muted-foreground">
						预约时间
					</Text>
					<Text className="mt-0.5 text-sm text-foreground">
						{appointmentDisplay}
					</Text>
				</View>
				<View className="items-end">
					<Text className="text-xs text-muted-foreground">
						实付款
					</Text>
					<Text className="mt-0.5 text-base font-bold text-foreground">
						{formatCurrency(Number(order.totalAmount))}
					</Text>
				</View>
			</View>

			{/* 底部操作区 */}
			<View className="mt-3 pt-3 border-t border-border/30 flex-row items-center justify-between">
				<View className="flex-row items-center gap-2">
					<Text className="text-xs text-muted-foreground">服务操作</Text>
				</View>
				<View className="flex-row items-center gap-2">
					{actionButtons.map((button) => (
						<ActionButton key={button.label} {...button} />
					))}
				</View>
			</View>
		</TouchableOpacity>
	);
}
