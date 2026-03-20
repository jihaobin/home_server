import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Textarea } from "@repo/mobile-ui/components/ui/textarea";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { useOrderCheckin, useOrderDetail } from "@repo/hooks/api/order";
import { useChatUpsertConversation } from "@repo/hooks/api/chat";
import { useOrderReview } from "@repo/hooks/api/review";
import { useCreateReview } from "@repo/hooks/api/review";
import { useUploadFiles } from "@repo/hooks/api/files";
import type { OrderStatus } from "@repo/types";
import { useOrderActions } from "@/components/orders_screen/hooks/useOrderActions";
import {
    resolveCancelOrderDescription,
    resolveCancelOrderReason,
} from "@/lib/order-cancel";
import { useConfirmDialog } from "@/hooks/useConfirmDialog";
import {
    ImageUploader,
    type ImageUploaderItem,
} from "../../components/image-uploader";
import { useQueryClient } from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import { useLocalSearchParams, useRouter } from "expo-router";
import { executeContactCustomerAction } from "@repo/mobile-ui/lib/contact-customer-action";
import {
    ChevronLeft,
    Headset,
    MessageCircle,
    MoreHorizontal,
    QrCode,
    Star,
} from "lucide-react-native";
import { Suspense, useCallback, useMemo, useState } from "react";
import {
    Image,
    RefreshControl,
    ScrollView,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";

const pad2 = (value: number) => String(value).padStart(2, "0");

function toDate(value: unknown): Date | null {
    if (!value) return null;
    const date = value instanceof Date ? value : new Date(String(value));
    return Number.isNaN(date.getTime()) ? null : date;
}

function formatDateTimeCn(value: unknown): string {
    const date = toDate(value);
    if (!date) return "--";
    const yyyy = date.getFullYear();
    const mm = pad2(date.getMonth() + 1);
    const dd = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const mi = pad2(date.getMinutes());
    const weekdays = ["日", "一", "二", "三", "四", "五", "六"];
    const wd = weekdays[date.getDay()] ?? "";
    return `${yyyy}年${mm}月${dd}日星期${wd}${hh}:${mi}`;
}

function formatMoney(amount: unknown): string {
    const value = typeof amount === "number" ? amount : Number(amount);
    if (!Number.isFinite(value)) return "--";
    return `¥${value.toFixed(2)}`;
}

function maskPhone(phone: string): string {
    const trimmed = phone.trim();
    if (trimmed.length < 7) return trimmed;
    return `${trimmed.slice(0, 3)}****${trimmed.slice(-4)}`;
}

function formatDuration(estimatedDurationMinutes: number | null | undefined) {
    if (
        !estimatedDurationMinutes ||
        !Number.isFinite(estimatedDurationMinutes)
    ) {
        return "";
    }
    if (estimatedDurationMinutes % 60 === 0) {
        return `${estimatedDurationMinutes / 60}小时`;
    }
    return `${estimatedDurationMinutes}分钟`;
}

function OrderStatusCard({ status }: { status: OrderStatus }) {
    if (status === "pending_payment") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    待支付
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    请尽快完成支付以锁定服务档期
                </Text>
                <View className="mt-3 rounded-lg bg-destructive/10 px-3 py-2">
                    <Text className="text-xs font-puhui-regular text-destructive">
                        请在11分17秒内完成支付，超时未支付自动取消订单
                    </Text>
                </View>
            </View>
        );
    }

    if (status === "pending_acceptance") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    待接单
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    服务人员待确认，请耐心等待
                </Text>
            </View>
        );
    }

    if (status === "paid") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    待服务
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    服务人员已确认，可按约定时间上门服务
                </Text>
            </View>
        );
    }

    if (status === "in_progress") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    服务中
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    服务正在进行中
                </Text>
            </View>
        );
    }

    if (status === "staff_rejected") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    服务人员已拒绝
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    客服会协助您重新预约其他服务人员
                </Text>
                <View className="mt-3 rounded-lg bg-primary/10 px-3 py-2">
                    <Text className="text-xs font-puhui-regular text-primary">
                        很抱歉，本次服务人员无法接单，您可以换个时间重新预约。
                    </Text>
                </View>
            </View>
        );
    }

    if (status === "refunded") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    已退款
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    订单已退款成功，款项预计24小时内原路返回。
                </Text>
            </View>
        );
    }

    if (status === "cancelled") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    已取消
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    订单已取消
                </Text>
            </View>
        );
    }

    if (status === "payment_timeout") {
        return (
            <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                <Text className="text-lg font-puhui-bold text-primary">
                    支付超时
                </Text>
                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                    订单支付已超时，系统自动取消
                </Text>
            </View>
        );
    }

    return (
        <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
            <Text className="text-lg font-puhui-bold text-primary">已完成</Text>
            <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                服务已完成
            </Text>
        </View>
    );
}

function OrderDetailSkeleton() {
    return (
        <View className="flex-1 items-center justify-center">
            <Text className="text-sm text-muted-foreground">加载中...</Text>
        </View>
    );
}

export default function OrderDetailScreen() {
    const router = useRouter();
    const { id } = useLocalSearchParams<{ id: string }>();

    if (!id) {
        return (
            <RequireAuth>
                <SafeAreaView className="flex-1 bg-background">
                    <View className="flex-1 items-center justify-center px-6">
                        <Text className="text-sm text-muted-foreground">
                            未找到订单 ID
                        </Text>
                    </View>
                </SafeAreaView>
            </RequireAuth>
        );
    }

    return (
        <RequireAuth>
            <SafeAreaView className="flex-1 bg-background">
                <Suspense fallback={<OrderDetailSkeleton />}>
                    <OrderDetailContent
                        orderId={id}
                        onBack={() => router.back()}
                    />
                </Suspense>
            </SafeAreaView>
        </RequireAuth>
    );
}

function OrderDetailContent({
    orderId,
    onBack,
}: {
    orderId: string;
    onBack: () => void;
}) {
    const router = useRouter();
    const orderDetailQuery = useOrderDetail(orderId);
    const order = orderDetailQuery.data;
    const queryClient = useQueryClient();
    const upsertConversation = useChatUpsertConversation();
    const { cancelOrder, isCancelling } = useOrderActions();
    const { confirm, confirmDialog } = useConfirmDialog();

    const createReview = useCreateReview();
    const uploadFiles = useUploadFiles();
    const [reviewModalVisible, setReviewModalVisible] = useState(false);
    const [draftRating, setDraftRating] = useState<number>(5);
    const [draftComment, setDraftComment] = useState<string>("");

    const MAX_REVIEW_IMAGES = 6;
    const [reviewUploaderKey, setReviewUploaderKey] = useState(0);
    const [reviewImageItems, setReviewImageItems] = useState<
        ImageUploaderItem[]
    >([]);

    const showQrCode =
        typeof order.showCheckinQr === "boolean"
            ? Boolean(order.showCheckinQr)
            : order.status === "paid" || order.status === "in_progress";
    const checkinQuery = useOrderCheckin(order.id, order.status);
    const checkin = showQrCode ? (checkinQuery.data ?? null) : null;

    const needsReview = Boolean(order.needsReview);
    const reviewQuery = useOrderReview(
        order.status === "completed" && !needsReview ? order.id : undefined,
    );
    const review = reviewQuery.data;
    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: async () => {
            const tasks: Array<Promise<unknown>> = [
                orderDetailQuery.refetch({
                    throwOnError: false,
                }),
            ];

            if (showQrCode) {
                tasks.push(
                    checkinQuery.refetch({
                        throwOnError: false,
                    }),
                );
            }

            if (order.status === "completed" && !needsReview) {
                tasks.push(
                    reviewQuery.refetch({
                        throwOnError: false,
                    }),
                );
            }

            await Promise.all(tasks);
        },
    });

    if (showPageLoading) {
        return <OrderDetailSkeleton />;
    }

    const canPay = Boolean(order.canPay);
    const canCancel = Boolean(order.canCancel);
    const hasReview = Boolean(review);

    const hasUploadingImages = reviewImageItems.some(
        (item) => item.status === "uploading",
    );
    const hasImageUploadError = reviewImageItems.some(
        (item) => item.status === "error",
    );
    const imageIds = reviewImageItems
        .map((item) => item.fileIdentifier)
        .filter((id): id is string => Boolean(id));

    const handleReviewItemsChange = useCallback(
        (items: ImageUploaderItem[]) => {
            setReviewImageItems(items);
        },
        [],
    );

    const workerName =
        order.assignment?.servicePersonnel?.name ??
        order.assignment?.servicePersonnel?.userName ??
        "待分配";

    const serviceSubTitle = useMemo(() => {
        const spec = order.specificationName;
        const duration = order.estimatedDurationMinutes;
        const suffix = formatDuration(duration);
        if (spec && suffix) return `${spec}${suffix}`;
        if (spec) return spec;
        if (suffix) return suffix;
        return "";
    }, [order]);

    const serviceTimeText = useMemo(() => {
        return formatDateTimeCn(order.appointmentTime);
    }, [order.appointmentTime]);

    const addressText = order.address?.detailedAddress ?? "--";
    const contactText = `${order.address?.recipientName ?? "--"}  ${order.address?.recipientPhone ? maskPhone(order.address.recipientPhone) : "--"}`;

    const serviceImageUri =
        order.service?.imageUrl ?? order.service?.imageFileUrl ?? null;

    const remarkText = order.remark?.trim() ? order.remark.trim() : "无";

    const paidAmountText = formatMoney(order.totalAmount);
    const servicePriceText = formatMoney(order.originalAmount);

    const copyOrderSerial = useCallback(async () => {
        try {
            await Clipboard.setStringAsync(order.orderSerial);
            toast.success("已复制");
        } catch {
            toast.error("复制失败");
        }
    }, [order.orderSerial]);

    const handleSupport = useCallback(() => {
        executeContactCustomerAction();
    }, []);

    const handleOpenWorkerChat = useCallback(async () => {
        const peerUserId = order.assignment?.servicePersonnel?.userId;
        if (!peerUserId) {
            toast.error("当前订单暂无可联系的服务人员");
            return;
        }

        try {
            const conversation = await upsertConversation.mutateAsync({
                dto: { peerUserId },
                clientRole: "customer",
            });
            router.push({
                pathname: "/chat/[conversationId]",
                params: {
                    conversationId: conversation.id,
                    peerName: workerName,
                    draftOrderId: order.id,
                },
            });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "发起私聊失败",
            );
        }
    }, [
        order.assignment?.servicePersonnel?.userId,
        order.id,
        router,
        upsertConversation,
        workerName,
    ]);

    const handlePrimaryAction = useCallback(() => {
        if (canPay) {
            toast.info("立即支付（mock）");
            return;
        }
        if (order.status === "completed" && needsReview) {
            setDraftRating(5);
            setDraftComment("");
            setReviewImageItems([]);
            setReviewUploaderKey((prev) => prev + 1);
            setReviewModalVisible(true);
            return;
        }
        toast.info("再次预约（mock）");
    }, [canPay, needsReview, order.status]);

    const handleSecondaryAction = useCallback(() => {
        if (order.status === "completed" && needsReview) {
            toast.info("再来一单（mock）");
            return;
        }
        if (canCancel) {
            void (async () => {
                const confirmed = await confirm({
                    title: "确认取消订单",
                    description: resolveCancelOrderDescription(order.status),
                    confirmText: "继续取消",
                    cancelText: "保留订单",
                    confirmVariant: "destructive",
                });
                if (!confirmed) {
                    return;
                }

                await cancelOrder({
                    orderId: order.id,
                    reason: resolveCancelOrderReason(order.status),
                });
            })();
            return;
        }
        toast.info("操作（mock）");
    }, [canCancel, cancelOrder, needsReview, order.id, order.status]);

    const shouldShowSecondaryButton =
        canCancel || (order.status === "completed" && needsReview);

    const primaryButtonText = canPay
        ? "立即支付"
        : order.status === "completed" && needsReview
          ? "评价"
          : "再次预约";

    const secondaryButtonText =
        order.status === "completed" && needsReview ? "再来一单" : "取消订单";

    const reviewTargetId = order.assignment?.servicePersonnel?.userId ?? null;

    const handleSubmitReview = useCallback(async () => {
        if (!reviewTargetId) {
            toast.error("缺少服务人员信息，无法评价");
            return;
        }
        if (
            !Number.isFinite(draftRating) ||
            draftRating < 1 ||
            draftRating > 5
        ) {
            toast.error("请选择 1-5 星评分");
            return;
        }

        if (hasUploadingImages || uploadFiles.isPending) {
            toast.error("图片上传中，请稍后再提交");
            return;
        }
        if (hasImageUploadError) {
            toast.error("存在上传失败的图片，请移除后重试");
            return;
        }

        try {
            await createReview.mutateAsync({
                orderId: order.id,
                targetId: reviewTargetId,
                targetType: "personnel",
                rating: draftRating,
                comment: draftComment.trim() ? draftComment.trim() : undefined,
                imageIds,
                isAnonymous: false,
            });
            toast.success("评价已提交");
            setReviewModalVisible(false);
            setDraftComment("");
            setReviewImageItems([]);
            setReviewUploaderKey((prev) => prev + 1);
            // 同步刷新详情页与订单列表卡片，确保 needsReview 等裁决字段更新。
            queryClient.invalidateQueries({
                queryKey: ["order-detail", order.id],
            });
            queryClient.invalidateQueries({
                queryKey: ["order-cards-list-infinite"],
            });
            queryClient.invalidateQueries({
                queryKey: ["review-by-order", order.id],
            });
        } catch (error) {
            toast.error(
                error instanceof Error ? error.message : "评价提交失败",
            );
        }
    }, [
        createReview,
        draftComment,
        draftRating,
        hasImageUploadError,
        hasUploadingImages,
        imageIds,
        order.id,
        queryClient,
        reviewTargetId,
        uploadFiles.isPending,
    ]);

    return (
        <>
            {confirmDialog}
            <View className="h-12 flex-row items-center justify-between px-4">
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={onBack}
                    className="-ml-2 px-2 py-2"
                >
                    <ChevronLeft size={22} className="text-foreground" />
                </TouchableOpacity>
                <Text className="text-base font-puhui-medium text-foreground">
                    订单详情
                </Text>
                <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={() => toast.info("更多（mock）")}
                    className="-mr-2 px-2 py-2"
                >
                    <MoreHorizontal size={22} className="text-foreground" />
                </TouchableOpacity>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
                }
            >
                <OrderStatusCard status={order.status} />

                <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                    <View className="flex-row items-center">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            服务时间：
                        </Text>
                        <Text className="ml-2 text-sm font-puhui-medium text-foreground">
                            {serviceTimeText}
                        </Text>
                    </View>
                </View>

                <View className="mx-4 mt-3 rounded-lg bg-card px-4 py-4 shadow-xs">
                    <View className="flex-row">
                        <Image
                            source={require("../../assets/images/icon-location-small.png")}
                            className="mt-0.5 h-5 w-5"
                            resizeMode="contain"
                        />
                        <View className="ml-3 flex-1">
                            <View className="flex-row flex-wrap items-center">
                                <Text className="text-sm font-puhui-medium text-foreground">
                                    {addressText}
                                </Text>
                            </View>
                            <Text className="mt-2 text-xs font-puhui-regular text-muted-foreground">
                                {contactText}
                            </Text>
                        </View>
                    </View>
                </View>

                {showQrCode ? (
                    <View className="mx-4 mt-3 overflow-hidden rounded-lg bg-card shadow-xs">
                        <View className="flex-row items-center px-4 py-3">
                            <QrCode size={16} className="text-foreground" />
                            <Text className="ml-2 text-sm font-puhui-medium text-foreground">
                                服务核验二维码
                            </Text>
                        </View>
                        <View className="h-px bg-border/60" />
                        <View className="items-center px-4 py-4">
                            {checkin?.qrCodeDataUrl ? (
                                <Image
                                    source={{ uri: checkin.qrCodeDataUrl }}
                                    className="h-52 w-52"
                                    resizeMode="contain"
                                />
                            ) : (
                                <View className="h-52 w-52 items-center justify-center">
                                    <Text className="text-xs text-muted-foreground">
                                        {checkinQuery.isLoading
                                            ? "二维码生成中..."
                                            : "暂无二维码"}
                                    </Text>
                                </View>
                            )}
                            <Text className="mt-3 text-xs font-puhui-regular text-muted-foreground">
                                请出示此二维码供服务人员扫码核验
                            </Text>
                            <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                {checkin?.expiresAt
                                    ? `有效期至${formatDateTimeCn(checkin.expiresAt)}`
                                    : ""}
                            </Text>
                        </View>
                    </View>
                ) : null}

                <View className="mx-4 mt-3 overflow-hidden rounded-lg bg-card shadow-xs">
                    <View className="px-4 py-3">
                        <Text className="text-sm font-puhui-medium text-foreground">
                            服务详情
                        </Text>
                    </View>
                    <View className="h-px bg-border/60" />
                    <View className="px-4 py-4">
                        <View className="flex-row items-center">
                            <Image
                                source={
                                    serviceImageUri
                                        ? { uri: serviceImageUri }
                                        : require("../../assets/images/category-home-cleaning.png")
                                }
                                className="h-14 w-14 rounded-md"
                                resizeMode="cover"
                            />
                            <View className="ml-3 flex-1">
                                <Text className="text-sm font-puhui-medium text-foreground">
                                    {workerName}
                                </Text>
                                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                    {serviceSubTitle}
                                </Text>
                            </View>
                            <View className="items-end">
                                <Text className="text-sm font-din-alt-bold text-foreground">
                                    {servicePriceText}
                                </Text>
                                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                    共1件
                                </Text>
                            </View>
                        </View>
                    </View>
                    <View className="bg-background px-4 py-3">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-puhui-regular text-muted-foreground">
                                实付金额：
                            </Text>
                            <Text className="text-sm font-din-alt-bold text-primary">
                                {paidAmountText}
                            </Text>
                        </View>
                    </View>
                </View>

                {order.status === "completed" && hasReview ? (
                    <View className="mx-4 mt-3 overflow-hidden rounded-lg bg-card shadow-xs">
                        <View className="px-4 py-3">
                            <Text className="text-sm font-puhui-medium text-foreground">
                                我的评价
                            </Text>
                            <Text className="mt-2 text-xs font-puhui-regular text-muted-foreground">
                                {review?.createdAt
                                    ? `发布于${formatDateTimeCn(review.createdAt)}`
                                    : ""}
                            </Text>
                            <View className="mt-3 flex-row items-center">
                                {Array.from({ length: 5 }).map((_, idx) => {
                                    const rating =
                                        typeof review?.rating === "number"
                                            ? review.rating
                                            : 0;
                                    const active = idx < rating;
                                    return (
                                        <Icon
                                            key={`mock-review-star-${idx}`}
                                            as={Star}
                                            size={16}
                                            className={
                                                active
                                                    ? "text-primary"
                                                    : "text-muted-foreground/30"
                                            }
                                            fill={
                                                active ? "currentColor" : "none"
                                            }
                                        />
                                    );
                                })}
                            </View>
                            <Text className="mt-2 text-sm font-puhui-medium text-foreground">
                                {review?.comment?.trim() || ""}
                            </Text>
                            <View className="mt-3 flex-row items-center gap-3">
                                {(review?.images ?? [])
                                    .slice(0, 3)
                                    .map((img, idx) => (
                                        <Image
                                            key={`review-image-${idx}`}
                                            source={{ uri: img.url }}
                                            className="h-16 w-16 rounded-md"
                                            resizeMode="cover"
                                        />
                                    ))}
                            </View>
                        </View>
                    </View>
                ) : null}

                <View className="mx-4 mt-3 mb-4 rounded-lg bg-card px-4 py-4 shadow-xs">
                    <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            订单编号：
                        </Text>
                        <View className="flex-row items-center">
                            <Text className="text-sm font-puhui-regular text-foreground">
                                {order.orderSerial}
                            </Text>
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={() => void copyOrderSerial()}
                                className="ml-3"
                            >
                                <Text className="text-sm font-puhui-medium text-primary">
                                    复制
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            下单时间：
                        </Text>
                        <Text className="text-sm font-puhui-regular text-foreground">
                            {formatDateTimeCn(order.createdAt)}
                        </Text>
                    </View>

                    <View className="mt-3 flex-row items-center justify-between">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            订单备注：
                        </Text>
                        <Text className="text-sm font-puhui-regular text-foreground">
                            {remarkText}
                        </Text>
                    </View>
                </View>
            </ScrollView>

            <View className="border-t border-border/50 bg-card px-4 py-3">
                <View className="flex-row items-center gap-2">
                    <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handleSupport}
                            className="min-w-0 flex-1 flex-row items-center justify-center px-1 py-2"
                        >
                            <Headset
                                size={15}
                                className="text-muted-foreground"
                            />
                            <Text
                                className="ml-1 text-[11px] font-puhui-regular text-muted-foreground"
                                numberOfLines={1}
                            >
                                咨询客服
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={() => void handleOpenWorkerChat()}
                            className="min-w-0 flex-1 flex-row items-center justify-center px-1 py-2"
                        >
                            <MessageCircle
                                size={15}
                                className="text-muted-foreground"
                            />
                            <Text
                                className="ml-1 text-[11px] font-puhui-regular text-muted-foreground"
                                numberOfLines={1}
                            >
                                联系服务人员
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View className="min-w-0 flex-1 flex-row items-center gap-2">
                        {shouldShowSecondaryButton ? (
                            <TouchableOpacity
                                activeOpacity={0.7}
                                onPress={handleSecondaryAction}
                                disabled={canCancel && isCancelling}
                                style={
                                    canCancel && isCancelling
                                        ? { opacity: 0.6 }
                                        : undefined
                                }
                                className="h-11 min-w-0 flex-1 items-center justify-center rounded-full border border-border bg-card px-2"
                            >
                                <Text
                                    className="text-xs font-puhui-medium text-muted-foreground"
                                    numberOfLines={1}
                                >
                                    {secondaryButtonText}
                                </Text>
                            </TouchableOpacity>
                        ) : null}

                        <TouchableOpacity
                            activeOpacity={0.7}
                            onPress={handlePrimaryAction}
                            className="h-11 min-w-0 flex-1 items-center justify-center rounded-full bg-primary px-2"
                        >
                            <Text
                                className="text-xs font-puhui-medium text-primary-foreground"
                                numberOfLines={1}
                            >
                                {primaryButtonText}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>

            <BottomSheetModal
                visible={reviewModalVisible}
                onClose={() => setReviewModalVisible(false)}
                backdropClassName="bg-foreground/30"
                sheetClassName="bg-card"
                initialHeightRatio={0.55}
                minHeightRatio={0.45}
                maxHeightRatio={0.75}
            >
                <View className="flex-1 px-5 pb-6">
                    <Text className="text-base font-puhui-medium text-foreground">
                        发表评价
                    </Text>
                    <Text className="mt-2 text-xs font-puhui-regular text-muted-foreground">
                        给本次服务打个分吧（1-5 星）
                    </Text>

                    <View className="mt-4 flex-row items-center">
                        {Array.from({ length: 5 }).map((_, idx) => {
                            const value = idx + 1;
                            const active = value <= draftRating;
                            return (
                                <TouchableOpacity
                                    key={`review-star-${value}`}
                                    activeOpacity={0.7}
                                    onPress={() => setDraftRating(value)}
                                    className="mr-2"
                                >
                                    <Icon
                                        as={Star}
                                        size={22}
                                        className={
                                            active
                                                ? "text-primary"
                                                : "text-muted-foreground"
                                        }
                                        fill={active ? "currentColor" : "none"}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View className="mt-4">
                        <Textarea
                            value={draftComment}
                            onChangeText={setDraftComment}
                            placeholder="说说你的体验（可选）"
                            editable={!createReview.isPending}
                        />
                    </View>

                    <View className="mt-4">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-sm font-puhui-medium text-foreground">
                                图片（{reviewImageItems.length}/
                                {MAX_REVIEW_IMAGES}）
                            </Text>
                        </View>
                        <View className="mt-3">
                            <ImageUploader
                                key={`review-uploader-${reviewUploaderKey}`}
                                multiple
                                maxCount={MAX_REVIEW_IMAGES}
                                size={64}
                                borderRadius={8}
                                disabled={createReview.isPending}
                                onItemsChange={handleReviewItemsChange}
                                onUploadMultiple={async (files) => {
                                    const uploaded =
                                        await uploadFiles.mutateAsync({
                                            files: files.map((file) => ({
                                                file,
                                            })),
                                        });
                                    return uploaded.map((item) => ({
                                        fileIdentifier: item.id,
                                        fileUrl: item.fileUrl,
                                    }));
                                }}
                            />
                        </View>
                        {hasImageUploadError ? (
                            <Text className="mt-2 text-xs text-destructive">
                                有图片上传失败，可点击失败图片的“重试”，或点右上角“×”删除。
                            </Text>
                        ) : null}
                    </View>

                    <View className="mt-5 flex-row items-center justify-end gap-3">
                        <Button
                            variant="outline"
                            onPress={() => setReviewModalVisible(false)}
                            disabled={createReview.isPending}
                        >
                            <Text>取消</Text>
                        </Button>
                        <Button
                            onPress={() => void handleSubmitReview()}
                            disabled={
                                createReview.isPending ||
                                hasUploadingImages ||
                                Boolean(uploadFiles.isPending)
                            }
                        >
                            <Text>
                                {createReview.isPending
                                    ? "提交中..."
                                    : "提交评价"}
                            </Text>
                        </Button>
                    </View>
                </View>
            </BottomSheetModal>
        </>
    );
}
