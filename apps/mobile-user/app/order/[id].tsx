import { Text } from "@repo/mobile-ui/components/ui/text";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
	ChevronLeft,
	MapPin,
	MessageCircle,
	MoreHorizontal,
	QrCode,
} from "lucide-react-native";
import { useCallback, useMemo, useState } from "react";
import {
	ActivityIndicator,
	Alert,
	Image,
	RefreshControl,
	ScrollView,
	TouchableOpacity,
	View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { toast } from "sonner-native";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useOrderCheckin, useOrderDetail } from "@repo/hooks/api/order";
import { useOrderActions } from "@/components/orders_screen/hooks/useOrderActions";
import { cn } from "@repo/mobile-ui/lib/utils";

// 状态显示配置
const STATUS_CONFIG: Record<
	string,
	{ label: string; color: string; description: string }
> = {
	pending_payment: {
		label: "未支付取消",
		color: "text-muted-foreground",
		description: "订单已取消，未完成支付",
	},
	paid: {
		label: "待服务",
		color: "text-primary",
		description: "服务人员即将上门服务",
	},
	in_progress: {
		label: "服务中",
		color: "text-accent-foreground",
		description: "服务人员正在为您服务",
	},
	completed: {
		label: "已完成",
		color: "text-primary",
		description: "服务已完成",
	},
	cancelled: {
		label: "已取消",
		color: "text-muted-foreground",
		description: "订单已取消",
	},
	refunded: {
		label: "已退款",
		color: "text-muted-foreground",
		description: "订单已退款",
	},
};

type FooterActionButtonProps = {
	label: string;
	onPress: () => void;
	variant?: "primary" | "secondary" | "outline" | "destructive";
	loading?: boolean;
};

const FooterActionButton = ({
	label,
	onPress,
	variant = "secondary",
	loading = false,
}: FooterActionButtonProps) => {
	const buttonClass = cn(
		"flex-1 rounded-full py-3 flex-row items-center justify-center",
		variant === "primary" && "bg-primary",
		variant === "secondary" && "bg-muted",
		variant === "outline" && "border border-border bg-transparent",
		variant === "destructive" && "bg-destructive",
		loading ? "opacity-70" : "",
	);

	const textClass = cn(
		"text-sm font-medium",
		variant === "primary"
			? "text-primary-foreground"
			: variant === "destructive"
				? "text-destructive-foreground"
				: "text-foreground",
	);

	const indicatorColor =
		variant === "primary" || variant === "destructive"
			? "#ffffff"
			: "#111827";

	return (
		<TouchableOpacity
			activeOpacity={0.7}
			onPress={onPress}
			disabled={loading}
			className={buttonClass}
		>
			{loading ? (
				<ActivityIndicator size="small" color={indicatorColor} />
			) : (
				<Text className={textClass}>{label}</Text>
			)}
		</TouchableOpacity>
	);
};

export default function OrderDetailScreen() {
	const router = useRouter();
	const { id } = useLocalSearchParams<{ id: string }>();
	const [showActions, setShowActions] = useState(false);

	// 获取订单详情
	const { data: order, refetch: refetchOrder } = useOrderDetail(id || "");
	const {
		payExistingOrder,
		isPaying,
		cancelOrder,
		isCancelling,
		completeOrder,
		isCompleting,
		reorder,
	} = useOrderActions();

	// 当订单状态为待服务时，获取核验二维码
	const {
		data: checkinData,
		isLoading: isLoadingCheckin,
		refetch: refetchCheckin,
	} = useOrderCheckin(id || "");
	const [isRefreshing, setIsRefreshing] = useState(false);

	if (!order) {
		return null;
	}

	// 判断是否显示二维码（订单状态为待服务）
	const shouldShowQRCode = order.status === "paid";

	const statusConfig =
		STATUS_CONFIG[order.status] ?? {
			label: "未知状态",
			color: "text-muted-foreground",
			description: "请联系客户支持确认订单状态",
		};

	const formatDate = (date: Date | string) => {
		const d = new Date(date);
		return d.toLocaleString("zh-CN", {
			year: "numeric",
			month: "2-digit",
			day: "2-digit",
			hour: "2-digit",
			minute: "2-digit",
			weekday: "long",
		});
	};

	const formatCurrency = (amount: number | string) => {
		const num = typeof amount === "string" ? Number.parseFloat(amount) : amount;
		return `${num.toFixed(2)}元`;
	};

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
		Alert.alert("确认服务已完成？", "确认后订单将标记为已完成。", [
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

	const handleContactSupport = useCallback(() => {
		toast.info("客服即将与您联系，稍后请保持电话畅通");
	}, []);

	const copyOrderNumber = useCallback(async () => {
		if (!order.orderSerial) {
			toast.info("暂无可复制的订单编号");
			return;
		}

		try {
			await Clipboard.setStringAsync(order.orderSerial);
			toast.success("订单编号已复制");
		} catch (error) {
			toast.error("复制失败，请稍后重试");
		}
	}, [order.orderSerial]);

	type FooterAction = FooterActionButtonProps & { key: string };

	const footerActions = useMemo<FooterAction[]>(() => {
		const actions: FooterAction[] = [];

		switch (order.status) {
			case "pending_payment":
				actions.push({
					key: "cancel",
					label: "取消订单",
					variant: "outline",
					onPress: handleCancelOrder,
					loading: isCancelling,
				});
				actions.push({
					key: "pay",
					label: "立即支付",
					variant: "primary",
					onPress: handlePayOrder,
					loading: isPaying,
				});
				break;
			case "paid":
				actions.push({
					key: "cancel",
					label: "取消订单",
					variant: "outline",
					onPress: handleCancelOrder,
					loading: isCancelling,
				});
				break;
			case "in_progress":
				actions.push({
					key: "complete",
					label: "确认完成",
					variant: "primary",
					onPress: handleCompleteOrder,
					loading: isCompleting,
				});
				break;
			case "completed":
				actions.push({
					key: "reorder",
					label: "再次预约",
					variant: "primary",
					onPress: handleReorder,
				});
				break;
			case "cancelled":
			case "refunded":
				actions.push({
					key: "reorder",
					label: "再次预约",
					variant: "primary",
					onPress: handleReorder,
				});
				break;
			default:
				break;
		}

		return actions;
	}, [
		handleCancelOrder,
		handleCompleteOrder,
		handlePayOrder,
		handleReorder,
		isCancelling,
		isCompleting,
		isPaying,
		order.status,
	]);

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await Promise.all([
				refetchOrder({ throwOnError: false }),
				refetchCheckin({ throwOnError: false }),
			]);
		} finally {
			setIsRefreshing(false);
		}
	}, [refetchCheckin, refetchOrder]);

	return (
		<RequireAuth>
			<View className="flex-1 bg-background">
				{/* 顶部导航栏 */}
				<View className="flex-row items-center justify-between px-4 pt-12 pb-4 bg-background border-b border-border">
					<TouchableOpacity
						onPress={() => router.back()}
						className="p-2 -ml-2"
						activeOpacity={0.7}
					>
						<ChevronLeft size={24} className="text-foreground" />
					</TouchableOpacity>
					<Text className="text-lg font-semibold">订单详情</Text>
					<TouchableOpacity
						onPress={() => setShowActions(!showActions)}
						className="p-2 -mr-2"
						activeOpacity={0.7}
					>
						<MoreHorizontal size={24} className="text-foreground" />
					</TouchableOpacity>
				</View>

				<ScrollView
					className="flex-1"
					showsVerticalScrollIndicator={false}
					contentContainerStyle={{ paddingBottom: 100 }}
					refreshControl={
						<RefreshControl
							refreshing={isRefreshing}
							onRefresh={handleRefresh}
						/>
					}
				>
					{/* 订单状态卡片 */}
					<View className="mx-4 mt-4 bg-card rounded-2xl p-4 border border-border">
						<View className="flex-row items-center justify-between">
							<View>
								<Text className={`text-lg font-bold ${statusConfig.color}`}>
									{statusConfig.label}
								</Text>
								<Text className="text-xs text-muted-foreground mt-1">
									{order.createdAt
										? formatDate(order.createdAt).split(" ")[0]
										: ""}
								</Text>
							</View>
						</View>
					</View>

					{/* 预约时间卡片 */}
					<View className="mx-4 mt-3 bg-card rounded-2xl p-4 border border-border">
						<View className="flex-row items-center justify-between mb-2">
							<Text className="text-sm text-muted-foreground">预约时间：</Text>
							<Text className="text-base font-semibold text-primary">
								{order.appointmentTime
									? formatDate(order.appointmentTime)
									: "未设置"}
							</Text>
						</View>
					</View>

					{/* 核验二维码卡片 - 仅在待服务状态显示 */}
					{shouldShowQRCode && (
						<View className="mx-4 mt-3 bg-card rounded-2xl p-4 border border-border">
							<View className="flex-row items-center gap-2 mb-3">
								<QrCode size={20} className="text-primary" />
								<Text className="text-sm font-medium text-foreground">
									服务核验二维码
								</Text>
							</View>

							{isLoadingCheckin ? (
								<View className="items-center justify-center py-8">
									<ActivityIndicator size="large" className="text-primary" />
									<Text className="text-sm text-muted-foreground mt-3">
										正在生成二维码...
									</Text>
								</View>
							) : checkinData?.qrCodeDataUrl ? (
								<View className="items-center">
									<View className="bg-white p-4 rounded-xl">
										<Image
											source={{ uri: checkinData.qrCodeDataUrl }}
											style={{ width: 200, height: 200 }}
											resizeMode="contain"
										/>
									</View>
									<Text className="text-xs text-muted-foreground mt-3 text-center">
										请出示此二维码供服务人员扫描核验
									</Text>
									{checkinData.expiresAt && (
										<Text className="text-xs text-muted-foreground mt-1 text-center">
											有效期至：{formatDate(checkinData.expiresAt)}
										</Text>
									)}
								</View>
							) : (
								<View className="items-center justify-center py-8">
									<Text className="text-sm text-muted-foreground">
										二维码生成失败，请稍后重试
									</Text>
								</View>
							)}
						</View>
					)}

					{/* 服务地址卡片 */}
					{order.address && (
						<View className="mx-4 mt-3 bg-card rounded-2xl p-4 border border-border">
							<View className="flex-row items-start gap-3">
								<MapPin size={20} className="text-primary mt-0.5" />
								<View className="flex-1">
									<View className="flex-row items-center justify-between mb-1">
										<Text className="text-base font-semibold">
											{order.address.recipientName || "未设置"}
										</Text>
										<TouchableOpacity
											onPress={handleContactSupport}
											activeOpacity={0.7}
											className="px-3 py-1 rounded-full bg-muted"
										>
											<Text className="text-xs text-foreground">联系客服</Text>
										</TouchableOpacity>
									</View>
									<Text className="text-sm text-muted-foreground mb-2">
										{order.address.recipientPhone
											? order.address.recipientPhone.replace(
													/(\d{3})\d{4}(\d{4})/,
													"$1****$2",
												)
											: ""}
									</Text>
									<Text className="text-sm text-foreground leading-5">
										{order.address.recipientPhone} {order.address.detailedAddress || ""}
									</Text>
								</View>
							</View>
						</View>
					)}

					{/* 服务人员信息 - 如果有分配 */}
					{order.assignment && (
						<View className="mx-4 mt-3 bg-card rounded-2xl p-4 border border-border">
							<View className="flex-row items-center justify-between mb-3">
								<Text className="text-sm font-medium text-muted-foreground">
									服务人员
								</Text>
							</View>
							<View className="flex-row items-center gap-3">
								<View className="w-12 h-12 rounded-full overflow-hidden bg-muted">
									<View className="w-full h-full items-center justify-center">
										<Text className="text-xs text-muted-foreground">
											暂无
										</Text>
									</View>
								</View>
								<View className="flex-1">
									<Text className="text-base font-semibold">
										服务人员
									</Text>
									<Text className="text-xs text-muted-foreground mt-0.5">
										等待分配
									</Text>
								</View>
							</View>
						</View>
					)}

					{/* 服务项目 */}
					<View className="mx-4 mt-3 bg-card rounded-2xl border border-border">
						<View className="px-4 py-3 border-b border-border">
							<Text className="text-sm font-medium text-muted-foreground">
								服务项目
							</Text>
						</View>
						{order.service && (
							<View className="p-4">
								<View className="flex-row items-center gap-3">
									<View className="w-20 h-20 rounded-lg overflow-hidden bg-muted shrink-0">
										<View className="w-full h-full items-center justify-center">
											<Text className="text-xs text-muted-foreground">
												暂无图片
											</Text>
										</View>
									</View>
									<View className="flex-1">
										<Text className="text-base font-semibold text-foreground leading-5">
											{order.service.name || "未知服务"}
										</Text>
										<Text className="text-xs text-muted-foreground mt-1 leading-4">
											{order.service.description || "暂无描述"}
										</Text>
									</View>
									<View className="items-end shrink-0">
										<Text className="text-base font-semibold text-foreground">
											{formatCurrency(order.totalAmount)}
										</Text>
										<Text className="text-xs text-muted-foreground mt-0.5">
											×1
										</Text>
									</View>
								</View>
							</View>
						)}

						{/* 费用明细 */}
						<View className="px-4 pb-4">
							<View className="flex-row items-center justify-between py-2 border-t border-border/30">
								<Text className="text-base font-semibold text-foreground">
									实付金额：
								</Text>
								<Text className="text-xl font-bold text-destructive">
									{formatCurrency(order.totalAmount)}
								</Text>
							</View>
						</View>
					</View>

					{/* 订单信息 */}
					<View className="mx-4 mt-3 bg-card rounded-2xl p-4 border border-border">
						<View className="flex-row items-center justify-between py-2">
							<Text className="text-sm text-muted-foreground">订单编号：</Text>
							<View className="flex-row items-center gap-2">
								<Text className="text-sm text-foreground">
									{order.orderSerial || ""}
								</Text>
								<TouchableOpacity
									onPress={copyOrderNumber}
									activeOpacity={0.7}
									className="px-2 py-1 rounded bg-muted"
								>
									<Text className="text-xs text-foreground">复制</Text>
								</TouchableOpacity>
							</View>
						</View>
						<View className="flex-row items-center justify-between py-2">
							<Text className="text-sm text-muted-foreground">下单时间：</Text>
							<Text className="text-sm text-foreground">
								{order.createdAt ? formatDate(order.createdAt) : ""}
							</Text>
						</View>
						<View className="flex-row items-start justify-between py-2">
							<Text className="text-sm text-muted-foreground">
								订单备注：
							</Text>
							<Text className="text-sm text-foreground flex-1 text-right">
								无
							</Text>
						</View>
					</View>
				</ScrollView>

				{/* 底部操作栏 */}
				<View className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3">
					<View className="flex-row items-center gap-3">
						<TouchableOpacity
							onPress={handleContactSupport}
							activeOpacity={0.7}
							className="flex-1 flex-row items-center justify-center gap-2 py-3 rounded-full bg-muted"
							disabled={isCancelling || isCompleting || isPaying}
						>
							<MessageCircle size={18} className="text-foreground" />
							<Text className="text-sm font-medium">咨询客服</Text>
						</TouchableOpacity>
						{footerActions.map(({ key, ...button }) => (
							<FooterActionButton key={key} {...button} />
						))}
					</View>
				</View>
			</View>
		</RequireAuth>
	);
}
