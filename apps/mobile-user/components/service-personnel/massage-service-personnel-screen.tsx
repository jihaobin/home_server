import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { useMassagePersonnelDetail } from "@repo/hooks/api/massage";
import {
    useFavoritePersonnel,
    usePersonnelFavoriteSummary,
    useUnfavoritePersonnel,
} from "@repo/hooks/api/follow";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "@repo/mobile-ui/lib/toast";
import { cssInterop } from "nativewind";
import { Suspense, useMemo, useRef } from "react";
import { Pressable, ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import {
    ReviewStarsRow,
    ServicePersonnelReviewList,
    type ServicePersonnelReviewItem,
} from "@/components/service-personnel/service-personnel-review-list";
import { useHomeLocationStore } from "@/stores/home-location-store";
import { ChevronLeft } from "lucide-react-native";
import { useRouter } from "expo-router";

cssInterop(ExpoImage, { className: { target: "style" } });

const Image = ExpoImage as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

const MASSAGE_DETAIL_THEME = {
    pageBackground: "#f4f5f7",
    pageBackgroundSoft: "#f9fafb",
    separator: "#edf0f3",
} as const;

const CONTENT_GRADIENT_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 375 140" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="detailGradient" x1="187.5" y1="0" x2="187.5" y2="140" gradientUnits="userSpaceOnUse"><stop stop-color="#FFE8C9"/><stop offset="1" stop-color="#FFFFFF"/></linearGradient></defs><rect width="375" height="140" fill="url(#detailGradient)"/></svg>`;
const SERVICE_GUARANTEE_DIVIDER_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 1 19" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M0.5 0V19" stroke="#F2F2F2"/></svg>`;
const SERVICE_GUARANTEE_ITEM_ICON_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M6 11C8.76142 11 11 8.76142 11 6C11 3.23858 8.76142 1 6 1C3.23858 1 1 3.23858 1 6C1 8.76142 3.23858 11 6 11Z" stroke="#FF6900" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/><path d="M4.5 6L5.5 7L7.5 5" stroke="#FF6900" stroke-width="1.33333" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

const SERVICE_GUARANTEE_ITEMS = ['契约包退', '实名认证', '资质证书'] as const;

type DetailMetric = {
    label: string;
    value: string;
};

type DetailService = {
    id: string;
    name: string;
    pricingId: string | null;
    tags: readonly string[];
    duration: string;
    price: number;
    originalPrice: number;
    actionLabel: string;
    imageUrl: string | null;
    imageBlurhash?: string | null;
};

function formatPercent(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "--";
    }
    if (value <= 1) {
        return `${Math.round(value * 100)}%`;
    }
    return `${Math.round(value)}%`;
}

function toOneDecimal(value: number | null | undefined): string {
    if (value === null || value === undefined || Number.isNaN(value)) {
        return "--";
    }
    return value.toFixed(1);
}

function orderServicesBySelection(
    services: readonly DetailService[],
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

function DetailMetricItem({ item }: { item: DetailMetric }) {
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

function GuaranteeItem({
    label,
    onPress,
}: {
    label: string;
    onPress?: () => void;
}) {
    const content = (
        <>
            <SvgXml
                xml={SERVICE_GUARANTEE_ITEM_ICON_XML}
                width={12}
                height={12}
            />
            <Text className="ml-1 text-xs font-puhui-regular text-[#364153]">
                {label}
            </Text>
        </>
    );

    if (onPress) {
        return (
            <Pressable
                className="h-5 w-[76px] flex-row items-center"
                hitSlop={8}
                onPress={onPress}
            >
                {content}
            </Pressable>
        );
    }

    return <View className="h-5 w-[76px] flex-row items-center">{content}</View>;
}

function ServiceCard({
    item,
    onPress,
}: {
    item: DetailService;
    onPress: () => void;
}) {
    return (
        <Pressable
            className="border-b px-4 pb-4 pt-4"
            style={{ borderBottomColor: MASSAGE_DETAIL_THEME.separator }}
            onPress={onPress}
        >
            <View className="flex-row">
                <View className="relative h-24 w-24 overflow-hidden rounded-[14px] bg-muted">
                    <Image
                        source={
                            item.imageUrl
                                ? { uri: item.imageUrl }
                                : require("@/assets/images/massage-project.png")
                        }
                        placeholder={
                            item.imageUrl && item.imageBlurhash
                                ? { blurhash: item.imageBlurhash }
                                : undefined
                        }
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
                                <ServiceTag key={`${item.id}-${tag}`} label={tag} />
                            ))}
                            {item.duration ? <ServiceTag label={item.duration} /> : null}
                        </View>
                    </View>

                    <View className="flex-row items-end justify-between">
                        <View className="flex-row items-end">
                            <Text className="pb-1 text-xs font-puhui-medium">￥</Text>
                            <Text className="text-[24px] font-din-alt-bold leading-[28px] text-primary">
                                {item.price}
                            </Text>
                            <Text className="ml-2 pb-1 text-sm font-puhui-regular line-through text-[#99a1af]">
                                ￥{item.originalPrice}
                            </Text>
                        </View>

                        <View className="h-9 min-w-[90px] items-center justify-center rounded-full bg-primary px-4">
                            <Text className="text-sm font-puhui-medium text-white">
                                {item.actionLabel}
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

function ReviewMetric({ item }: { item: DetailMetric }) {
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

function MassageServicePersonnelContent({
    personnelId,
    serviceId,
    pricingId,
    serviceName,
    personnelName,
}: {
    personnelId: string;
    serviceId: string;
    pricingId: string;
    serviceName: string;
    personnelName: string;
}) {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const selectedHomeLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );

    const resolvedCoords = useMemo(() => {
        if (
            selectedHomeLocation &&
            Number.isFinite(selectedHomeLocation.lat) &&
            Number.isFinite(selectedHomeLocation.lng)
        ) {
            return {
                lat: selectedHomeLocation.lat,
                lng: selectedHomeLocation.lng,
            };
        }
        return null;
    }, [selectedHomeLocation]);

    const detail = useMassagePersonnelDetail(personnelId, {
        serviceId: serviceId || undefined,
        pricingId: pricingId || undefined,
        ...(resolvedCoords
            ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
            : {}),
    }).data;

    const favoriteSummary = usePersonnelFavoriteSummary(personnelId).data;
    const favoritePersonnel = useFavoritePersonnel(personnelId);
    const unfavoritePersonnel = useUnfavoritePersonnel(personnelId);
    const isFavoriteMutating =
        favoritePersonnel.isPending || unfavoritePersonnel.isPending;
    const favoriteActionLockRef = useRef(false);
    const displayName = personnelName || detail.personnelName;

    const orderedServices = useMemo<DetailService[]>(
        () =>
            orderServicesBySelection(
                detail.services.map((item) => ({
                    id: item.serviceId,
                    name: item.serviceName,
                    pricingId: item.pricingId,
                    tags: item.tags,
                    duration: item.durationMinutes
                        ? `${item.durationMinutes}分钟`
                        : "",
                    price: item.price ?? 0,
                    originalPrice: item.originalPrice ?? (item.price ?? 0),
                    actionLabel: item.actionLabel,
                    imageUrl: item.imageUrl,
                    imageBlurhash: item.imageBlurhash ?? null,
                })),
                serviceId,
                serviceName,
            ),
        [detail.services, serviceId, serviceName],
    );

    const normalizedReviews = useMemo<ServicePersonnelReviewItem[]>(
        () =>
            detail.topReviews.map((review) => ({
                id: review.id,
                rating: review.rating,
                ratingLabel: review.ratingLabel ?? undefined,
                comment: review.comment,
                createdAt: review.createdAt,
                reviewerName: review.reviewerName ?? undefined,
                images: review.images.map((image) => ({
                    url: image.url,
                    blurhash: image.blurhash ?? undefined,
                })),
            })),
        [detail.topReviews],
    );

    const stats = useMemo<DetailMetric[]>(
        () => [
            {
                label: "入驻",
                value: `${detail.stats.yearsOfExperience}年以上`,
            },
            {
                label: "手法",
                value: toOneDecimal(detail.stats.averageServiceQuality),
            },
            {
                label: "回头率",
                value: formatPercent(detail.stats.repurchaseRate),
            },
            {
                label: "满意度",
                value: `${detail.stats.goodRatePercentage}%`,
            },
        ],
        [detail.stats],
    );

    const reviewMetrics = useMemo<DetailMetric[]>(
        () => [
            {
                label: "服务态度",
                value: toOneDecimal(detail.reviewSummary.averageAttitude),
            },
            {
                label: "技术",
                value: toOneDecimal(detail.reviewSummary.averageSkill),
            },
            {
                label: "客户满意度",
                value: `${detail.reviewSummary.customerSatisfactionRate}%`,
            },
        ],
        [detail.reviewSummary],
    );

    const heroImage = detail.galleryImages[0];

    function onPressAllReviews(): void {
        router.push({
            pathname: "/servicePersonnel/reviews",
            params: {
                personnelId,
                serviceId,
                serviceName,
            },
        });
    }

    function handlePressQualificationCertificates(): void {
        router.push({
            pathname: "./qualification-certificates",
            params: {
                personnelId,
            },
        });
    }

    function handlePressService(item: DetailService): void {
        router.push({
            pathname: "/servicePersonnel/order-confirm",
            params: {
                personnelId,
                serviceId: item.id,
                serviceName: item.name,
                ...(item.pricingId
                    ? {
                          specificationId: item.pricingId,
                      }
                    : {}),
            },
        });
    }

    async function handleToggleFavorite(): Promise<void> {
        if (isFavoriteMutating || favoriteActionLockRef.current) {
            return;
        }

        favoriteActionLockRef.current = true;

        try {
            if (favoriteSummary.isFavorited) {
                await unfavoritePersonnel.mutateAsync();
                toast.success("已取消收藏");
                return;
            }

            await favoritePersonnel.mutateAsync();
            toast.success("收藏成功");
        } catch (error) {
            console.error("toggle favorite failed", error);
        } finally {
            favoriteActionLockRef.current = false;
        }
    }

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
                        source={
                            heroImage?.url
                                ? { uri: heroImage.url }
                                : detail.avatarUrl
                                    ? { uri: detail.avatarUrl }
                                    : require("@/assets/images/massage-personnel-blue.png")
                        }
                        placeholder={
                            heroImage?.url && heroImage.blurhash
                                ? { blurhash: heroImage.blurhash }
                                : undefined
                        }
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
                        <SvgXml xml={CONTENT_GRADIENT_XML} width="100%" height="100%" />
                    </View>

                    <View className="px-4 pt-4">
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 flex-row">
                                <View className="h-16 w-16 overflow-hidden rounded-[14px] border-2 border-white bg-[#f3f4f6]">
                                    <Image
                                        source={
                                            detail.avatarUrl
                                                ? { uri: detail.avatarUrl }
                                                : require("@/assets/images/massage-personnel-blue.png")
                                        }
                                        placeholder={
                                            detail.avatarUrl && detail.avatarBlurhash
                                                ? { blurhash: detail.avatarBlurhash }
                                                : undefined
                                        }
                                        contentFit="cover"
                                        className="h-full w-full"
                                    />
                                </View>

                                <View className="ml-4 flex-1 pt-1">
                                    <Text className="text-[20px] font-puhui-medium text-[#101828]">
                                        {displayName}
                                    </Text>
                                    <Text className="mt-1 text-xs font-puhui-regular text-[#6a7282]">
                                        地址：{detail.addressText}
                                    </Text>
                                </View>
                            </View>

                            <Pressable
                                className="h-9 min-w-20 items-center justify-center rounded-full bg-[#f7951b] px-4"
                                disabled={isFavoriteMutating}
                                onPress={() => {
                                    void handleToggleFavorite();
                                }}
                                style={{
                                    opacity: isFavoriteMutating ? 0.6 : 1,
                                }}
                            >
                                <Text className="text-sm font-puhui-medium text-white">
                                    {favoriteSummary.isFavorited ? "已收藏" : "收藏"}
                                </Text>
                            </Pressable>
                        </View>

                        <View className="mt-4 flex-row items-center justify-between">
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                一年 {detail.yearlyOrderCount}单
                            </Text>
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                收藏 {favoriteSummary.favoriteCount}
                            </Text>
                            <Text className="text-xs font-puhui-regular text-[#6a7282]">
                                {detail.distanceText ?? ""}
                            </Text>
                        </View>

                        <View className="mt-2 flex-row items-center justify-end">
                            <Text className="text-xs font-puhui-regular text-[#fd831f]">
                                {detail.availableTimeText ?? ""}
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
                                {stats.map((item) => (
                                    <DetailMetricItem key={item.label} item={item} />
                                ))}
                            </View>
                        </View>

                        <Text className="mt-2 text-sm font-puhui-regular text-[#364153]">
                            {detail.description ?? ""}
                        </Text>
                    </View>

                    <View className="h-[35px] flex-row items-center bg-[#fff9f1]">
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
                            {SERVICE_GUARANTEE_ITEMS.map((item) => (
                                <GuaranteeItem
                                    key={item}
                                    label={item}
                                    onPress={
                                        item === "资质证书"
                                            ? handlePressQualificationCertificates
                                            : undefined
                                    }
                                />
                            ))}
                        </View>
                    </View>

                    <View className="h-4 bg-[#f9fafb]" />



                    <View className="bg-white">
                        {orderedServices.map((item) => (
                            <ServiceCard
                                key={item.id}
                                item={item}
                                onPress={() => handlePressService(item)}
                            />
                        ))}
                    </View>

                    <View className="h-4 bg-[#f9fafb]" />

                    <View className="bg-white pt-4">
                        <ServicePersonnelReviewList
                            reviewCount={detail.reviewSummary.totalReviews}
                            reviews={normalizedReviews}
                            enableGallery={false}
                            summary={
                                <View className="mt-4 px-4">
                                    <View className="flex-row items-start">
                                        <Text className="text-[32px] font-din-alt-bold text-[#f7951b]">
                                            {detail.reviewSummary.averageRating.toFixed(1)}
                                        </Text>

                                        <View className="ml-4 flex-1">
                                            <View className="flex-row items-center">
                                                <Text className="mr-2 text-xs font-puhui-regular text-[#999999]">
                                                    商家评分
                                                </Text>
                                                <ReviewStarsRow
                                                    rating={Math.round(
                                                        detail.reviewSummary.averageRating,
                                                    )}
                                                />
                                            </View>

                                            <View className="mt-3 flex-row justify-between">
                                                {reviewMetrics.map((item) => (
                                                    <ReviewMetric
                                                        key={item.label}
                                                        item={item}
                                                    />
                                                ))}
                                            </View>
                                        </View>
                                    </View>
                                </View>
                            }
                            onPressAllReviews={onPressAllReviews}
                        />
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

function MassageServicePersonnelSkeleton() {
    return (
        <ScrollView className="flex-1">
            <Skeleton className="h-[384px] w-full rounded-none" />
            <View className="-mt-16 rounded-t-[24px] bg-white">
                <View className="px-4 pt-4">
                    <View className="flex-row items-start justify-between">
                        <View className="flex-row">
                            <Skeleton className="h-16 w-16 rounded-[14px]" />
                            <View className="ml-4 pt-1">
                                <Skeleton className="h-6 w-28 rounded-md" />
                                <Skeleton className="mt-2 h-3 w-32 rounded" />
                            </View>
                        </View>
                        <Skeleton className="h-9 w-20 rounded-full" />
                    </View>
                    <View className="mt-4 flex-row justify-between">
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                        <Skeleton className="h-3 w-16 rounded" />
                    </View>
                </View>
                <View className="px-4 pb-3 pt-2">
                    <Skeleton className="h-20 w-full rounded-[8px]" />
                    <Skeleton className="mt-3 h-4 w-full rounded" />
                    <Skeleton className="mt-2 h-4 w-3/4 rounded" />
                </View>
                <Skeleton className="h-[35px] w-full rounded-none" />
                <View className="h-4" />
                <Skeleton className="h-[50px] w-full rounded-none" />
                <Skeleton className="h-[128px] w-full rounded-none" />
                <Skeleton className="h-[128px] w-full rounded-none" />
            </View>
        </ScrollView>
    );
}

export function MassageServicePersonnelScreen(props: {
    personnelId: string;
    serviceId: string;
    pricingId: string;
    serviceName: string;
    personnelName: string;
}) {
    return (
        <Suspense fallback={<MassageServicePersonnelSkeleton />}>
            <MassageServicePersonnelContent {...props} />
        </Suspense>
    );
}
