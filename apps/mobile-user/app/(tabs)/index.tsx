import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { cssInterop, useColorScheme } from "nativewind";
import { router, useFocusEffect } from "expo-router";
import {
    Suspense,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    Platform,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { StatusBar } from "expo-status-bar";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-user-constants";
import {
    useHomeBase,
    useHomeRecommendationsInfinite,
} from "@repo/hooks/api/home";
import { FlashList } from "@shopify/flash-list";
import useLocation from "@repo/hooks/useLocation";
import { useHomeLocationStore } from "@/stores/home-location-store";
import type { SelectLocation } from "@/stores/address-store";
import type { HomeRecommendedPersonnel } from "@repo/types";
import { MoreServicesBottomSheet } from "@/components/more-services/MoreServicesBottomSheet";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";

// Enable NativeWind `className` on expo-image.
cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

type ImageSource = React.ComponentProps<typeof ExpoImage>["source"];

// DEV: 调试开关——设为 true 时，总是显示“更多服务”入口。
const FORCE_SHOW_MORE_SERVICES_ENTRY = false;

type GuaranteeItem = {
    id: string;
    label: string;
    icon: number;
};

const GUARANTEES: readonly GuaranteeItem[] = [
    {
        id: "late-comp",
        label: "迟到必赔",
        icon: require("@/assets/images/guarantee-late-compensation.png"),
    },
    {
        id: "redo",
        label: "不满意重做",
        icon: require("@/assets/images/guarantee-redo.png"),
    },
    {
        id: "24h",
        label: "7×24小时服务",
        icon: require("@/assets/images/guarantee-24h-service.png"),
    },
    {
        id: "all-guarantee",
        label: "全场保障",
        icon: require("@/assets/images/guarantee-full-coverage.png"),
    },
] as const;

// 后端返回的分类 icon 还未落到移动端资源映射前，先用当前像素稿的本地 icon 兜底。
// 这里用 label 作为 key（当前 demo 资源是中文名）。
const CATEGORY_ICON_BY_LABEL: Record<string, number> = {
    家庭保洁: require("@/assets/images/category-home-cleaning.png"),
    家电清洗: require("@/assets/images/category-appliance-cleaning.png"),
    康养护理: require("@/assets/images/category-health-care.png"),
    上门美业: require("@/assets/images/category-home-beauty.png"),
    整理收纳: require("@/assets/images/category-organization.png"),
    深度保洁: require("@/assets/images/category-deep-cleaning.png"),
    衣物洗护: require("@/assets/images/category-laundry-care.png"),
    推拿按摩: require("@/assets/images/category-massage.png"),
    家具养护: require("@/assets/images/category-furniture-care.png"),
    保姆月嫂: require("@/assets/images/category-nanny-maternity.png"),
};

const CATEGORY_FALLBACK_ICON = require("@/assets/images/category-fallback.png");

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

    // 兼容后端已返回中文文案的情况
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

    // 0 代表后端未计算距离（无坐标场景），UI 侧不展示距离。
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

function resolveCategoryIconSource(
    name: string,
    iconFileUrl?: string | null,
): ImageSource {
    if (iconFileUrl) {
        return { uri: iconFileUrl };
    }
    return CATEGORY_ICON_BY_LABEL[name] ?? CATEGORY_FALLBACK_ICON;
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

type RemotePromoCardItem = {
    id: string;
    name: string;
    tag: string;
    price: number;
    imageUrl: string | null;
    imageBlurhash?: string | null;
};

function RemotePromoCard({ item }: { item: RemotePromoCardItem }) {
    const imageSource = useMemo<ImageSource | null>(
        () => (item.imageUrl ? { uri: item.imageUrl } : null),
        [item.imageUrl],
    );
    const imagePlaceholder = useMemo(
        () =>
            item.imageBlurhash ? { blurhash: item.imageBlurhash } : undefined,
        [item.imageBlurhash],
    );

    return (
        <View className="h-[150px] w-[123px] overflow-hidden rounded-lg border border-border bg-card">
            {imageSource ? (
                <Image
                    source={imageSource}
                    placeholder={imagePlaceholder}
                    contentFit="cover"
                    transition={200}
                    className="w-32 h-20"
                />
            ) : (
                <View className="w-32 h-20 bg-muted" />
            )}
            <View className="px-2 pt-1.5">
                <Text className="text-sm text-foreground font-puhui-regular">
                    {item.name}
                </Text>
                <View className="mt-2 flex-row items-center">
                    <View className="p-[2px] items-center justify-center rounded border border-primary">
                        <Text className="text-xs text-primary font-puhui-regular">
                            {item.tag}
                        </Text>
                    </View>
                </View>
                <View className="mt-2">
                    <PriceTag price={item.price} />
                </View>
            </View>
        </View>
    );
}

function RemoteProviderCard({
    item,
}: {
    item: {
        id: string;
        serviceId?: string;
        pricingId?: string;
        serviceName?: string;
        name: string;
        tag: string;
        price: number;
        distanceText: string;
        address: string;
        scheduleLine1: string;
        scheduleLine2: string;
        avatarUrl: string | null;
        avatarBlurhash?: string | null;
    };
}) {
    const avatarSource = useMemo<ImageSource | null>(
        () => (item.avatarUrl ? { uri: item.avatarUrl } : null),
        [item.avatarUrl],
    );
    const avatarPlaceholder = useMemo(
        () =>
            item.avatarBlurhash ? { blurhash: item.avatarBlurhash } : undefined,
        [item.avatarBlurhash],
    );
    const showDistance = Boolean(item.distanceText);
    const handleNavigateToServiceDetail = useCallback(() => {
        router.push({
            pathname: "/servicePersonnel/[id]",
            params: {
                id: item.id,
                ...(item.serviceId ? { serviceId: item.serviceId } : {}),
                ...(item.pricingId ? { pricingId: item.pricingId } : {}),
                ...(item.serviceName
                    ? { serviceName: item.serviceName }
                    : { serviceName: item.tag }),
            },
        });
    }, [item.id, item.pricingId, item.serviceId, item.serviceName, item.tag]);

    return (
        <Pressable
            className="h-[298px] w-[158px] overflow-hidden rounded-xl border border-border bg-card"
            onPress={handleNavigateToServiceDetail}
            style={({ pressed }) =>
                pressed
                    ? { opacity: 0.92, transform: [{ scale: 0.98 }] }
                    : undefined
            }
        >
            {avatarSource ? (
                <Image
                    source={avatarSource}
                    placeholder={avatarPlaceholder}
                    contentFit="cover"
                    transition={200}
                    className="h-[170px] w-[158px]"
                />
            ) : (
                <View className="h-[170px] w-[158px] bg-muted" />
            )}
            <View className="flex-1 px-2 pt-2">
                <View className="flex-row items-center justify-between gap-1">
                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-sm text-foreground font-puhui-regular">
                                {item.name}
                            </Text>
                        </View>
                    </View>
                    <View className="p-[2px]  items-center justify-center rounded border border-primary">
                        <Text className="text-xs text-primary font-puhui-regular">
                            {item.tag}
                        </Text>
                    </View>
                </View>

                {showDistance ? (
                    <View className="mt-2 flex-row items-center gap-1">
                        <Image
                            source={require("@/assets/images/icon-location-small.png")}
                            contentFit="contain"
                            className="h-3 w-3"
                        />
                        <Text className=" text-xs text-primary font-puhui-medium">
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
                            {item.address}
                        </Text>
                    </View>
                ) : (
                    <View className="mt-2 flex-row items-center gap-1">
                        <Image
                            source={require("@/assets/images/icon-location-small.png")}
                            contentFit="contain"
                            className="h-3 w-3"
                        />
                        <Text
                            className="flex-1 text-xs text-muted-foreground font-puhui-regular"
                            numberOfLines={1}
                        >
                            {item.address}
                        </Text>
                    </View>
                )}

                <View className="mt-1.5 flex-row items-start">
                    <Image
                        source={require("@/assets/images/icon-time.png")}
                        contentFit="contain"
                        className="mt-0.5 h-3 w-3"
                    />
                    <View className="ml-1 flex-1">
                        <Text className="text-xs text-muted-foreground font-puhui-regular">
                            {item.scheduleLine1}
                        </Text>
                        <Text className="text-xs text-muted-foreground font-puhui-regular">
                            {item.scheduleLine2}
                        </Text>
                    </View>
                </View>

                <View className="mt-auto flex-row items-end justify-between pb-1.5">
                    <PriceTag price={item.price} />
                    <View className="h-5 w-16 items-center justify-center rounded-full bg-primary">
                        <Text className="text-xs text-primary-foreground font-puhui-medium">
                            立即预约
                        </Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

function StatusBarBackground({ color }: { color: string }) {
    const insets = useSafeAreaInsets();

    if (Platform.OS === "web" || insets.top === 0) {
        return null;
    }

    return (
        <View
            pointerEvents="none"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: color,
                zIndex: 1,
            }}
        />
    );
}

function HomeBaseSkeleton() {
    return (
        <>
            <View className="mx-4 mt-2">
                <Skeleton className="h-[81px] w-[343px] rounded-xl" />
            </View>
            <View className="mx-4 mt-3 w-[343px] flex-row items-center justify-between">
                {Array.from({ length: 4 }).map((_, idx) => (
                    <Skeleton key={idx} className="h-3 w-14 rounded" />
                ))}
            </View>
            <View className="mx-[17px] mt-4 w-[341px] flex-row flex-wrap gap-6">
                {Array.from({ length: 10 }).map((_, idx) => (
                    <View key={idx} className="w-[49px] items-center">
                        <Skeleton className="h-[49px] w-[49px] rounded-full" />
                        <Skeleton className="mt-1 h-3 w-12 rounded" />
                    </View>
                ))}
            </View>
        </>
    );
}

function HomeRecommendationsSkeleton() {
    return (
        <View className="mx-4 mt-2 w-[343px] flex-row flex-wrap justify-between gap-y-[9px]">
            {Array.from({ length: 4 }).map((_, idx) => (
                <View
                    key={idx}
                    className="h-[298px] w-[158px] overflow-hidden rounded-xl border border-border bg-card"
                >
                    <Skeleton className="h-[170px] w-full" />
                    <View className="flex-1 px-2 pt-2">
                        <View className="flex-row items-center justify-between">
                            <Skeleton className="h-4 w-[72px] rounded" />
                            <Skeleton className="h-4 w-10 rounded" />
                        </View>
                        <View className="mt-2 flex-row items-center gap-1">
                            <Skeleton className="h-3 w-3 rounded" />
                            <Skeleton className="h-3 w-[80px] rounded" />
                        </View>
                        <Skeleton className="mt-2 h-3 w-[110px] rounded" />
                        <Skeleton className="mt-1 h-3 w-[96px] rounded" />
                        <View className="mt-2 flex-row items-center justify-between">
                            <Skeleton className="h-4 w-10 rounded" />
                            <Skeleton className="h-6 w-[52px] rounded-full" />
                        </View>
                    </View>
                </View>
            ))}
        </View>
    );
}

function HomeBaseContent({
    onOpenMoreServices,
    moreServicesVisible,
    onCloseMoreServices,
}: {
    onOpenMoreServices: () => void;
    moreServicesVisible: boolean;
    onCloseMoreServices: () => void;
}) {
    const homeBase = useHomeBase();
    const data = homeBase.data;
    const bannerImageSource = useMemo<ImageSource | null>(
        () =>
            data.banners[0]?.imageUrl
                ? { uri: data.banners[0].imageUrl }
                : null,
        [data.banners],
    );
    const bannerPlaceholder = useMemo(
        () =>
            data.banners[0]?.imageBlurhash
                ? { blurhash: data.banners[0].imageBlurhash }
                : undefined,
        [data.banners],
    );

    const categoryItems = data.categories.map((c) => ({
        id: c.id,
        label: c.name,
        icon: resolveCategoryIconSource(c.name, c.iconFileUrl ?? null),
    }));

    // 设计稿（375 宽）分类区为 5 列 x 2 行。
    // 当父分类数量超过两行容量时，显示“更多服务”入口（占用最后一个格子）。
    const homeCategoryCapacity = 10;
    const shouldShowMoreServicesEntry =
        FORCE_SHOW_MORE_SERVICES_ENTRY ||
        categoryItems.length > homeCategoryCapacity;

    const categoriesToRender = shouldShowMoreServicesEntry
        ? [
              ...categoryItems.slice(0, Math.max(0, homeCategoryCapacity - 1)),
              {
                  id: "more-services-entry",
                  label: "更多服务",
                  icon: CATEGORY_FALLBACK_ICON,
              },
          ]
        : categoryItems;

    return (
        <>
            <View className="mx-4 mt-2 h-[81px] w-[343px] overflow-hidden rounded-xl shadow-lg">
                {bannerImageSource ? (
                    <Image
                        source={bannerImageSource}
                        placeholder={bannerPlaceholder}
                        contentFit="cover"
                        transition={200}
                        className="h-full w-full"
                    />
                ) : (
                    <Image
                        source={require("@/assets/images/home-banner.png")}
                        contentFit="cover"
                        className="h-full w-full"
                    />
                )}
            </View>

            <View className="mx-4 mt-3 w-[343px] flex-row items-center justify-between">
                {(data.guarantees.length ? data.guarantees : GUARANTEES).map(
                    (item) => (
                        <View key={item.id} className="flex-row items-center">
                            {"iconUrl" in item && item.iconUrl ? (
                                <Image
                                    source={{ uri: item.iconUrl }}
                                    placeholder={
                                        "iconBlurhash" in item &&
                                        item.iconBlurhash
                                            ? { blurhash: item.iconBlurhash }
                                            : undefined
                                    }
                                    contentFit="contain"
                                    className="h-3 w-3"
                                />
                            ) : (
                                <Image
                                    source={(item as GuaranteeItem).icon}
                                    contentFit="contain"
                                    className="h-3 w-3"
                                />
                            )}
                            <Text className="ml-1 text-xs text-muted-foreground font-puhui-regular">
                                {item.label}
                            </Text>
                        </View>
                    ),
                )}
            </View>

            {categoriesToRender.length ? (
                <View className="mx-[17px] mt-4 w-[341px] flex-row flex-wrap gap-6">
                    {categoriesToRender.map((item) => (
                        <Pressable
                            key={item.id}
                            className="w-[49px] items-center"
                            onPress={() => {
                                if (item.label === "更多服务") {
                                    onOpenMoreServices();
                                    return;
                                }

                                if (item.label.includes("按摩")) {
                                    router.push("../massage");
                                    return;
                                }

                                router.push({
                                    pathname: "/category/filter",
                                    params: {
                                        categoryId: String(item.id),
                                        categoryName: item.label,
                                        // 分类筛选页默认选中 Tab
                                        defaultTabName: item.label,
                                    },
                                });
                            }}
                        >
                            <Image
                                source={item.icon}
                                contentFit="contain"
                                className="h-[49px] w-[49px]"
                            />
                            <Text
                                className="mt-1 text-xs text-foreground font-puhui-regular"
                                numberOfLines={1}
                            >
                                {item.label}
                            </Text>
                        </Pressable>
                    ))}
                </View>
            ) : null}

            <MoreServicesBottomSheet
                visible={moreServicesVisible}
                onClose={onCloseMoreServices}
            />

            {data.promos.length > 0 && (
                <View className="mx-4 mt-5 h-[205px] rounded-xl bg-card shadow-lg">
                    <Text className="ml-3 mt-3 text-lg text-foreground font-puhui-medium">
                        特惠服务
                    </Text>
                    <ScrollView
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        className="mt-2"
                    >
                        <View className="flex-row gap-3 px-3">
                            {data.promos.length
                                ? data.promos.map((p) => (
                                      <RemotePromoCard
                                          key={p.id}
                                          item={{
                                              id: p.id,
                                              name: p.personnelName,
                                              tag: p.tag,
                                              price: p.price,
                                              imageUrl: p.imageUrl,
                                              imageBlurhash: p.imageBlurhash,
                                          }}
                                      />
                                  ))
                                : null}
                        </View>
                    </ScrollView>
                </View>
            )}
        </>
    );
}

type HomeLocationState = ReturnType<typeof useLocation>;
type HomeSelectedLocation = SelectLocation | null;

type HomeRecommendationsParams = Parameters<
    typeof useHomeRecommendationsInfinite
>[0];

function HomeRecommendationsContent({
    items,
    isInitialLoading,
    isFetchingNextPage,
}: {
    items: readonly HomeRecommendedPersonnel[];
    isInitialLoading: boolean;
    isFetchingNextPage: boolean;
}) {
    if (isInitialLoading) {
        return <HomeRecommendationsSkeleton />;
    }

    if (!items.length) {
        return (
            <Text className="mx-4 mt-2 text-xs text-muted-foreground font-puhui-regular">
                暂无可推荐的服务人员
            </Text>
        );
    }

    return (
        <View className="mx-4 mt-2">
            <FlashList
                data={items}
                numColumns={2}
                keyExtractor={(item, index) =>
                    item.pricingId
                        ? `${item.personnelId}-${item.pricingId}`
                        : item.serviceId
                          ? `${item.personnelId}-${item.serviceId}`
                          : `${item.personnelId}-${index}`
                }
                renderItem={({ item }) => (
                    <View className="mb-[9px]">
                        <RemoteProviderCard
                            item={{
                                id: item.personnelId,
                                serviceId: item.serviceId,
                                pricingId: item.pricingId,
                                serviceName: item.tag,
                                name: item.name,
                                tag: item.tag,
                                price: item.minPrice,
                                distanceText: formatDistanceKm(item.distanceKm),
                                address: item.addressText,
                                scheduleLine1: formatWorkDays(item.workDays),
                                scheduleLine2: `${formatTimeHHmm(item.workStartTime)}-${formatTimeHHmm(item.workEndTime)}`,
                                avatarUrl: item.avatarUrl,
                                avatarBlurhash: item.avatarBlurhash,
                            }}
                        />
                    </View>
                )}
                ListFooterComponent={
                    isFetchingNextPage ? (
                        <View className="items-center justify-center py-3">
                            <Text className="text-xs text-muted-foreground font-puhui-regular">
                                加载中...
                            </Text>
                        </View>
                    ) : null
                }
                scrollEnabled={false}
            />
        </View>
    );
}

function HomeRecommendationsSection({
    location,
    locationError,
    selectedLocation,
    manualLoading,
    onReachedPageEnd,
}: {
    location: HomeLocationState["location"];
    locationError: HomeLocationState["error"];
    selectedLocation: HomeSelectedLocation;
    manualLoading: boolean;
    onReachedPageEnd: (fn: () => void) => void;
}) {
    const hasManualLocation = Boolean(selectedLocation);

    const lat = hasManualLocation ? selectedLocation?.lat : location?.latitude;
    const lng = hasManualLocation ? selectedLocation?.lng : location?.longitude;
    const hasCoords =
        lat !== undefined &&
        lng !== undefined &&
        Number.isFinite(lat) &&
        Number.isFinite(lng) &&
        lat !== 0 &&
        lng !== 0;
    const addressText = hasManualLocation
        ? selectedLocation?.detailedAddress
        : location?.address || location?.name;

    const params: HomeRecommendationsParams = hasCoords
        ? {
              lat,
              lng,
              ...(addressText ? { addressText } : {}),
          }
        : {};

    const rec = useHomeRecommendationsInfinite(params);
    const items = useMemo(
        () =>
            rec.data?.pages.flatMap((page) => page.recommendedPersonnel) ?? [],
        [rec.data],
    );

    // 将“加载下一页”的回调交给父级 ScrollView 的 onScroll 触发，避免嵌套滚动。
    const loadMore = useCallback(() => {
        if (
            rec.hasNextPage &&
            !rec.isFetchingNextPage &&
            !rec.isFetching &&
            !rec.isPlaceholderData
        ) {
            rec.fetchNextPage();
        }
    }, [rec]);

    useEffect(() => {
        onReachedPageEnd(loadMore);
    }, [onReachedPageEnd, loadMore]);

    return (
        <HomeRecommendationsContent
            items={items}
            isInitialLoading={manualLoading || (rec.isLoading && !rec.data)}
            isFetchingNextPage={rec.isFetchingNextPage}
        />
    );
}

export default function HomeScreen() {
    const { colorScheme } = useColorScheme();
    const [isScreenFocused, setIsScreenFocused] = useState(false);
    const { location, error: locationError } = useLocation({
        enabled: isScreenFocused,
        source: "mobile-user/home",
    });
    const selectedLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );

    const navTheme = NAV_THEME[colorScheme ?? "light"];
    const statusBarBackground = navTheme.colors.primary;

    // 未选址时也不阻断浏览体验：展示默认文案（仍可点击进入选址页）。
    const headerAddressLabel =
        selectedLocation?.detailedAddress ||
        location?.name ||
        location?.address ||
        location?.district ||
        location?.city ||
        location?.province ||
        "全国";

    const loadMoreRef = useRef<null | (() => void)>(null);
    const setLoadMore = useCallback((fn: () => void) => {
        loadMoreRef.current = fn;
    }, []);

    const [moreServicesVisible, setMoreServicesVisible] = useState(false);
    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh();

    useFocusEffect(
        useCallback(() => {
            setIsScreenFocused(true);
            return () => {
                setIsScreenFocused(false);
                setMoreServicesVisible(false);
            };
        }, []),
    );

    // 无改动外层结构：通过外层 ScrollView 的滚动触底判断触发推荐列表拉取下一页。
    const handleScroll = useCallback((event: any) => {
        const { layoutMeasurement, contentOffset, contentSize } =
            event.nativeEvent;
        const paddingToBottom = 160;
        const isNearBottom =
            layoutMeasurement.height + contentOffset.y >=
            contentSize.height - paddingToBottom;

        if (isNearBottom) {
            loadMoreRef.current?.();
        }
    }, []);

    return (
        <View className="flex-1 bg-background">
            <StatusBar
                style={colorScheme === "dark" ? "light" : "dark"}
                backgroundColor={statusBarBackground}
            />
            <StatusBarBackground color={statusBarBackground} />
            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
                }
                onScroll={handleScroll}
                scrollEventThrottle={16}
            >
                <View className="pb-6">
                    <View className="bg-primary">
                        <SafeAreaView edges={["top"]}>
                            <View className="bg-primary pb-2">
                                <View className="h-11 flex-row items-center">
                                    <Image
                                        source={require("@/assets/images/icon-location.png")}
                                        contentFit="contain"
                                        className="ml-4 h-4 w-4"
                                    />
                                    <Pressable
                                        onPress={() =>
                                            router.push({
                                                pathname:
                                                    "/address/select-address",
                                                params: { scene: "home" },
                                            })
                                        }
                                        className="ml-1 flex-row items-center"
                                    >
                                        <Text className="text-sm text-foreground font-puhui-medium">
                                            {headerAddressLabel}
                                        </Text>
                                        <Image
                                            source={require("@/assets/images/icon-arrow.png")}
                                            contentFit="contain"
                                            className="h-5 w-5"
                                        />
                                    </Pressable>
                                </View>

                                <Pressable
                                    className="mx-4 mt-3 h-10 w-[343px] flex-row items-center rounded-full bg-card"
                                    onPress={() => router.push("../search")}
                                >
                                    <Text className="ml-3 flex-1 text-sm text-muted-foreground font-puhui-regular">
                                        搜索你想要的服务
                                    </Text>
                                    <View className="mr-0.5 h-9 w-[60px] items-center justify-center rounded-full bg-primary">
                                        <Text className="text-sm text-foreground font-puhui-regular">
                                            搜索
                                        </Text>
                                    </View>
                                </Pressable>
                            </View>
                        </SafeAreaView>
                    </View>

                    {showPageLoading ? (
                        <HomeBaseSkeleton />
                    ) : (
                        <Suspense fallback={<HomeBaseSkeleton />}>
                            <HomeBaseContent
                                onOpenMoreServices={() =>
                                    setMoreServicesVisible(true)
                                }
                                moreServicesVisible={moreServicesVisible}
                                onCloseMoreServices={() =>
                                    setMoreServicesVisible(false)
                                }
                            />
                        </Suspense>
                    )}

                    <Text className="mx-4 mt-3 text-base text-foreground font-puhui-medium">
                        推荐
                    </Text>

                    <HomeRecommendationsSection
                        location={location}
                        locationError={locationError}
                        selectedLocation={selectedLocation}
                        manualLoading={showPageLoading}
                        onReachedPageEnd={setLoadMore}
                    />
                </View>
            </ScrollView>
        </View>
    );
}
