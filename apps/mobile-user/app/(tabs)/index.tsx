import { useServiceList } from "@repo/hooks/api/service";
import { useServicePersonnelSearch } from "@repo/hooks/api/service-personnel";
import useLocation from "@repo/hooks/useLocation";
import { useDebounce } from "@repo/hooks/useDebounceThrottle";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import type { CategoryWithServices } from "@repo/types";
import { useFile } from "@repo/hooks/api/files";
import { router } from "expo-router";
import {
    type LucideIcon,
    icons as lucideIconRegistry,
} from "lucide-react-native";
import { Suspense, useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    Image,
    type ListRenderItemInfo,
    Pressable,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { ServiceProviderSheet } from "@/components/index_screen/ServiceProviderSheet";
import useServiceStore, { type ServiceItem } from "@/stores/service";

type ServiceCategory = {
    id: string;
    label: string;
    description: string | null;
    icon?: string | null;
    items: ServiceItem[];
};

const ICON_MAP = lucideIconRegistry as Record<string, LucideIcon>;

function toPascalCase(value: string) {
    return value
        .toLowerCase()
        .split(/[\s-_]+/)
        .filter(Boolean)
        .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
        .join("");
}

function resolveLucideIcon(iconName?: string | null): LucideIcon | null {
    if (!iconName) {
        return null;
    }

    const trimmed = iconName.trim();
    if (!trimmed) {
        return null;
    }

    const candidates = new Set<string>([
        trimmed,
        trimmed.replace(/^[a-z]/, (char) => char.toUpperCase()),
        toPascalCase(trimmed),
        trimmed.toLowerCase(),
        trimmed
            .split(/[\s-_]+/)
            .map((segment, index) =>
                index === 0
                    ? segment.charAt(0).toUpperCase() + segment.slice(1)
                    : segment.charAt(0).toUpperCase() + segment.slice(1),
            )
            .join(""),
    ]);

    for (const candidate of candidates) {
        const keysToTry = [candidate, `${candidate}Icon`, `Lucide${candidate}`];
        for (const key of keysToTry) {
            const maybeIcon = ICON_MAP[key];
            if (maybeIcon) {
                return maybeIcon;
            }
        }
    }

    return null;
}

function mapServiceListToCategories(
    categories: CategoryWithServices[],
): ServiceCategory[] {
    return categories
        .filter((category) => category.isActive)
        .map<ServiceCategory>((category) => ({
            id: category.id,
            label: category.name,
            description: category.description,
            // 分类标签不展示图片
            icon: null,
            items: category.children
                .filter((service) => service.isActive)
                .map<ServiceItem>((service) => {
                    const galleryCover =
                        Array.isArray((service as any)?.gallery) &&
                        (service as any).gallery.length > 0
                            ? (service as any).gallery[0]
                            : null;
                    const iconCandidate =
                        (service as any).imageFileUrl ||
                        (service as any).imageFileId ||
                        galleryCover?.url ||
                        galleryCover?.fileUrl ||
                        galleryCover?.fileId ||
                        (service as any).iconFileUrl ||
                        (service as any).icon ||
                        null;

                    return {
                        id: service.id,
                        label: service.name,
                        description:
                            service.description ??
                            (service as any)?.personnelDescription ??
                            category.description ??
                            "暂无描述",
                        icon: iconCandidate,
                    };
                }),
        }))
        .filter((category) => category.items.length > 0);
}

/**
 * 服务人员列表加载组件
 * 使用 Suspense 边界处理加载状态
 */
function ServiceProvidersList({
    serviceId,
    userLat,
    userLng,
}: {
    serviceId: string;
    userLat: number;
    userLng: number;
}) {
    const { data } = useServicePersonnelSearch({
        serviceId,
        userLat,
        userLng,
        maxDistance: 50, // 最大距离 50km
        sortBy: "distance", // 按距离排序
        sortOrder: "asc", // 升序
    });

    return data.items;
}

/**
 * 带数据加载的服务人员 Sheet 组件
 */
function ServiceProviderSheetWithData({
    service,
    userLat,
    userLng,
    onClose,
}: {
    service: ServiceItem;
    userLat: number;
    userLng: number;
    onClose: () => void;
}) {
    const providers = ServiceProvidersList({
        serviceId: service.id,
        userLat,
        userLng,
    });

    const { setService: setServiceId, setServicePersonnelInfo } =
        useServiceStore();

    return (
        <ServiceProviderSheet
            service={service}
            providers={providers}
            onClose={onClose}
            onProviderDetail={(provider) => {
                router.push({
                    pathname: "/servicePersonnel",
                });
                setServiceId(service);
                setServicePersonnelInfo(provider);
            }}
        />
    );
}

function CategoryTab({
    category,
    isActive,
    onPress,
}: {
    category: ServiceCategory;
    isActive: boolean;
    onPress: (id: string) => void;
}) {
    return (
        <Pressable
            accessibilityRole="button"
            className={cn(
                "mr-2 rounded-full border px-4 py-2",
                isActive
                    ? "border-primary bg-primary/10 dark:bg-primary/20"
                    : "border-border bg-muted/60 dark:bg-muted/40",
            )}
            onPress={() => onPress(category.id)}
        >
            <Text
                className={`text-sm font-medium ${isActive ? "text-primary" : "text-muted-foreground"}`}
                numberOfLines={1}
                ellipsizeMode="tail"
            >
                {category.label}
            </Text>
        </Pressable>
    );
}

function ServiceIconBadge({
    icon,
    label,
    size = 26,
    variant = "rounded",
}: {
    icon?: string | null;
    label: string;
    size?: number;
    variant?: "rounded" | "circle";
}) {
    const iconComponent = resolveLucideIcon(icon);
    const isRemoteImage = Boolean(icon && /^https?:\/\//i.test(icon));
    const { data: iconFile } = useFile(!isRemoteImage ? icon : null);
    const resolvedImage = isRemoteImage ? icon : iconFile?.fileUrl ?? null;
    const [imageError, setImageError] = useState(false);
    const borderRadius = variant === "circle" ? size / 2 : Math.max(8, size / 4);

    useEffect(() => {
        setImageError(false);
    }, [resolvedImage, icon]);

    if (resolvedImage && !imageError) {
        return (
            <Image
                source={{ uri: resolvedImage }}
                style={{
                    width: size,
                    height: size,
                    borderRadius,
                }}
                resizeMode="cover"
                onError={() => setImageError(true)}
            />
        );
    }

    if (iconComponent) {
        return <Icon as={iconComponent} size={size} className="text-primary" />;
    }

    const fallbackLetter = label?.trim().slice(0, 1) || "·";

    return (
        <View
            className="items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20"
            style={{
                width: size,
                height: size,
                borderRadius,
            }}
        >
            <Text className="text-xs font-semibold text-primary">
                {fallbackLetter}
            </Text>
        </View>
    );
}

function ServiceCard({
    item,
    index,
    onPress,
}: {
    item: ServiceItem;
    index: number;
    onPress: (item: ServiceItem) => void;
}) {
    const isLeftColumn = index % 2 === 0;

    return (
        <Pressable
            className="flex-1 rounded-2xl border border-border bg-card px-4 py-3"
            style={{
                marginRight: isLeftColumn ? 8 : 0,
                marginLeft: isLeftColumn ? 0 : 8,
                marginBottom: 16,
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
            android_ripple={{
                color: "rgba(148, 163, 184, 0.16)",
                borderless: false,
            }}
            onPress={() => onPress(item)}
        >
            <View className="flex-row items-start">
                <View
                    className="mr-3 items-center justify-center rounded-xl border border-border bg-muted/40"
                    style={{
                        width: 52,
                        height: 52,
                    }}
                >
                    <ServiceIconBadge
                        icon={item.icon}
                        label={item.label}
                        size={40}
                        variant="rounded"
                    />
                </View>
                <View className="flex-1">
                    <Text
                        className="text-base font-semibold text-foreground"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {item.label}
                    </Text>
                    <Text
                        className="mt-1 text-xs text-muted-foreground"
                        numberOfLines={2}
                        ellipsizeMode="tail"
                    >
                        {item.description ?? "专业团队 · 快速响应"}
                    </Text>
                </View>
            </View>
            <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-xs font-medium text-primary">立即预约</Text>
                <Icon as={ICON_MAP.ChevronRight} size={16} className="text-primary" />
            </View>
        </Pressable>
    );
}

export default function HomeScreen() {
    const [activeCategoryId, setActiveCategoryId] = useState<string>("");
    const [searchValue, setSearchValue] = useState("");
    const [selectedService, setSelectedService] = useState<ServiceItem | null>(
        null,
    );
    const [isModalVisible, setIsModalVisible] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 使用封装的防抖 hook - 用户停止输入500ms后才更新
    const debouncedSearchValue = useDebounce(searchValue, 500);

    // 使用无限滚动的服务列表 - 使用防抖后的搜索值
    const {
        data: serviceListData,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
        refetch: refetchServices,
    } = useServiceList({
        limit: 10,
        sortOrder: "asc",
        isActive: true,
        ...(debouncedSearchValue ? { keyword: debouncedSearchValue } : {}),
        ...(activeCategoryId ? { categoryId: activeCategoryId } : {}),
    });

    // 合并所有页面的服务分类数据
    const allCategories = useMemo(() => {
        const pages = serviceListData?.pages ?? [];
        const allItems: CategoryWithServices[] = [];

        for (const page of pages) {
            allItems.push(...page.items);
        }

        return allItems;
    }, [serviceListData]);

    // 将服务分类映射为展示格式
    const serviceCategories = useMemo(
        () => mapServiceListToCategories(allCategories),
        [allCategories],
    );

    // 初始化第一个分类为激活状态
    useEffect(() => {
        if (!activeCategoryId && serviceCategories.length > 0) {
            setActiveCategoryId(serviceCategories[0].id);
        }
    }, [serviceCategories, activeCategoryId]);

    const emptyStateIcon = useMemo(
        () =>
            resolveLucideIcon("file-question-mark") ??
            resolveLucideIcon("circle-help") ??
            resolveLucideIcon("search-x"),
        [],
    );

    const { location } = useLocation();

    const activeCategory = useMemo(
        () =>
            serviceCategories.find(
                (category: ServiceCategory) => category.id === activeCategoryId,
            ) ?? serviceCategories[0],
        [activeCategoryId, serviceCategories],
    );

    const displayedItems = useMemo(() => {
        const items = activeCategory?.items ?? [];
        const keyword = searchValue.trim().toLowerCase();
        if (!keyword) {
            return items;
        }



        return items.filter((item: ServiceItem) => {
            const label = item.label.toLowerCase();
            const description = item.description?.toLowerCase() ?? "";
            return label.includes(keyword) || description.includes(keyword);
        });
    }, [activeCategory?.items, searchValue]);

    const handleCategoryPress = useCallback((categoryId: string) => {
        setActiveCategoryId(categoryId);
    }, []);

    const handleServicePress = useCallback((item: ServiceItem) => {
        setSelectedService(item);
        setIsModalVisible(true);
    }, []);

    const handleCloseModal = useCallback(() => {
        setIsModalVisible(false);
        setTimeout(() => {
            setSelectedService(null);
        }, 300);
    }, []);

    const renderCategoryTab = useCallback(
        ({ item }: ListRenderItemInfo<ServiceCategory>) => (
            <CategoryTab
                category={item}
                isActive={item.id === activeCategory?.id}
                onPress={handleCategoryPress}
            />
        ),
        [activeCategory?.id, handleCategoryPress],
    );

    const renderServiceCard = useCallback(
        ({ item, index }: ListRenderItemInfo<ServiceItem>) => (
            <ServiceCard item={item} index={index} onPress={handleServicePress} />
        ),
        [handleServicePress],
    );

    const categoryKeyExtractor = useCallback(
        (item: ServiceCategory) => item.id,
        [],
    );
    const serviceKeyExtractor = useCallback((item: ServiceItem) => item.id, []);

    // 加载更多数据的处理函数
    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

    // 渲染加载更多的底部组件
    const renderListFooter = useCallback(() => {
        if (!isFetchingNextPage) return null;

        return (
            <View className="py-4 items-center">
                <ActivityIndicator size="small" />
                <Text className="mt-2 text-xs text-muted-foreground">加载更多...</Text>
            </View>
        );
    }, [isFetchingNextPage]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refetchServices({
                throwOnError: false,
            });
        } finally {
            setIsRefreshing(false);
        }
    }, [refetchServices]);

    const renderListHeader = useCallback(() => {
        return (
            <View>
                <View className="px-4 pb-3">
                    <View className="flex-row items-center justify-between">
                        <View>
                            <Text className="mt-4 text-3xl font-semibold text-foreground">
                                叮咚上门
                            </Text>
                            <Text className="mt-1 text-sm text-muted-foreground">
                                专业团队到家，30 分钟极速响应
                            </Text>
                        </View>
                        <View className="flex-row items-center rounded-full bg-primary/10 dark:bg-primary/20 px-3 py-1.5">
                            <Icon as={ICON_MAP.MapPin} size={16} className="text-primary" />
                            <Text className="ml-1 text-xs font-medium text-primary">
                                {location?.district ?? location?.city ?? location?.province}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-4 flex-row items-center rounded-full border border-border px-4">
                        <Icon
                            as={ICON_MAP.Search}
                            size={18}
                            className="text-muted-foreground"
                        />
                        <Input
                            value={searchValue}
                            onChangeText={(value) => {
                                setSearchValue(value);
                            }}
                            placeholder="搜索你想要的服务"
                            placeholderTextColor="rgba(148, 163, 184, 0.9)"
                            className="ml-2 flex-1 text-sm text-foreground border-transparent outline-none"
                            returnKeyType="search"
                        />
                        {searchValue ? (
                            <Pressable onPress={() => setSearchValue("")} hitSlop={8}>
                                <Icon
                                    as={ICON_MAP.X}
                                    size={16}
                                    className="text-muted-foreground"
                                />
                            </Pressable>
                        ) : null}
                    </View>
                </View>

                <View className="border-b border-border px-4 pb-3 pt-2">
                    <Text
                        className="text-base font-semibold text-foreground"
                        numberOfLines={1}
                        ellipsizeMode="tail"
                    >
                        选择需要的服务
                    </Text>
                    <FlatList
                        className="mt-3"
                        data={serviceCategories}
                        horizontal
                        showsHorizontalScrollIndicator={false}
                        renderItem={renderCategoryTab}
                        keyExtractor={categoryKeyExtractor}
                        contentContainerStyle={{
                            paddingRight: 16,
                        }}
                    />
                </View>
            </View>
        );
    }, [
        categoryKeyExtractor,
        location?.city,
        location?.district,
        location?.province,
        renderCategoryTab,
        searchValue,
        serviceCategories,
    ]);

    return (
        <SafeAreaView className="flex-1">
            <FlatList
                data={displayedItems}
                keyExtractor={serviceKeyExtractor}
                numColumns={2}
                renderItem={renderServiceCard}
                onEndReached={handleLoadMore}
                onEndReachedThreshold={0.5}
                ListFooterComponent={renderListFooter}
                ListHeaderComponent={renderListHeader}
                contentContainerStyle={{
                    paddingHorizontal: 16,
                    paddingTop: 16,
                    paddingBottom: 32,
                }}
                refreshing={isRefreshing}
                onRefresh={handleRefresh}
                ListEmptyComponent={
                    <View className="flex-1 items-center justify-center px-6 py-24">
                        {emptyStateIcon ? (
                            <Icon
                                as={emptyStateIcon}
                                size={28}
                                className="text-muted-foreground"
                            />
                        ) : null}
                        <Text className="mt-3 text-sm font-medium text-muted-foreground">
                            未找到匹配的子服务
                        </Text>
                        <Text className="mt-1 text-xs text-muted-foreground">
                            请尝试调整关键词或切换其他服务分类
                        </Text>
                    </View>
                }
                showsVerticalScrollIndicator={false}
                removeClippedSubviews
            />

            {selectedService && location && (
                <BottomSheetModal visible={isModalVisible} onClose={handleCloseModal}>
                    <Suspense
                        fallback={
                            <View className="flex-1 items-center justify-center py-12">
                                <ActivityIndicator size="large" />
                                <Text className="mt-4 text-sm text-muted-foreground">
                                    正在加载服务人员...
                                </Text>
                            </View>
                        }
                    >
                        <ServiceProviderSheetWithData
                            service={selectedService}
                            userLat={location.latitude}
                            userLng={location.longitude}
                            onClose={handleCloseModal}
                        />
                    </Suspense>
                </BottomSheetModal>
            )}
        </SafeAreaView>
    );
}
