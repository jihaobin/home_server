import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useState } from "react";
import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Galeria } from "@nandorojo/galeria";
import type { Review } from "./types";

const ICON_MAP = lucideIconRegistry;

type TabType = "all" | "positive" | "neutral" | "negative";

interface ReviewsListProps {
    reviews: Review[];
    onReviewPress?: (reviewId: string) => void;
    totalReviewsCount?: number;
    positiveCount?: number;
    neutralCount?: number;
    negativeCount?: number;
}

export function ReviewsList({
    reviews,
    onReviewPress,
    totalReviewsCount = 2000,
    positiveCount = 1800,
    neutralCount = 150,
    negativeCount = 50,
}: ReviewsListProps) {
    const [activeTab, setActiveTab] = useState<TabType>("all");

    // 根据选中的tab过滤评论
    const filteredReviews = reviews.filter((review) => {
        if (activeTab === "all") return true;
        if (activeTab === "positive") return review.rating >= 4;
        if (activeTab === "neutral") return review.rating === 3;
        if (activeTab === "negative") return review.rating <= 2;
        return true;
    });

    const tabs = [
        { key: "all" as TabType, label: "全部", count: totalReviewsCount },
        { key: "positive" as TabType, label: "好评", count: positiveCount },
        { key: "neutral" as TabType, label: "中评", count: neutralCount },
        { key: "negative" as TabType, label: "差评", count: negativeCount },
    ];

    // if (reviews.length === 0) {
    //     return (
    //         <View className="px-4 py-8">
    //             <Text className="text-center text-sm text-muted-foreground">
    //                 暂无评价
    //             </Text>
    //         </View>
    //     );
    // }

    return (
        <View>
            {/* Tabs栏 */}
            <View className="border-b border-border bg-background">
                <View className="flex-row px-4">
                    {tabs.map((tab) => (
                        <Pressable
                            key={tab.key}
                            className={`mr-6 pb-3 pt-4 ${activeTab === tab.key ? "border-b-2 border-primary" : ""
                                }`}
                            onPress={() => setActiveTab(tab.key)}
                        >
                            <View className="flex-row items-center">
                                <Text
                                    className={`text-sm font-medium ${activeTab === tab.key
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                        }`}
                                >
                                    {tab.label}
                                </Text>
                                <Text
                                    className={`ml-1 text-xs ${activeTab === tab.key
                                        ? "text-primary"
                                        : "text-muted-foreground"
                                        }`}
                                >
                                    {tab.count}+
                                </Text>
                            </View>
                        </Pressable>
                    ))}
                </View>
            </View>

            {/* 评论列表 */}
            <View className="mt-2">
                {filteredReviews.map((review, index) => (
                    <View key={review.id}>
                        <Pressable
                            className="py-3 active:bg-muted/30 bg-card px-4"
                            onPress={() => onReviewPress?.(review.id)}
                        >
                            <View className="flex-row items-start">
                                {/* 头像 */}
                                <View className="relative">
                                    <View className="h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-primary/10">
                                        <Text className="text-base font-semibold text-primary">
                                            {review.userName.slice(0, 1)}
                                        </Text>
                                    </View>
                                </View>

                                {/* 右侧内容 */}
                                <View className="ml-2.5 flex-1">
                                    {/* 用户名和日期 */}
                                    <View className="flex-row items-center justify-between mb-0.5">
                                        <Text className="text-sm font-medium text-foreground">
                                            {review.userName}
                                        </Text>
                                        <Text className="text-xs text-muted-foreground/70">
                                            {review.date}
                                        </Text>
                                    </View>

                                    {/* 星级评分 */}
                                    <View className="flex-row items-center mb-2">
                                        {Array.from({ length: 5 }).map((_, i) => (
                                            <Icon
                                                key={`star-${review.id}-${i}`}
                                                as={ICON_MAP.Star}
                                                size={11}
                                                className={
                                                    i < review.rating
                                                        ? "text-amber-400"
                                                        : "text-muted-foreground/20"
                                                }
                                                fill={i < review.rating ? "currentColor" : "none"}
                                            />
                                        ))}
                                    </View>

                                    {/* 评论内容(如果有) */}
                                    {review.content && (
                                        <Text className="text-[13px] leading-[18px] text-foreground/90 mb-2">
                                            {review.content}
                                        </Text>
                                    )}

                                    {/* 评论图片(如果有,最多显示3张) */}
                                    {review.images && review.images.length > 0 && (
                                        <Galeria urls={review.images.map(img => img.url)}>
                                            <View className="mb-2 flex-row -mx-0.5">
                                                {review.images.slice(0, 3).map((image, imgIndex) => (
                                                    <Galeria.Image index={imgIndex} key={`${review.id}-img-${imgIndex}`}>
                                                        <Pressable
                                                            className="px-0.5"
                                                        >
                                                            <Image
                                                                source={{ uri: image.url }}
                                                                className="rounded"
                                                                contentFit="cover"
                                                                style={{ width: 80, height: 80 }}
                                                                placeholder={image.blurhash}
                                                            />
                                                        </Pressable>
                                                    </Galeria.Image>
                                                ))}
                                            </View>
                                        </Galeria>
                                    )}

                                    {/* 服务标签和地区 */}
                                    <View className="flex-row items-center flex-wrap">
                                        {review.serviceTag && (
                                            <View className="rounded bg-muted/70 px-2 py-0.5 mr-2">
                                                <Text className="text-[11px] text-muted-foreground">
                                                    {review.serviceTag}
                                                </Text>
                                            </View>
                                        )}
                                        {review.location && (
                                            <View className="flex-row items-center">
                                                <Icon
                                                    as={ICON_MAP.MapPin}
                                                    size={10}
                                                    className="text-muted-foreground/60"
                                                />
                                                <Text className="ml-0.5 text-[11px] text-muted-foreground/70">
                                                    {review.location}
                                                </Text>
                                            </View>
                                        )}
                                    </View>
                                </View>
                            </View>
                        </Pressable>

                        {/* 分隔线 */}
                        {index < filteredReviews.length - 1 && (
                            <View className="h-[1px] bg-border/30 ml-[52px]" />
                        )}
                    </View>
                ))}
            </View>
        </View>
    );
}
