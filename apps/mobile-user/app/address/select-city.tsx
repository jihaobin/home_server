import { Input } from "@repo/mobile-ui/components/ui/input";
import type { ChinaCity, DistrictData } from "@repo/types";
import { FlashList } from "@shopify/flash-list";
import { router, useLocalSearchParams } from "expo-router";
import { MapPin, Search } from "lucide-react-native";
import type React from "react";
import {
    memo,
    Suspense,
    startTransition,
    useCallback,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import { FlatList, Pressable, Text, View } from "react-native";
import { useShallow } from "zustand/react/shallow";
import {
    CitySearchErrorBoundary,
    MainContentErrorBoundary,
} from "@repo/mobile-ui/components/error-boundaries";
import {
    useChinaCity,
    useCityParentInfo,
    useCitySearchSuspense,
} from "@repo/hooks/api/address";
import { useDebounce } from "@repo/hooks/useDebounceThrottle";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import {
    useAddressEditStore,
    type SelectLocation,
} from "@/stores/address-store";
import { useHomeLocationStore } from "@/stores/home-location-store";

// 字母索引
const ALPHABET = [
    "A",
    "B",
    "C",
    "D",
    "E",
    "F",
    "G",
    "H",
    "I",
    "J",
    "K",
    "L",
    "M",
    "N",
    "O",
    "P",
    "Q",
    "R",
    "S",
    "T",
    "U",
    "V",
    "W",
    "X",
    "Y",
    "Z",
];

function CitySelectionSkeleton() {
    return (
        <View className="flex-1">
            <View className="px-4 py-3 border-b border-border/50 bg-card">
                <View className="relative">
                    <Search
                        size={20}
                        color="#9CA3AF"
                        style={{
                            position: "absolute",
                            left: 12,
                            top: 12,
                            zIndex: 1,
                        }}
                    />
                    <Input
                        placeholder="搜索城市"
                        className="pl-10 rounded-xl bg-muted/30"
                        editable={false}
                    />
                </View>
            </View>

            <View className="px-4 py-3.5 border-b border-border/50 bg-card">
                <View className="h-3 w-16 bg-muted/50 rounded mb-2" />
                <View className="flex-row items-center justify-between py-2">
                    <View className="flex-row items-center">
                        <View className="w-9 h-9 bg-muted/50 rounded-full mr-2" />
                        <View className="h-4 w-12 bg-muted/50 rounded" />
                    </View>
                </View>
            </View>

            <View className="px-4 py-3.5 border-b border-border/50 bg-background">
                <View className="h-3 w-16 bg-muted/50 rounded mb-3" />
                <View className="flex-row gap-2 mb-2">
                    {[1, 2, 3].map((i) => (
                        <View
                            key={i}
                            className="flex-1 h-10 bg-muted/50 rounded-xl"
                        />
                    ))}
                </View>
            </View>

            <View className="flex-1 px-4 pt-2">
                {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                    <View
                        key={i}
                        className="flex-row items-center py-3.5 border-b border-border/30"
                    >
                        <View className="h-4 w-16 bg-muted/50 rounded" />
                    </View>
                ))}
            </View>

            <View className="absolute right-2 top-1/3">
                <View className="bg-card/90 rounded-xl shadow-lg py-2 px-1 border border-border/50">
                    {Array.from({ length: 8 }, (_, i) => (
                        <View
                            key={i}
                            className="w-7 h-7 items-center justify-center mb-1"
                        >
                            <View className="w-2 h-3 bg-muted/50 rounded" />
                        </View>
                    ))}
                </View>
            </View>
        </View>
    );
}

// 城市搜索结果项组件
function CitySearchItem({
    district,
    onPress,
}: {
    district: DistrictData;
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
                    <Text className="text-base font-semibold text-foreground">
                        {district.name || district.fullname}
                    </Text>
                    <Text
                        className="text-sm text-muted-foreground mt-0.5 leading-5"
                        numberOfLines={1}
                    >
                        {district.address || district.fullname}
                    </Text>
                </View>
            </View>
        </Pressable>
    );
}

// 搜索建议内容组件 - 用于Suspense边界
const SearchSuggestionsContent = memo(
    ({
        searchQuery,
        onSelectDistrict,
    }: {
        searchQuery: string;
        onSelectDistrict: (district: DistrictData) => void;
    }) => {
        const { data: searchResults, refetch: refetchSearch } =
            useCitySearchSuspense(searchQuery);
        const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh(
            {
                refetchActiveQueries: false,
                extraRefresh: () =>
                    refetchSearch({
                        throwOnError: false,
                    }),
            },
        );

        // 渲染搜索建议项
        const renderSuggestionItem = ({ item }: { item: DistrictData }) => (
            <CitySearchItem
                district={item}
                onPress={() => onSelectDistrict(item)}
            />
        );

        if (showPageLoading) {
            return (
                <View className="h-full">
                    <View className="bg-card absolute z-10 w-full h-full">
                        <View className="bg-primary/5 px-4 py-2.5 border-b border-border/50">
                            <Text className="text-sm text-primary font-medium">
                                刷新中...
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
            );
        }

        return (
            <View className="h-full">
                <View className="bg-card absolute z-10 w-full h-full">
                    <View className="bg-primary/5 px-4 py-2.5 border-b border-border/50">
                        <Text className="text-sm text-primary font-medium">
                            搜索结果 · {searchResults.length} 条
                        </Text>
                    </View>
                    <FlatList
                        data={searchResults}
                        renderItem={renderSuggestionItem}
                        keyExtractor={(item) => `search-${item.id}`}
                        style={{ flex: 1 }}
                        showsVerticalScrollIndicator={true}
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
                </View>
            </View>
        );
    },
);
SearchSuggestionsContent.displayName = "SearchSuggestionsContent";

interface CityItemProps {
    city: ChinaCity;
    onPress: (city: ChinaCity) => void;
}

const CityItem: React.FC<CityItemProps> = memo(({ city, onPress }) => (
    <Pressable
        onPress={() => onPress(city)}
        className="flex-row items-center px-4 py-3.5 border-b border-border/30 active:bg-muted/30"
    >
        <Text className="text-base text-foreground">{city.name}</Text>
    </Pressable>
));
CityItem.displayName = "CityItem";

interface HotCityItemProps {
    city: ChinaCity;
    onPress: (city: ChinaCity) => void;
}

const HotCityItem: React.FC<HotCityItemProps> = memo(({ city, onPress }) => (
    <Pressable
        onPress={() => onPress(city)}
        className="bg-muted/50 border-2 border-border/50 rounded-xl px-4 py-3 flex-1 mx-1 my-1 active:bg-primary/10 active:border-primary"
    >
        <Text className="text-center text-sm font-medium text-foreground">
            {city.name}
        </Text>
    </Pressable>
));
HotCityItem.displayName = "HotCityItem";

// 分离的主内容组件 - 用于 Suspense 边界
const CitySelectionContent = memo(() => {
    const [searchText, setSearchText] = useState("");
    const flashListRef = useRef<any>(null);
    const [selectCity, setSelectCity] = useState<ChinaCity | null>(null);
    const [hasNavigated, setHasNavigated] = useState(false); // 防止重复导航
    const params = useLocalSearchParams<{ scene?: string }>();
    const isHomeMode = params.scene === "home";

    // 使用防抖处理搜索文本，300ms延迟
    const debouncedSearchText = useDebounce(searchText, 300);

    const updateAddressStore = useAddressEditStore(
        useShallow((state) => state.updateAddress),
    );
    const addressStoreSelectedAddress = useAddressEditStore(
        useShallow((state) => state.selectedAddress),
    );
    const selectedHomeLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );
    const setHomeSelectedLocation = useHomeLocationStore(
        (state) => state.setSelectedLocation,
    );

    const selectedAddress = isHomeMode
        ? selectedHomeLocation
        : addressStoreSelectedAddress;

    const updateSelectedAddress = useCallback(
        (data: Partial<SelectLocation>) => {
            if (isHomeMode) {
                const baseLocation: SelectLocation = selectedHomeLocation ?? {
                    province: "",
                    city: "",
                    district: "",
                    detailedAddress: "",
                    lng: 0,
                    lat: 0,
                };
                setHomeSelectedLocation({
                    ...baseLocation,
                    ...data,
                });
                return;
            }

            updateAddressStore(data);
        },
        [
            isHomeMode,
            selectedHomeLocation,
            setHomeSelectedLocation,
            updateAddressStore,
        ],
    );

    // 使用 TanStack Query 获取城市数据
    const { data: allCities = [], refetch: refetchCities } = useChinaCity({
        filter: "city",
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
    const HOT_CITY_IDS = useMemo(
        () => [
            1101, 310000, 440100, 440300, 330100, 320100, 610100, 510100,
            420100, 120000, 500000, 320500,
        ],
        [],
    );

    // 从API数据中筛选热门城市
    const hotCities = useMemo(() => {
        return cities.filter((city) => HOT_CITY_IDS.includes(city.id));
    }, [cities, HOT_CITY_IDS]);

    // 过滤和分组城市数据
    const { groupedCities } = useMemo(() => {
        let filtered = cities;

        if (searchText.trim()) {
            const query = searchText.toLowerCase();
            filtered = cities.filter(
                (city) =>
                    city.name.toLowerCase().includes(query) ||
                    city.pinyin.toLowerCase().includes(query),
            );
        }

        // 按首字母分组
        const grouped = filtered.reduce(
            (acc, city) => {
                const letter = city.pinyinPrefix.charAt(0).toUpperCase();
                if (!acc[letter]) {
                    acc[letter] = [];
                }
                acc[letter].push(city);
                return acc;
            },
            {} as Record<string, ChinaCity[]>,
        );

        // 排序每个分组内的城市
        Object.keys(grouped).forEach((letter) => {
            grouped[letter].sort((a: ChinaCity, b: ChinaCity) =>
                a.pinyin.localeCompare(b.pinyin),
            );
        });

        return { groupedCities: grouped };
    }, [searchText, cities]);

    // 监听城市选择变化，当城市父级信息加载完成后更新地址
    useEffect(() => {
        if (selectCity && cityParendInfo && !hasNavigated) {
            updateSelectedAddress({
                province: cityParendInfo.province || "",
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
    }, [selectCity, cityParendInfo, hasNavigated, updateSelectedAddress]);

    // 处理城市选择
    const handleCitySelect = (city: ChinaCity) => {
        setSelectCity(city);
    };

    // 处理搜索结果选择
    const handleDistrictSelect = (district: DistrictData) => {
        const address = (
            district.address?.trim()
                ? district.address
                : district.fullname || ""
        ).split(",");

        updateSelectedAddress({
            province: address[0] || "",
            lng: district.location.lng || 0,
            lat: district.location.lat || 0,
            city: address[1] || "",
            district: address[2] || "",
        });
        // 导航回上一页
        router.back();
    };

    // 为FlashList准备扁平化数据结构
    const flatListData = useMemo(() => {
        const sections: Array<
            | { type: "header"; letter: string }
            | { type: "city"; city: ChinaCity }
        > = [];

        ALPHABET.forEach((letter) => {
            if (groupedCities[letter] && groupedCities[letter].length > 0) {
                sections.push({ type: "header", letter });
                groupedCities[letter].forEach((city) => {
                    sections.push({ type: "city", city });
                });
            }
        });

        return sections;
    }, [groupedCities]);

    // 处理字母索引点击
    const handleLetterPress = (letter: string) => {
        if (!flashListRef.current || !groupedCities[letter]) return;

        const targetIndex = flatListData.findIndex(
            (item) => item.type === "header" && item.letter === letter,
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
                    {Array.from(
                        { length: 3 - rowCities.length },
                        (_, index) => (
                            <View
                                key={`empty-${index}`}
                                className="flex-1 mx-1"
                            />
                        ),
                    )}
                </View>,
            );
        }
        return rows;
    };

    // FlashList渲染项目函数
    const renderListItem = ({ item }: { item: (typeof flatListData)[0] }) => {
        if (item.type === "header") {
            return (
                <View className="px-4 py-2 bg-muted/30 border-b border-border/50">
                    <Text className="text-sm font-semibold text-primary">
                        {item.letter}
                    </Text>
                </View>
            );
        } else {
            return <CityItem city={item.city} onPress={handleCitySelect} />;
        }
    };

    // getItemType用于FlashList性能优化
    const getItemType = (item: (typeof flatListData)[0]) => {
        return item.type;
    };

    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            refetchCities({
                throwOnError: false,
            }),
    });

    return (
        <View className="flex-1 bg-background">
            {/* 搜索框 */}
            <View className="px-4 py-3 border-b border-border/50 bg-card shadow-sm">
                <View className="relative">
                    <Search
                        size={20}
                        color="#9CA3AF"
                        style={{
                            position: "absolute",
                            left: 12,
                            top: 12,
                            zIndex: 1,
                        }}
                    />
                    <Input
                        placeholder="搜索城市"
                        value={searchText}
                        onChangeText={handleSearchChange}
                        className="pl-10 rounded-xl bg-muted/30 border-border focus:border-primary focus:bg-background"
                    />
                </View>
            </View>

            {/* 搜索结果或主内容 */}
            {debouncedSearchText.trim() ? (
                <CitySearchErrorBoundary>
                    <View className="h-full">
                        <Suspense
                            fallback={
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
                    {showPageLoading ? (
                        <CitySelectionSkeleton />
                    ) : (
                        <>
                            {/* 当前城市 */}
                            <View className="px-4 py-3.5 border-b border-border/50 bg-card">
                                <Text className="text-xs text-muted-foreground mb-2 font-medium">
                                    当前城市
                                </Text>
                                <View className="flex-row items-center">
                                    <View className="bg-primary/10 rounded-full p-2 mr-2">
                                        <MapPin
                                            size={18}
                                            className="text-primary"
                                        />
                                    </View>
                                    <Text className="text-base font-semibold text-foreground">
                                        {selectedAddress?.district ||
                                            selectedAddress?.city ||
                                            "北京"}
                                    </Text>
                                </View>
                            </View>

                            {/* 热门城市 */}
                            <View className="px-4 py-3.5 border-b border-border/50 bg-background">
                                <Text className="text-xs text-muted-foreground mb-3 font-medium">
                                    热门城市
                                </Text>
                                {renderHotCities()}
                            </View>

                            {/* 字母分组的城市列表 */}
                            <View className="flex-1">
                                <FlashList
                                    ref={flashListRef}
                                    data={flatListData}
                                    renderItem={renderListItem}
                                    keyExtractor={(item) =>
                                        item.type === "header"
                                            ? `header-${item.letter}`
                                            : `city-${item.city.id}`
                                    }
                                    getItemType={getItemType}
                                    showsVerticalScrollIndicator={false}
                                    refreshing={refreshing}
                                    onRefresh={() => {
                                        void onRefresh();
                                    }}
                                />
                            </View>
                        </>
                    )}
                </View>
            )}

            {/* 右侧字母索引 */}
            {!debouncedSearchText.trim() && !showPageLoading && (
                <View className="absolute right-2 top-1/2 -translate-y-[45%]">
                    <View className="bg-card/90 backdrop-blur-sm rounded-xl shadow-lg py-2 px-1 border border-border/50">
                        {ALPHABET.map((letter) => {
                            if (!groupedCities[letter]) return null;

                            return (
                                <Pressable
                                    key={letter}
                                    className={`w-7 h-7 items-center justify-center rounded-lg ${
                                        groupedCities[letter]
                                            ? "active:bg-primary/20"
                                            : "opacity-30"
                                    }`}
                                    disabled={!groupedCities[letter]}
                                    onPress={() => handleLetterPress(letter)}
                                >
                                    <Text
                                        className={`text-xs font-bold ${
                                            groupedCities[letter]
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }`}
                                    >
                                        {letter}
                                    </Text>
                                </Pressable>
                            );
                        })}
                    </View>
                </View>
            )}
        </View>
    );
});
CitySelectionContent.displayName = "CitySelectionContent";

export default function SelectCityScreen() {
    // 立即显示的UI框架，不等待任何数据
    return (
        <View className="flex-1 bg-background">
            {/* 使用Suspense包裹实际内容 */}
            <MainContentErrorBoundary>
                <Suspense fallback={<CitySelectionSkeleton />}>
                    <CitySelectionContent />
                </Suspense>
            </MainContentErrorBoundary>
        </View>
    );
}
