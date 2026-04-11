import { Text } from "@repo/mobile-ui/components/ui/text";
import { useHomeSearchResult } from "@repo/hooks/api/home";
import type { HomeSearchResponse } from "@repo/types";
import { useLocalSearchParams } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, View } from "react-native";
import { SearchPersonnelList } from "@/components/search/SearchPersonnelList";
import { SearchPersonnelServices } from "@/components/search/SearchPersonnelServices";
import { normalizeSearchKeyword } from "@/lib/search-history";
import { useHomeLocationStore } from "@/stores/home-location-store";

type SearchPersonnelListResponse = Extract<
    HomeSearchResponse,
    { mode: "personnel_list" }
>;

type SearchPersonnelServicesResponse = Extract<
    HomeSearchResponse,
    { mode: "personnel_services" }
>;

const PAGE_LIMIT = 20;

function readStringParam(value?: string | string[]) {
    if (Array.isArray(value)) {
        return value[0] ? String(value[0]) : undefined;
    }

    return value ? String(value) : undefined;
}

function buildPersonnelKey(
    item: SearchPersonnelListResponse["personnel"][number],
) {
    return `${item.personnelId}-${item.pricingId ?? item.serviceId ?? item.tag}`;
}

export default function SearchResultScreen() {
    const params = useLocalSearchParams<{
        keyword?: string | string[];
        personnelId?: string | string[];
        serviceId?: string | string[];
    }>();
    const selectedLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );

    const keyword = normalizeSearchKeyword(
        readStringParam(params.keyword) ?? "",
    );
    const personnelId = readStringParam(params.personnelId);
    const serviceId = readStringParam(params.serviceId);
    const requestKey = `${keyword}::${personnelId ?? ""}::${serviceId ?? ""}`;

    const [page, setPage] = useState(1);
    const [personnelData, setPersonnelData] =
        useState<SearchPersonnelListResponse | null>(null);
    const [personnelServicesData, setPersonnelServicesData] =
        useState<SearchPersonnelServicesResponse | null>(null);

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

    useEffect(() => {
        setPage(1);
        setPersonnelData(null);
        setPersonnelServicesData(null);
    }, [requestKey]);

    const resultQuery = useHomeSearchResult(
        {
            keyword,
            page,
            limit: PAGE_LIMIT,
            ...(personnelId ? { personnelId } : {}),
            ...(serviceId ? { serviceId } : {}),
            ...(resolvedCoords
                ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
                : {}),
        },
        { enabled: Boolean(keyword) },
    );

    useEffect(() => {
        const data = resultQuery.data;
        if (!data) {
            return;
        }

        if (data.mode === "personnel_services") {
            setPersonnelServicesData(data);
            setPersonnelData(null);
            return;
        }

        setPersonnelServicesData(null);
        setPersonnelData((previous) => {
            if (!previous || page === 1) {
                return data;
            }

            const seen = new Set(previous.personnel.map(buildPersonnelKey));
            const nextItems = data.personnel.filter(
                (item) => !seen.has(buildPersonnelKey(item)),
            );

            return {
                ...data,
                personnel: [...previous.personnel, ...nextItems],
            };
        });
    }, [page, resultQuery.data]);

    const activeData = personnelServicesData ?? personnelData;
    const isInitialLoading = resultQuery.isLoading && !activeData;
    const isInitialError = resultQuery.isError && !activeData;
    const isLoadingMore = page > 1 && resultQuery.isFetching;
    const loadMoreError = page > 1 && resultQuery.isError;

    const handleRetry = useCallback(() => {
        void resultQuery.refetch({ throwOnError: false });
    }, [resultQuery]);

    const handleLoadMore = useCallback(() => {
        if (
            !personnelData ||
            !personnelData.hasMore ||
            isLoadingMore ||
            resultQuery.isFetching
        ) {
            return;
        }

        setPage(personnelData.nextPage ?? personnelData.page + 1);
    }, [isLoadingMore, personnelData, resultQuery.isFetching]);

    if (!keyword) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-base font-puhui-medium text-foreground">
                    缺少搜索关键词
                </Text>
                <Text className="mt-2 text-sm font-puhui-regular text-muted-foreground">
                    请返回搜索页重新输入关键词
                </Text>
            </View>
        );
    }

    if (isInitialLoading) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-base font-puhui-medium text-foreground">
                    搜索中...
                </Text>
                <Text className="mt-2 text-sm font-puhui-regular text-muted-foreground">
                    正在为你查找相关结果
                </Text>
            </View>
        );
    }

    if (isInitialError) {
        return (
            <View className="flex-1 items-center justify-center bg-background px-6">
                <Text className="text-base font-puhui-medium text-foreground">
                    搜索结果加载失败
                </Text>
                <Text className="mt-2 text-center text-sm font-puhui-regular text-muted-foreground">
                    请稍后重试，或返回搜索页重新发起搜索
                </Text>
                <Pressable
                    className="mt-4 rounded-xl bg-primary px-5 py-3"
                    onPress={handleRetry}
                >
                    <Text className="text-sm font-puhui-medium text-primary-foreground">
                        重新加载
                    </Text>
                </Pressable>
            </View>
        );
    }

    if (personnelServicesData) {
        return <SearchPersonnelServices data={personnelServicesData} />;
    }

    if (personnelData) {
        return (
            <SearchPersonnelList
                data={personnelData}
                isLoadingMore={isLoadingMore}
                loadMoreError={loadMoreError}
                onLoadMore={handleLoadMore}
                onRetryLoadMore={handleRetry}
            />
        );
    }

    return (
        <View className="flex-1 items-center justify-center bg-background px-6">
            <Text className="text-base font-puhui-medium text-foreground">
                暂无搜索结果
            </Text>
        </View>
    );
}
