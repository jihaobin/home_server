import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { ChevronLeft, Star } from "lucide-react-native";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Suspense, useMemo, useState } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
    useReviewStats,
    useTargetReviewsInfinite,
} from "@repo/hooks/api/review";
import { QueryErrorResetBoundary } from "@tanstack/react-query";
import { ErrorBoundary } from "react-error-boundary";

type ReviewImage = {
    url: string;
    blurhash?: string;
};

type Review = {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: unknown;
    images: ReviewImage[];
    reviewerAvatar?: ReviewImage | null;
    reviewerName?: string | null;
    reviewerPhoneMasked?: string | null;
};

const DEFAULT_AVATAR = require("../../assets/images/icon-round.png");

const STAR_SLOTS = [0, 1, 2, 3, 4] as const;

function formatPublishedAt(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `发布于${y}年${m}月${d}日`;
}

function StarsRow({ rating }: { rating: number }) {
    return (
        <View className="flex-row items-center">
            {STAR_SLOTS.map((slot) => {
                const active = slot < rating;
                return (
                    <Icon
                        key={`star-${slot}`}
                        as={Star}
                        size={16}
                        className={
                            active ? "text-primary" : "text-muted-foreground"
                        }
                        fill={active ? "currentColor" : "none"}
                    />
                );
            })}
        </View>
    );
}

function ReviewItem({
    review,
    showDivider,
}: {
    review: Review;
    showDivider: boolean;
}) {
    const images = (review.images || [])
        .filter((img) => Boolean(img.url))
        .slice(0, 4);
    const publishedAtText = formatPublishedAt(review.createdAt);
    const reviewerName = review.reviewerName || "用户";

    return (
        <View>
            <View className="px-4 pt-3">
                <View className="flex-row items-start justify-between">
                    <View className="flex-row items-start">
                        <View className="h-[42px] w-[42px] rounded-full overflow-hidden bg-muted">
                            <Image
                                source={
                                    review.reviewerAvatar?.url
                                        ? { uri: review.reviewerAvatar.url }
                                        : DEFAULT_AVATAR
                                }
                                placeholder={
                                    review.reviewerAvatar?.blurhash
                                        ? {
                                              blurhash:
                                                  review.reviewerAvatar
                                                      .blurhash,
                                          }
                                        : undefined
                                }
                                contentFit="cover"
                                style={{ width: "100%", height: "100%" }}
                            />
                        </View>

                        <View className="ml-1">
                            <Text className="text-sm font-puhui-medium text-foreground">
                                {reviewerName}
                            </Text>
                            {review.reviewerPhoneMasked ? (
                                <Text className="mt-1 text-[11px] font-puhui-regular text-muted-foreground">
                                    {review.reviewerPhoneMasked}
                                </Text>
                            ) : null}
                        </View>
                    </View>

                    <StarsRow rating={review.rating} />
                </View>

                {review.comment ? (
                    <Text className="mt-3 text-xs font-puhui-regular text-foreground">
                        {review.comment}
                    </Text>
                ) : null}

                {images.length ? (
                    <View className="mt-3 flex-row gap-3">
                        {images.map((img, idx) => (
                            <View
                                key={`${review.id}-img-${idx}`}
                                className="h-[77px] w-[77px] rounded-[8px] overflow-hidden bg-muted"
                            >
                                <Image
                                    source={{ uri: img.url }}
                                    placeholder={
                                        img.blurhash
                                            ? { blurhash: img.blurhash }
                                            : undefined
                                    }
                                    contentFit="cover"
                                    style={{ width: "100%", height: "100%" }}
                                />
                            </View>
                        ))}
                    </View>
                ) : null}

                {publishedAtText ? (
                    <Text className="mt-3 pb-4 text-xs font-puhui-regular text-muted-foreground">
                        {publishedAtText}
                    </Text>
                ) : null}
            </View>

            {showDivider ? <View className="h-px bg-border mx-4" /> : null}
        </View>
    );
}

function ReviewsSkeleton() {
    return (
        <>
            <View className="bg-card">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="h-[42px]"
                >
                    <View
                        className="flex-row items-center px-4"
                        style={{ gap: 24 }}
                    >
                        {Array.from({ length: 5 }).map((_, idx) => (
                            <View
                                key={`tab-skeleton-${idx}`}
                                className="items-center"
                            >
                                <Skeleton className="h-4 w-16 rounded" />
                                <Skeleton className="mt-1 h-[3px] w-5 rounded-full" />
                            </View>
                        ))}
                    </View>
                </ScrollView>
            </View>

            <ScrollView
                className="flex-1 bg-card"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                <View className="h-px bg-border mx-4" />

                {Array.from({ length: 6 }).map((_, index) => (
                    <View key={`review-skeleton-${index}`}>
                        <View className="px-4 pt-3">
                            <View className="flex-row items-start justify-between">
                                <View className="flex-row items-start">
                                    <Skeleton className="h-[42px] w-[42px] rounded-full" />
                                    <View className="ml-1">
                                        <Skeleton className="h-4 w-20 rounded" />
                                        <Skeleton className="mt-2 h-3 w-16 rounded" />
                                    </View>
                                </View>
                                <View className="flex-row" style={{ gap: 4 }}>
                                    {Array.from({ length: 5 }).map(
                                        (__, starIdx) => (
                                            <Skeleton
                                                key={`review-skeleton-star-${index}-${starIdx}`}
                                                className="h-3 w-3 rounded-full"
                                            />
                                        ),
                                    )}
                                </View>
                            </View>

                            <Skeleton className="mt-3 h-3 w-full rounded" />
                            <Skeleton className="mt-2 h-3 w-5/6 rounded" />

                            <View className="mt-3 flex-row" style={{ gap: 12 }}>
                                {Array.from({ length: 3 }).map((__, imgIdx) => (
                                    <Skeleton
                                        key={`review-skeleton-img-${index}-${imgIdx}`}
                                        className="h-[77px] w-[77px] rounded-[8px]"
                                    />
                                ))}
                            </View>

                            <Skeleton className="mt-3 h-3 w-24 rounded" />
                            <View className="pb-4" />
                        </View>

                        {index < 5 ? (
                            <View className="h-px bg-border mx-4" />
                        ) : null}
                    </View>
                ))}
            </ScrollView>
        </>
    );
}

function ReviewsError({ onRetry }: { onRetry: () => void }) {
    return (
        <ScrollView
            className="flex-1 bg-card"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ paddingBottom: 24 }}
        >
            <View className="h-px bg-border mx-4" />
            <View className="px-4 py-6">
                <Text className="text-xs font-puhui-regular text-muted-foreground">
                    评价加载失败
                </Text>
                <Pressable
                    hitSlop={12}
                    onPress={onRetry}
                    className="mt-4 self-start rounded-full bg-primary px-4 py-2"
                >
                    <Text className="text-sm font-puhui-medium text-primary-foreground">
                        重试
                    </Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

function ReviewsContent({
    personnelId,
    serviceId,
    activeTabKey,
    onTabChange,
}: {
    personnelId: string;
    serviceId?: string;
    activeTabKey: "all" | "latest" | "photos" | "positive" | "negative";
    onTabChange: (
        key: "all" | "latest" | "photos" | "positive" | "negative",
    ) => void;
}) {
    const stats = useReviewStats("personnel", personnelId, serviceId).data;

    const tabs = useMemo(() => {
        const total = stats?.totalCount ?? 0;
        const photo = stats?.photoCount ?? 0;
        const good = stats?.goodCount ?? 0;
        const bad = stats?.badCount ?? 0;
        return [
            { key: "all", label: "全部", count: total },
            { key: "latest", label: "最新", count: total },
            { key: "photos", label: "晒图", count: photo },
            { key: "positive", label: "好评", count: good },
            { key: "negative", label: "差评", count: bad },
        ] as const;
    }, [stats]);

    const listParams = useMemo(
        () => ({
            limit: 10,
            serviceId,
            tab: activeTabKey,
        }),
        [activeTabKey, serviceId],
    );

    const reviewsQuery = useTargetReviewsInfinite(
        "personnel",
        personnelId,
        listParams,
    );

    const reviewItems = useMemo(() => {
        const pages = reviewsQuery.data?.pages ?? [];
        return pages.flatMap((page) => page.data) as Review[];
    }, [reviewsQuery.data]);

    return (
        <>
            <View className="bg-card">
                <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    className="h-[42px]"
                >
                    <View className="flex-row items-center px-4">
                        {tabs.map((tab) => {
                            const isActive = tab.key === activeTabKey;
                            return (
                                <Pressable
                                    key={tab.key}
                                    onPress={() => onTabChange(tab.key)}
                                    className="mr-6 items-center justify-center"
                                >
                                    <Text
                                        className={
                                            isActive
                                                ? "text-sm text-primary font-puhui-regular"
                                                : "text-sm text-muted-foreground font-puhui-regular"
                                        }
                                    >
                                        {tab.label}（{tab.count}）
                                    </Text>
                                    <View
                                        className={
                                            isActive
                                                ? "mt-1 h-[3px] w-5 rounded-full bg-primary"
                                                : "mt-1 h-[3px] w-5 rounded-full bg-transparent"
                                        }
                                    />
                                </Pressable>
                            );
                        })}
                    </View>
                </ScrollView>
            </View>

            <ScrollView
                className="flex-1 bg-card"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 24 }}
            >
                <View className="h-px bg-border mx-4" />

                {reviewItems.length ? (
                    <>
                        {reviewItems.map((review, index) => (
                            <ReviewItem
                                key={review.id}
                                review={review}
                                showDivider={index < reviewItems.length - 1}
                            />
                        ))}

                        {reviewsQuery.hasNextPage ? (
                            <Pressable
                                className="px-4 py-4 items-center"
                                hitSlop={12}
                                onPress={() => {
                                    if (
                                        !reviewsQuery.isFetchingNextPage &&
                                        reviewsQuery.hasNextPage
                                    ) {
                                        reviewsQuery.fetchNextPage();
                                    }
                                }}
                            >
                                <Text className="text-sm font-puhui-regular text-muted-foreground">
                                    {reviewsQuery.isFetchingNextPage
                                        ? "加载中..."
                                        : "加载更多"}
                                </Text>
                            </Pressable>
                        ) : null}
                    </>
                ) : (
                    <View className="px-4 py-6">
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            暂无评价
                        </Text>
                    </View>
                )}
            </ScrollView>
        </>
    );
}

export default function ServicePersonnelReviewsScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        personnelId?: string | string[];
        serviceId?: string | string[];
        serviceName?: string | string[];
    }>();

    const personnelId = Array.isArray(params.personnelId)
        ? params.personnelId[0]
        : params.personnelId
          ? String(params.personnelId)
          : "";
    const serviceId = Array.isArray(params.serviceId)
        ? params.serviceId[0]
        : params.serviceId
          ? String(params.serviceId)
          : undefined;

    const [activeTabKey, setActiveTabKey] = useState<
        "all" | "latest" | "photos" | "positive" | "negative"
    >("all");

    return (
        <View className="flex-1 bg-background">
            <View className="bg-card">
                <View className="h-[90px] flex-row items-center px-4 pt-12">
                    <View className="w-[78px]">
                        <Pressable hitSlop={12} onPress={() => router.back()}>
                            <Icon
                                as={ChevronLeft}
                                size={22}
                                className="text-foreground"
                            />
                        </Pressable>
                    </View>
                    <View className="flex-1 items-center">
                        <Text className="text-base font-puhui-medium text-foreground">
                            用户评价
                        </Text>
                    </View>
                    <View className="w-[78px]" />
                </View>
            </View>

            {!personnelId ? (
                <ScrollView
                    className="flex-1 bg-card"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 24 }}
                >
                    <View className="h-px bg-border mx-4" />
                    <View className="px-4 py-6">
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            缺少 personnelId，无法加载评价
                        </Text>
                    </View>
                </ScrollView>
            ) : (
                <QueryErrorResetBoundary>
                    {({ reset }) => (
                        <ErrorBoundary
                            onReset={reset}
                            fallbackRender={({ resetErrorBoundary }) => (
                                <>
                                    <View className="bg-card">
                                        <ScrollView
                                            horizontal
                                            showsHorizontalScrollIndicator={
                                                false
                                            }
                                            className="h-[42px]"
                                        >
                                            <View
                                                className="flex-row items-center px-4"
                                                style={{ gap: 24 }}
                                            >
                                                {Array.from({ length: 5 }).map(
                                                    (_, idx) => (
                                                        <View
                                                            key={`tab-error-${idx}`}
                                                            className="items-center"
                                                        >
                                                            <Skeleton className="h-4 w-16 rounded" />
                                                            <Skeleton className="mt-1 h-[3px] w-5 rounded-full" />
                                                        </View>
                                                    ),
                                                )}
                                            </View>
                                        </ScrollView>
                                    </View>
                                    <ReviewsError
                                        onRetry={resetErrorBoundary}
                                    />
                                </>
                            )}
                        >
                            <Suspense fallback={<ReviewsSkeleton />}>
                                <ReviewsContent
                                    personnelId={personnelId}
                                    serviceId={serviceId}
                                    activeTabKey={activeTabKey}
                                    onTabChange={setActiveTabKey}
                                />
                            </Suspense>
                        </ErrorBoundary>
                    )}
                </QueryErrorResetBoundary>
            )}
        </View>
    );
}
