import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { cssInterop } from "nativewind";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { HomeSearchResponse } from "@repo/types";

cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

type ImageSource = React.ComponentProps<typeof ExpoImage>["source"];

type SearchPersonnelListData = Extract<
    HomeSearchResponse,
    { mode: "personnel_list" }
>;

function formatDistanceKm(distanceKm: number) {
    if (!Number.isFinite(distanceKm) || distanceKm <= 0) {
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

const WEEKDAY_BY_DIGIT: Record<string, string> = {
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
    "7": "周日",
};

function formatWorkDays(value: string) {
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
    return uniqueSorted
        .map((digit) => WEEKDAY_BY_DIGIT[digit] ?? digit)
        .join("、");
}

function formatTimeHHmm(value: string) {
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

function PersonnelCard({
    item,
}: {
    item: SearchPersonnelListData["personnel"][number];
}) {
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

    const distanceText = formatDistanceKm(item.distanceKm);
    const scheduleText = `${formatWorkDays(item.workDays)}——${formatTimeHHmm(item.workStartTime)}-${formatTimeHHmm(item.workEndTime)}`;
    const matchedServiceName = item.serviceName ?? item.tag;

    return (
        <Pressable
            className="mb-3 overflow-hidden rounded-xl bg-card shadow-sm"
            onPress={() =>
                router.push({
                    pathname: "/servicePersonnel/[id]",
                    params: {
                        id: item.personnelId,
                        ...(item.serviceId
                            ? { serviceId: item.serviceId }
                            : {}),
                        ...(item.pricingId
                            ? { pricingId: item.pricingId }
                            : {}),
                        ...(matchedServiceName
                            ? { serviceName: matchedServiceName }
                            : {}),
                        personnelName: item.name,
                    },
                })
            }
        >
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
                        <View className="flex-1 pr-3">
                            <Text className="text-sm font-puhui-regular text-foreground">
                                {item.name}
                            </Text>
                            <Text className="mt-1 text-xs font-puhui-medium text-primary">
                                {matchedServiceName}
                            </Text>
                        </View>

                        <View className="rounded border border-primary px-1 py-0.5">
                            <Text className="text-xs font-puhui-regular text-primary">
                                {item.tag}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-2 flex-row items-center">
                        {distanceText ? (
                            <Text className="text-xs font-puhui-medium text-primary">
                                {distanceText}
                            </Text>
                        ) : null}
                        {distanceText && item.addressText ? (
                            <Text className="text-xs font-puhui-regular text-muted-foreground">
                                {"  ·  "}
                            </Text>
                        ) : null}
                        <Text
                            className="flex-1 text-xs font-puhui-regular text-muted-foreground"
                            numberOfLines={1}
                        >
                            {item.addressText}
                        </Text>
                    </View>

                    <Text
                        className="mt-1.5 text-xs font-puhui-regular text-muted-foreground"
                        numberOfLines={2}
                    >
                        {scheduleText}
                    </Text>

                    <View className="mt-auto flex-row items-end justify-between">
                        <View className="flex-row items-center">
                            <Text className="text-xs font-din-alt-bold text-destructive">
                                ￥
                            </Text>
                            <Text className="text-lg font-din-alt-bold text-destructive">
                                {item.minPrice}
                            </Text>
                            <Text className="ml-0.5 text-xs font-puhui-regular text-foreground">
                                起
                            </Text>
                        </View>

                        <View className="h-5 w-16 items-center justify-center rounded-full bg-primary">
                            <Text className="text-xs font-puhui-medium text-primary-foreground">
                                立即预约
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

type SearchPersonnelListProps = {
    data: SearchPersonnelListData;
    isLoadingMore: boolean;
    loadMoreError: boolean;
    onLoadMore: () => void;
    onRetryLoadMore: () => void;
};

export function SearchPersonnelList({
    data,
    isLoadingMore,
    loadMoreError,
    onLoadMore,
    onRetryLoadMore,
}: SearchPersonnelListProps) {
    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
        >
            <View className="mb-4 rounded-xl bg-card px-4 py-4">
                <Text className="text-base font-puhui-medium text-foreground">
                    {data.serviceHint?.serviceName ?? data.keyword}
                </Text>
                <Text className="mt-1 text-sm font-puhui-regular text-muted-foreground">
                    为你找到 {data.personnel.length} 位相关服务人员
                </Text>
            </View>

            {!data.personnel.length ? (
                <View className="rounded-xl bg-card px-4 py-6">
                    <Text className="text-sm font-puhui-regular text-muted-foreground">
                        未找到相关服务人员
                    </Text>
                </View>
            ) : (
                data.personnel.map((item) => (
                    <PersonnelCard
                        key={`${item.personnelId}-${item.pricingId ?? item.serviceId ?? item.tag}`}
                        item={item}
                    />
                ))
            )}

            {loadMoreError ? (
                <View className="mt-2 items-center">
                    <Pressable
                        className="rounded-xl border border-border bg-card px-4 py-3"
                        onPress={onRetryLoadMore}
                    >
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            加载更多失败，点击重试
                        </Text>
                    </Pressable>
                </View>
            ) : null}

            {data.personnel.length && data.hasMore ? (
                <View className="mt-2 items-center">
                    <Pressable
                        className="rounded-xl bg-card px-4 py-3"
                        onPress={onLoadMore}
                    >
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            {isLoadingMore ? "加载中..." : "加载更多"}
                        </Text>
                    </Pressable>
                </View>
            ) : null}
        </ScrollView>
    );
}
