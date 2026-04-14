import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { useRouter } from "expo-router";
import { cssInterop } from "nativewind";
import { useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import {
    MASSAGE_DETAIL_THEME,
    getMassageServicePersonnelDetail,
    type MassageDetailMetric,
    type MassageDetailReview,
    type MassageDetailService,
} from "@/components/massage/mock";
import {
    ReviewStarsRow,
    ServicePersonnelReviewList,
    type ServicePersonnelReviewItem,
} from "@/components/service-personnel/service-personnel-review-list";
import { ChevronLeft } from "lucide-react-native";

cssInterop(ExpoImage, { className: { target: "style" } });

const Image = ExpoImage as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

const CONTENT_GRADIENT_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 375 140" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="detailGradient" x1="187.5" y1="0" x2="187.5" y2="140" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE8C9"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><rect width="375" height="140" fill="url(#detailGradient)"/></svg>`;
const SERVICE_GUARANTEE_DIVIDER_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 1 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0V19" stroke="#F2F2F2"/></svg>`;
const SERVICE_GUARANTEE_ITEM_ICON_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z" stroke="#FF6900" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 6L5.5 7L7.5 5" stroke="#FF6900" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

function ServiceTag({ label }: { label: string }) {
    return (
        <View
            className="h-5 items-center justify-center rounded px-2"
            style={{ backgroundColor: "#ffedd4" }}
        >
            <Text className="text-xs font-puhui-regular text-[#f54900]">
                {label}
            </Text>
        </View>
    );
}

function DetailMetricItem({ item }: { item: MassageDetailMetric }) {
    return (
        <View className="flex-1 items-center justify-center">
            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                {item.label}
            </Text>
            <Text className="mt-1 text-sm font-puhui-medium text-[#101828]">
                {item.value}
            </Text>
        </View>
    );
}

function GuaranteeItem({ label }: { label: string }) {
    return (
        <View className="h-5 w-[76px] flex-row items-center">
            <SvgXml
                xml={SERVICE_GUARANTEE_ITEM_ICON_XML}
                width={12}
                height={12}
            />
            <Text className="ml-1 text-xs font-puhui-regular text-[#364153]">
                {label}
            </Text>
        </View>
    );
}

function MockServiceCard({ item }: { item: MassageDetailService }) {
    return (
        <View
            className="border-b px-4 pb-4 pt-4"
            style={{
                borderBottomColor: MASSAGE_DETAIL_THEME.separator,
            }}
        >
            <View className="flex-row">
                <View className="relative h-24 w-24 overflow-hidden rounded-[14px] bg-muted">
                    <Image
                        source={item.imageSource}
                        contentFit="cover"
                        className="h-full w-full"
                    />
                </View>

                <View className="ml-4 flex-1 justify-between">
                    <View>
                        <Text className="text-base font-puhui-medium text-[#101828]">
                            {item.name}
                        </Text>
                        <View className="mt-1 flex-row" style={{ gap: 4 }}>
                            {item.tags.map((tag) => (
                                <ServiceTag
                                    key={`${item.id}-${tag}`}
                                    label={tag}
                                />
                            ))}
                            <ServiceTag label={item.duration} />
                        </View>
                    </View>

                    <View className="flex-row items-end justify-between">
                        <View className="flex-row items-end">
                            <Text className="pb-1 text-xs font-puhui-medium ">
                                ￥
                            </Text>
                            <Text className="text-[24px] font-din-alt-bold leading-[28px] text-primary">
                                {item.price}
                            </Text>
                            <Text className="ml-2 pb-1 text-sm font-puhui-regular line-through text-[#99a1af]">
                                ￥{item.originalPrice}
                            </Text>
                        </View>

                        <View className="h-9 min-w-[90px] items-center justify-center rounded-full px-4 bg-primary">
                            <Text className="text-sm font-puhui-medium text-white">
                                {item.actionLabel}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </View>
    );
}

function ReviewMetric({ item }: { item: MassageDetailMetric }) {
    return (
        <View className="items-start">
            <Text className="text-xs font-puhui-regular text-[#999999]">
                {item.label}
            </Text>
            <Text className="mt-1 text-sm font-puhui-medium text-[#211f1c]">
                {item.value}
            </Text>
        </View>
    );
}

function toMockReviewItem(
    item: MassageDetailReview,
): ServicePersonnelReviewItem {
    return {
        id: item.id,
        rating: 5,
        ratingLabel: item.ratingLabel,
        comment: item.comment,
        createdAt: item.date,
        reviewerName: item.userName,
        images: item.imageSources.map((imageSource) => ({
            source: imageSource,
        })),
    };
}

function orderServicesBySelection(
    services: readonly MassageDetailService[],
    serviceId: string,
    serviceName: string,
) {
    const matched = services.find(
        (item) => item.id === serviceId || item.name === serviceName,
    );

    if (!matched) {
        return [...services];
    }

    return [matched, ...services.filter((item) => item.id !== matched.id)];
}

type MockServicePersonnelScreenProps = {
    personnelId: string;
    serviceId: string;
    pricingId: string;
    serviceName: string;
    personnelName: string;
};

export function MockServicePersonnelScreen({
    personnelId,
    serviceId,
    pricingId: _pricingId,
    serviceName,
    personnelName,
}: MockServicePersonnelScreenProps) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const detail = getMassageServicePersonnelDetail(personnelId);
    const displayName = personnelName || detail.personnelName;
    const orderedServices = orderServicesBySelection(
        detail.services,
        serviceId,
        serviceName,
    );
    const normalizedReviews = useMemo(
        () => detail.reviews.map(toMockReviewItem),
        [detail.reviews],
    );

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: MASSAGE_DETAIL_THEME.pageBackground }}
        >
            <ScrollView
                className="flex-1"
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
                style={{
                    backgroundColor: MASSAGE_DETAIL_THEME.pageBackgroundSoft,
                }}
            >
                <View className="relative h-[384px] overflow-hidden bg-[#f3f4f6]">
                    <Image
                        source={detail.heroImageSource}
                        contentFit="cover"
                        className="h-full w-full"
                    />

                    <Pressable
                        className="absolute left-4 h-8 w-8 items-center justify-center rounded-full"
                        onPress={() => router.back()}
                        style={{
                            top: Math.max(insets.top + 4, 48),
                            backgroundColor: "rgba(255,255,255,0.8)",
                        }}
                    >
                        <Icon
                            as={ChevronLeft}
                            size={18}
                            className="text-foreground"
                        />
                    </Pressable>
                </View>

                <View className="-mt-16 rounded-t-[24px] bg-white">
                    <View className="absolute left-0 right-0 top-0 h-[140px] overflow-hidden rounded-t-[24px]">
                        <SvgXml
                            xml={CONTENT_GRADIENT_XML}
                            width="100%"
                            height="100%"
                        />
                    </View>

                    <View className="px-4 pt-4">
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 flex-row">
                                <View className="h-16 w-16 overflow-hidden rounded-[14px] border-2 border-white bg-[#f3f4f6]">
                                    <Image
                                        source={detail.avatarImageSource}
                                        contentFit="cover"
                                        className="h-full w-full"
                                    />
                                </View>

                                <View className="ml-4 flex-1 pt-1">
                                    <Text className="text-[20px] font-puhui-medium text-[#101828]">
                                        {displayName}
                                    </Text>
                                    <Text className="mt-1 text-xs font-puhui-regular text-[#6a7282]">
                                        地址：{detail.address}
                                    </Text>
                                </View>
                            </View>

                            <View
                                className="h-9 min-w-20 items-center justify-center rounded-full px-4"
                                style={{ backgroundColor: "#f7951b" }}
                            >
                                <Text className="text-sm font-puhui-medium text-white">
                                    收藏
                                </Text>
                            </View>
                        </View>

                        <View className="mt-4 flex-row items-center justify-between">
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                {detail.yearlyOrders}
                            </Text>
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                {detail.favoriteCount}
                            </Text>
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                {detail.distance}
                            </Text>
                        </View>

                        <View className="mt-2 flex-row items-center justify-end">
                            <Text className="text-xs font-puhui-regular text-[#fd831f]">
                                {detail.availability}
                            </Text>
                        </View>
                    </View>

                    <View className="bg-white px-4 pb-3 pt-2">
                        <View
                            className="rounded-[8px] border px-1 py-1"
                            style={{
                                backgroundColor: "#fff9f1",
                                borderColor: "#efd1a8",
                            }}
                        >
                            <View className="flex-row">
                                {detail.stats.map((item) => (
                                    <DetailMetricItem
                                        key={item.label}
                                        item={item}
                                    />
                                ))}
                            </View>
                        </View>

                        <Text className="mt-2 text-sm font-puhui-regular text-[#364153]">
                            {detail.description}
                        </Text>
                    </View>

                    <View
                        className="h-[35px] flex-row items-center"
                        style={{ backgroundColor: "#fff9f1" }}
                    >
                        <View className="ml-4 h-8 w-[88px] flex-row items-center">
                            <Image
                                source={require("@/assets/images/guarantee-service-title.png")}
                                contentFit="contain"
                                className="h-6 w-6"
                            />
                            <Text className="text-base font-puhui-medium text-[#101828]">
                                服务保障
                            </Text>
                        </View>

                        <View className="h-[19px] w-px">
                            <SvgXml
                                xml={SERVICE_GUARANTEE_DIVIDER_XML}
                                width="100%"
                                height="100%"
                            />
                        </View>

                        <View
                            className="ml-[14px] flex-row items-center justify-end"
                            style={{ gap: 9 }}
                        >
                            {detail.guaranteeItems.map((item) => (
                                <GuaranteeItem key={item} label={item} />
                            ))}
                        </View>
                    </View>

                    <View
                        className="h-4"
                        style={{
                            backgroundColor:
                                MASSAGE_DETAIL_THEME.pageBackgroundSoft,
                        }}
                    />

                    <View
                        className="h-[50px] flex-row items-center border-b px-4"
                        style={{
                            borderBottomColor: MASSAGE_DETAIL_THEME.separator,
                        }}
                    >
                        <View className="mr-6 h-[25px] border-b-[3px] border-[#ffba59]">
                            <Text className="text-lg font-puhui-medium text-[#101828]">
                                推荐项目
                            </Text>
                        </View>
                        <Text className="text-base font-puhui-medium text-[#99a1af]">
                            全部项目
                        </Text>
                    </View>

                    <View className="bg-white">
                        {orderedServices.map((item) => (
                            <MockServiceCard key={item.id} item={item} />
                        ))}
                    </View>

                    <View
                        className="h-4"
                        style={{
                            backgroundColor:
                                MASSAGE_DETAIL_THEME.pageBackgroundSoft,
                        }}
                    />

                    <View className="bg-white pt-4">
                        <ServicePersonnelReviewList
                            reviewCount={detail.reviewCount}
                            reviews={normalizedReviews}
                            enableGallery={false}
                            summary={
                                <View className="mt-4 px-4">
                                    <View className="flex-row items-start">
                                        <Text className="text-[32px] font-din-alt-bold text-[#f7951b]">
                                            {detail.reviewScore}
                                        </Text>

                                        <View className="ml-4 flex-1">
                                            <View className="flex-row items-center">
                                                <Text className="mr-2 text-xs font-puhui-regular text-[#999999]">
                                                    商家评分
                                                </Text>
                                                <ReviewStarsRow rating={5} />
                                            </View>

                                            <View className="mt-3 flex-row justify-between">
                                                {detail.reviewMetrics.map(
                                                    (item) => (
                                                        <ReviewMetric
                                                            key={item.label}
                                                            item={item}
                                                        />
                                                    ),
                                                )}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            }
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
