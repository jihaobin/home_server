import { Image, type ImageProps } from "@repo/mobile-ui/components/ui/image";
import { router } from "expo-router";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { HomeSearchResponse } from "@repo/types";

type ImageSource = ImageProps["source"];

type SearchPersonnelServicesData = Extract<
    HomeSearchResponse,
    { mode: "personnel_services" }
>;

function formatDurationLabel(value?: number) {
    if (!value || value <= 0) {
        return null;
    }

    return `约${value}分钟`;
}

export function SearchPersonnelServices({
    data,
}: {
    data: SearchPersonnelServicesData;
}) {
    const avatarSource = useMemo<ImageSource>(
        () =>
            data.matchedPersonnel.avatarUrl
                ? ({
                      uri: data.matchedPersonnel.avatarUrl,
                  } satisfies ImageSource)
                : require("@/assets/images/promo-1.png"),
        [data.matchedPersonnel.avatarUrl],
    );
    const avatarPlaceholder = useMemo(
        () =>
            data.matchedPersonnel.avatarBlurhash
                ? { blurhash: data.matchedPersonnel.avatarBlurhash }
                : undefined,
        [data.matchedPersonnel.avatarBlurhash],
    );

    return (
        <ScrollView
            className="flex-1 bg-background"
            contentContainerStyle={{ padding: 16, paddingBottom: 24 }}
            showsVerticalScrollIndicator={false}
        >
            <View className="overflow-hidden rounded-xl bg-card shadow-sm">
                <View className="flex-row items-center p-4">
                    <View className="h-16 w-16 overflow-hidden rounded-full bg-muted">
                        <Image
                            source={avatarSource}
                            placeholder={avatarPlaceholder}
                            contentFit="cover"
                            transition={200}
                            className="h-16 w-16"
                        />
                    </View>

                    <View className="ml-3 flex-1">
                        <Text className="text-base font-puhui-medium text-foreground">
                            {data.matchedPersonnel.name}
                        </Text>
                        <Text className="mt-1 text-sm font-puhui-regular text-muted-foreground">
                            共 {data.services.length} 项可预约服务
                        </Text>
                    </View>
                </View>
            </View>

            <Text className="mb-3 mt-5 text-base font-puhui-medium text-foreground">
                服务列表
            </Text>

            {!data.services.length ? (
                <View className="rounded-xl bg-card px-4 py-6">
                    <Text className="text-sm font-puhui-regular text-muted-foreground">
                        该服务人员暂无可预约服务
                    </Text>
                </View>
            ) : (
                data.services.map((item) => {
                    const durationLabel = formatDurationLabel(
                        item.estimatedDurationMinutes,
                    );

                    return (
                        <Pressable
                            key={item.pricingId ?? item.serviceId}
                            className="mb-3 overflow-hidden rounded-xl bg-card p-4 shadow-sm"
                            onPress={() =>
                                router.push({
                                    pathname: "/servicePersonnel/[id]",
                                    params: {
                                        id: data.matchedPersonnel.id,
                                        serviceId: item.serviceId,
                                        ...(item.pricingId
                                            ? { pricingId: item.pricingId }
                                            : {}),
                                        serviceName: item.serviceName,
                                        personnelName:
                                            data.matchedPersonnel.name,
                                    },
                                })
                            }
                        >
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 pr-3">
                                    <Text className="text-base font-puhui-medium text-foreground">
                                        {item.serviceName}
                                    </Text>
                                    {durationLabel ? (
                                        <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                            {durationLabel}
                                        </Text>
                                    ) : null}
                                </View>

                                <View className="items-end">
                                    {typeof item.price === "number" ? (
                                        <View className="flex-row items-center">
                                            <Text className="text-xs font-din-alt-bold text-destructive">
                                                ￥
                                            </Text>
                                            <Text className="text-lg font-din-alt-bold text-destructive">
                                                {item.price}
                                            </Text>
                                            <Text className="ml-0.5 text-xs font-puhui-regular text-foreground">
                                                起
                                            </Text>
                                        </View>
                                    ) : (
                                        <Text className="text-sm font-puhui-regular text-primary">
                                            查看详情
                                        </Text>
                                    )}
                                </View>
                            </View>
                        </Pressable>
                    );
                })
            )}
        </ScrollView>
    );
}
