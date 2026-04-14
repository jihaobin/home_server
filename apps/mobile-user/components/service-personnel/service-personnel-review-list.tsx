import type { ReactNode } from "react";
import { Galeria } from "@nandorojo/galeria";
import { Image } from "expo-image";
import { Pressable, View, type ImageSourcePropType } from "react-native";
import { ChevronRight, Star } from "lucide-react-native";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";

export type ServicePersonnelReviewImage = {
    url?: string;
    blurhash?: string;
    source?: ImageSourcePropType;
};

export type ServicePersonnelReviewItem = {
    id: string;
    rating: number;
    comment?: string | null;
    createdAt: unknown;
    images: ServicePersonnelReviewImage[];
    reviewerAvatar?: ServicePersonnelReviewImage | null;
    reviewerName?: string | null;
    reviewerPhoneMasked?: string | null;
    ratingLabel?: string;
};

const DEFAULT_AVATAR = require("@/assets/images/icon-round.png");
const STAR_SLOTS = [0, 1, 2, 3, 4] as const;

export function formatReviewPublishedAt(value: unknown): string {
    const date = value instanceof Date ? value : new Date(String(value));
    if (Number.isNaN(date.getTime())) {
        return "";
    }

    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `发布于${y}年${m}月${d}日`;
}

export function ReviewStarsRow({ rating }: { rating: number }) {
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

function getReviewImageSource(image?: ServicePersonnelReviewImage | null) {
    if (image?.source) {
        return image.source;
    }

    if (image?.url) {
        return { uri: image.url };
    }

    return DEFAULT_AVATAR;
}

function getReviewImagePlaceholder(image?: ServicePersonnelReviewImage | null) {
    if (!image?.url || !image.blurhash) {
        return undefined;
    }

    return { blurhash: image.blurhash };
}

function ReviewImageCell({ image }: { image: ServicePersonnelReviewImage }) {
    return (
        <Image
            source={getReviewImageSource(image)}
            placeholder={getReviewImagePlaceholder(image)}
            contentFit="cover"
            style={{ width: "100%", height: "100%" }}
        />
    );
}

export function ServicePersonnelReviewCard({
    review,
    showDivider,
    enableGallery,
}: {
    review: ServicePersonnelReviewItem;
    showDivider: boolean;
    enableGallery: boolean;
}) {
    const reviewImages = (review.images ?? []).filter((item) =>
        Boolean(item.url || item.source),
    );
    const galleryImages = reviewImages.filter((item) => Boolean(item.url));
    const thumbnails = reviewImages.slice(0, 6);
    const publishedAtText = formatReviewPublishedAt(review.createdAt);
    const reviewerName = review.reviewerName || "用户";
    const canOpenGallery =
        enableGallery && galleryImages.length === reviewImages.length;

    return (
        <View>
            <View className="px-4 pt-4">
                <View className="flex-row items-start">
                    <View className="h-[42px] w-[42px] rounded-full overflow-hidden bg-muted">
                        <Image
                            source={getReviewImageSource(review.reviewerAvatar)}
                            placeholder={getReviewImagePlaceholder(
                                review.reviewerAvatar,
                            )}
                            contentFit="cover"
                            style={{ width: "100%", height: "100%" }}
                        />
                    </View>

                    <View className="ml-3 flex-1">
                        <View className="flex-row items-start justify-between">
                            <View>
                                <Text className="text-sm font-puhui-medium text-foreground">
                                    {reviewerName}
                                </Text>
                                {review.reviewerPhoneMasked ? (
                                    <Text className="mt-1 text-[11px] font-puhui-regular text-muted-foreground">
                                        {review.reviewerPhoneMasked}
                                    </Text>
                                ) : null}
                            </View>

                            <View className="items-end">
                                <ReviewStarsRow rating={review.rating} />
                                {review.ratingLabel ? (
                                    <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                        {review.ratingLabel}
                                    </Text>
                                ) : null}
                            </View>
                        </View>

                        {review.comment ? (
                            <Text className="mt-3 text-xs font-puhui-regular text-foreground">
                                {review.comment}
                            </Text>
                        ) : null}

                        {thumbnails.length ? (
                            canOpenGallery ? (
                                <Galeria
                                    urls={galleryImages.map(
                                        (item) => item.url ?? "",
                                    )}
                                >
                                    <View
                                        className="mt-3 flex-row flex-wrap"
                                        style={{ gap: 12 }}
                                    >
                                        {thumbnails.map((item, index) => (
                                            <View
                                                key={`${review.id}-img-${index}`}
                                                className="h-[77px] w-[77px] rounded-[8px] overflow-hidden bg-muted"
                                            >
                                                <Galeria.Image
                                                    index={index}
                                                    style={{
                                                        width: "100%",
                                                        height: "100%",
                                                    }}
                                                >
                                                    <ReviewImageCell
                                                        image={item}
                                                    />
                                                </Galeria.Image>
                                            </View>
                                        ))}
                                    </View>
                                </Galeria>
                            ) : (
                                <View
                                    className="mt-3 flex-row flex-wrap"
                                    style={{ gap: 12 }}
                                >
                                    {thumbnails.map((item, index) => (
                                        <View
                                            key={`${review.id}-img-${index}`}
                                            className="h-[77px] w-[77px] rounded-[8px] overflow-hidden bg-muted"
                                        >
                                            <ReviewImageCell image={item} />
                                        </View>
                                    ))}
                                </View>
                            )
                        ) : null}

                        {publishedAtText ? (
                            <View className="pt-3 pb-4 items-start">
                                <Text className="text-xs font-puhui-regular text-muted-foreground">
                                    {publishedAtText}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>

            {showDivider ? <View className="h-px bg-border mx-4" /> : null}
        </View>
    );
}

function SectionAction({
    label,
    onPress,
}: {
    label: string;
    onPress?: () => void;
}) {
    const content = (
        <>
            <Text className="text-sm font-puhui-regular text-muted-foreground">
                {label}
            </Text>
            <Icon
                as={ChevronRight}
                size={16}
                className="ml-1 text-muted-foreground"
            />
        </>
    );

    if (!onPress) {
        return <View className="flex-row items-center">{content}</View>;
    }

    return (
        <Pressable
            className="flex-row items-center"
            hitSlop={12}
            onPress={onPress}
        >
            {content}
        </Pressable>
    );
}

export function ServicePersonnelReviewList({
    reviewCount,
    reviews,
    summary,
    onPressAllReviews,
    enableGallery = true,
    emptyText = "暂无评价",
    showHeaderAction = true,
    showFooterAction = true,
}: {
    reviewCount: number;
    reviews: ServicePersonnelReviewItem[];
    summary?: ReactNode;
    onPressAllReviews?: () => void;
    enableGallery?: boolean;
    emptyText?: string;
    showHeaderAction?: boolean;
    showFooterAction?: boolean;
}) {
    return (
        <>
            <View className="px-4 py-4 flex-row items-center justify-between">
                <Text className="text-base font-puhui-medium text-foreground">
                    评价({reviewCount})
                </Text>
                {showHeaderAction ? (
                    <SectionAction
                        label="查看全部"
                        onPress={onPressAllReviews}
                    />
                ) : null}
            </View>

            {summary ?? <View className="h-px bg-border" />}

            {summary ? <View className="h-px bg-border" /> : null}

            {reviews.length ? (
                reviews.map((review, index) => (
                    <ServicePersonnelReviewCard
                        key={review.id}
                        review={review}
                        showDivider={index < reviews.length - 1}
                        enableGallery={enableGallery}
                    />
                ))
            ) : (
                <View className="px-4 py-4">
                    <Text className="text-xs font-puhui-regular text-muted-foreground">
                        {emptyText}
                    </Text>
                </View>
            )}

            {showFooterAction && reviewCount ? (
                <>
                    <View className="h-px bg-border" />
                    {onPressAllReviews ? (
                        <Pressable
                            className="px-4 py-4 items-center justify-center flex-row"
                            hitSlop={12}
                            onPress={onPressAllReviews}
                        >
                            <Text className="text-sm font-puhui-regular text-muted-foreground">
                                全部{reviewCount}条评价
                            </Text>
                            <Icon
                                as={ChevronRight}
                                size={16}
                                className="ml-1 text-muted-foreground"
                            />
                        </Pressable>
                    ) : (
                        <View className="px-4 py-4 items-center justify-center flex-row">
                            <Text className="text-sm font-puhui-regular text-muted-foreground">
                                全部{reviewCount}条评价
                            </Text>
                            <Icon
                                as={ChevronRight}
                                size={16}
                                className="ml-1 text-muted-foreground"
                            />
                        </View>
                    )}
                </>
            ) : null}
        </>
    );
}
