import { type Href, Stack, router } from "expo-router";
import { Heart, MapPin, Star } from "lucide-react-native";
import { Suspense, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Image, type ImageProps } from "@repo/mobile-ui/components/ui/image";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useFavoritePersonnelList } from "@repo/hooks/api/follow";
import type { FavoritePersonnelListItem } from "@repo/types";

type ImageSource = ImageProps["source"];

const TABS_ROUTE = "/(tabs)" as Href;

function FavoritePersonnelSkeleton() {
    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
        >
            {Array.from({ length: 5 }).map((_, index) => (
                <View
                    key={`favorite-personnel-skeleton-${index}`}
                    className="mb-3 overflow-hidden rounded-xl bg-card p-3 shadow-sm"
                >
                    <View className="flex-row">
                        <Skeleton className="h-[88px] w-[88px] rounded-lg" />
                        <View className="ml-3 flex-1">
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 pr-3">
                                    <Skeleton className="h-5 w-24 rounded" />
                                    <Skeleton className="mt-2 h-4 w-20 rounded" />
                                </View>
                                <Skeleton className="h-5 w-12 rounded" />
                            </View>
                            <Skeleton className="mt-3 h-3 w-full rounded" />
                            <Skeleton className="mt-2 h-3 w-3/4 rounded" />
                            <View className="mt-auto flex-row justify-between pt-4">
                                <Skeleton className="h-3 w-20 rounded" />
                                <Skeleton className="h-3 w-16 rounded" />
                            </View>
                        </View>
                    </View>
                </View>
            ))}
        </ScrollView>
    );
}

function EmptyFavoritePersonnel() {
    return (
        <View className="flex-1 items-center justify-center px-8 py-24">
            <View className="h-20 w-20 items-center justify-center rounded-full bg-primary/10">
                <Icon as={Heart} size={36} className="text-primary" />
            </View>
            <Text className="mt-5 text-lg font-puhui-medium text-foreground">
                暂无收藏商户
            </Text>
            <Text className="mt-2 text-center text-sm font-puhui-regular text-muted-foreground">
                去逛逛并收藏感兴趣的服务人员
            </Text>
            <Pressable
                className="mt-6 h-11 min-w-[116px] items-center justify-center rounded-full bg-primary px-6"
                onPress={() => {
                    router.replace(TABS_ROUTE);
                }}
            >
                <Text className="text-sm font-puhui-medium text-primary-foreground">
                    去看看
                </Text>
            </Pressable>
        </View>
    );
}

function FavoritePersonnelCard({ item }: { item: FavoritePersonnelListItem }) {
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

    return (
        <Pressable
            className="mb-3 overflow-hidden rounded-xl bg-card shadow-sm"
            onPress={() =>
                router.push({
                    pathname: "/servicePersonnel/[id]",
                    params: {
                        id: item.personnelId,
                        mock: "massage",
                        ...(item.primaryServiceId
                            ? { serviceId: item.primaryServiceId }
                            : {}),
                        ...(item.primaryPricingId
                            ? { pricingId: item.primaryPricingId }
                            : {}),
                        ...(item.primaryServiceName
                            ? { serviceName: item.primaryServiceName }
                            : {}),
                        personnelName: item.personnelName,
                    },
                })
            }
        >
            <View className="flex-row p-3">
                <View className="h-[88px] w-[88px] overflow-hidden rounded-lg bg-muted">
                    <Image
                        source={avatarSource}
                        placeholder={avatarPlaceholder}
                        contentFit="cover"
                        transition={200}
                        className="h-[88px] w-[88px]"
                    />
                </View>

                <View className="ml-3 flex-1">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-1 pr-3">
                            <Text className="text-base font-puhui-medium text-foreground">
                                {item.personnelName}
                            </Text>
                            <Text className="mt-1 text-xs font-puhui-medium text-primary">
                                {item.primaryServiceName ?? "上门服务"}
                            </Text>
                        </View>

                        <View className="flex-row items-center rounded-full bg-primary/10 px-2 py-0.5">
                            <Icon as={Star} size={12} className="text-primary" />
                            <Text className="ml-1 text-xs font-puhui-medium text-primary">
                                {item.ratingValue.toFixed(1)}
                            </Text>
                        </View>
                    </View>

                    <View className="mt-2 flex-row items-center">
                        <Icon
                            as={MapPin}
                            size={13}
                            className="text-muted-foreground"
                        />
                        <Text
                            className="ml-1 flex-1 text-xs font-puhui-regular text-muted-foreground"
                            numberOfLines={1}
                        >
                            {item.distanceText
                                ? `${item.distanceText} · ${item.addressText}`
                                : item.addressText}
                        </Text>
                    </View>

                    <Text
                        className="mt-1.5 text-xs font-puhui-regular text-muted-foreground"
                        numberOfLines={1}
                    >
                        {item.availableTimeText ?? "可预约"}
                    </Text>

                    <View className="mt-auto flex-row items-center justify-between pt-3">
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            已收藏 {item.favoriteCount}
                        </Text>
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            评价 {item.reviewCount}
                        </Text>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

function FavoritePersonnelContent() {
    const { data } = useFavoritePersonnelList(1, 10);

    if (!data.items.length) {
        return <EmptyFavoritePersonnel />;
    }

    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
        >
            {data.items.map((item) => (
                <FavoritePersonnelCard key={item.personnelId} item={item} />
            ))}
        </ScrollView>
    );
}

export default function FavoritePersonnelScreen() {
    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <Stack.Screen
                    options={{
                        title: "收藏商户",
                        headerShown: true,
                    }}
                />
                <Suspense fallback={<FavoritePersonnelSkeleton />}>
                    <FavoritePersonnelContent />
                </Suspense>
            </View>
        </RequireAuth>
    );
}
