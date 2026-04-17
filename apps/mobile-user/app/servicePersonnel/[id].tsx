import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Galeria } from "@nandorojo/galeria";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, useMemo, useRef } from "react";
import { useSharedValue } from "react-native-reanimated";
import Carousel, {
    type ICarouselInstance,
    Pagination,
} from "react-native-reanimated-carousel";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";
import {
    ChevronLeft,
    Clock,
    MapPin,
    MessageCircle,
    User,
} from "lucide-react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
    Pressable,
    RefreshControl,
    ScrollView,
    useWindowDimensions,
    View,
} from "react-native";
import { useServicePersonnelDetails } from "@repo/hooks/api/service-personnel";
import { useChatUpsertConversation } from "@repo/hooks/api/chat";
import { executeContactCustomerAction } from "@repo/mobile-ui/lib/contact-customer-action";
import { toast } from "sonner-native";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { MassageServicePersonnelScreen } from "@/components/service-personnel/massage-service-personnel-screen";
import {
    ServicePersonnelReviewList,
    type ServicePersonnelReviewItem,
} from "@/components/service-personnel/service-personnel-review-list";

const WEEKDAY_BY_DIGIT: Record<string, string> = {
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
    "7": "周日",
};

function formatWorkDays(value: string): string {
    if (!value) {
        return "";
    }

    if (value.includes("周")) {
        return value;
    }

    const digits = value.match(/[1-7]/g);
    if (!digits?.length) {
        return value;
    }

    const uniqueSorted = Array.from(new Set(digits)).sort(
        (a, b) => Number(a) - Number(b),
    );
    return uniqueSorted.map((d) => WEEKDAY_BY_DIGIT[d] ?? d).join("、");
}

function formatTimeHHmm(value: string): string {
    if (!value) {
        return "";
    }

    const parts = value.split(":");
    if (parts.length < 2) {
        return value;
    }

    const hh = parts[0]?.padStart(2, "0") ?? parts[0];
    const mm = parts[1]?.padStart(2, "0") ?? parts[1];
    return `${hh}:${mm}`;
}

function getRouteParam(value?: string | string[]): string {
    if (Array.isArray(value)) {
        return value[0] ?? "";
    }

    return value ? String(value) : "";
}

function ServiceDetailSkeleton({
    bottomInset,
    includeBottomBar = true,
}: {
    bottomInset: number;
    includeBottomBar?: boolean;
}) {
    return (
        <>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* 顶部图片 */}
                <View className="relative">
                    <Skeleton className="h-[233px] w-full rounded-none" />
                    <View className="absolute left-0 right-0 bottom-3 items-center">
                        <View className="flex-row" style={{ gap: 6 }}>
                            {Array.from({ length: 3 }).map((_, idx) => (
                                <Skeleton
                                    key={`header-skeleton-dot-${idx}`}
                                    className="h-[6px] w-[6px] rounded-full"
                                />
                            ))}
                        </View>
                    </View>
                </View>

                {/* 主体白底内容 */}
                <View className="bg-card">
                    {/* 价格 + 已购 */}
                    <View className="px-4 pt-3 flex-row justify-between">
                        <View className="flex-row items-baseline">
                            <Skeleton className="h-4 w-4 rounded" />
                            <Skeleton className="ml-2 h-8 w-20 rounded" />
                            <Skeleton className="ml-2 h-4 w-6 rounded" />
                        </View>
                        <Skeleton className="h-3 w-16 rounded" />
                    </View>

                    {/* 姓名 + 经验 + 标签 */}
                    <View className="px-4 pt-2 flex-row items-start justify-between">
                        <View className="flex-1">
                            <Skeleton className="h-4 w-40 rounded" />
                            <Skeleton className="mt-2 h-3 w-24 rounded" />
                        </View>
                        <Skeleton className="h-5 w-12 rounded" />
                    </View>

                    {/* 描述 */}
                    <View className="px-4 pt-2">
                        <Skeleton className="h-3 w-full rounded" />
                        <Skeleton className="mt-2 h-3 w-5/6 rounded" />
                        <Skeleton className="mt-2 h-3 w-2/3 rounded" />
                    </View>

                    {/* 距离/地址 */}
                    <View className="px-4 pt-3 flex-row items-center">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="ml-2 h-3 flex-1 rounded" />
                    </View>

                    {/* 工作时间 */}
                    <View className="px-4 pt-2 pb-4 flex-row items-center">
                        <Skeleton className="h-4 w-4 rounded-full" />
                        <Skeleton className="ml-2 h-3 w-40 rounded" />
                    </View>

                    <View className="h-px bg-border" />

                    {/* 评价标题 */}
                    <View className="px-4 py-4 flex-row items-center justify-between">
                        <Skeleton className="h-4 w-24 rounded" />
                        <Skeleton className="h-4 w-16 rounded" />
                    </View>

                    <View className="h-px bg-border" />

                    {/* 评价列表骨架 */}
                    {Array.from({ length: 2 }).map((_, index) => (
                        <View key={`review-skeleton-${index}`}>
                            <View className="px-4 pt-4">
                                <View className="flex-row items-start">
                                    <Skeleton className="h-[42px] w-[42px] rounded-full" />
                                    <View className="ml-3 flex-1">
                                        <View className="flex-row items-start justify-between">
                                            <View className="flex-1">
                                                <Skeleton className="h-4 w-24 rounded" />
                                                <Skeleton className="mt-2 h-3 w-16 rounded" />
                                            </View>
                                            <View
                                                className="flex-row items-center"
                                                style={{ gap: 4 }}
                                            >
                                                {Array.from({ length: 5 }).map(
                                                    (__, starIdx) => (
                                                        <Skeleton
                                                            key={`review-skeleton-star-${index}-${starIdx}`}
                                                            className="h-3 w-3 rounded-full"
                                                        />
                                                    ),
                                                )}
                                            </View>
                                        </View>

                                        <Skeleton className="mt-3 h-3 w-full rounded" />
                                        <Skeleton className="mt-2 h-3 w-5/6 rounded" />

                                        <View
                                            className="mt-3 flex-row"
                                            style={{ gap: 12 }}
                                        >
                                            {Array.from({ length: 3 }).map(
                                                (__, imgIdx) => (
                                                    <Skeleton
                                                        key={`review-skeleton-img-${index}-${imgIdx}`}
                                                        className="h-[77px] w-[77px] rounded-[8px]"
                                                    />
                                                ),
                                            )}
                                        </View>

                                        <Skeleton className="mt-3 h-3 w-24 rounded" />
                                    </View>
                                </View>
                            </View>

                            {index === 0 ? (
                                <View className="h-px bg-border" />
                            ) : null}
                        </View>
                    ))}

                    <View className="h-px bg-border" />
                    <View className="px-4 py-4 items-center">
                        <Skeleton className="h-4 w-28 rounded" />
                    </View>
                </View>
            </ScrollView>

            {includeBottomBar ? (
                <View
                    className="absolute bottom-0 left-0 right-0 bg-card border-t border-border"
                    style={{ paddingBottom: bottomInset }}
                >
                    <View className="px-4 py-2 flex-row items-center">
                        <View className="w-[88px] h-[34px] flex-row items-center">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="ml-2 h-3 w-12 rounded" />
                        </View>
                        <View className="w-[88px] h-[34px] flex-row items-center">
                            <Skeleton className="h-5 w-5 rounded-full" />
                            <Skeleton className="ml-2 h-3 w-12 rounded" />
                        </View>
                        <View className="flex-1 items-end">
                            <Skeleton className="h-[34px] w-[120px] rounded-full" />
                        </View>
                    </View>
                </View>
            ) : null}
        </>
    );
}

function ServiceDetailError({
    onRetry,
    bottomInset,
}: {
    onRetry: () => void;
    bottomInset: number;
}) {
    return (
        <>
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                <View className="px-4 py-6">
                    <Text className="text-sm text-muted-foreground font-puhui-regular">
                        服务详情加载失败
                    </Text>
                    <Pressable
                        hitSlop={12}
                        onPress={onRetry}
                        className="mt-4 self-start rounded-full bg-primary px-4 py-2"
                    >
                        <Text className="text-sm font-puhui-medium text-primary-foreground">
                            重试
                        </Text>
                    </Pressable>
                </View>
            </ScrollView>

            {/* 底部操作栏（固定） */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-card border-t border-border"
                style={{ paddingBottom: bottomInset }}
            >
                <ServiceDetailBottomBarContent />
            </View>
        </>
    );
}

function ServiceDetailBottomBarContent() {
    const router = useRouter();
    const upsertConversation = useChatUpsertConversation();
    const params = useLocalSearchParams<{
        id?: string | string[];
        serviceId?: string | string[];
        serviceName?: string | string[];
        personnelName?: string | string[];
    }>();

    const personnelId = Array.isArray(params.id)
        ? params.id[0]
        : params.id
          ? String(params.id)
          : "";
    const serviceId = Array.isArray(params.serviceId)
        ? params.serviceId[0]
        : params.serviceId
          ? String(params.serviceId)
          : "";
    const serviceName = Array.isArray(params.serviceName)
        ? params.serviceName[0]
        : params.serviceName
          ? String(params.serviceName)
          : "";
    const personnelName = Array.isArray(params.personnelName)
        ? params.personnelName[0]
        : params.personnelName
          ? String(params.personnelName)
          : "服务人员";

    const handleOpenPersonnelChat = async () => {
        if (!personnelId) {
            toast.error("缺少服务人员信息，无法发起私聊");
            return;
        }
        try {
            const conversation = await upsertConversation.mutateAsync({
                dto: { peerUserId: personnelId },
                clientRole: "customer",
            });
            router.push({
                pathname: "/chat/[conversationId]",
                params: {
                    conversationId: conversation.id,
                    peerName: personnelName,
                },
            });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "发起私聊失败",
            );
        }
    };

    return (
        <View className="px-4 py-2 flex-row items-center">
            <Pressable
                className="w-[88px] h-[34px] flex-row items-center"
                hitSlop={12}
                onPress={executeContactCustomerAction}
            >
                <Icon
                    as={MessageCircle}
                    size={20}
                    className="text-foreground opacity-60"
                />
                <Text className="ml-1 text-xs font-puhui-regular text-foreground opacity-60">
                    咨询客服
                </Text>
            </Pressable>

            <Pressable
                className="w-[88px] h-[34px] flex-row items-center"
                hitSlop={12}
                onPress={() => void handleOpenPersonnelChat()}
            >
                <Icon
                    as={User}
                    size={20}
                    className="text-foreground opacity-60"
                />
                <Text className="ml-1 text-xs font-puhui-regular text-foreground opacity-60">
                    联系服务人员
                </Text>
            </Pressable>

            <View className="flex-1 items-end">
                <Pressable
                    className="h-[34px] w-[120px] rounded-full bg-primary items-center justify-center"
                    hitSlop={12}
                    onPress={() =>
                        router.push({
                            pathname: "/servicePersonnel/order-confirm",
                            params: {
                                personnelId,
                                serviceId,
                                serviceName,
                            },
                        })
                    }
                >
                    <Text className="text-sm font-puhui-medium text-primary-foreground">
                        立即预约
                    </Text>
                </Pressable>
            </View>
        </View>
    );
}

function ServiceDetailBottomBar({ bottomInset }: { bottomInset: number }) {
    return (
        <View
            className="absolute bottom-0 left-0 right-0 bg-card border-t border-border"
            style={{ paddingBottom: bottomInset }}
        >
            <ServiceDetailBottomBarContent />
        </View>
    );
}

function ServiceDetailContent({
    personnelId,
    serviceId,
    serviceName,
    onGoToAllReviews,
}: {
    personnelId: string;
    serviceId: string;
    serviceName: string;
    onGoToAllReviews: () => void;
}) {
    const { width: windowWidth } = useWindowDimensions();
    const headerCarouselProgress = useSharedValue<number>(0);
    const headerCarouselRef = useRef<ICarouselInstance>(null);

    const onPressHeaderPagination = (index: number) => {
        // 用 count 差值，loop 模式下会更自然地滚到“最近”的那一张。
        headerCarouselRef.current?.scrollTo({
            count: index - headerCarouselProgress.value,
            animated: true,
        });
    };

    const detailsQuery = useServicePersonnelDetails({
        personnelId,
        serviceId,
    });
    const details = detailsQuery.data;
    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            detailsQuery.refetch({
                throwOnError: false,
            }),
    });

    const view = useMemo(() => {
        const headerImages = (details?.gallery ?? []).filter((image) =>
            Boolean(image.url),
        );

        const priceCandidates = (details?.specifications ?? [])
            .map((spec) => Number.parseFloat(spec.price))
            .filter((v) => Number.isFinite(v) && v >= 0);
        const priceFrom = priceCandidates.length
            ? Math.min(...priceCandidates)
            : 0;

        const locationText =
            details?.detailedAddress?.trim() ||
            [details?.province, details?.district, details?.county]
                .filter(Boolean)
                .join("") ||
            "";

        const scheduleDays = details?.workDays
            ? formatWorkDays(details.workDays)
            : "";
        const scheduleStart = details?.workStartTime
            ? formatTimeHHmm(details.workStartTime)
            : "";
        const scheduleEnd = details?.workEndTime
            ? formatTimeHHmm(details.workEndTime)
            : "";
        const scheduleTime =
            scheduleStart && scheduleEnd
                ? `${scheduleStart}-${scheduleEnd}`
                : scheduleStart || scheduleEnd;
        const scheduleText = scheduleDays
            ? scheduleTime
                ? `${scheduleDays}—${scheduleTime}`
                : scheduleDays
            : scheduleTime;

        const topReviews =
            (
                details as unknown as
                    | {
                          topReviews?: ServicePersonnelReviewItem[];
                      }
                    | undefined
            )?.topReviews ?? [];

        return {
            headerImages,
            priceFrom,
            purchasedCount: details?.servicedCount ?? 0,
            personnelName: details?.name ?? "",
            experienceText:
                details?.yearsOfExperience && details.yearsOfExperience > 0
                    ? `${details.yearsOfExperience}年经验`
                    : "",
            serviceTag: serviceName,
            description: details?.description ?? "",
            locationText,
            scheduleText,
            reviewCount: topReviews.length,
            topReviews,
        };
    }, [details, serviceName]);

    if (showPageLoading) {
        return (
            <ServiceDetailSkeleton bottomInset={0} includeBottomBar={false} />
        );
    }

    return (
        <ScrollView
            className="flex-1"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 120 }}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing}
                    onRefresh={() => {
                        void onRefresh();
                    }}
                />
            }
        >
            {/* 顶部图片 */}
            {view.headerImages.length ? (
                <View style={{ width: "100%", height: 233 }}>
                    <Galeria urls={view.headerImages.map((img) => img.url)}>
                        <Carousel
                            ref={headerCarouselRef}
                            width={windowWidth}
                            height={233}
                            data={view.headerImages}
                            loop={view.headerImages.length > 1}
                            autoPlay={view.headerImages.length > 1}
                            autoPlayInterval={3000}
                            onProgressChange={headerCarouselProgress}
                            onConfigurePanGesture={(gesture) => {
                                "worklet";
                                // 嵌套在纵向 ScrollView 时，给 X 轴留出小范围滑动阈值，
                                // 避免轮播手势抢占导致页面上下滚动不顺。
                                gesture.activeOffsetX([-10, 10]);
                            }}
                            renderItem={({ item, index }) => (
                                <Galeria.Image index={index}>
                                    <Image
                                        source={{ uri: item.url }}
                                        placeholder={
                                            item.blurhash
                                                ? { blurhash: item.blurhash }
                                                : undefined
                                        }
                                        contentFit="cover"
                                        style={{
                                            width: "100%",
                                            height: "100%",
                                        }}
                                    />
                                </Galeria.Image>
                            )}
                        />
                    </Galeria>

                    {view.headerImages.length > 1 ? (
                        <View
                            style={{
                                position: "absolute",
                                left: 0,
                                right: 0,
                                bottom: 10,
                                alignItems: "center",
                            }}
                        >
                            <Pagination.Basic
                                progress={headerCarouselProgress}
                                data={view.headerImages}
                                size={6}
                                dotStyle={{
                                    backgroundColor:
                                        "rgba(255, 255, 255, 0.35)",
                                    borderRadius: 999,
                                }}
                                activeDotStyle={{
                                    backgroundColor: "rgba(255, 255, 255, 0.9)",
                                    borderRadius: 999,
                                    overflow: "hidden",
                                }}
                                containerStyle={{ gap: 6 }}
                                onPress={onPressHeaderPagination}
                            />
                        </View>
                    ) : null}
                </View>
            ) : (
                <View className="h-[233px] w-full bg-muted" />
            )}

            {/* 主体白底内容 */}
            <View className="bg-card">
                {/* 价格 + 已购 */}
                <View className="px-4 pt-3 flex-row justify-between">
                    <View className="flex-row items-baseline font-din-alt-bold">
                        <Text className="text-sm text-destructive font-din-alt-bold">
                            ￥
                        </Text>
                        <Text className="text-3xl text-destructive font-din-alt-bold leading-[36px]">
                            {view.priceFrom}
                        </Text>
                        <Text className="ml-1 text-sm text-destructive font-din-alt-bold">
                            起
                        </Text>
                    </View>
                    <Text className="text-[11px] font-puhui-regular text-muted-foreground">
                        已购 {view.purchasedCount}
                    </Text>
                </View>

                {/* 姓名 + 经验 + 标签 */}
                <View className="px-4 pt-2 flex-row items-start justify-between">
                    <Text className="text-base font-puhui-regular text-foreground">
                        {view.personnelName || "服务人员"}·
                        <Text className="text-sm font-puhui-medium text-secondary-foreground">
                            {view.experienceText}
                        </Text>
                    </Text>
                    {view.serviceTag ? (
                        <View className="border border-primary rounded px-1 py-0.5">
                            <Text className="text-[11px] font-puhui-regular text-primary">
                                {view.serviceTag}
                            </Text>
                        </View>
                    ) : null}
                </View>

                {/* 描述 */}
                <View className="px-4 pt-2">
                    <Text className="text-xs font-puhui-regular text-muted-foreground leading-5">
                        {view.description}
                    </Text>
                </View>

                {/* 距离/地址 */}
                <View className="px-4 pt-3 flex-row items-center">
                    <Icon
                        as={MapPin}
                        size={16}
                        className="text-muted-foreground"
                    />
                    <Text className="ml-2 text-xs font-puhui-regular text-muted-foreground">
                        {view.locationText}
                    </Text>
                </View>

                {/* 工作时间 */}
                <View className="px-4 pt-2 pb-4 flex-row items-center">
                    <Icon
                        as={Clock}
                        size={16}
                        className="text-muted-foreground"
                    />
                    <Text className="ml-2 text-xs font-puhui-regular text-muted-foreground">
                        {view.scheduleText}
                    </Text>
                </View>

                <View className="h-px bg-border" />

                <ServicePersonnelReviewList
                    reviewCount={view.reviewCount}
                    reviews={view.topReviews}
                    onPressAllReviews={onGoToAllReviews}
                />
            </View>
        </ScrollView>
    );
}

export default function ServiceDetailScreen() {
    // 像素稿：先做静态 UI（不对接后端），用语义 token className 表达颜色。
    // Figma: 服务详情 (node 20:2194)
    const router = useRouter();
    const insets = useSafeAreaInsets();

    const params = useLocalSearchParams<{
        id?: string | string[];
        serviceId?: string | string[];
        pricingId?: string | string[];
        serviceName?: string | string[];
        personnelName?: string | string[];
        mock?: string | string[];
    }>();

    const personnelId = getRouteParam(params.id);
    const serviceId = getRouteParam(params.serviceId);
    const pricingId = getRouteParam(params.pricingId);
    const serviceName = getRouteParam(params.serviceName);
    const personnelName = getRouteParam(params.personnelName);
    const mockSource = getRouteParam(params.mock);

    if (mockSource === "massage") {
        return (
            <QueryErrorResetBoundary>
                {({ reset }) => (
                    <ErrorBoundary
                        onReset={reset}
                        fallbackRender={({ resetErrorBoundary }) => (
                            <ServiceDetailError
                                onRetry={resetErrorBoundary}
                                bottomInset={insets.bottom}
                            />
                        )}
                    >
                        <MassageServicePersonnelScreen
                            personnelId={personnelId}
                            serviceId={serviceId}
                            pricingId={pricingId}
                            serviceName={serviceName}
                            personnelName={personnelName}
                        />
                    </ErrorBoundary>
                )}
            </QueryErrorResetBoundary>
        );
    }

    const goToAllReviews = () => {
        router.push({
            pathname: "/servicePersonnel/reviews",
            params: {
                personnelId,
                serviceId,
                serviceName,
            },
        });
    };

    return (
        <View className="flex-1 bg-background">
            {/* 顶部导航栏（固定） */}
            <View className="bg-card">
                <View className="h-[90px] flex-row items-center px-4 pt-12">
                    <View className="w-[78px]">
                        <Pressable hitSlop={12} onPress={() => router.back()}>
                            <Icon
                                as={ChevronLeft}
                                size={22}
                                className="text-foreground"
                            />
                        </Pressable>
                    </View>
                    <View className="flex-1 items-center">
                        <Text className="text-base font-puhui-medium text-foreground">
                            服务详情
                        </Text>
                    </View>
                    <View className="w-[78px] items-end">
                        {/* <Pressable hitSlop={12} onPress={() => { }}>
                            <Icon
                                as={MoreHorizontal}
                                size={22}
                                className="text-foreground"
                            />
                        </Pressable> */}
                    </View>
                </View>
            </View>

            {!serviceId || !personnelId ? (
                <>
                    <ScrollView
                        className="flex-1"
                        showsVerticalScrollIndicator={false}
                        contentContainerStyle={{ paddingBottom: 120 }}
                    >
                        <View className="px-4 py-6">
                            <Text className="text-sm text-muted-foreground font-puhui-regular">
                                缺少 personnelId 或 serviceId，无法加载服务详情
                            </Text>
                        </View>
                    </ScrollView>
                    <ServiceDetailBottomBar bottomInset={insets.bottom} />
                </>
            ) : (
                <QueryErrorResetBoundary>
                    {({ reset }) => (
                        <ErrorBoundary
                            onReset={reset}
                            fallbackRender={({ resetErrorBoundary }) => (
                                <ServiceDetailError
                                    onRetry={resetErrorBoundary}
                                    bottomInset={insets.bottom}
                                />
                            )}
                        >
                            <Suspense
                                fallback={
                                    <ServiceDetailSkeleton
                                        bottomInset={insets.bottom}
                                    />
                                }
                            >
                                <>
                                    <ServiceDetailContent
                                        personnelId={personnelId}
                                        serviceId={serviceId}
                                        serviceName={serviceName}
                                        onGoToAllReviews={goToAllReviews}
                                    />
                                    <ServiceDetailBottomBar
                                        bottomInset={insets.bottom}
                                    />
                                </>
                            </Suspense>
                        </ErrorBoundary>
                    )}
                </QueryErrorResetBoundary>
            )}
        </View>
    );
}
