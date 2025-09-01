import React, { useState, useCallback, Suspense } from 'react';
import { View, ScrollView, Pressable, FlatList } from 'react-native';
import { router, Link } from 'expo-router';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { ChevronDown } from '@repo/mobile-ui/lib/icons/ChevronDown';
import { MapPin } from '@repo/mobile-ui/lib/icons/MapPin';
import { useAddressSuggestionInfiniteSuspense } from '@/hooks/api/address';
import { SelectAddress, SelectLocation, useAddressEditStore } from '@/stores/address-store';
import { useShallow } from 'zustand/react/shallow';
import { useDebounce } from '@/hooks/useDebounceThrottle';
import { AddressSuggestionErrorBoundary } from '@/components/error-boundaries';
import type { SuggestionData } from '@repo/types';


// 地址项组件
function AddressItem({
    title,
    address,
    tag,
    isCurrent = false,
    onPress
}: {
    title: string;
    address: string;
    tag?: string;
    isCurrent?: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} className="py-4 px-4 border-b border-border">
            <View className="flex-row items-start">
                <MapPin size={20} className="text-primary mr-3 mt-1" />
                <View className="flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-base font-medium text-foreground mr-2">
                            {title}
                        </Text>
                        {tag && (
                            <View className={`px-2 py-1 rounded ${isCurrent ? 'bg-primary' : 'bg-primary/50'}`}>
                                <Text className="text-xs text-white">{tag}</Text>
                            </View>
                        )}
                    </View>
                    <Text className="text-sm text-muted-foreground mt-1 text-ellipsis">
                        {address}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

// 搜索建议内容组件 - 用于Suspense边界
const AddressSuggestionsContent = React.memo(({
    searchQuery,
    selectedAddress,
    onSelectAddress
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
    } = useAddressSuggestionInfiniteSuspense({
        keyword: searchQuery,
        lat: selectedAddress?.lat,
        lng: selectedAddress?.lng,
        city: selectedAddress?.district || selectedAddress?.city || selectedAddress?.province
    });

    // 将所有页面的数据平铺为一个数组
    const allSuggestions = addressSuggestionData?.pages?.flatMap((page) => page.data) || [];

    // 加载更多数据的回调
    const handleLoadMore = useCallback(() => {
        if (hasNextPage && !isFetchingNextPage && !isFetching) {
            fetchNextPage();
        }
    }, [hasNextPage, isFetchingNextPage, isFetching, fetchNextPage]);

    // 将 SuggestionData 转换为 selectAddress
    const convertToSelectedLocation = useCallback((item: SuggestionData): SelectLocation => {
        return {
            lng: item.location.lng,
            lat: item.location.lat,
            detailedAddress: item.address || item.title,
            province: item.province || '',
            city: item.city || '',
            district: item.district || '',
        };
    }, []);

    // 渲染搜索建议项
    const renderSuggestionItem = ({ item, index }: { item: SuggestionData; index: number }) => (
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
                    {isFetchingNextPage ? '加载中...' : '上拉加载更多'}
                </Text>
            </View>
        );
    };

    if (allSuggestions.length === 0) {
        return (
            <View className="bg-white absolute z-10 w-full h-full items-center justify-center">
                <Text className="text-muted-foreground">暂无搜索结果</Text>
            </View>
        );
    }

    return (
        <View className='h-full'>
            <View className="bg-white absolute z-10 w-full h-full">
                <View className="bg-gray-100 px-4 py-2">
                    <Text className="text-sm text-muted-foreground">
                        搜索结果
                    </Text>
                </View>
                <FlatList
                    data={allSuggestions}
                    renderItem={renderSuggestionItem}
                    keyExtractor={(item, index) => `suggestion-${index}-${item.id || item.title}`}
                    onEndReached={handleLoadMore}
                    onEndReachedThreshold={0.5}
                    ListFooterComponent={renderFooter}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={true}
                />
            </View>
        </View>
    );
});
AddressSuggestionsContent.displayName = 'AddressSuggestionsContent';

export default function SelectAddressScreen() {
    const [searchText, setSearchText] = useState('');

    // 使用防抖处理搜索文本，300ms延迟
    const debouncedSearchText = useDebounce(searchText, 300);

    // 使用精简的 Zustand store
    const manualSelectAddress = useAddressEditStore(useShallow((state) => state.manualSelectAddress));
    const updateAddress = useAddressEditStore(useShallow((state) => state.updateAddress));
    const selectedAddress = useAddressEditStore(useShallow((state) => state.selectedAddress));

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
        updateAddress(selectedLocationData)
        manualSelectAddress();

        // 返回编辑页面
        setTimeout(() => {
            router.back();
        }, 100);
    };

    return (
        <View className="flex-1 bg-background">
            {/* 搜索区域 */}
            <View className="px-4 py-3 bg-background relative">
                <View className="flex-row items-center gap-2">
                    {/* 城市选择 */}
                    <Link
                        className="flex-row items-center py-2" href={'./select-city'}
                    >
                        <Text className="text-base text-foreground mr-1">{selectedAddress?.district || selectedAddress?.city || '选择城市'}</Text>
                        <ChevronDown size={16} className="text-muted-foreground" />
                    </Link>

                    {/* 搜索框 */}
                    <View className="flex-1">
                        <Input
                            placeholder="搜索小区名/大厦名"
                            value={searchText}
                            onChangeText={setSearchText}
                            className="h-10 rounded-full border-border focus:border-primary"
                        />
                    </View>
                </View>
            </View>

            {/* 地址建议结果 */}
            {debouncedSearchText && (
                <AddressSuggestionErrorBoundary>
                    <Suspense
                        fallback={
                            <View className='h-full'>
                                <View className="bg-white absolute z-10 w-full h-full">
                                    <View className="bg-gray-100 px-4 py-2">
                                        <Text className="text-sm text-muted-foreground">
                                            搜索中...
                                        </Text>
                                    </View>
                                    <View className="flex-1 px-4 py-4">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <View key={i} className="h-12 bg-gray-100 rounded mb-2 animate-pulse" />
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
            {!debouncedSearchText && (
                <ScrollView className="flex-1">
                    {/* 常用服务地址 */}
                    <View className="bg-gray-100 px-4 py-2">
                        <Text className="text-sm text-muted-foreground">常用服务地址</Text>
                    </View>

                    <View className="px-4 py-4 border-b border-border">
                        <View className="flex-row items-center">
                            <Text className="text-base font-medium text-foreground mr-3">u6154</Text>
                            <Text className="text-sm text-muted-foreground mr-3">先生</Text>
                            <Text className="text-sm text-muted-foreground">19090416306</Text>
                        </View>
                        <Text className="text-sm text-muted-foreground mt-1">
                            黄冈武穴市兴雨科技大楼hh
                        </Text>
                    </View>

                    {/* 附近地址 */}
                    <View className="bg-gray-100 px-4 py-2 flex-row items-center justify-between">
                        <Text className="text-sm text-muted-foreground">附近地址</Text>
                    </View>

                    {/* 地址列表 */}
                <AddressItem
                    title="柏曼酒店(黄冈武穴利江大道店)"
                    address="利江大道35号"
                    tag="3位邻居"
                        onPress={() => handleSelectAddress({
                            title: '柏曼酒店(黄冈武穴利江大道店)',
                            address: '利江大道35号',
                            detailedAddress: '利江大道35号',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="兴雨科技大楼"
                    address="湖北省黄冈市武穴市利江大道59号"
                    tag="当前"
                    isCurrent={true}
                        onPress={() => handleSelectAddress({
                            title: '兴雨科技大楼',
                            address: '湖北省黄冈市武穴市利江大道59号',
                            detailedAddress: '湖北省黄冈市武穴市利江大道59号',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="添才翰格猎服集团(黄冈武穴分公司)"
                    address="黄冈市武穴市利江大道实验小学(大桥分校)东北..."
                        onPress={() => handleSelectAddress({
                            title: '添才翰格猎服集团(黄冈武穴分公司)',
                            address: '黄冈市武穴市利江大道实验小学(大桥分校)东北...',
                            detailedAddress: '黄冈市武穴市利江大道实验小学(大桥分校)东北...',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="太子庙路-道路"
                    address="武穴市"
                        onPress={() => handleSelectAddress({
                            title: '太子庙路-道路',
                            address: '武穴市',
                            detailedAddress: '武穴市',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="聚贤小区"
                    address="武穴市"
                        onPress={() => handleSelectAddress({
                            title: '聚贤小区',
                            address: '武穴市',
                            detailedAddress: '武穴市',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="芳刚服饰厂"
                    address="武穴市"
                        onPress={() => handleSelectAddress({
                            title: '芳刚服饰厂',
                            address: '武穴市',
                            detailedAddress: '武穴市',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="武穴市梅园小区"
                    address="黄冈市武穴市利江大道40号东北方向180米"
                        onPress={() => handleSelectAddress({
                            title: '武穴市梅园小区',
                            address: '黄冈市武穴市利江大道40号东北方向180米',
                            detailedAddress: '黄冈市武穴市利江大道40号东北方向180米',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />

                <AddressItem
                    title="丽枫酒店(武穴利江大道店)"
                    address="湖北省黄冈市武穴市利江大道锦路"
                        onPress={() => handleSelectAddress({
                            title: '丽枫酒店(武穴利江大道店)',
                            address: '湖北省黄冈市武穴市利江大道锦路',
                            detailedAddress: '湖北省黄冈市武穴市利江大道锦路',
                            province: '湖北省',
                            city: '黄冈市',
                            district: '黄冈市',
                            county: '武穴市',
                            lng: 115.5656,
                            lat: 29.8496,
                        })}
                />
                </ScrollView>
            )}
        </View>
    );
}
