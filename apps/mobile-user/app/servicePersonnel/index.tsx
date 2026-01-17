import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-user-constants";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Image } from "expo-image";
import { useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { ActivityIndicator, Dimensions, Modal, Pressable, RefreshControl, ScrollView, View } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedScrollHandler,
    useAnimatedStyle,
    useSharedValue,
} from "react-native-reanimated";
import ReanimatedCarousel from "react-native-reanimated-carousel";
import { useServicePersonnelDetails } from "@repo/hooks/api/service-personnel";
import { hslToRgba } from "@repo/lib/utils";
import useServiceStore from "@/stores/service";
import { ReviewsList } from "@/components/service-personnel/ReviewsList";
import type { Review } from "@/components/service-personnel/types";
import { useReviewStats, useTargetReviewsInfinite } from "@repo/hooks/api/review";

const ICON_MAP = lucideIconRegistry;
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");

function TabPanel({
    visible,
    children,
}: {
    visible: boolean;
    children: ReactNode;
}) {
    return (
        <View style={{ display: visible ? "flex" : "none" }}>
            {children}
        </View>
    );
}

export default function ServiceDetailScreen() {
    const router = useRouter();

    const { selectedServiceTime, selectService: selectServiceId, selectServicePersonnelInfo, setSelectedSpecification, setServiceDetails } = useServiceStore();


    const { data: servicePersonnelDetails, refetch: refetchServicePersonnel } = useServicePersonnelDetails({
        serviceId: selectServiceId!.id,
        personnelId: selectServicePersonnelInfo?.userId!,
    });
    const personnelId = selectServicePersonnelInfo?.userId || servicePersonnelDetails?.userId;
    const serviceId = selectServiceId?.id;
    const { data: reviewStats, refetch: refetchReviewStats } = useReviewStats(
        "personnel",
        personnelId || "",
        serviceId,
    );
    const {
        data: reviewPages,
        fetchNextPage: fetchNextReviewsPage,
        hasNextPage: hasNextReviewsPage,
        isFetchingNextPage: isFetchingNextReviewsPage,
        isLoading: isLoadingReviews,
        refetch: refetchReviews,
    } = useTargetReviewsInfinite("personnel", personnelId || "", {
        serviceId,
        limit: 10,
    });

    const { colorScheme } = useColorScheme();


    // 使用后端返回的真实规格数据
    const specifications = servicePersonnelDetails?.specifications || [];

    const [selectedOption, setSelectedOption] = useState("");
    const [selectedTab, setSelectedTab] = useState("service");
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [carouselIndex, setCarouselIndex] = useState(0);
    const [isPreviewVisible, setIsPreviewVisible] = useState(false);
    const [previewIndex, setPreviewIndex] = useState(0);
    const [previewImages, setPreviewImages] = useState<string[]>([]);
    const [scrollContainerHeight, setScrollContainerHeight] = useState(
        Math.max(SCREEN_HEIGHT, 1),
    );
    const [canScroll, setCanScroll] = useState(true);

    const scrollY = useSharedValue(0);
    const isScrollIng = useSharedValue(false);

    // 当规格数据加载完成后,设置默认选中第一个规格
    useEffect(() => {
        if (specifications.length === 0) {
            return;
        }
        const currentExists = specifications.some((spec) => spec.id === selectedOption);
        if (!selectedOption || !currentExists) {
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
    const gallery = useMemo(
        () => servicePersonnelDetails?.gallery ?? [],
        [servicePersonnelDetails?.gallery],
    );
    const carouselHeight = SCREEN_WIDTH * 0.75;

    // 服务说明 - 使用后端返回的description
    const serviceDescription =
        servicePersonnelDetails?.description || "暂无服务说明";
    const reviewItems = useMemo((): Review[] => {
        const items = reviewPages?.pages.flatMap((page) => page.data) ?? [];
        return items.map((item) => {
            const rawAvatar =
                (item as any).reviewerAvatarUrl ||
                (item as any).reviewerAvatar ||
                (item as any).avatar ||
                "";
            const isHttp = rawAvatar && /^https?:\/\//i.test(rawAvatar);
            return {
                id: item.id,
                userId: item.reviewerId,
                userName: item.isAnonymous
                    ? "匿名用户"
                    : item.reviewerName || item.reviewerId.slice(0, 6),
                avatar: isHttp ? rawAvatar : undefined,
                avatarFileId: !isHttp && rawAvatar ? rawAvatar : undefined,
                rating: item.rating,
                date: new Date(item.createdAt).toLocaleDateString("zh-CN"),
                content: item.comment || "",
                images: item.images?.map((image) => ({
                    url: image.url,
                    blurhash: image.blurhash,
                })),
                serviceTag: item.serviceId ? selectServiceId?.label : undefined,
            };
        });
    }, [reviewPages, selectServiceId?.label]);
    const totalReviewsCount = reviewStats?.totalCount ?? 0;
    const positiveCount = reviewStats?.goodCount ?? 0;
    const neutralCount = reviewStats?.neutralCount ?? 0;
    const negativeCount = reviewStats?.badCount ?? 0;

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

    const forceShowHeader = !canScroll;

    const handleRefresh = async () => {
        setIsRefreshing(true);
        try {
            const [detailResult] = await Promise.all([
                refetchServicePersonnel({
                    throwOnError: false,
                }),
                refetchReviews({ throwOnError: false }),
                refetchReviewStats({ throwOnError: false }),
            ]);
            if (detailResult?.data) {
                setServiceDetails(detailResult.data);
            }
        } finally {
            setIsRefreshing(false);
        }
    };

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
                    style={[
                        backgroundAnimatedStyle,
                        forceShowHeader && {
                            backgroundColor: NAV_THEME[colorScheme ?? "light"].colors.background,
                        },
                    ]}
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
                        style={[opacity, forceShowHeader && { opacity: 1 }]}
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
                scrollEventThrottle={16}
                onLayout={(e) =>
                    setScrollContainerHeight(e.nativeEvent.layout.height || SCREEN_HEIGHT)
                }
                onContentSizeChange={(_w, h) => {
                    setCanScroll(h > scrollContainerHeight + 8);
                }}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                {/* 服务头部图片/轮播 */}
                <View className="relative">
                    {gallery.length > 0 ? (
                        <View>
                            <ReanimatedCarousel
                                width={SCREEN_WIDTH}
                                height={carouselHeight}
                                data={gallery}
                                loop
                                pagingEnabled
                                onSnapToItem={setCarouselIndex}
                                renderItem={({ item }) => (
                                    <Pressable
                                        onPress={() => {
                                            setPreviewImages(gallery.map((g) => g.url));
                                            setPreviewIndex(
                                                Math.max(
                                                    0,
                                                    gallery.findIndex((g) => g.url === item.url),
                                                ),
                                            );
                                            setIsPreviewVisible(true);
                                        }}
                                    >
                                        <Image
                                            source={{ uri: item.url }}
                                            style={{ width: SCREEN_WIDTH, height: carouselHeight }}
                                            contentFit="cover"
                                        />
                                    </Pressable>
                                )}
                            />
                            {gallery.length > 1 && (
                                <View className="absolute bottom-3 left-0 right-0 flex-row justify-center gap-2">
                                    {gallery.map((_, idx) => (
                                        <View
                                            key={`dot-${idx}`}
                                            style={{
                                                width: idx === carouselIndex ? 20 : 8,
                                                height: 8,
                                                borderRadius: 999,
                                                backgroundColor:
                                                    idx === carouselIndex ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.5)",
                                            }}
                                        />
                                    ))}
                                </View>
                            )}
                        </View>
                    ) : (
                        <Image
                            source={{
                                uri: `https://picsum.photos/${SCREEN_WIDTH}/${Math.floor(carouselHeight)}`,
                            }}
                            style={{
                                width: SCREEN_WIDTH,
                                height: carouselHeight,
                            }}
                            contentFit="cover"
                        />
                    )}
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
                    <TabPanel visible={selectedTab === "service"}>
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
											{showAllParts ? \"收起全部\" : \"查看全部\"}
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
                    </TabPanel>

                    <TabPanel visible={selectedTab === "reviews"}>
                        <View className="mb-6">
                            <View className="mb-3 flex-row items-center justify-between">
                                <View>
                                    <Text className="text-lg font-bold text-foreground">
                                        用户评论
                                    </Text>
                                    <Text className="text-xs text-muted-foreground mt-1">
                                        {totalReviewsCount > 0
                                            ? `共 ${totalReviewsCount} 条评价`
                                            : "暂无评价"}
                                    </Text>
                                </View>
                                {reviewStats && (
                                    <View className="items-end">
                                        <Text className="text-3xl font-semibold text-primary">
                                            {reviewStats.averageRatingDisplay}
                                        </Text>
                                        <Text className="text-xs text-muted-foreground">
                                            综合评分
                                        </Text>
                                    </View>
                                )}
                            </View>

                            {isLoadingReviews ? (
                                <View className="py-8 items-center justify-center">
                                    <ActivityIndicator size="small" className="text-primary" />
                                    <Text className="mt-2 text-sm text-muted-foreground">
                                        加载评价中...
                                    </Text>
                                </View>
                            ) : reviewItems.length > 0 ? (
                                <ReviewsList
                                    reviews={reviewItems}
                                    totalReviewsCount={totalReviewsCount}
                                    positiveCount={positiveCount}
                                    neutralCount={neutralCount}
                                    negativeCount={negativeCount}
                                    onImagePress={(images: string[], index: number) => {
                                        setPreviewImages(images);
                                        setPreviewIndex(index);
                                        setIsPreviewVisible(true);
                                    }}
                                />
                            ) : (
                                <View className="py-8 items-center justify-center">
                                    <Text className="text-sm text-muted-foreground">
                                        暂无评价
                                    </Text>
                                </View>
                            )}

                            {hasNextReviewsPage && (
                                <Pressable
                                    className="mt-3 items-center justify-center rounded-full border border-border py-2 active:opacity-80"
                                    onPress={() => fetchNextReviewsPage()}
                                    disabled={isFetchingNextReviewsPage}
                                >
                                    {isFetchingNextReviewsPage ? (
                                        <ActivityIndicator size="small" className="text-primary" />
                                    ) : (
                                        <Text className="text-sm text-primary">加载更多</Text>
                                    )}
                                </Pressable>
                            )}
                        </View>
                    </TabPanel>

                    {/* 相似服务推荐
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
                                        onPress={() => { }}
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
                    </View> */}
                </View>
            </Animated.ScrollView>

            {/* 全屏预览 */}
            <Modal
                visible={isPreviewVisible}
                transparent
                animationType="fade"
                onRequestClose={() => setIsPreviewVisible(false)}
            >
                <View className="flex-1 bg-black/90">
                    <View className="absolute right-4 top-10 z-10">
                        <Pressable
                            onPress={() => setIsPreviewVisible(false)}
                            className="h-10 w-10 items-center justify-center rounded-full bg-black/60"
                            hitSlop={12}
                        >
                            <Icon as={ICON_MAP.X} size={22} className="text-white" />
                        </Pressable>
                    </View>

                    {previewImages.length > 0 && (
                        <ReanimatedCarousel
                            width={SCREEN_WIDTH}
                            height={SCREEN_HEIGHT}
                            data={previewImages}
                            defaultIndex={previewIndex}
                            loop={previewImages.length > 1}
                            pagingEnabled
                            onSnapToItem={setPreviewIndex}
                            renderItem={({ item }) => (
                                <View className="w-full h-full items-center justify-center">
                                    <Image
                                        source={{ uri: item }}
                                        style={{ width: SCREEN_WIDTH, height: SCREEN_HEIGHT }}
                                        contentFit="contain"
                                    />
                                </View>
                            )}
                        />
                    )}
                </View>
            </Modal>

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