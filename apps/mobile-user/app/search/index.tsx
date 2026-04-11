import { Input } from "@repo/mobile-ui/components/ui/input";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useHomeSearchSuggestions } from "@repo/hooks/api/home";
import { useDebounce } from "@repo/hooks/useDebounceThrottle";
import { router, useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SearchHistorySection } from "@/components/search/SearchHistorySection";
import { SearchSuggestionList } from "@/components/search/SearchSuggestionList";
import {
    clearSearchHistory,
    getSearchHistory,
    normalizeSearchKeyword,
    recordSearchKeyword,
    removeSearchHistoryItem,
} from "@/lib/search-history";
import { useHomeLocationStore } from "@/stores/home-location-store";

type SearchSubmitExtra = {
    personnelId?: string;
    serviceId?: string;
};

export default function SearchScreen() {
    const [keyword, setKeyword] = useState("");
    const [history, setHistory] = useState<string[]>([]);
    const selectedLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );

    const debouncedKeyword = useDebounce(keyword, 300);
    const normalizedInputKeyword = normalizeSearchKeyword(keyword);
    const normalizedDebouncedKeyword = normalizeSearchKeyword(debouncedKeyword);

    const resolvedCoords = useMemo(() => {
        if (
            selectedLocation &&
            Number.isFinite(selectedLocation.lat) &&
            Number.isFinite(selectedLocation.lng) &&
            (selectedLocation.lat !== 0 || selectedLocation.lng !== 0)
        ) {
            return {
                lat: selectedLocation.lat,
                lng: selectedLocation.lng,
            };
        }

        return null;
    }, [selectedLocation]);

    const refreshHistory = useCallback(() => {
        setHistory(getSearchHistory());
    }, []);

    useFocusEffect(
        useCallback(() => {
            refreshHistory();
        }, [refreshHistory]),
    );

    const suggestionQuery = useHomeSearchSuggestions(
        {
            keyword: normalizedDebouncedKeyword,
            limit: 10,
            ...(resolvedCoords
                ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
                : {}),
        },
        { enabled: Boolean(normalizedDebouncedKeyword) },
    );

    const isWaitingForDebounce =
        Boolean(normalizedInputKeyword) &&
        normalizedInputKeyword !== normalizedDebouncedKeyword;

    const handleSubmitKeyword = useCallback(
        (rawKeyword: string, extra?: SearchSubmitExtra) => {
            const nextKeyword = normalizeSearchKeyword(rawKeyword);
            if (!nextKeyword) {
                return;
            }

            const nextHistory = recordSearchKeyword(nextKeyword);
            setHistory(nextHistory);

            router.push({
                pathname: "/search/result",
                params: {
                    keyword: nextKeyword,
                    ...(extra?.personnelId
                        ? { personnelId: extra.personnelId }
                        : {}),
                    ...(extra?.serviceId ? { serviceId: extra.serviceId } : {}),
                },
            });
        },
        [],
    );

    const handleDeleteHistoryItem = useCallback((item: string) => {
        const nextHistory = removeSearchHistoryItem(item);
        setHistory(nextHistory);
    }, []);

    const handleClearAllHistory = useCallback(() => {
        clearSearchHistory();
        setHistory([]);
    }, []);

    return (
        <View className="flex-1 bg-background">
            <View className="border-b border-border bg-card px-4 py-3">
                <View className="flex-row items-center gap-3">
                    <View className="flex-1 flex-row items-center rounded-xl border border-border bg-muted/30 px-3">
                        <Input
                            placeholder="搜索服务或服务人员"
                            value={keyword}
                            onChangeText={setKeyword}
                            onSubmitEditing={() => handleSubmitKeyword(keyword)}
                            returnKeyType="search"
                            autoFocus
                            className="h-10 flex-1 border-0 bg-transparent px-0"
                        />

                        {normalizedInputKeyword ? (
                            <Pressable
                                className="ml-2 rounded-full border border-border px-3 py-1.5"
                                onPress={() => setKeyword("")}
                            >
                                <Text className="text-xs font-puhui-regular text-muted-foreground">
                                    清空
                                </Text>
                            </Pressable>
                        ) : null}
                    </View>

                    <Pressable
                        className="h-10 items-center justify-center rounded-xl bg-primary px-4"
                        onPress={() => handleSubmitKeyword(keyword)}
                    >
                        <Text className="text-sm font-puhui-medium text-primary-foreground">
                            搜索
                        </Text>
                    </Pressable>
                </View>

                {normalizedInputKeyword && suggestionQuery.isError ? (
                    <Text className="mt-3 text-sm font-puhui-regular text-muted-foreground">
                        联想加载失败，你仍可直接搜索当前关键词
                    </Text>
                ) : null}
            </View>

            {normalizedInputKeyword ? (
                <SearchSuggestionList
                    keyword={normalizedInputKeyword}
                    suggestions={suggestionQuery.data?.suggestions ?? []}
                    isLoading={
                        isWaitingForDebounce ||
                        suggestionQuery.isLoading ||
                        suggestionQuery.isFetching
                    }
                    isError={suggestionQuery.isError}
                    onSelectSuggestion={(item) =>
                        handleSubmitKeyword(item.label, {
                            personnelId: item.personnelId,
                            serviceId: item.serviceId,
                        })
                    }
                />
            ) : (
                <SearchHistorySection
                    history={history}
                    onPressKeyword={handleSubmitKeyword}
                    onDeleteKeyword={handleDeleteHistoryItem}
                    onClearAll={handleClearAllHistory}
                />
            )}
        </View>
    );
}
