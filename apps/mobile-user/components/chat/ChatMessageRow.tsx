import { Pressable, View } from "react-native";
import { Image } from "expo-image";
import { Play } from "lucide-react-native";
import { useMemo } from "react";

import type { ChatMessage, OrderStatus } from "@repo/types";
import { useFile } from "@repo/hooks/api/files";
import { useOrderDetailQuery } from "@repo/hooks/api/order";
import { Text } from "@repo/mobile-ui/components/ui/text";

import { useLocalVideoThumbnail } from "./use-local-video-thumbnail";

export function ChatMessageRow(props: {
    message: ChatMessage;
    isOwn: boolean;
    onOpenOrder: (orderId: string) => void;
    onOpenMedia?: (messageId: string) => void;
}) {
    const { message } = props;
    const timeText = formatTime(message.createdAt);

    if (message.content.type === "text") {
        if (props.isOwn) {
            return (
                <View className="max-w-[82%] rounded-2xl bg-primary px-3 py-2">
                    <Text className="text-sm text-primary-foreground">
                        {message.content.text}
                    </Text>
                    <Text className="mt-1 text-xs text-primary-foreground">
                        {timeText}
                    </Text>
                </View>
            );
        }

        return (
            <View className="max-w-[82%] rounded-2xl border border-border bg-white px-3 py-2 dark:bg-card">
                <Text className="text-sm text-black dark:text-foreground">
                    {message.content.text}
                </Text>
                <Text className="mt-1 text-xs text-neutral-600 dark:text-muted-foreground">
                    {timeText}
                </Text>
            </View>
        );
    }

    if (message.content.type === "image") {
        return (
            <ChatImageMessage
                message={message}
                onOpenMedia={props.onOpenMedia}
                timeText={timeText}
            />
        );
    }

    if (message.content.type === "video") {
        return (
            <ChatVideoMessage
                message={message}
                onOpenMedia={props.onOpenMedia}
                timeText={timeText}
            />
        );
    }

    if (message.content.type === "order_card") {
        return (
            <ChatOrderCardMessage
                message={message}
                timeText={timeText}
                onOpenOrder={props.onOpenOrder}
            />
        );
    }

    return null;
}

function ChatOrderCardMessage(props: {
    message: ChatMessage;
    timeText: string;
    onOpenOrder: (orderId: string) => void;
}) {
    if (props.message.content.type !== "order_card") {
        return null;
    }

    const snapshot = props.message.content.snapshot;
    const orderId = props.message.content.orderId;
    const needFallbackDetail =
        !snapshot?.title || !snapshot?.totalAmount || !snapshot?.workerAvatar;

    const { data: orderDetail } = useOrderDetailQuery(orderId, {
        enabled: needFallbackDetail,
    });

    const title = resolveOrderTitle(
        snapshot?.title ?? orderDetail?.service?.name ?? undefined,
        orderId,
    );
    const serial = resolveOrderSerial(
        snapshot?.orderSerial,
        orderDetail?.orderSerial,
        orderId,
    );
    const statusText = resolveOrderStatus(
        snapshot?.status ?? resolveStatusFromCode(orderDetail?.status),
    );
    const amountText =
        formatAmountText(snapshot?.totalAmount ?? orderDetail?.totalAmount) ??
        "¥--";
    const avatarUrl =
        snapshot?.workerAvatar ??
        orderDetail?.assignment?.servicePersonnel?.avatarUrl ??
        orderDetail?.service?.imageUrl ??
        orderDetail?.service?.imageFileUrl ??
        null;
    const avatarBlurhash =
        snapshot?.workerAvatarBlurhash ??
        orderDetail?.assignment?.servicePersonnel?.avatarBlurhash ??
        orderDetail?.service?.imageBlurhash;
    const avatarSource = useMemo(
        () => (avatarUrl ? { uri: avatarUrl } : null),
        [avatarUrl],
    );
    const avatarPlaceholder = useMemo(
        () => (avatarBlurhash ? { blurhash: avatarBlurhash } : undefined),
        [avatarBlurhash],
    );
    const subline = resolveOrderSubline(
        snapshot?.workerName ?? resolveWorkerName(orderDetail),
        snapshot?.appointmentTime ?? orderDetail?.appointmentTime,
    );

    return (
        <Pressable
            onPress={() => props.onOpenOrder(orderId)}
            className="max-w-[86%] rounded-2xl border border-border bg-card px-3 py-3"
            style={{ minWidth: 260 }}
        >
            <View className="flex-row items-start justify-between">
                <Text
                    className="mr-2 flex-1 text-xs text-muted-foreground"
                    numberOfLines={1}
                >
                    订单号：{serial}
                </Text>
                <View className="rounded-md bg-destructive/10 px-2 py-1">
                    <Text className="text-xs font-puhui-medium text-destructive">
                        {statusText}
                    </Text>
                </View>
            </View>

            <View className="mt-2 flex-row items-center">
                <View className="h-16 w-16 overflow-hidden rounded-lg bg-muted">
                    {avatarSource ? (
                        <Image
                            source={avatarSource}
                            placeholder={avatarPlaceholder}
                            className="h-full w-full"
                            contentFit="cover"
                        />
                    ) : (
                        <View className="h-full w-full items-center justify-center">
                            <Text className="text-xs text-muted-foreground">
                                暂无图片
                            </Text>
                        </View>
                    )}
                </View>

                <View className="ml-2 flex-1">
                    <Text
                        className="text-base font-puhui-medium text-foreground"
                        numberOfLines={2}
                    >
                        {title}
                    </Text>
                    <Text
                        className="mt-1 text-xs text-muted-foreground"
                        numberOfLines={1}
                    >
                        {subline}
                    </Text>
                </View>

                <View className="ml-2 items-end self-stretch">
                    <Text className="text-lg font-puhui-medium text-foreground">
                        {amountText}
                    </Text>
                    <Text className="mt-2 text-xs text-muted-foreground">
                        x1
                    </Text>
                </View>
            </View>

            <View className="mt-2 flex-row justify-end">
                <Text className="text-xs text-muted-foreground">
                    {props.timeText}
                </Text>
            </View>
        </Pressable>
    );
}

function ChatImageMessage(props: {
    message: ChatMessage;
    onOpenMedia?: (messageId: string) => void;
    timeText: string;
}) {
    const content = props.message.content;
    const fileId = content.type === "image" ? content.fileId : null;
    const { data } = useFile(fileId);
    const uri = data?.fileUrl;
    const imageSource = useMemo(() => (uri ? { uri } : null), [uri]);
    const imageBlurhash =
        content.type === "image" ? content.blurhash : undefined;
    const imagePlaceholder = useMemo(
        () => (imageBlurhash ? { blurhash: imageBlurhash } : undefined),
        [imageBlurhash],
    );

    if (content.type !== "image") {
        return null;
    }

    return (
        <Pressable
            onPress={() => props.onOpenMedia?.(props.message.id)}
            className="max-w-[86%] rounded-2xl border border-border bg-card px-2 py-2"
        >
            {imageSource ? (
                <Image
                    source={imageSource}
                    placeholder={imagePlaceholder}
                    style={{ width: 220, height: 160, borderRadius: 8 }}
                    contentFit="cover"
                />
            ) : (
                <Text className="text-sm text-muted-foreground">
                    图片加载中...
                </Text>
            )}
            <Text className="mt-1 text-xs text-muted-foreground">
                {props.timeText}
            </Text>
        </Pressable>
    );
}

function ChatVideoMessage(props: {
    message: ChatMessage;
    onOpenMedia?: (messageId: string) => void;
    timeText: string;
}) {
    const content = props.message.content;
    const fileId = content.type === "video" ? content.fileId : null;
    const { data } = useFile(fileId);
    const uri = data?.fileUrl;
    const { thumbnail, isGenerating } = useLocalVideoThumbnail(uri);

    if (content.type !== "video") {
        return null;
    }

    return (
        <Pressable
            onPress={() => props.onOpenMedia?.(props.message.id)}
            className="max-w-[86%] rounded-2xl border border-border bg-card px-3 py-3"
        >
            <View className="h-36 w-[220px] items-center justify-center overflow-hidden rounded-xl bg-muted">
                {thumbnail ? (
                    <Image
                        source={thumbnail}
                        style={{ width: "100%", height: "100%" }}
                        contentFit="cover"
                    />
                ) : (
                    <Text className="text-xs text-muted-foreground">
                        {isGenerating ? "封面生成中..." : "点击播放视频"}
                    </Text>
                )}
                <View
                    className="absolute h-11 w-11 items-center justify-center rounded-full"
                    style={{ backgroundColor: "rgba(0, 0, 0, 0.35)" }}
                >
                    <Play size={18} color="#ffffff" fill="#ffffff" />
                </View>
            </View>
            <Text className="mt-1 text-xs text-muted-foreground">
                {uri ? props.timeText : "链接获取中..."}
            </Text>
        </Pressable>
    );
}

function formatTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${hour}:${minute}`;
}

function formatAmountText(value: string | number | null | undefined) {
    if (value === null || value === undefined || value === "") {
        return undefined;
    }
    const parsed = Number(value);
    if (Number.isNaN(parsed)) {
        return undefined;
    }
    return `¥${parsed.toFixed(2)}`;
}

function resolveOrderTitle(title: string | undefined, orderId: string) {
    if (title && title.trim()) {
        return title;
    }
    const shortId = orderId.slice(0, 8);
    return `订单 ${shortId}`;
}

function resolveOrderSerial(
    orderSerial: string | undefined,
    fallbackOrderSerial: string | undefined,
    orderId: string,
) {
    if (orderSerial && orderSerial.trim()) {
        return orderSerial;
    }
    if (fallbackOrderSerial && fallbackOrderSerial.trim()) {
        return fallbackOrderSerial;
    }
    return orderId.slice(0, 12);
}

function resolveOrderStatus(status: string | undefined) {
    if (!status || !status.trim()) {
        return "订单进行中";
    }
    const normalized = status.trim();
    switch (normalized) {
        case "pending_payment":
            return "待付款";
        case "pending_acceptance":
        case "paid":
            return "待服务";
        case "in_progress":
            return "待验收";
        case "completed":
            return "已完成";
        case "cancelled":
            return "已取消";
        case "payment_timeout":
            return "支付超时";
        case "refunded":
            return "已退款";
        case "staff_rejected":
            return "服务人员拒单";
        default:
            return normalized;
    }
}

function resolveStatusFromCode(status: OrderStatus | undefined) {
    if (!status) {
        return undefined;
    }
    return status;
}

function resolveWorkerName(
    orderDetail:
        | {
              assignment?: {
                  servicePersonnel?: {
                      name?: string | null;
                      userName?: string | null;
                  } | null;
              } | null;
          }
        | undefined,
) {
    return (
        orderDetail?.assignment?.servicePersonnel?.name ??
        orderDetail?.assignment?.servicePersonnel?.userName ??
        undefined
    );
}

function resolveOrderSubline(
    workerName: string | undefined,
    appointmentTime: string | Date | undefined,
) {
    const displayName = workerName?.trim() ? workerName : "订单信息";
    const displayTime = appointmentTime
        ? formatDateTimeForOrder(appointmentTime)
        : "";
    if (!displayTime) {
        return displayName;
    }
    return `${displayName}  ${displayTime}`;
}

function formatDateTimeForOrder(value: string | Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
}
