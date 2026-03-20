import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { router, useFocusEffect, useLocalSearchParams } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { cssInterop, useColorScheme } from "nativewind";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { InteractionManager, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { ArrowLeft } from "@repo/mobile-ui/lib/icons/ArrowLeft";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-user-constants";
import { useServiceListSinglePage } from "@repo/hooks/api/service";
import { useHomeRecommendationsInfinite } from "@repo/hooks/api/home";
import {
    type MatchedPersonnelUI,
    useServicePersonnelSearchQuery,
} from "@repo/hooks/api/service-personnel";
import useLocation from "@repo/hooks/useLocation";
import { useHomeLocationStore } from "@/stores/home-location-store";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

// Enable NativeWind `className` on expo-image.
cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

type ImageSource = React.ComponentProps<typeof ExpoImage>["source"];

type WorkerCardItem = {
    id: string;
    serviceId?: string;
    pricingId?: string;
    serviceName?: string;
    name: string;
    experienceText: string;
    tag: string;
    distanceText: string;
    addressText: string;
    scheduleText: string;
    price: number;
    avatarUrl: string | null;
    avatarBlurhash?: string | null;
};

const WEEKDAY_BY_DIGIT: Record<string, string> = {
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
    "7": "周日",
};

const RECOMMEND_TAB_KEY = "recommend";
const PENDING_TAB_KEY = "__pending__";

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

function formatDistanceKm(distanceKm: number): string {
    if (!Number.isFinite(distanceKm)) {
        return "";
    }

    if (distanceKm <= 0) {
        return "";
    }

    const meters = distanceKm * 1000;
    if (meters < 1000) {
        return `${Math.round(meters)}米`;
    }

    const kmText =
        distanceKm < 10 ? distanceKm.toFixed(1) : distanceKm.toFixed(0);
    return `${kmText}公里`;
}

function PriceTag({ price }: { price: number }) {
    return (
        <View className="flex-row items-center">
            <Text className="text-xs text-destructive font-din-alt-bold">
                ￥
            </Text>
            <Text className="text-lg text-destructive font-din-alt-bold">
                {price}
            </Text>
            <Text className="ml-0.5 text-xs text-foreground font-puhui-regular">
                起
            </Text>
        </View>
    );
}

function WorkerCard({ item }: { item: WorkerCardItem }) {
    const avatarSource = useMemo<ImageSource>(
        () =>
            item.avatarUrl
                ? ({ uri: item.avatarUrl } satisfies ImageSource)
                : require("@/assets/images/promo-1.png"),
        [item.avatarUrl],
    );
    const avatarPlaceholder = useMemo(
        () =>
            item.avatarBlurhash ? { blurhash: item.avatarBlurhash } : undefined,
        [item.avatarBlurhash],
    );

    return (
        <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
            <View className="flex-row p-3">
                <View className="h-[100px] w-[100px] overflow-hidden rounded-md bg-muted">
                    <Image
                        source={avatarSource}
                        placeholder={avatarPlaceholder}
                        contentFit="cover"
                        transition={200}
                        className="h-[100px] w-[100px]"
                    />
                </View>

                <View className="ml-3 flex-1">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 flex-row items-baseline">
                            <Text className="text-sm text-foreground font-puhui-regular">
                                {item.name}·
                            </Text>
                            {item.experienceText ? (
                                <Text className="ml-0.5 text-xs text-primary font-puhui-medium">
                                    {item.experienceText}
                                </Text>
                            ) : null}
                        </View>
                        <View className="ml-2 items-center justify-center rounded border border-primary px-1 py-0.5">
                            <Text className="text-xs text-primary font-puhui-regular">
                                {item.tag}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-2 flex-row items-center">
                        <Image
                            source={require("@/assets/images/icon-location-small.png")}
                            contentFit="contain"
                            className="h-3 w-3"
                        />
                        <Text className="ml-1 text-xs text-primary font-puhui-medium">
                            {item.distanceText}
                        </Text>
                        <Text className="text-xs text-muted-foreground font-puhui-regular">
                            {" "}
                            ·{" "}
                        </Text>
                        <Text
                            className="flex-1 text-xs text-muted-foreground font-puhui-regular"
                            numberOfLines={1}
                        >
                            {item.addressText}
                        </Text>
                    </View>

                    <View className="mt-1.5 flex-row items-start">
                        <Image
                            source={require("@/assets/images/icon-time.png")}
                            contentFit="contain"
                            className="mt-0.5 h-3 w-3"
                        />
                        <Text
                            className="ml-1 flex-1 text-xs text-muted-foreground font-puhui-regular"
                            numberOfLines={2}
                        >
                            {item.scheduleText}
                        </Text>
                    </View>

                    <View className="mt-auto flex-row items-end justify-between">
                        <PriceTag price={item.price} />
                        <Pressable
                            className="h-5 w-16 items-center justify-center rounded-full bg-primary"
                            onPress={() =>
                                router.push({
                                    pathname: "/servicePersonnel/[id]",
                                    params: {
                                        id: item.id,
                                        ...(item.serviceId
                                            ? { serviceId: item.serviceId }
                                            : {}),
                                        ...(item.pricingId
                                            ? { pricingId: item.pricingId }
                                            : {}),
                                        ...(item.serviceName
                                            ? { serviceName: item.serviceName }
                                            : {}),
                                    },
                                })
                            }
                        >
                            <Text className="text-xs text-primary-foreground font-puhui-medium">
                                立即预约
                            </Text>
                        </Pressable>
                    </View>
                </View>
            </View>
        </View>
    );
}

function WorkerCardSkeleton() {
    return (
        <View className="mx-4 mb-3 overflow-hidden rounded-xl bg-card shadow-sm">
            <View className="flex-row p-3">
                <Skeleton className="h-[100px] w-[100px] rounded-md" />

                <View className="ml-3 flex-1">
                    <View className="flex-row items-start justify-between">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="h-4 w-12" />
                    </View>

                    <View className="mt-2 flex-row items-center">
                        <Skeleton className="h-3 w-10" />
                        <Skeleton className="ml-2 h-3 w-24" />
                    </View>

                    <View className="mt-2">
                        <Skeleton className="h-3 w-44" />
                        <Skeleton className="mt-1.5 h-3 w-36" />
                    </View>

                    <View className="mt-auto flex-row items-end justify-between">
                        <Skeleton className="h-6 w-16" />
                        <Skeleton className="h-5 w-16 rounded-full" />
                    </View>
                </View>
            </View>
        </View>
    );
}

function WorkersListSkeleton({ count = 6 }: { count?: number }) {
    return (
        <View className="pt-3 pb-6">
            {Array.from({ length: count }).map((_, idx) => (
                <WorkerCardSkeleton key={idx} />
            ))}
        </View>
    );
}

export default function CategoryFilterScreen() {
    const params = useLocalSearchParams<{
        categoryId?: string;
        categoryName?: string;
        defaultTabName?: string;
        defaultServiceId?: string;
    }>();
    const categoryId = params.categoryId
        ? String(params.categoryId)
        : undefined;
    const explicitDefaultTabName = params.defaultTabName
        ? String(params.defaultTabName)
        : undefined;
    const defaultTabName = explicitDefaultTabName
        ? explicitDefaultTabName
        : params.categoryName
          ? String(params.categoryName)
          : undefined;
    const defaultServiceId = params.defaultServiceId
        ? String(params.defaultServiceId)
        : undefined;

    const { colorScheme } = useColorScheme();
    const navTheme = NAV_THEME[colorScheme ?? "light"];

    const title = params.categoryName || "家庭保洁";

    const shouldDeferInitialTab = Boolean(
        defaultServiceId || explicitDefaultTabName,
    );
    const [activeTabKey, setActiveTabKey] = useState<string>(() => {
        if (defaultServiceId) {
            return defaultServiceId;
        }

        return shouldDeferInitialTab ? PENDING_TAB_KEY : RECOMMEND_TAB_KEY;
    });

    const listRef = useRef<FlashListRef<WorkerCardItem> | null>(null);
    const [isTransitionSettled, setIsTransitionSettled] = useState(false);

    const serviceListQuery = useServiceListSinglePage({
        categoryId,
        isActive: true,
        limit: 1,
        page: 1,
        enabled: Boolean(categoryId) && isTransitionSettled,
    });

    const services = useMemo(
        () => serviceListQuery.data?.items?.[0]?.children ?? [],
        [serviceListQuery.data],
    );

    const tabs = useMemo(() => {
        return [
            { key: RECOMMEND_TAB_KEY, label: "推荐" },
            ...services.map((s) => ({ key: s.id, label: s.name })),
        ];
    }, [services]);

    const isTabsLoading =
        Boolean(categoryId) &&
        (!isTransitionSettled ||
            serviceListQuery.isLoading ||
            (serviceListQuery.isFetching && !serviceListQuery.data));

    useEffect(() => {
        if (defaultServiceId) {
            setActiveTabKey(defaultServiceId);
            return;
        }

        setActiveTabKey(
            shouldDeferInitialTab ? PENDING_TAB_KEY : RECOMMEND_TAB_KEY,
        );
    }, [categoryId, defaultServiceId, shouldDeferInitialTab]);

    useEffect(() => {
        if (isTabsLoading) {
            return;
        }

        if (!services.length) {
            if (activeTabKey === PENDING_TAB_KEY) {
                setActiveTabKey(RECOMMEND_TAB_KEY);
            }
            return;
        }

        const hasActive = services.some((s) => s.id === activeTabKey);
        if (hasActive || activeTabKey === RECOMMEND_TAB_KEY) {
            return;
        }

        const byId = defaultServiceId
            ? services.find((s) => s.id === defaultServiceId)
            : null;
        const byName = defaultTabName
            ? services.find((s) => s.name === defaultTabName)
            : null;
        const next = byId ?? byName;
        if (next && next.id !== activeTabKey) {
            setActiveTabKey(next.id);
            return;
        }

        setActiveTabKey(RECOMMEND_TAB_KEY);
    }, [
        services,
        activeTabKey,
        defaultServiceId,
        defaultTabName,
        isTabsLoading,
    ]);

    const selectedHomeLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );
    const [isScreenFocused, setIsScreenFocused] = useState(false);
    const { location } = useLocation({
        enabled: isScreenFocused,
        source: "mobile-user/category-filter",
    });

    useFocusEffect(
        useCallback(() => {
            let isCancelled = false;
            const interactionTask = InteractionManager.runAfterInteractions(
                () => {
                    if (!isCancelled) {
                        setIsTransitionSettled(true);
                        setIsScreenFocused(true);
                    }
                },
            );

            return () => {
                isCancelled = true;
                interactionTask.cancel();
                setIsTransitionSettled(false);
                setIsScreenFocused(false);
            };
        }, []),
    );

    const resolvedCoords = useMemo(() => {
        if (
            selectedHomeLocation &&
            Number.isFinite(selectedHomeLocation.lat) &&
            Number.isFinite(selectedHomeLocation.lng) &&
            (selectedHomeLocation.lat !== 0 || selectedHomeLocation.lng !== 0)
        ) {
            return {
                lat: selectedHomeLocation.lat,
                lng: selectedHomeLocation.lng,
            };
        }

        if (location) {
            return {
                lat: location.latitude,
                lng: location.longitude,
            };
        }

        return null;
    }, [selectedHomeLocation, location]);

    const recommendationsQuery = useHomeRecommendationsInfinite(
        {
            categoryId,
            ...(resolvedCoords
                ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
                : {}),
            limit: 20,
        },
        {
            enabled:
                isTransitionSettled &&
                activeTabKey === RECOMMEND_TAB_KEY &&
                Boolean(categoryId),
        },
    );

    const activeService = services.find((s) => s.id === activeTabKey) ?? null;

    const canSearchPersonnel =
        Boolean(activeService) &&
        Boolean(resolvedCoords) &&
        Boolean(categoryId);

    const personnelQuery = useServicePersonnelSearchQuery({
        enabled: isTransitionSettled && canSearchPersonnel,
        serviceId: activeService?.id ?? "",
        userLat: resolvedCoords?.lat ?? 0,
        userLng: resolvedCoords?.lng ?? 0,
        maxDistance: 10,
        page: 1,
        pageSize: 20,
        sortBy: "distance",
        sortOrder: "asc",
    });

    const workers = useMemo<WorkerCardItem[]>(() => {
        if (activeTabKey === RECOMMEND_TAB_KEY) {
            const pages = recommendationsQuery.data?.pages ?? [];
            return pages
                .flatMap((p) => p.recommendedPersonnel)
                .map((p) => ({
                    id: p.personnelId,
                    serviceId: p.serviceId,
                    pricingId: p.pricingId,
                    serviceName: p.tag,
                    name: p.name,
                    experienceText: "",
                    tag: p.tag,
                    distanceText: formatDistanceKm(p.distanceKm),
                    addressText: p.addressText,
                    scheduleText: `${formatWorkDays(p.workDays)}——${formatTimeHHmm(p.workStartTime)}-${formatTimeHHmm(p.workEndTime)}`,
                    price: p.minPrice,
                    avatarUrl: p.avatarUrl ?? null,
                    avatarBlurhash: p.avatarBlurhash ?? null,
                }));
        }

        const items = (personnelQuery.data?.items ??
            []) as MatchedPersonnelUI[];
        const tag = activeService?.name ?? "";

        return items.map((p) => {
            const addressText =
                p.detailedAddress?.trim() ||
                [p.province, p.district, p.county].filter(Boolean).join("") ||
                "";
            const priceValue = Number.parseFloat(p.price);
            return {
                id: p.userId,
                serviceId: activeService?.id,
                serviceName: activeService?.name,
                name: p.name,
                experienceText: `${p.yearsOfExperience}年经验`,
                tag,
                distanceText: formatDistanceKm(p.distance),
                addressText,
                scheduleText: `${formatWorkDays(p.workDays)}——${formatTimeHHmm(p.workStartTime)}-${formatTimeHHmm(p.workEndTime)}`,
                price: Number.isFinite(priceValue) ? priceValue : 0,
                avatarUrl: p.avatar?.url ?? null,
                avatarBlurhash: p.avatar?.blurhash ?? null,
            };
        });
    }, [
        activeTabKey,
        recommendationsQuery.data,
        personnelQuery.data,
        activeService,
    ]);

    const isListLoading = !isTransitionSettled
        ? true
        : shouldDeferInitialTab &&
            activeTabKey !== RECOMMEND_TAB_KEY &&
            !activeService
          ? true
          : activeTabKey === RECOMMEND_TAB_KEY
            ? recommendationsQuery.isLoading
            : Boolean(personnelQuery.isLoading) && canSearchPersonnel;

    const isListError =
        activeTabKey === RECOMMEND_TAB_KEY
            ? recommendationsQuery.isError
            : personnelQuery.isError;

    const listEmptyText =
        activeTabKey === RECOMMEND_TAB_KEY ? "暂无推荐人员" : "暂无服务人员";

    return (
        <View className="flex-1 bg-background">
            <StatusBar
                style={colorScheme === "dark" ? "light" : "dark"}
                backgroundColor={navTheme.colors.card}
            />

            <View className="bg-card">
                <SafeAreaView edges={["top"]}>
                    <View className="h-[46px] flex-row items-center justify-between px-4">
                        <Pressable
                            onPress={() => router.back()}
                            className="h-[46px] w-[46px] items-start justify-center"
                        >
                            <Icon
                                as={ArrowLeft}
                                size={22}
                                className="text-foreground"
                            />
                        </Pressable>

                        <Text className="text-base text-foreground font-puhui-medium">
                            {title}
                        </Text>

                        <Pressable className="h-[46px] w-[46px] items-end justify-center">
                            {/* <Icon
                                as={MoreHorizontal}
                                size={22}
                                className="text-foreground"
                            /> */}
                        </Pressable>
                    </View>
                </SafeAreaView>

                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="h-[42px]"
                >
                    <View className="flex-row items-center px-4">
                        {tabs.map((tab) => {
                            const isActive = tab.key === activeTabKey;
                            return (
                                <Pressable
                                    key={tab.key}
                                    onPress={() => {
                                        setActiveTabKey(tab.key);
                                        listRef.current?.scrollToOffset({
                                            offset: 0,
                                            animated: false,
                                        });
                                    }}
                                    className="mr-6 items-center justify-center"
                                >
                                    <Text
                                        className={
                                            isActive
                                                ? "text-sm text-primary font-puhui-regular"
                                                : "text-sm text-muted-foreground font-puhui-regular"
                                        }
                                    >
                                        {tab.label}
                                    </Text>
                                    <View
                                        className={
                                            isActive
                                                ? "mt-1 h-[3px] w-5 rounded-full bg-primary"
                                                : "mt-1 h-[3px] w-5 rounded-full bg-transparent"
                                        }
                                    />
                                </Pressable>
                            );
                        })}

                        {isTabsLoading
                            ? Array.from({ length: 5 }).map((_, idx) => (
                                  <View
                                      key={`tab-skeleton-${idx}`}
                                      className="mr-6 items-center justify-center"
                                  >
                                      <Skeleton className="h-4 w-12" />
                                      <View className="mt-1 h-[3px] w-5 rounded-full bg-transparent" />
                                  </View>
                              ))
                            : null}
                    </View>
                </ScrollView>
            </View>

            <FlashList
                ref={(ref) => {
                    listRef.current = ref;
                }}
                data={workers as WorkerCardItem[]}
                keyExtractor={(item, index) =>
                    item.pricingId
                        ? `${item.id}-${item.pricingId}`
                        : item.serviceId
                          ? `${item.id}-${item.serviceId}`
                          : `${item.id}-${index}`
                }
                renderItem={({ item }) => <WorkerCard item={item} />}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
                showsVerticalScrollIndicator={false}
                ListEmptyComponent={
                    isListLoading ? (
                        <WorkersListSkeleton />
                    ) : isListError ? (
                        <View className="flex-1 items-center justify-center py-12">
                            <Text className="text-sm text-muted-foreground font-puhui-regular">
                                列表加载失败
                            </Text>
                        </View>
                    ) : (
                        <View className="flex-1 items-center justify-center py-12">
                            <Text className="text-sm text-muted-foreground font-puhui-regular">
                                {listEmptyText}
                            </Text>
                        </View>
                    )
                }
                ListFooterComponent={
                    activeTabKey === RECOMMEND_TAB_KEY &&
                    recommendationsQuery.isFetchingNextPage ? (
                        <View className="pb-6">
                            <WorkerCardSkeleton />
                        </View>
                    ) : null
                }
                onEndReachedThreshold={0.2}
                onEndReached={() => {
                    if (activeTabKey !== RECOMMEND_TAB_KEY) {
                        return;
                    }
                    if (
                        recommendationsQuery.hasNextPage &&
                        !recommendationsQuery.isFetchingNextPage &&
                        !recommendationsQuery.isFetching &&
                        !recommendationsQuery.isPlaceholderData
                    ) {
                        recommendationsQuery.fetchNextPage();
                    }
                }}
            />
        </View>
    );
}
