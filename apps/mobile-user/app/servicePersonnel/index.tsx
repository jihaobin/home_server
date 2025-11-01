import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { NAV_THEME } from "@repo/mobile-ui/lib/constants";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useEffect, useState } from "react";
import { Dimensions, Pressable, ScrollView, View } from "react-native";
import Animated, {
	Extrapolation,
	interpolate,
	interpolateColor,
	useAnimatedScrollHandler,
	useAnimatedStyle,
	useSharedValue,
} from "react-native-reanimated";
import { useServicePersonnelDetails } from "@repo/hooks/api/service-personnel";
import { hslToRgba } from "@repo/lib/utils";
import useServiceStore from "@/stores/service";

const ICON_MAP = lucideIconRegistry;
const { width: SCREEN_WIDTH } = Dimensions.get("window");

// 评论类型(保留用于未来功能)
interface Review {
	id: string;
	userId: string;
	userName: string;
	avatar?: string;
	rating: number;
	date: string;
	content: string;
	images?: string[];
}

// 相似服务类型(保留用于未来功能)
interface SimilarService {
	id: string;
	name: string;
	price: number;
	unit: string;
	image?: string;
	tag?: string;
}

// Mock 数据 - 评论(待后端API完成)
const mockReviews: Review[] = [
	{
		id: "1",
		userId: "u50351303",
		userName: "u50351303",
		rating: 5,
		date: "2023-09-24",
		content: "师傅准时上门，维修快服务好",
		images: [
			"https://via.placeholder.com/150",
			"https://via.placeholder.com/150",
		],
	},
	{
		id: "2",
		userId: "u50351304",
		userName: "用户12345",
		rating: 5,
		date: "2023-09-23",
		content: "非常专业,解决了困扰我很久的问题，态度也很好！",
	},
	{
		id: "3",
		userId: "u50351305",
		userName: "满意客户",
		rating: 4,
		date: "2023-09-22",
		content: "服务不错，价格合理",
	},
];

// Mock 数据 - 相似服务(待后端API完成)
const mockSimilarServices: SimilarService[] = [
	{
		id: "1",
		name: "跑腿线维修/安装",
		price: 22,
		unit: "米",
		tag: "到位包退",
		image: "https://via.placeholder.com/120",
	},
	{
		id: "2",
		name: "水路维修",
		price: 129,
		unit: "次",
		tag: "到位包退",
		image: "https://via.placeholder.com/120",
	},
	{
		id: "3",
		name: "中式推拿",
		price: 168,
		unit: "次",
		tag: "60分钟",
		image: "https://via.placeholder.com/120",
	},
	{
		id: "4",
		name: "川派采耳",
		price: 88,
		unit: "次",
		image: "https://via.placeholder.com/120",
	},
	{
		id: "5",
		name: "地热暖气维修",
		price: 199,
		unit: "次",
		image: "https://via.placeholder.com/120",
	},
	{
		id: "6",
		name: "灯具维修",
		price: 79,
		unit: "次",
		image: "https://via.placeholder.com/120",
	},
];

export default function ServiceDetailScreen() {
	const router = useRouter();

	const { selectedServiceTime, selectService: selectServiceId,selectServicePersonnelInfo, setSelectedSpecification, setServiceDetails } = useServiceStore();


	const { data: servicePersonnelDetails } = useServicePersonnelDetails({
		serviceId: selectServiceId!.id,
		personnelId: selectServicePersonnelInfo?.userId!,
	});

	const { colorScheme } = useColorScheme();


	// 使用后端返回的真实规格数据
	const specifications = servicePersonnelDetails?.specifications || [];

	const [selectedOption, setSelectedOption] = useState("");
	const [selectedTab, setSelectedTab] = useState("service");

	const scrollY = useSharedValue(0);
	const isScrollIng = useSharedValue(false);

	// 当规格数据加载完成后,设置默认选中第一个规格
	useEffect(() => {
		if (specifications.length > 0 && !selectedOption) {
			setSelectedOption(specifications[0].id);
		}
	}, [specifications, selectedOption]);

	// 服务时间 - 格式化显示
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

	// 从后端数据获取工作时间信息
	const workSchedule = {
		workDays: servicePersonnelDetails?.workDays || "1234567",
		workStartTime: servicePersonnelDetails?.workStartTime || "08:00:00",
		workEndTime: servicePersonnelDetails?.workEndTime || "19:00:00",
	};

	// 服务说明 - 使用后端返回的description
	const serviceDescription =
		servicePersonnelDetails?.description || "暂无服务说明";

	const handleScroll = useAnimatedScrollHandler({
		onScroll: (event) => {
			scrollY.value = event.contentOffset.y;
		},
		onBeginDrag: () => {
			isScrollIng.value = true;
		},
		onEndDrag: () => {
			isScrollIng.value = false;
		},
	});

	const opacity = useAnimatedStyle(() => {
		return {
			opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
		};
	});

	const backgroundAnimatedStyle = useAnimatedStyle(() => {
		const backgroundColor = interpolateColor(
			scrollY.value,
			[0, 50],
			["rgba(0,0,0,0)", NAV_THEME[colorScheme ?? "light"].colors.background],
		);
		return { backgroundColor };
	});

	const backgroundColor = hslToRgba(
		NAV_THEME[colorScheme ?? "light"].colors.foreground,
		0.3,
	);
	const backBackgroundAnimatedStyle = useAnimatedStyle(() => {
		return {
			backgroundColor: interpolateColor(
				scrollY.value,
				[0, 50],
				[backgroundColor, "rgba(0,0,0,0)"],
			),
		};
	});

	// 第一个图标的透明度动画 (popover 颜色)
	const backIcon1AnimatedStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
		};
	});

	// 第二个图标的透明度动画 (primary 颜色)
	const backIcon2AnimatedStyle = useAnimatedStyle(() => {
		return {
			opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
		};
	});

	return (
		<View className="flex-1 bg-transparent">
			{/* 固定顶部导航栏 - 极简风格 */}
			<Animated.View
				style={{
					position: "absolute",
					top: 0,
					left: 0,
					right: 0,
					zIndex: 100,
				}}
			>
				{/* 单行导航栏：返回 + Tab + 功能按钮 */}
				<Animated.View
					className="flex-row items-center px-3 pt-12 pb-0"
					style={[backgroundAnimatedStyle]}
				>
					{/* 左侧返回按钮 */}
					<Animated.View
						className="h-10 w-10 items-center justify-center active:opacity-60 bg-foreground/30 rounded-full"
						hitSlop={8}
						style={backBackgroundAnimatedStyle}
					>
						<Pressable onPress={() => router.back()}>
							<View className="relative">
								{/* 第一个图标 - popover 颜色,滚动时淡出 */}
								<Animated.View
									style={[{ position: "absolute" }, backIcon1AnimatedStyle]}
								>
									<Icon
										as={ICON_MAP.ChevronLeft}
										size={20}
										className="text-popover"
									/>
								</Animated.View>
								{/* 第二个图标 - primary 颜色,滚动时淡入 */}
								<Animated.View style={backIcon2AnimatedStyle}>
									<Icon
										as={ICON_MAP.ChevronLeft}
										size={20}
										className="text-primary"
									/>
								</Animated.View>
							</View>
						</Pressable>
					</Animated.View>

					{/* 中间Tab切换 */}
					<Animated.View
						className="flex-1 flex-row items-center justify-center mx-2"
						style={opacity}
					>
						<Pressable
							onPress={() => setSelectedTab("service")}
							className={cn(
								"items-center px-4 py-3 border-b-2",
								selectedTab === "service"
									? "border-primary"
									: "border-transparent",
							)}
						>
							<Text
								className={cn(
									"text-base font-medium",
									selectedTab === "service"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							>
								服务
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setSelectedTab("details")}
							className={cn(
								"items-center px-4 py-3 border-b-2",
								selectedTab === "details"
									? "border-primary"
									: "border-transparent",
							)}
						>
							<Text
								className={cn(
									"text-base font-medium",
									selectedTab === "details"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							>
								详情
							</Text>
						</Pressable>
						<Pressable
							onPress={() => setSelectedTab("reviews")}
							className={cn(
								"items-center px-4 py-3 border-b-2",
								selectedTab === "reviews"
									? "border-primary"
									: "border-transparent",
							)}
						>
							<Text
								className={cn(
									"text-base font-medium",
									selectedTab === "reviews"
										? "text-foreground"
										: "text-muted-foreground",
								)}
							>
								评价
							</Text>
						</Pressable>
					</Animated.View>

					{/* 右侧功能按钮 */}
					{/* <View className="flex-row items-center">
						<Pressable
							onPress={() => {}}
							className="h-12 w-12 items-center justify-center active:opacity-60"
							hitSlop={8}
						>
							<Icon as={ICON_MAP.RefreshCw} size={20} className="text-foreground" />
						</Pressable>
						<Pressable
							onPress={() => {}}
							className="h-12 w-12 items-center justify-center active:opacity-60"
							hitSlop={8}
						>
							<Icon as={ICON_MAP.Menu} size={20} className="text-foreground" />
						</Pressable>
					</View> */}
				</Animated.View>
			</Animated.View>

			<Animated.ScrollView
				className="flex-1"
				showsVerticalScrollIndicator={false}
				contentContainerStyle={{ paddingBottom: 100 }}
				onScroll={handleScroll}
			>
				{/* 服务头部图片 */}
				<View className="relative">
					<Image
						source={{
							uri: `https://picsum.photos/${SCREEN_WIDTH}/${Math.floor(SCREEN_WIDTH * 0.75)}`,
						}}
						style={{
							width: SCREEN_WIDTH,
							height: SCREEN_WIDTH * 0.75,
						}}
					/>
				</View>
				{/* 服务选项卡片 */}
				{specifications.length > 0 ? (
					<ScrollView
						horizontal
						showsHorizontalScrollIndicator={false}
						className="px-4 py-4"
						contentContainerStyle={{ gap: 12 }}
					>
						{specifications.map((spec) => {
							const price = Number.parseFloat(spec.price);
							return (
								<Pressable
									key={spec.id}
									onPress={() => setSelectedOption(spec.id)}
									className={cn(
										"rounded-2xl border-2 px-4 py-3 min-w-[160px]",
										selectedOption === spec.id
											? "border-primary bg-primary/5"
											: "border-border bg-card",
									)}
								>
									<Text
										className={cn(
											"text-base font-semibold",
											selectedOption === spec.id
												? "text-primary"
												: "text-foreground",
										)}
									>
										{spec.name || "标准服务"}
									</Text>
									<View className="mt-1 flex-row items-baseline">
										<Text
											className={cn(
												"text-xl font-bold",
												selectedOption === spec.id
													? "text-primary"
													: "text-foreground",
											)}
										>
											{price.toFixed(2)}
										</Text>
									</View>
								</Pressable>
							);
						})}
					</ScrollView>
				) : (
					<View className="mx-4 my-4 rounded-xl border border-border bg-card p-6">
						<Text className="text-center text-sm text-muted-foreground">
							暂无服务规格信息
						</Text>
					</View>
				)}
				{/* 预约时间 */}
				<Pressable
					onPress={() =>
						router.push({
							pathname: "/servicePersonnel/time-picker",
							params: {
								workDays: workSchedule.workDays,
								workStartTime: workSchedule.workStartTime,
								workEndTime: workSchedule.workEndTime,
							},
						})
					}
					className="mx-4 mb-4 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:opacity-60"
				>
					<View className="flex-row items-center">
						<Icon as={ICON_MAP.Clock} size={18} className="text-primary" />
						<Text className="ml-2 text-sm font-medium text-foreground">
							服务时间
						</Text>
					</View>
					<View className="flex-row items-center">
						<Text
							className={cn(
								"text-base font-semibold",
								selectedServiceTime ? "text-primary" : "text-muted-foreground",
							)}
						>
							{serviceTime}
						</Text>
						<Icon
							as={ICON_MAP.ChevronRight}
							size={18}
							className="ml-1 text-muted-foreground"
						/>
					</View>
				</Pressable>

				<View className="px-4">
					{selectedTab === "service" && (
						<View>
							{/* 服务说明 */}
							<View className="mb-4">
								<Text className="text-sm leading-6 text-foreground">
									{serviceDescription}
								</Text>
							</View>

							{/* 配件费表格 */}
							{/* <View className="mb-4">
								<View className="mb-3 flex-row items-center justify-between">
									<Text className="text-base font-semibold text-foreground">
										配件费
									</Text>
									<Text className="text-base font-semibold text-foreground">
										价格(元)
									</Text>
								</View>

								<View className="rounded-xl border border-border bg-card overflow-hidden">
									{displayedParts.map((part, index) => (
										<View key={part.name}>
											<View className="flex-row items-center justify-between px-4 py-3">
												<Text className="text-sm text-foreground">
													{part.name}
												</Text>
												<Text className="text-base font-semibold text-primary">
													{part.price}
												</Text>
											</View>
											{index < displayedParts.length - 1 && (
												<Separator className="bg-border" />
											)}
										</View>
									))}
								</View>

								{mockPartPrices.length > 5 && (
									<Pressable
										onPress={() => setShowAllParts(!showAllParts)}
										className="mt-3 flex-row items-center justify-center"
									>
										<Text className="text-sm font-medium text-primary">
											{showAllParts ? "收起全部" : "查看全部"}
										</Text>
										<Icon
											as={showAllParts ? ICON_MAP.ChevronUp : ICON_MAP.ChevronDown}
											size={16}
											className="ml-1 text-primary"
										/>
									</Pressable>
								)}
							</View> */}
						</View>
					)}

					{selectedTab === "details" && (
						<View>
							<Text className="text-sm leading-6 text-foreground mb-4">
								{serviceDescription}
							</Text>
							<Text className="text-sm text-muted-foreground">
								更多详情内容...
							</Text>
						</View>
					)}

					{selectedTab === "reviews" && (
						<View>
							{/* 用户评价 */}
							<View className="mb-4">
								<View className="mb-3 flex-row items-center justify-between">
									<Text className="text-lg font-bold text-foreground">
										用户评论
									</Text>
									<Pressable className="flex-row items-center">
										<Text className="text-sm text-primary">1000+ 条评论</Text>
										<Icon
											as={ICON_MAP.ChevronRight}
											size={16}
											className="ml-1 text-primary"
										/>
									</Pressable>
								</View>

								{mockReviews.map((review) => (
									<View
										key={review.id}
										className="mb-4 rounded-xl border border-border bg-card p-4"
									>
										<View className="flex-row items-start">
											<View className="h-10 w-10 items-center justify-center rounded-full bg-primary/10">
												<Text className="font-semibold text-primary">
													{review.userName.slice(0, 1)}
												</Text>
											</View>

											<View className="ml-3 flex-1">
												<View className="flex-row items-center justify-between">
													<Text className="font-semibold text-foreground">
														{review.userName}
													</Text>
													<Text className="text-xs text-muted-foreground">
														{review.date}
													</Text>
												</View>

												<View className="mt-1 flex-row items-center">
													{Array.from({ length: 5 }).map((_, i) => (
														<Icon
															key={`star-${review.id}-${i}`}
															as={ICON_MAP.Star}
															size={12}
															className={
																i < review.rating
																	? "text-primary"
																	: "text-muted-foreground/30"
															}
															fill={i < review.rating ? "currentColor" : "none"}
														/>
													))}
												</View>

												<Text className="mt-2 text-sm leading-5 text-foreground">
													{review.content}
												</Text>

												{review.images && review.images.length > 0 && (
													<ScrollView
														horizontal
														showsHorizontalScrollIndicator={false}
														className="mt-3"
														contentContainerStyle={{ gap: 8 }}
													>
														{review.images.map((img, idx) => (
															<Image
																key={`${review.id}-img-${idx}`}
																source={{ uri: img }}
																style={{
																	width: 80,
																	height: 80,
																	borderRadius: 8,
																}}
																contentFit="cover"
															/>
														))}
													</ScrollView>
												)}
											</View>
										</View>
									</View>
								))}
							</View>
						</View>
					)}

					{/* 相似服务推荐 */}
					<View className="mb-6">
						<View className="mb-3 flex-row items-center justify-between">
							<Text className="text-lg font-bold text-foreground">
								相似服务
							</Text>
							<Pressable className="flex-row items-center">
								<Text className="text-sm text-primary">查看更多</Text>
								<Icon
									as={ICON_MAP.ChevronRight}
									size={16}
									className="ml-1 text-primary"
								/>
							</Pressable>
						</View>

						<View className="flex-row flex-wrap -mx-2">
							{mockSimilarServices.map((service) => (
								<View key={service.id} className="w-1/3 px-2 mb-4">
									<Pressable
										className="rounded-xl border border-border bg-card overflow-hidden"
										onPress={() => {}}
									>
										<Image
											source={{ uri: service.image }}
											style={{
												width: "100%",
												height: 100,
											}}
											contentFit="cover"
										/>
										<View className="p-2">
											<Text
												className="text-sm font-medium text-foreground"
												numberOfLines={2}
											>
												{service.name}
											</Text>
											<View className="mt-1 flex-row items-baseline">
												<Text className="text-base font-bold text-primary">
													{service.price}
												</Text>
												<Text className="ml-1 text-xs text-muted-foreground">
													元/{service.unit}
												</Text>
											</View>
											{service.tag && (
												<View className="mt-1 self-start rounded-full bg-primary/10 px-2 py-0.5">
													<Text className="text-xs text-primary">
														{service.tag}
													</Text>
												</View>
											)}
										</View>
									</Pressable>
								</View>
							))}
						</View>
					</View>
				</View>
			</Animated.ScrollView>

			{/* 底部操作栏 */}
			<View
				className="absolute bottom-0 left-0 right-0 bg-background border-t border-border px-4 py-3"
				style={{
					shadowColor: "#000",
					shadowOffset: { width: 0, height: -2 },
					shadowOpacity: 0.1,
					shadowRadius: 8,
					elevation: 8,
				}}
			>
				<View className="flex-row items-center gap-3">
					{/* 左侧图标按钮 */}
					{/* <Pressable
						onPress={() => {}}
						className="items-center justify-center"
						hitSlop={8}
					>
						<Icon
							as={ICON_MAP.MessageCircle}
							size={24}
							className="text-foreground"
						/>
						<Text className="mt-1 text-xs text-muted-foreground">在线咨询</Text>
					</Pressable>

					<Pressable
						onPress={() => {}}
						className="items-center justify-center"
						hitSlop={8}
					>
						<Icon
							as={ICON_MAP.ShoppingCart}
							size={24}
							className="text-foreground"
						/>
						<Text className="mt-1 text-xs text-muted-foreground">购物车</Text>
					</Pressable>

					<Separator orientation="vertical" className="h-10 bg-border mx-2" /> */}

					{/* 主要操作按钮 */}
					{/* <Button
						onPress={() => {}}
						className="flex-1 items-center justify-center rounded-full border-2 border-primary bg-transparent"
					>
						<Text className="text-primary">
							加入购物车
						</Text>
					</Button> */}

					<Button
						onPress={() => {
							// 保存服务详情到 store
							if (servicePersonnelDetails) {
								setServiceDetails(servicePersonnelDetails);
							}

							// 保存选中的规格到 store
							const selectedSpec = specifications.find(spec => spec.id === selectedOption);
							console.log(selectedSpec)
                            if (selectedSpec) {
								setSelectedSpecification({
									id: selectedSpec.id,
									name: selectedSpec.name,
									price: selectedSpec.price,
									unit: selectedSpec.currency
								});
							}

							router.push({
								pathname: "/servicePersonnel/order-confirm",
							});
						}}
						className="flex-1 items-center justify-center rounded-full bg-primary"
					>
						<Text className="text-base font-semibold text-primary-foreground">
							立即预约
						</Text>
					</Button>
				</View>
			</View>
		</View>
	);
}
