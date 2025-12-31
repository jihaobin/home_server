import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Textarea } from "@repo/mobile-ui/components/ui/textarea";
import { useState } from "react";
import {
    ActivityIndicator,
    ScrollView,
    TouchableOpacity,
    View,
} from "react-native";
import { Image } from "expo-image"
import { Camera, X } from "lucide-react-native";
import * as ImagePicker from "expo-image-picker";
import { toast } from "sonner-native";
import { cn } from "@repo/mobile-ui/lib/utils";
import type { CreateReviewBody } from "@repo/types";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { useUploadFile } from "@repo/hooks/api/files";

export interface OrderReviewModalProps {
    visible: boolean;
    onClose: () => void;
    orderId: string;
    targetId: string;
    targetType: "personnel" | "shop";
    serviceName?: string;
    serviceDescription?: string | null;
    serviceImageUrl?: string | null;
    orderSerial?: string | null;
    onSubmit: (review: CreateReviewBody) => Promise<void>;
}

/**
 * 订单评论弹窗组件
 *
 * @example
 * ```tsx
 * <OrderReviewModal
 *   visible={isVisible}
 *   onClose={() => setIsVisible(false)}
 *   orderId="order-123"
 *   targetId="worker-456"
 *   targetType="worker"
 *   onSubmit={handleSubmitReview}
 * />
 * ```
 */
export function OrderReviewModal({
    visible,
    onClose,
    orderId,
    targetId,
    targetType,
    serviceName,
    serviceDescription,
    serviceImageUrl,
    orderSerial,
    onSubmit,
}: OrderReviewModalProps) {
    // 评分相关状态
    const [rating, setRating] = useState(5);
    const [serviceQuality, setServiceQuality] = useState<number | undefined>(
        undefined,
    );
    const [attitude, setAttitude] = useState<number | undefined>(undefined);
    const [punctuality, setPunctuality] = useState<number | undefined>(undefined);

    // 评论内容
    const [comment, setComment] = useState("");

    // 图片相关
    const [images, setImages] = useState<string[]>([]);
    const [imageIds, setImageIds] = useState<string[]>([]);

    // 是否匿名
    const [isAnonymous, setIsAnonymous] = useState(false);

    // 提交状态
    const [isSubmitting, setIsSubmitting] = useState(false);

    // 图片上传相关
    const { mutateAsync: uploadFile, isPending: isUploading } = useUploadFile();

    // 星星评分组件
    const StarRating = ({
        value,
        onChange,
        label,
    }: {
        value: number;
        onChange: (rating: number) => void;
        label?: string;
    }) => {
        return (
            <View className="mb-3">
                {label && (
                    <Text className="text-sm text-muted-foreground mb-2">{label}</Text>
                )}
                <View className="flex-row gap-1 justify-center">
                    {[1, 2, 3, 4, 5].map((star) => (
                        <TouchableOpacity
                            key={star}
                            onPress={() => onChange(star)}
                            activeOpacity={0.7}
                            className="p-2"
                        >
                            <Text className={cn("text-4xl", star <= value ? "text-primary" : "text-muted-foreground/20")}>
                                ★
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // 选择图片
    const handlePickImage = async () => {
        if (images.length >= 6) {
            toast.info("最多支持上传6张图片");
            return;
        }

        if (isUploading) {
            toast.info("正在上传图片，请稍候");
            return;
        }

        // 请求权限
        const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted) {
            toast.error("需要相册访问权限才能上传图片");
            return;
        }

        // 选择图片
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: "images",
            allowsEditing: false,
            aspect: [4, 3],
            quality: 0.8,
        });

        if (!result.canceled && result.assets[0]) {
            const asset = result.assets[0];
            const uri = asset.uri;

            // 先添加到预览列表
            setImages([...images, uri]);

            try {
                // 获取文件扩展名
                const fileName = asset.fileName || uri.split('/').pop() || 'image.jpg';
                const fileType = asset.mimeType || 'image/jpeg';

                // 上传图片到服务器
                const uploadResult = await uploadFile({
                    file: {
                        uri: uri,
                        name: fileName,
                        type: fileType,
                    },
                    fileName: fileName,
                });

                // 上传成功后，保存文件ID
                setImageIds([...imageIds, uploadResult.id]);
                toast.success("图片上传成功");
            } catch (error) {
                // 上传失败，移除预览图
                setImages(images.filter(img => img !== uri));
                toast.error("图片上传失败，请重试");
                console.error("Upload image error:", error);
            }
        }
    };

    // 删除图片
    const handleRemoveImage = (index: number) => {
        setImages(images.filter((_, i) => i !== index));
        setImageIds(imageIds.filter((_, i) => i !== index));
    };

    // 提交评价
    const handleSubmit = async () => {
        if (!comment.trim()) {
            toast.error("请填写评价内容");
            return;
        }

        if (comment.trim().length > 1000) {
            toast.error("评价内容最多支持1000个字符");
            return;
        }

        setIsSubmitting(true);

        try {
            const reviewData: CreateReviewBody = {
                orderId,
                targetId,
                targetType,
                rating,
                serviceQuality,
                attitude,
                punctuality,
                comment: comment.trim(),
                isAnonymous,
                imageIds: imageIds.length > 0 ? imageIds : [],
            };

            await onSubmit(reviewData);
            toast.success("评价提交成功");
            handleClose();
        } catch (error) {
            toast.error("评价提交失败,请稍后重试");
            console.error("Submit review error:", error);
        } finally {
            setIsSubmitting(false);
        }
    };

    // 关闭弹窗并重置状态
    const handleClose = () => {
        setRating(5);
        setServiceQuality(undefined);
        setAttitude(undefined);
        setPunctuality(undefined);
        setComment("");
        setImages([]);
        setImageIds([]);
        setIsAnonymous(false);
        onClose();
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={handleClose}
            initialHeightRatio={0.75}
            minHeightRatio={0.5}
            maxHeightRatio={0.9}
        >
            <View className="flex-1 px-4">
                {/* 标题 */}
                <View className="pb-4 border-b border-border">
                    <Text className="text-xl font-bold text-center">商品信息</Text>
                    <Text className="text-sm text-muted-foreground text-center mt-1">
                        真实、有趣的分享更受欢迎哦
                    </Text>
                </View>

                <ScrollView
                    className="flex-1"
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 20 }}
                >
                    {/* 服务商品信息展示 */}
                    <View className="mt-4 flex-row items-center gap-3 p-3 bg-muted/30 rounded-lg border border-border">
                        <View className="w-16 h-16 rounded-lg overflow-hidden bg-muted">
                            {serviceImageUrl ? (
                                <Image
                                    source={{ uri: serviceImageUrl }}
                                    style={{ width: "100%", height: "100%" }}
                                    contentFit="cover"
                                />
                            ) : (
                                <View className="w-full h-full items-center justify-center">
                                    <Text className="text-xs text-muted-foreground">商品</Text>
                                </View>
                            )}
                        </View>
                        <View className="flex-1">
                            <Text className="text-sm font-medium text-foreground" numberOfLines={1}>
                                {serviceName || "商品信息"}
                            </Text>
                            <Text className="text-xs text-muted-foreground mt-0.5">
                                {serviceDescription?.trim()
                                    ? serviceDescription
                                    : `订单编号: ${orderSerial || orderId.slice(-8)}`}
                            </Text>
                        </View>
                    </View>

                    {/* 综合评分 */}
                    <View className="mt-6">
                        <StarRating value={rating} onChange={setRating} />
                    </View>

                    {/* 评论内容 */}
                    <View className="mt-4">
                        <Text className="text-sm text-muted-foreground mb-2">
                            评价内容
                        </Text>
                        <Textarea
                            placeholder="请开始说明您对服务的感受吧..."
                            value={comment}
                            onChangeText={setComment}
                            className="min-h-32"
                            maxLength={1000}
                        />
                        <Text className="text-xs text-muted-foreground text-right mt-1">
                            {comment.length}/1000
                        </Text>
                    </View>

                    {/* 图片上传区域 */}
                    <View className="mt-4 border-t border-border pt-4">
                        <View className="flex-row flex-wrap gap-2.5">
                            {/* 已上传的图片预览 */}
                            {images.map((uri, index) => (
                                <View key={index} className="relative">
                                    <View className="border border-primary rounded-lg overflow-hidden bg-muted">
                                        <Image
                                            source={{ uri }}
                                            style={{ width: 96, height: 96 }}
                                            contentFit="cover"
                                            transition={200}
                                        />
                                    </View>
                                    <TouchableOpacity
                                        onPress={() => handleRemoveImage(index)}
                                        activeOpacity={0.7}
                                        className="absolute -top-1.5 -right-1.5 bg-destructive rounded-full p-1 shadow-sm"
                                    >
                                        <X size={12} className="text-destructive-foreground" />
                                    </TouchableOpacity>
                                </View>
                            ))}

                            {/* 图片上传按钮 */}
                            {images.length < 6 && (
                                <TouchableOpacity
                                    onPress={handlePickImage}
                                    activeOpacity={0.7}
                                    disabled={isUploading}
                                    className={cn(
                                        "w-24 h-24 rounded-lg border border-primary bg-background items-center justify-center",
                                        isUploading && "opacity-50"
                                    )}
                                >
                                    {isUploading ? (
                                        <ActivityIndicator size="small" className="text-primary" />
                                    ) : (
                                        <Icon as={Camera} size={28} className="text-primary mb-1" />
                                    )}
                                </TouchableOpacity>
                            )}
                        </View>
                        <Text className="text-xs text-muted-foreground mt-2">
                            最多可上传6张图片
                        </Text>
                    </View>
                </ScrollView>

                {/* 底部提交按钮 */}
                <View className="pt-4 pb-6 border-t border-border">
                    <TouchableOpacity
                        onPress={handleSubmit}
                        activeOpacity={0.7}
                        disabled={isSubmitting || isUploading}
                        className={cn(
                            "bg-primary rounded-full py-3.5 items-center justify-center",
                            (isSubmitting || isUploading) && "opacity-70",
                        )}
                    >
                        {isSubmitting ? (
                            <ActivityIndicator size="small" className="text-primary-foreground" />
                        ) : (
                            <Text className="text-base font-semibold text-primary-foreground">
                                {isUploading ? "上传中..." : "发布"}
                            </Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </BottomSheetModal>
    );
}
