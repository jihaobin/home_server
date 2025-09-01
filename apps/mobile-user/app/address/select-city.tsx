import React, { useState, useMemo, useRef, memo, Suspense, startTransition, useEffect } from 'react';
import { View, Text, Pressable, Alert, FlatList } from 'react-native';
import { router } from 'expo-router';
import { Search, MapPin, Navigation } from 'lucide-react-native';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { FlashList } from '@shopify/flash-list';
import { useChinaCity, useCityParentInfo, useCitySearchSuspense } from '@/hooks/api/address';
import { CitySearchErrorBoundary, MainContentErrorBoundary } from '@/components/error-boundaries';

import { ChinaCity, DistrictData } from "@repo/types"
import { useAddressEditStore } from '@/stores/address-store';
import { useShallow } from 'zustand/react/shallow';
import { useDebounce } from '@/hooks/useDebounceThrottle';

// 字母索引
const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

// 城市搜索结果项组件
function CitySearchItem({
    district,
    onPress
}: {
    district: DistrictData;
    onPress: () => void;
}) {
    return (
        <Pressable onPress={onPress} className="py-4 px-4 border-b border-border">
            <View className="flex-row items-start">
                <MapPin size={20} className="text-primary mr-3 mt-1" />
                <View className="flex-1">
                    <Text className="text-base font-medium text-foreground">
                        {district.name || district.fullname}
                    </Text>
                    <Text className="text-sm text-muted-foreground mt-1">
                        {district.address || district.fullname}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

// 搜索建议内容组件 - 用于Suspense边界
const SearchSuggestionsContent = memo(({ searchQuery, onSelectDistrict }: {
    searchQuery: string;
    onSelectDistrict: (district: DistrictData) => void;
}) => {
    const { data: searchResults } = useCitySearchSuspense(searchQuery);

    // 渲染搜索建议项
    const renderSuggestionItem = ({ item }: { item: DistrictData }) => (
        <CitySearchItem
            district={item}
            onPress={() => onSelectDistrict(item)}
        />
    );
    debugger

    return (
        <View className='h-full'>
            <View className="bg-white absolute z-10 w-full h-full">
                <View className="bg-gray-100 px-4 py-2">
                    <Text className="text-sm text-muted-foreground">
                        搜索结果 ({searchResults.length} 条)
                    </Text>
                </View>
                <FlatList
                    data={searchResults}
                    renderItem={renderSuggestionItem}
                    keyExtractor={(item) => `search-${item.id}`}
                    style={{ flex: 1 }}
                    showsVerticalScrollIndicator={true}
                />
            </View>
        </View>
    );
});
SearchSuggestionsContent.displayName = 'SearchSuggestionsContent';

interface CityItemProps {
    city: ChinaCity;
    onPress: (city: ChinaCity) => void;
}

const CityItem: React.FC<CityItemProps> = memo(({ city, onPress }) => (
    <Pressable
        onPress={() => onPress(city)}
        className="flex-row items-center px-4 py-3 border-b border-gray-100"
    >
        <Text className="text-base text-gray-900">{city.name}</Text>
    </Pressable>
));
CityItem.displayName = 'CityItem';

interface HotCityItemProps {
    city: ChinaCity;
    onPress: (city: ChinaCity) => void;
}

const HotCityItem: React.FC<HotCityItemProps> = memo(({ city, onPress }) => (
    <Pressable
        onPress={() => onPress(city)}
        className="bg-gray-50 border border-gray-200 rounded-lg px-4 py-2 flex-1 mx-1 my-1"
    >
        <Text className="text-center text-sm text-gray-900">{city.name}</Text>
    </Pressable>
));
HotCityItem.displayName = 'HotCityItem';

// 分离的主内容组件 - 用于 Suspense 边界
const CitySelectionContent = memo(() => {
    const [searchText, setSearchText] = useState('');
    const flashListRef = useRef<any>(null);
    const [selectCity, setSelectCity] = useState<ChinaCity | null>(null);
    const [hasNavigated, setHasNavigated] = useState(false); // 防止重复导航

    // 使用防抖处理搜索文本，300ms延迟
    const debouncedSearchText = useDebounce(searchText, 300);

    const updateSelectedAddress = useAddressEditStore(useShallow((state) => state.updateAddress));
    const selectedAddress = useAddressEditStore(useShallow((state) => state.selectedAddress));

    // 使用 TanStack Query 获取城市数据
    const { data: allCities = [] } = useChinaCity({
        filter: 'city'
    });
    const { data: cityParendInfo } = useCityParentInfo(selectCity?.name);

    // 优化搜索输入，使用startTransition降低优先级
    const handleSearchChange = (text: string) => {
        startTransition(() => {
            setSearchText(text);
        });
    };

    // 只获取城市级别的数据 (deep = 1)
    const cities = useMemo(() => {
        return allCities.filter((city: ChinaCity) => city.deep === 1);
    }, [allCities]);

    // 热门城市ID列表
    const HOT_CITY_IDS = useMemo(() => [110000, 310000, 440100, 440300, 330100, 320100, 610100, 510100, 420100, 120000, 500000, 320500], []);

    // 从API数据中筛选热门城市
    const hotCities = useMemo(() => {
        return cities.filter(city => HOT_CITY_IDS.includes(city.id));
    }, [cities, HOT_CITY_IDS]);

    // 过滤和分组城市数据
    const { groupedCities } = useMemo(() => {
        let filtered = cities;

        if (searchText.trim()) {
            const query = searchText.toLowerCase();
            filtered = cities.filter(city =>
                city.name.toLowerCase().includes(query) ||
                city.pinyin.toLowerCase().includes(query)
            );
        }

        // 按首字母分组
        const grouped = filtered.reduce((acc, city) => {
            const letter = city.pinyinPrefix.charAt(0).toUpperCase();
            if (!acc[letter]) {
                acc[letter] = [];
            }
            acc[letter].push(city);
            return acc;
        }, {} as Record<string, ChinaCity[]>);

        // 排序每个分组内的城市
        Object.keys(grouped).forEach(letter => {
            grouped[letter].sort((a: ChinaCity, b: ChinaCity) => a.pinyin.localeCompare(b.pinyin));
        });

        return { groupedCities: grouped };
    }, [searchText, cities]);

    // 监听城市选择变化，当城市父级信息加载完成后更新地址
    useEffect(() => {
        if (selectCity && cityParendInfo && !hasNavigated) {
            updateSelectedAddress({
                province: cityParendInfo.province || '',
                lng: cityParendInfo.location.lng || 0,
                lat: cityParendInfo.location.lat || 0,
                city: cityParendInfo.city || "",
                district: cityParendInfo.district || "",
            });
            // 标记已导航，防止重复导航
            setHasNavigated(true);
            // 导航回上一页
            router.back();
        }
    }, [selectCity, cityParendInfo, hasNavigated]); // 移除 updateSelectedAddress，因为它来自 Zustand store，是稳定的

    // 处理城市选择
    const handleCitySelect = (city: ChinaCity) => {
        setSelectCity(city);
    };

    // 处理搜索结果选择
    const handleDistrictSelect = (district: DistrictData) => {
        const address = district.address.split(',')

        updateSelectedAddress({
            province: address[0] || '',
            lng: district.location.lng || 0,
            lat: district.location.lat || 0,
            city: address[1] || '',
            district: address[2] || '',
        });
        // 导航回上一页
        router.back();
    };

    // 为FlashList准备扁平化数据结构
    const flatListData = useMemo(() => {
        const sections: Array<{ type: 'header'; letter: string } | { type: 'city'; city: ChinaCity }> = [];

        ALPHABET.forEach(letter => {
            if (groupedCities[letter] && groupedCities[letter].length > 0) {
                sections.push({ type: 'header', letter });
                groupedCities[letter].forEach(city => {
                    sections.push({ type: 'city', city });
                });
            }
        });

        return sections;
    }, [groupedCities]);

    // 处理字母索引点击
    const handleLetterPress = (letter: string) => {
        if (!flashListRef.current || !groupedCities[letter]) return;

        const targetIndex = flatListData.findIndex(
            item => item.type === 'header' && item.letter === letter
        );

        if (targetIndex !== -1) {
            flashListRef.current.scrollToIndex({
                index: targetIndex,
                animated: true,
                viewPosition: 0,
            });
        }
    };

    // 渲染热门城市网格
    const renderHotCities = () => {
        const rows = [];
        for (let i = 0; i < hotCities.length; i += 3) {
            const rowCities = hotCities.slice(i, i + 3);
            rows.push(
                <View key={i} className="flex-row mb-2">
                    {rowCities.map((city) => (
                        <HotCityItem
                            key={city.id}
                            city={city}
                            onPress={handleCitySelect}
                        />
                    ))}
                    {Array.from({ length: 3 - rowCities.length }, (_, index) => (
                        <View key={`empty-${index}`} className="flex-1 mx-1" />
                    ))}
                </View>
            );
        }
        return rows;
    };

    // FlashList渲染项目函数
    const renderListItem = ({ item }: { item: typeof flatListData[0] }) => {
        if (item.type === 'header') {
            return (
                <View className="px-4 py-2 bg-gray-50 border-b border-gray-200">
                    <Text className="text-sm font-medium text-gray-600">
                        {item.letter}
                    </Text>
                </View>
            );
        } else {
            return (
                <CityItem
                    city={item.city}
                    onPress={handleCitySelect}
                />
            );
        }
    };

    // getItemType用于FlashList性能优化
    const getItemType = (item: typeof flatListData[0]) => {
        return item.type;
    };

    return (
        <View className="flex-1 bg-white">
            {/* 搜索框 */}
            <View className="px-4 py-3 border-b border-gray-200">
                <View className="relative">
                    <Search
                        size={20}
                        color="#9CA3AF"
                        style={{ position: 'absolute', left: 12, top: 12, zIndex: 1 }}
                    />
                    <Input
                        placeholder="搜索城市"
                        value={searchText}
                        onChangeText={handleSearchChange}
                        className="pl-10"
                    />
                </View>
            </View>

            {/* 搜索结果或主内容 */}
            {debouncedSearchText.trim() ? (
                <CitySearchErrorBoundary>
                    <View className='h-full'>
                        <Suspense
                            fallback={
                                <View className="bg-white absolute z-10 w-full h-full">
                                    <View className="bg-gray-100 px-4 py-2">
                                        <Text className="text-sm text-muted-foreground">搜索中...</Text>
                                    </View>
                                    <View className="flex-1 px-4 py-4">
                                        {[1, 2, 3, 4, 5].map(i => (
                                            <View key={i} className="h-12 bg-gray-100 rounded mb-2 animate-pulse" />
                                        ))}
                                    </View>
                                </View>
                            }
                        >
                            <SearchSuggestionsContent
                                searchQuery={debouncedSearchText}
                                onSelectDistrict={handleDistrictSelect}
                            />
                        </Suspense>
                    </View>

                </CitySearchErrorBoundary>
            ) : (
                <View className="flex-1">
                    {/* 当前城市 */}
                    <View className="px-4 py-3 border-b border-gray-200">
                            <Text className="text-sm text-gray-500 mb-2">当前城市</Text>
                            <View className="flex-row items-center">
                                <MapPin size={20} className='text-primary' />
                                <Text className="ml-2 text-base text-gray-900">{selectedAddress?.district || selectedAddress?.city || '北京'}</Text>
                            </View>
                    </View>

                    {/* 热门城市 */}
                    <View className="px-4 py-3 border-b border-gray-200">
                        <Text className="text-sm text-gray-500 mb-3">热门城市</Text>
                        {renderHotCities()}
                    </View>

                    {/* 字母分组的城市列表 */}
                    <View className="flex-1">
                        <FlashList
                            ref={flashListRef}
                            data={flatListData}
                            renderItem={renderListItem}
                            keyExtractor={(item) =>
                                item.type === 'header' ? `header-${item.letter}` : `city-${item.city.id}`
                            }
                            getItemType={getItemType}
                            showsVerticalScrollIndicator={false}
                                estimatedItemSize={flatListData.length}
                        />
                    </View>
                </View>
            )}

            {/* 右侧字母索引 */}
            {!debouncedSearchText.trim() && (
                <View className="absolute right-2 top-1/2 -translate-y-[40%]">
                    <View className="bg-transparent rounded-lg shadow-lg py-2 px-1">
                        {ALPHABET.map((letter) => (
                            <Pressable
                                key={letter}
                                className={`w-6 h-6 items-center justify-center ${groupedCities[letter] ? '' : 'opacity-30'}`}
                                disabled={!groupedCities[letter]}
                                onPress={() => handleLetterPress(letter)}
                            >
                                <Text className="text-xs font-medium text-primary">
                                    {letter}
                                </Text>
                            </Pressable>
                        ))}
                    </View>
                </View>
            )}
        </View>
    );
});
CitySelectionContent.displayName = 'CitySelectionContent';

export default function SelectCityScreen() {
    // 立即显示的UI框架，不等待任何数据
    return (
        <View className="flex-1 bg-white">
            {/* 使用Suspense包裹实际内容 */}
            <MainContentErrorBoundary>
                <Suspense
                    fallback={
                        <View className="flex-1">
                            <View className="px-4 py-3 border-b border-gray-200">
                                <View className="relative">
                                    <Search
                                        size={20}
                                        color="#9CA3AF"
                                        style={{ position: 'absolute', left: 12, top: 12, zIndex: 1 }}
                                    />
                                    <Input
                                        placeholder="搜索城市"
                                        className="pl-10"
                                        editable={false} // 暂时禁用，等内容加载完成
                                    />
                                </View>
                            </View>

                            {/* 精心设计的骨架屏，模拟真实界面 */}
                            <View className="px-4 py-3 border-b border-gray-200">
                                <View className="h-4 w-20 bg-gray-100 rounded mb-2 animate-pulse" />
                                <View className="flex-row items-center justify-between py-2">
                                    <View className="flex-row items-center">
                                        <View className="w-5 h-5 bg-gray-100 rounded mr-2 animate-pulse" />
                                        <View className="h-4 w-12 bg-gray-100 rounded animate-pulse" />
                                    </View>
                                    <View className="flex-row items-center">
                                        <View className="w-4 h-4 bg-gray-100 rounded mr-1 animate-pulse" />
                                        <View className="h-3 w-12 bg-gray-100 rounded animate-pulse" />
                                    </View>
                                </View>
                            </View>

                            <View className="px-4 py-3 border-b border-gray-200">
                                <View className="h-4 w-16 bg-gray-100 rounded mb-3 animate-pulse" />
                                <View className="flex-row gap-2 mb-2">
                                    {[1, 2, 3].map(i => (
                                        <View key={i} className="flex-1 h-8 bg-gray-100 rounded animate-pulse" />
                                    ))}
                                </View>
                            </View>

                            <View className="flex-1 px-4 pt-2">
                                {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                                    <View key={i} className="flex-row items-center py-3 border-b border-gray-50">
                                        <View className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                                    </View>
                                ))}
                            </View>

                            {/* 字母索引骨架 */}
                            <View className="absolute right-2 top-1/3">
                                <View className="bg-white rounded-lg shadow-lg py-2 px-1">
                                    {Array.from({ length: 8 }, (_, i) => (
                                        <View key={i} className="w-6 h-6 items-center justify-center mb-1">
                                            <View className="w-2 h-3 bg-gray-100 rounded animate-pulse" />
                                        </View>
                                    ))}
                                </View>
                            </View>
                        </View>
                    }
                >
                    <CitySelectionContent />
                </Suspense>
            </MainContentErrorBoundary>
        </View>
    );
}
