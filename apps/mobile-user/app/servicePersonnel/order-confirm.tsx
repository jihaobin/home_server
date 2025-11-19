import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Separator } from "@repo/mobile-ui/components/ui/separator";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Link, useFocusEffect, useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useCallback, useState } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";
import { toast } from "sonner-native";
import { PaySheet } from "@/components/pay/paySheet";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useAddressEditStore } from "@/stores/address-store";
import useServiceStore from "@/stores/service";

const ICON_MAP = lucideIconRegistry;

export default function OrderConfirmScreen() {
	const router = useRouter();

	// 从 zustand store 获取数据
	const {
		selectedServiceTime,
		selectedSpecification,
		selectService,
		selectServicePersonnelInfo,
	} = useServiceStore();

	const { selectedAddress, reset } = useAddressEditStore();
	const { session, refetch: refetchSession } = useSession();

	const [showPaymentModal, setShowPaymentModal] = useState(false);
	const [isRefreshing, setIsRefreshing] = useState(false);
	const [missingFields, setMissingFields] = useState<{
		address?: boolean;
		serviceTime?: boolean;
	}>({});

	// 从 store 获取服务信息
	const servicePrice = selectedSpecification
		? Number.parseFloat(selectedSpecification.price)
		: 0;
	const totalAmount = servicePrice;

	// 格式化服务时间
	const formatServiceTime = (date: Date | undefined) => {
		if (!date) return "请选择时间";

		const now = new Date();
		const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
		const tomorrow = new Date(today);
		tomorrow.setDate(today.getDate() + 1);
		const targetDate = new Date(
			date.getFullYear(),
			date.getMonth(),
			date.getDate(),
		);

		let dayLabel = "";
		if (targetDate.getTime() === today.getTime()) {
			dayLabel = "今天";
		} else if (targetDate.getTime() === tomorrow.getTime()) {
			dayLabel = "明天";
		} else {
			const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
			dayLabel = weekdays[date.getDay()];
		}

		const timeLabel = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

		return `${dayLabel} ${timeLabel}`;
	};

	const serviceTime = formatServiceTime(selectedServiceTime);

	// 页面失焦时重置地址选择状态
	useFocusEffect(
		useCallback(() => {
			return () => {
				reset();
			};
		}, [reset]),
	);

	// 跳转到地址选择页面
	const handleSelectAddress = () => {
		router.push({
			pathname: "/address/service-address",
			params: { mode: "select" },
		});
	};

	// 校验订单信息
	const validateOrderInfo = (): { valid: boolean; message?: string } => {
		// 检查用户登录状态
		if (!session?.user.id) {
			return { valid: false, message: "请先登录" };
		}

		// 检查服务地址
		if (!selectedAddress) {
			return { valid: false, message: "请选择服务地址" };
		}

		// 检查服务时间
		if (!selectedServiceTime) {
			return { valid: false, message: "请选择服务时间" };
		}

		// 检查服务时间是否在未来
		const now = new Date();
		if (selectedServiceTime <= now) {
			return { valid: false, message: "服务时间必须是未来时间" };
		}

		// 检查服务规格
		if (!selectedSpecification?.id) {
			return { valid: false, message: "请选择服务规格" };
		}

		// 检查服务人员
		if (!selectServicePersonnelInfo?.userId) {
			return { valid: false, message: "请选择服务人员" };
		}

		// 检查服务价格
		if (servicePrice <= 0) {
			return { valid: false, message: "服务价格异常，请重新选择服务" };
		}

		return { valid: true };
	};

	// 点击立即支付按钮
	const handleClickPay = () => {
		// 重置缺失字段状态
		setMissingFields({});

		// 先进行基础校验（除支付方式外）
		const validation = validateOrderInfo();
		if (!validation.valid) {
			// 标记缺失的字段
			const newMissingFields: {
				address?: boolean;
				serviceTime?: boolean;
			} = {};

			if (!selectedAddress) {
				newMissingFields.address = true;
			}
			if (!selectedServiceTime) {
				newMissingFields.serviceTime = true;
			}

			setMissingFields(newMissingFields);
			toast.error(validation.message || "订单信息不完整");
			return;
		}

		// 校验通过，打开支付方式选择模态框
		setShowPaymentModal(true);
	};

	const handleRefresh = useCallback(async () => {
		setIsRefreshing(true);
		try {
			await refetchSession();
			setMissingFields({});
			setShowPaymentModal(false);
		} finally {
			setIsRefreshing(false);
		}
	}, [refetchSession]);

	return (
		<View className="flex-1 bg-background">
			{/* 顶部导航栏 */}
			<View className="border-b border-border bg-background px-4 pt-12 pb-4">
				<View className="flex-row items-center">
					<Pressable
						onPress={() => router.back()}
						className="mr-3 h-10 w-10 items-center justify-center active:opacity-60"
						hitSlop={8}
					>
						<Icon
							as={ICON_MAP.ChevronLeft}
							size={24}
							className="text-foreground"
						/>
					</Pressable>
					<Text className="text-xl font-bold text-foreground">确认订单</Text>
				</View>
			</View>

			<ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 120 }}
				refreshControl={
					<RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
				}
			>
				{/* 服务时间卡片 */}
				<Link
					href={"/servicePersonnel/time-picker"}
					className={`mx-4 mt-4 rounded-2xl border bg-card p-4 ${
						missingFields.serviceTime
							? "border-destructive border-2"
							: "border-border"
					}`}
				>
					<View className="flex-row items-center">
						<View
							className={`h-12 w-12 items-center justify-center rounded-full ${
								missingFields.serviceTime
									? "bg-destructive/10"
									: "bg-primary/10"
							}`}
						>
							<Icon
								as={ICON_MAP.Clock}
								size={24}
								className={
									missingFields.serviceTime
										? "text-destructive"
										: "text-primary"
								}
							/>
						</View>
						<View className="ml-3 flex-1">
							<View className="flex-row items-center">
								<Text className="text-sm text-muted-foreground">服务时间</Text>
								{missingFields.serviceTime && (
									<View className="ml-2 rounded-full bg-destructive px-2 py-0.5">
										<Text className="text-xs text-destructive-foreground">
											必填
										</Text>
									</View>
								)}
							</View>
							<Text
								className={`mt-1 text-base font-semibold ${
									missingFields.serviceTime
										? "text-destructive"
										: "text-foreground"
								}`}
							>
								{serviceTime}
							</Text>
						</View>
						<Pressable hitSlop={8} className="active:opacity-60">
							<Icon
								as={ICON_MAP.ChevronRight}
								size={20}
								className="text-muted-foreground"
							/>
						</Pressable>
					</View>
				</Link>

				{/* 服务地址卡片 */}
				<Pressable
					onPress={handleSelectAddress}
					className={`mx-4 mt-3 rounded-2xl border bg-card p-4 active:opacity-80 ${
						missingFields.address
							? "border-destructive border-2"
							: "border-border"
					}`}
				>
					<View className="flex-row items-start">
						<View
							className={`h-12 w-12 items-center justify-center rounded-full ${
								missingFields.address ? "bg-destructive/10" : "bg-primary/10"
							}`}
						>
							<Icon
								as={ICON_MAP.MapPin}
								size={24}
								className={
									missingFields.address ? "text-destructive" : "text-primary"
								}
							/>
						</View>
						{selectedAddress ? (
							<View className="ml-3 flex-1">
								<View className="flex-row items-center justify-between">
									<Text className="text-base font-semibold text-foreground">
										{selectedAddress.recipientName}
									</Text>
									<Text className="text-base text-foreground">
										{selectedAddress.recipientPhone}
									</Text>
								</View>
								<Text className="mt-2 text-sm leading-5 text-muted-foreground">
									{selectedAddress.detailedAddress}
								</Text>
							</View>
						) : (
							<View className="ml-3 flex-1">
								<View className="flex-row items-center">
									<Text
										className={`text-base font-semibold ${
											missingFields.address
												? "text-destructive"
												: "text-foreground"
										}`}
									>
										请选择服务地址
									</Text>
									{missingFields.address && (
										<View className="ml-2 rounded-full bg-destructive px-2 py-0.5">
											<Text className="text-xs text-destructive-foreground">
												必填
											</Text>
										</View>
									)}
								</View>
								<Text className="mt-2 text-sm leading-5 text-muted-foreground">
									点击选择或添加新地址
								</Text>
							</View>
						)}
						<View className="ml-2 active:opacity-60">
							<Icon
								as={ICON_MAP.ChevronRight}
								size={20}
								className="text-muted-foreground"
							/>
						</View>
					</View>
				</Pressable>

				{/* 服务详情卡片 */}
				<View className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4">
					<View className="flex-row items-center justify-between mb-3">
						<Text className="text-base font-bold text-foreground">
							服务详情
						</Text>
					</View>

					<View className="flex-row items-start">
						<View className="h-20 w-20 rounded-xl bg-muted" />
						<View className="ml-3 flex-1">
							<Text className="text-base font-semibold text-foreground">
								{selectService?.label}
							</Text>
							<Text className="mt-1 text-sm text-muted-foreground">
								{selectedSpecification?.name}
							</Text>
							<View className="mt-2 flex-row items-baseline">
								<Text className="text-lg font-bold text-primary">
									¥{servicePrice}
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* 订单备注 */}
				<View className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4">
					<View className="flex-row items-center justify-between">
						<Text className="text-base font-semibold text-foreground">
							订单备注
						</Text>
						<Pressable
							className="flex-row items-center active:opacity-60"
							hitSlop={8}
						>
							<Text className="text-sm text-muted-foreground">
								添加备注信息
							</Text>
							<Icon
								as={ICON_MAP.ChevronRight}
								size={16}
								className="ml-1 text-muted-foreground"
							/>
						</Pressable>
					</View>
				</View>

				{/* 费用明细 */}
				<View className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4">
					<Text className="mb-3 text-base font-bold text-foreground">
						费用明细
					</Text>

					<View className="space-y-3">
						<View className="flex-row items-center justify-between">
							<Text className="text-sm text-foreground">服务费用</Text>
							<Text className="text-base font-semibold text-foreground">
								¥{servicePrice}
							</Text>
						</View>

						<Separator className="my-2 bg-border" />

						<View className="flex-row items-center justify-between">
							<Text className="text-base font-bold text-foreground">
								合计金额
							</Text>
							<View className="flex-row items-baseline">
								<Text className="text-xs text-muted-foreground">¥</Text>
								<Text className="text-2xl font-bold text-primary">
									{totalAmount.toFixed(2)}
								</Text>
							</View>
						</View>
					</View>
				</View>

				{/* 温馨提示 */}
				<View className="mx-4 mt-3 rounded-2xl border border-accent/30 bg-accent/10 p-4">
					<View className="flex-row items-start">
						<Icon
							as={ICON_MAP.Info}
							size={18}
							className="mt-0.5 text-accent-foreground"
						/>
						<View className="ml-2 flex-1">
							<Text className="text-sm font-semibold text-foreground">
								温馨提示
							</Text>
							<Text className="mt-1 text-xs leading-5 text-muted-foreground">
								• 师傅将在预约时间准时上门服务
								{"\n"}• 服务完成后请及时验收并评价
							</Text>
						</View>
					</View>
				</View>
			</ScrollView>

			{/* 底部支付栏 */}
			<View
				className="absolute bottom-0 left-0 right-0 border-t border-border bg-background px-4 py-4"
				style={{
					shadowColor: "#000",
					shadowOffset: { width: 0, height: -2 },
					shadowOpacity: 0.1,
					shadowRadius: 8,
					elevation: 8,
				}}
			>
				<View className="flex-row items-center justify-between">
					<View className="flex-1">
						<Text className="text-sm text-muted-foreground">实付金额</Text>
						<View className="mt-1 flex-row items-baseline">
							<Text className="text-xs text-primary">¥</Text>
							<Text className="text-2xl font-bold text-primary">
								{totalAmount.toFixed(2)}
							</Text>
						</View>
					</View>
					<Button
						onPress={handleClickPay}
						className="h-12 rounded-full bg-primary px-8"
					>
						<Text className="text-base font-semibold text-primary-foreground">
							立即支付
						</Text>
					</Button>
				</View>
			</View>

			{/* 支付方式选择模态框 */}
			<PaySheet
				visible={showPaymentModal}
				onClose={() => setShowPaymentModal(false)}
				orderData={{
					customerId: session?.user.id || "",
					serviceId: selectService?.id || "",
					addressId: selectedAddress?.id || "",
					appointmentTime: selectedServiceTime?.toISOString() || "",
					designatedPersonnelId: selectServicePersonnelInfo?.userId || "",
					specificationId: selectedSpecification?.id || "",
					displayPrice: servicePrice,
				}}
				totalAmount={totalAmount}
				onPaymentSuccess={(orderId) => {
					console.log("支付成功，订单ID:", orderId);
				}}
				onPaymentFailed={(orderId, message) => {
					console.log("支付失败，订单ID:", orderId, "原因:", message);
				}}
				onPaymentCancelled={() => {
					console.log("用户取消支付");
				}}
			/>
		</View>
	);
}
