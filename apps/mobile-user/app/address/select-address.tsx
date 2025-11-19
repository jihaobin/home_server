import { Input } from "@repo/mobile-ui/components/ui/input";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { ChevronDown } from "@repo/mobile-ui/lib/icons/ChevronDown";
import { MapPin } from "@repo/mobile-ui/lib/icons/MapPin";
import type { SuggestionData } from "@repo/types";
import { Link, router } from "expo-router";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import { AddressSuggestionErrorBoundary } from "@repo/mobile-ui/components/error-boundaries";
import { useAddressSuggestionInfiniteSuspense, useLocationDetail, useUserAddresses } from "@repo/hooks/api/address";
import { useDebounce } from "@repo/hooks/useDebounceThrottle";
import {
    type SelectLocation,
    useAddressEditStore,
} from "@/stores/address-store";
import useLocation from "@repo/hooks/useLocation";
import { LocationChangedEvent } from "expo-qq-location";

// 地址项组件
function AddressItem({
    title,
    address,
    tag,
    isCurrent = false,
    onPress,
}: {
        title: string;
        address: string;
        tag?: string;
        isCurrent?: boolean;
        onPress: () => void;
}) {
    return (
        <Pressable
            onPress={onPress}
            className="py-3.5 px-4 border-b border-border/50 active:bg-muted/30"
        >
            <View className="flex-row items-start">
                <View className="bg-primary/10 rounded-full p-2 mr-3 mt-0.5">
                    <MapPin size={18} className="text-primary" />
                </View>
                <View className="flex-1">
                    <View className="flex-row items-center flex-wrap mb-1">
                        <Text className="text-base font-semibold text-foreground mr-2">
                            {title}
                        </Text>
                        {tag && (
                            <View
                                className={`px-2 py-0.5 rounded-full ${isCurrent ? "bg-primary" : "bg-accent"
                                    }`}
                            >
                                <Text className={`text-xs font-medium ${isCurrent ? "text-primary-foreground" : "text-accent-foreground"
                                    }`}>
                                    {tag}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-sm text-muted-foreground leading-5" numberOfLines={2}>
                        {address}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

// 搜索建议内容组件 - 用于Suspense边界
const AddressSuggestionsContent = React.memo(
    ({
        searchQuery,
        selectedAddress,
        onSelectAddress,
    }: {
        searchQuery: string;
        selectedAddress: SelectLocation | null;
        onSelectAddress: (address: SelectLocation) => void;
    }) => {
        // 使用Suspense版本的地址建议无限查询
        const {
            data: addressSuggestionData,
            fetchNextPage,
            hasNextPage,
            isFetchingNextPage,
            isFetching,
            refetch,
        } = useAddressSuggestionInfiniteSuspense({
            keyword: searchQuery,
            lat: selectedAddress?.lat,
            lng: selectedAddress?.lng,
            city:
                selectedAddress?.district ||
                selectedAddress?.city ||
                selectedAddress?.province,
        });
        const [isRefreshing, setIsRefreshing] = useState(false);

        // 将所有页面的数据平铺为一个数组
        const allSuggestions =
            addressSuggestionData?.pages?.flatMap((page) => page.data) || [];

        const handleRefresh = useCallback(async () => {
            setIsRefreshing(true);
            try {
                await refetch({
                    throwOnError: false,
                });
            } finally {
                setIsRefreshing(false);
            }
        }, [refetch]);

        // 加载更多数据的回调
        const handleLoadMore = useCallback(() => {
            if (hasNextPage && !isFetchingNextPage && !isFetching) {
                fetchNextPage();
            }
        }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

        // 将 SuggestionData 转换为 selectAddress
        const convertToSelectedLocation = useCallback(
            (item: SuggestionData): SelectLocation => {
                return {
                    lng: item.location.lng,
                    lat: item.location.lat,
                    detailedAddress: item.address || item.title,
                    province: item.province || "",
                    city: item.city || "",
                    district: item.district || "",
                };
            },
            [],
        );

        // 渲染搜索建议项
        const renderSuggestionItem = ({
            item,
            index,
        }: {
            item: SuggestionData;
            index: number;
        }) => (
            <AddressItem
                key={`suggestion-${index}`}
                title={item.title}
                address={item.address || item.title}
                onPress={() => onSelectAddress(convertToSelectedLocation(item))}
            />
        );

        // 渲染加载更多指示器
        const renderFooter = () => {
            if (!hasNextPage) return null;

            return (
                <View className="py-4 px-4 items-center">
                    <Text className="text-sm text-muted-foreground">
                        {isFetchingNextPage ? "加载中..." : "上拉加载更多"}
                    </Text>
                </View>
            );
        };

        if (allSuggestions.length === 0) {
            return (
                <View className="bg-card absolute z-10 w-full h-full items-center justify-center">
                    <View className="bg-muted/30 rounded-full p-6 mb-4">
                        <MapPin size={40} className="text-muted-foreground" />
                    </View>
                    <Text className="text-foreground font-semibold text-base mb-2">暂无搜索结果</Text>
                    <Text className="text-muted-foreground text-sm">请尝试其他关键词</Text>
                </View>
            );
        }

        return (
            <View className="h-full">
                <View className="bg-card absolute z-10 w-full h-full">
                    <View className="bg-primary/5 px-4 py-2.5 border-b border-border/50">
                        <Text className="text-sm text-primary font-medium">
                            搜索结果 · {allSuggestions.length} 条
                        </Text>
                    </View>
                    <FlatList
                        data={allSuggestions}
                        renderItem={renderSuggestionItem}
                        keyExtractor={(item, index) =>
                            `suggestion-${index}-${item.id || item.title}`
                        }
                        onEndReached={handleLoadMore}
                        onEndReachedThreshold={0.5}
                        ListFooterComponent={renderFooter}
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={true}
                        refreshing={isRefreshing || isFetching}
                        onRefresh={handleRefresh}
                    />
                </View>
            </View>
        );
    },
);
AddressSuggestionsContent.displayName = "AddressSuggestionsContent";

// 常用地址和附近地址内容组件
const DefaultAddressContent = React.memo(({ location, onSelectAddress }: {
    onSelectAddress: (address: SelectLocation) => void;
    location: LocationChangedEvent;
}) => {
    // 获取用户保存的地址列表
    const {
        data: userAddresses,
        refetch: refetchUserAddresses,
        isFetching: isFetchingAddresses,
    } = useUserAddresses();

    // 获取当前位置详情（包含附近POI）
    const {
        data: locationDetail,
        refetch: refetchLocationDetail,
        isFetching: isFetchingLocation,
    } = useLocationDetail({
        lat: location.latitude,
        lng: location.longitude,
    });
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 统计地址使用频率并去重，取前3个
    const frequentAddresses = useMemo(() => {
        if (!userAddresses || userAddresses.length === 0) return [];

        // 统计每个详细地址的使用次数
        const addressCountMap = new Map<string, { count: number; address: typeof userAddresses[0] }>();

        for (const addr of userAddresses) {
            const key = `${addr.province}-${addr.city}-${addr.district}-${addr.detailedAddress}`;
            const existing = addressCountMap.get(key);
            if (existing) {
                existing.count++;
            } else {
                addressCountMap.set(key, { count: 1, address: addr });
            }
        }

        // 转换为数组并按使用次数排序
        return Array.from(addressCountMap.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 3)
            .map(item => item.address);
    }, [userAddresses]);

    // 获取附近POI列表（排除已在常用地址中的）
    const nearbyPois = useMemo(() => {
        // locationDetail 可能是空数组或 ReverseGeocodeResponse["result"]对象
        if (!locationDetail || Array.isArray(locationDetail) || typeof locationDetail !== 'object') {
            return [];
        }

        if (!('pois' in locationDetail) || !Array.isArray(locationDetail.pois) || locationDetail.pois.length === 0) {
            return [];
        }

        // 过滤掉常用地址中已有的POI
        const frequentTitles = new Set(frequentAddresses.map(addr => addr.detailedAddress));

        return locationDetail.pois
            .filter((poi: any) => !frequentTitles.has(poi.title))
            .slice(0, 8); // 最多显示8个附近地址
    }, [locationDetail, frequentAddresses]);

    const handleSelectFrequentAddress = useCallback((address: typeof userAddresses[0]) => {
        // 从geom数组中提取经纬度 [lng, lat]
        const lng = address.geom?.[0] || 0;
        const lat = address.geom?.[1] || 0;

        onSelectAddress({
            province: address.province,
            city: address.city || "",
            district: address.district || "",
            detailedAddress: address.detailedAddress,
            lng: lng,
            lat: lat,
        });
    }, [onSelectAddress]);

    const handleSelectNearbyPoi = useCallback((poi: any) => {
        if (!locationDetail || Array.isArray(locationDetail) || typeof locationDetail !== 'object' || !('address_component' in locationDetail)) {
            return;
        }

        const addressComponent = locationDetail.address_component as any;

        onSelectAddress({
            province: addressComponent?.province || "",
            city: addressComponent?.city || "",
            district: addressComponent?.district || "",
            detailedAddress: poi.address || poi.title,
            lng: poi.location.lng,
            lat: poi.location.lat,
        });
    }, [locationDetail, onSelectAddress]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refetchUserAddresses({
                    throwOnError: false,
                }),
                refetchLocationDetail({
                    throwOnError: false,
                }),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [refetchLocationDetail, refetchUserAddresses]);

    return (
        <ScrollView
            className="flex-1"
            refreshControl={
                <RefreshControl
                    refreshing={isRefreshing || isFetchingAddresses || isFetchingLocation}
                    onRefresh={handleRefresh}
                />
            }
        >
            {/* 常用服务地址 */}
            {frequentAddresses.length > 0 && (
                <>
                    <View className="bg-primary/5 px-4 py-2.5 border-b border-border/50">
                        <Text className="text-sm text-primary font-medium">
                            ⭐ 常用服务地址
                        </Text>
                    </View>

                    {frequentAddresses.map((address, index) => (
                        <Pressable
                            key={`frequent-${index}`}
                            onPress={() => handleSelectFrequentAddress(address)}
                            className="px-4 py-4 border-b border-border/50 active:bg-muted/30"
                        >
                            <View className="flex-row items-start">
                                <View className="bg-accent/20 rounded-full p-2 mr-3">
                                    <MapPin size={18} className="text-accent-foreground" />
                                </View>
                                <View className="flex-1">
                                    <View className="flex-row items-center mb-1.5">
                                        <Text className="text-base font-semibold text-foreground mr-2">
                                            {address.recipientName}
                                        </Text>
                                        <View className="bg-accent/80 px-2 py-0.5 rounded-full mr-2">
                                            <Text className="text-xs font-medium text-accent-foreground">
                                                {address.sex ? "先生" : "女士"}
                                            </Text>
                                        </View>
                                    </View>
                                    <Text className="text-sm text-muted-foreground mb-1 font-medium">
                                        {address.recipientPhone}
                                    </Text>
                                    <Text className="text-sm text-foreground/70 leading-5" numberOfLines={2}>
                                        {address.province}{address.city}{address.district}{address.detailedAddress}
                                    </Text>
                                </View>
                            </View>
                        </Pressable>
                    ))}
                </>
            )}

            {/* 附近地址 */}
            {nearbyPois.length > 0 && (
                <>
                    <View className="bg-secondary/10 px-4 py-2.5 border-b border-border/50 flex-row items-center justify-between">
                        <Text className="text-sm text-secondary-foreground font-medium">
                            📍 附近地址
                        </Text>
                    </View>

                    {nearbyPois.map((poi: any, index: number) => (
                        <AddressItem
                            key={`poi-${index}`}
                            title={poi.title}
                            address={poi.address || poi.title}
                            tag={poi._distance ? `${Math.round(poi._distance)}m` : undefined}
                            onPress={() => handleSelectNearbyPoi(poi)}
                        />
                    ))}
                </>
            )}

            {/* 如果没有任何数据，显示提示 */}
            {frequentAddresses.length === 0 && nearbyPois.length === 0 && (
                <View className="flex-1 items-center justify-center py-20 px-6">
                    <View className="bg-muted/30 rounded-full p-6 mb-4">
                        <MapPin size={40} className="text-muted-foreground" />
                    </View>
                    <Text className="text-foreground font-semibold text-base mb-2">
                        暂无常用地址和附近地址
                    </Text>
                    <Text className="text-sm text-muted-foreground text-center">
                        请使用搜索功能查找地址
                    </Text>
                </View>
            )}
        </ScrollView>
    );
});
DefaultAddressContent.displayName = "DefaultAddressContent";

export default function SelectAddressScreen() {
    const [searchText, setSearchText] = useState("");

    const { location: locationDetail } = useLocation();


    // 使用防抖处理搜索文本，300ms延迟
    const debouncedSearchText = useDebounce(searchText, 300);

    // 使用精简的 Zustand store
    const manualSelectAddress = useAddressEditStore(
        useShallow((state) => state.manualSelectAddress),
    );
    const updateAddress = useAddressEditStore(
        useShallow((state) => state.updateAddress),
    );
    const selectedAddress = useAddressEditStore(
        useShallow((state) => state.selectedAddress),
    );

    const handleSelectAddress = (addressData: SelectLocation) => {
        // 构造要传递给store的地址数据
        const selectedLocationData: SelectLocation = {
            province: addressData.province,
            district: addressData.district,
            city: addressData.city || addressData.district,
            detailedAddress: addressData.detailedAddress,
            lng: addressData.lng,
            lat: addressData.lat,
        };

        // 直接更新store中的位置数据
        updateAddress(selectedLocationData);
        manualSelectAddress();

        // 返回编辑页面
        setTimeout(() => {
            router.back();
        }, 100);
    };

    return (
        <View className="flex-1 bg-background">
            {/* 搜索区域 */}
            <View className="px-4 py-3 bg-card relative border-b border-border/50 shadow-sm">
                <View className="flex-row items-center gap-3">
                    {/* 城市选择 */}
                    <Link href="/address/select-city">
                        <View className="flex-row items-center py-2 px-3 bg-primary/10 rounded-xl active:bg-primary/20">
                            <Text className="text-base text-primary font-semibold mr-1">
                                {selectedAddress?.district || selectedAddress?.city || "选择城市"}
                            </Text>
                            <ChevronDown size={16} className="text-primary" />
                        </View>
                    </Link>

                    {/* 搜索框 */}
                    <View className="flex-1">
                        <Input
                            placeholder="搜索小区名/大厦名"
                            value={searchText}
                            onChangeText={setSearchText}
                            className="h-10 rounded-xl border-border bg-muted/30 focus:border-primary focus:bg-background"
                        />
                    </View>
                </View>
            </View>

            {/* 地址建议结果 */}
            {debouncedSearchText && (
                <AddressSuggestionErrorBoundary>
                    <Suspense
                        fallback={
                            <View className="h-full">
                                <View className="bg-card absolute z-10 w-full h-full">
                                    <View className="bg-primary/5 px-4 py-2.5 border-b border-border/50">
                                        <Text className="text-sm text-primary font-medium">
                                            搜索中...
                                        </Text>
                                    </View>
                                    <View className="flex-1 px-4 py-4">
                                        {[1, 2, 3, 4, 5].map((i) => (
                                            <View
                                                key={i}
                                                className="h-16 bg-muted/30 rounded-xl mb-3"
                                            />
                                        ))}
                                    </View>
                                </View>
                            </View>
                        }
                    >
                        <AddressSuggestionsContent
                            searchQuery={debouncedSearchText}
                            selectedAddress={selectedAddress}
                            onSelectAddress={handleSelectAddress}
                        />
                    </Suspense>
                </AddressSuggestionErrorBoundary>
            )}

            {/* 当没有搜索内容时显示的默认内容 */}
            {!debouncedSearchText && locationDetail && (
                <Suspense
                    fallback={
                        <View className="flex-1 items-center justify-center">
                            <View className="bg-primary/10 rounded-full p-4 mb-4">
                                <MapPin size={32} className="text-primary" />
                            </View>
                            <Text className="mt-4 text-muted-foreground">加载地址中...</Text>
                        </View>
                    }
                >
                    <DefaultAddressContent onSelectAddress={handleSelectAddress} location={locationDetail} />
                </Suspense>
            )}
        </View>
    );
}
