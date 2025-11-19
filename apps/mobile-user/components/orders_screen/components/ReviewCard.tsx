import { useCallback } from "react";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useRouter } from "expo-router";
import { Image, TouchableOpacity, View } from "react-native";
import type { ReviewCardProps } from "../types";
import { Star } from "lucide-react-native";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Icon } from "@repo/mobile-ui/components/ui/icon";

export function ReviewCard({ review }: ReviewCardProps) {
    const router = useRouter();

    const handlePress = useCallback(() => {
        // Navigate to order detail with the associated order ID
        router.push(`/order/${review.orderId}` as any);
    }, [router, review.orderId]);

    const formatDate = (date: Date) => {
        const d = new Date(date);
        return `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日`;
    };

    // 渲染评分星星：选中使用主题主色填充+描边，未选中仅描边为弱化色
    const renderStars = (rating: number) => {
        return (
            <View className="flex-row items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => {
                    const isActive = star <= rating;
                    return (
                        <Icon as={Star}
                            key={star}
                            size={14}
                            // lucide-react-native 支持 fill/color 属性，使用 currentColor 以便通过类名统一控制
                            color={isActive ? undefined : undefined}
                            fill={isActive ? "currentColor" : "none"}
                            className={cn(
                                isActive
                                    ? "text-primary"
                                    : "text-muted-foreground/40"
                            )}
                        />
                    );
                })}
            </View>
        );
    };

    return (
        <TouchableOpacity
            activeOpacity={0.7}
            onPress={handlePress}
            className="mt-3 rounded-2xl border border-border bg-card px-4 py-4"
        >
            {/* Header: Target type and date */}
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                    <View className="rounded-full bg-primary/10 px-3 py-1">
                        <Text className="text-xs font-medium text-primary">
                            {review.targetType === "personnel" ? "服务人员" : "店铺"}
                        </Text>
                    </View>
                    <Text className="text-xs text-muted-foreground">
                        评价于 {formatDate(review.latestReviewAt)}
                    </Text>
                </View>
            </View>

            {/* Rating and count */}
            <View className="flex-row items-center justify-between mb-3">
                <View className="flex-row items-center gap-2">
                    {renderStars(Math.round(review.averageRating))}
                    <Text className="text-sm font-semibold text-foreground">
                        {Number(review.averageRating).toFixed(1)}
                    </Text>
                </View>
                <Text className="text-xs text-muted-foreground">
                    共 {review.reviewCount} 次评价
                </Text>
            </View>

            {/* Comment */}
            {review.comment && (
                <View className="mb-3">
                    <Text className="text-sm text-foreground leading-5" numberOfLines={3}>
                        {review.comment}
                    </Text>
                </View>
            )}

            {/* Images */}
            {review.images && review.images.length > 0 && (
                <View className="flex-row gap-2 flex-wrap mb-3">
                    {review.images.slice(0, 3).map((image, index) => (
                        <View
                            key={index}
                            className="w-20 h-20 rounded-lg overflow-hidden bg-muted"
                        >
                            <Image
                                source={{ uri: image.url }}
                                className="w-full h-full"
                                resizeMode="cover"
                            />
                        </View>
                    ))}
                    {review.images.length > 3 && (
                        <View className="w-20 h-20 rounded-lg bg-muted items-center justify-center">
                            <Text className="text-xs text-muted-foreground">
                                +{review.images.length - 3}
                            </Text>
                        </View>
                    )}
                </View>
            )}

            {/* Footer: View order detail */}
            <View className="pt-3 border-t border-border/30">
                <Text className="text-xs text-muted-foreground">
                    点击查看订单详情 {'>'}
                </Text>
            </View>
        </TouchableOpacity>
    );
}
