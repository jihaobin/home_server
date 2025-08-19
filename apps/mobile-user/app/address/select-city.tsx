import React, { useState, useMemo, useRef, memo, Suspense, startTransition } from 'react';
import { View, Text, Pressable, Alert } from 'react-native';
import { router } from 'expo-router';
import { Search, MapPin, Navigation } from 'lucide-react-native';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { FlashList } from '@shopify/flash-list';
import { useChinaCity } from '@/hooks/api/address';

import { ChinaCity } from "@repo/types"


// 字母索引
const ALPHABET = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z'];

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
    const [searchQuery, setSearchQuery] = useState('');
    const [currentCity] = useState('北京市');
    const flashListRef = useRef<any>(null);

    // 使用 TanStack Query 获取城市数据
    const { data: allCities = [], isPending, isError, error, refetch } = useChinaCity({
        filter: 'city'
    });

    // 优化搜索输入，使用startTransition降低优先级
    const handleSearchChange = (text: string) => {
        startTransition(() => {
            setSearchQuery(text);
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
    const { filteredCities, groupedCities } = useMemo(() => {
        let filtered = cities;

        if (searchQuery.trim()) {
            const query = searchQuery.toLowerCase();
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

        return { filteredCities: filtered, groupedCities: grouped };
    }, [searchQuery, cities]);

    // 处理城市选择
    const handleCitySelect = (city: ChinaCity) => {
        Alert.alert('选择城市', `您选择了: ${city.name}`, [
            {
                text: '确定',
                onPress: () => router.back(),
            },
        ]);
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

    // 处理重新定位
    const handleRelocate = () => {
        Alert.alert('重新定位', '正在获取您的当前位置...');
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

    // // 如果正在加载，显示骨架屏
    if (isPending) {
        return (
            <View className="flex-1 bg-white">
                {/* 搜索框占位 */}
                <View className="px-4 py-3 border-b border-gray-200">
                    <View className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                </View>

                {/* 内容骨架屏 */}
                <View className="flex-1 px-4 py-4">
                    <View className="h-4 bg-gray-100 rounded mb-2 animate-pulse" />
                    <View className="flex-row gap-2 mb-4">
                        {[1, 2, 3].map(i => (
                            <View key={i} className="flex-1 h-8 bg-gray-100 rounded animate-pulse" />
                        ))}
                    </View>
                    {[1, 2, 3, 4, 5].map(i => (
                        <View key={i} className="h-12 bg-gray-100 rounded mb-2 animate-pulse" />
                    ))}
                </View>
            </View>
        );
    }

    // 如果出错，显示错误状态
    if (isError) {
        return (
            <View className="flex-1 items-center justify-center px-4 bg-white">
                <Text className="text-red-500 text-center">
                    {error?.message || '获取城市数据失败，请重试'}
                </Text>
                <Pressable
                    className="mt-4 bg-blue-500 px-4 py-2 rounded"
                    onPress={() => refetch()}
                >
                    <Text className="text-white">重试</Text>
                </Pressable>
            </View>
        );
    }

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
                        value={searchQuery}
                        onChangeText={handleSearchChange}
                        className="pl-10"
                    />
                </View>
            </View>

            {/* 搜索结果或主内容 */}
            {searchQuery.trim() ? (
                <FlashList
                    data={filteredCities}
                    renderItem={({ item }) => (
                        <CityItem city={item} onPress={handleCitySelect} />
                    )}
                    keyExtractor={(item) => item.id.toString()}
                />
            ) : (
                <View className="flex-1">
                    {/* 当前城市 */}
                    <View className="px-4 py-3 border-b border-gray-200">
                        <Text className="text-sm text-gray-500 mb-2">当前城市</Text>
                        <Pressable
                            className="flex-row items-center justify-between py-2"
                            onPress={handleRelocate}
                        >
                            <View className="flex-row items-center">
                                <MapPin size={20} className='text-primary' />
                                <Text className="ml-2 text-base text-gray-900">{currentCity}</Text>
                            </View>
                            <View className="flex-row items-center">
                                <Navigation size={16} className='text-primary' />
                                <Text className="ml-1 text-sm text-primary">重新定位</Text>
                            </View>
                        </Pressable>
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
                        />
                    </View>
                </View>
            )}

            {/* 右侧字母索引 */}
            {!searchQuery.trim() && (
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
            <Suspense
                fallback={
                    <View className="flex-1">
                          {/* 立即显示搜索框 - 给用户交互反馈 */}
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
        </View>
    );
}
