import { Ionicons } from "@expo/vector-icons";
import { useHideOrderForStaff } from "@repo/hooks/api/order";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@repo/mobile-ui/components/ui/hover-card";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { cn } from "@repo/mobile-ui/lib/utils";
import type { StaffOrderListResponse } from "@repo/types";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useRouter } from "expo-router";
import React from "react";
import {
    ActionSheetIOS,
    Alert,
    Linking,
    Platform,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { toast } from "sonner-native";

type StaffOrder = StaffOrderListResponse["items"][number];
type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

const MAP_REFERER = "dingdong-worker";
const MAP_APPS = [
    {
        name: "腾讯地图",
        url: (encodedAddress: string) =>
            `qqmap://map/search?keyword=${encodedAddress}&referer=${MAP_REFERER}`,
    },
    {
        name: "百度地图",
        url: (encodedAddress: string) =>
            `baidumap://map/geocoder?address=${encodedAddress}&src=${MAP_REFERER}`,
    },
    {
        name: "高德地图",
        url: (encodedAddress: string) => {
            const scheme = Platform.OS === "ios" ? "iosamap" : "androidamap";
            return `${scheme}://poi?sourceApplication=${MAP_REFERER}&keywords=${encodedAddress}`;
        },
    },
];

const ORDER_STATUS_DISPLAY: Record<
    string,
    {
        label: string;
        badgeClassName: string;
        textClassName: string;
    }
> = {
    pending_payment: {
        label: "待支付",
        badgeClassName: "border-chart-4 bg-chart-4/10",
        textClassName: "text-chart-4",
    },
    payment_timeout: {
        label: "支付超时",
        badgeClassName: "border-muted-foreground/30 bg-muted",
        textClassName: "text-muted-foreground",
    },
    pending_acceptance: {
        label: "待接单",
        badgeClassName: "border-chart-4 bg-chart-4/10",
        textClassName: "text-chart-4",
    },
    paid: {
        label: "待服务",
        badgeClassName: "border-chart-4 bg-chart-4/10",
        textClassName: "text-chart-4",
    },
    completed: {
        label: "已完成",
        badgeClassName: "border-primary bg-primary/10",
        textClassName: "text-primary",
    },
    cancelled: {
        label: "已取消",
        badgeClassName: "border-muted-foreground/30 bg-muted",
        textClassName: "text-muted-foreground",
    },
    refunded: {
        label: "已退款",
        badgeClassName: "border-muted-foreground/30 bg-muted",
        textClassName: "text-muted-foreground",
    },
    staff_rejected: {
        label: "已拒绝",
        badgeClassName: "border-destructive bg-destructive/10",
        textClassName: "text-destructive",
    },
};

const isHideableOrderStatus = (status: StaffOrder["status"]) =>
    status === "completed" ||
    status === "cancelled" ||
    status === "payment_timeout" ||
    status === "refunded" ||
    status === "staff_rejected";

function OrderInfoRow({
    icon,
    label,
    children,
}: {
    icon: IoniconName;
    label: string;
    children: React.ReactNode;
}) {
    return (
        <View className="flex-row items-start">
            <Ionicons name={icon} size={18} color="#6A7282" />
            <Text className="ml-2.5 w-[62px] text-sm leading-5 text-muted-foreground">
                {label}
            </Text>
            <View className="min-w-0 flex-1 flex-row items-start">
                {children}
            </View>
        </View>
    );
}

export function WorkerOrderCard({ order }: { order: StaffOrder }) {
    const router = useRouter();
    const hideOrderForStaff = useHideOrderForStaff();
    const meta =
        ORDER_STATUS_DISPLAY[order.status];
    const orderTime = formatFriendlyTime(order.createdAt);
    const appointment = formatFriendlyAppointmentTime(order.appointmentTime);
    const price = formatCurrency(order.totalAmount);
    const remark = order.remark?.trim();
    const address = order.address?.trim();
    const serviceIconUrl = order.serviceIconUrl?.trim();
    const serviceIconBlurhash = order.serviceIconBlurhash?.trim();
    const canHideOrder = isHideableOrderStatus(order.status);

    const copyOrderNumber = async (orderNumber: string) => {
        try {
            await Clipboard.setStringAsync(orderNumber);
            toast.success("订单号已复制");
        } catch {
            toast.error("复制失败，请稍后重试");
        }
    };

    const openTencentMapWeb = async (encodedAddress: string) => {
        await Linking.openURL(
            `https://apis.map.qq.com/uri/v1/search?keyword=${encodedAddress}&referer=${MAP_REFERER}`,
        );
    };

    const openAddressNavigation = async (targetAddress: string) => {
        const encodedAddress = encodeURIComponent(targetAddress);
        const installedMapApps = (
            await Promise.all(
                MAP_APPS.map(async (app) => ({
                    app,
                    supported: await Linking.canOpenURL(
                        app.url(encodedAddress),
                    ).catch(() => false),
                })),
            )
        )
            .filter((item) => item.supported)
            .map((item) => item.app);

        try {
            if (Platform.OS === "android") {
                if (installedMapApps.length === 1) {
                    await Linking.openURL(
                        installedMapApps[0].url(encodedAddress),
                    );
                    return;
                }

                await IntentLauncher.startActivityAsync(
                    "android.intent.action.VIEW",
                    {
                        data: `geo:0,0?q=${encodedAddress}`,
                    },
                );
                return;
            }

            if (installedMapApps.length === 1) {
                await Linking.openURL(installedMapApps[0].url(encodedAddress));
                return;
            }

            if (installedMapApps.length === 0) {
                await Linking.openURL(MAP_APPS[0].url(encodedAddress));
                return;
            }

            ActionSheetIOS.showActionSheetWithOptions(
                {
                    title: "选择地图应用",
                    options: [
                        ...installedMapApps.map((app) => app.name),
                        "取消",
                    ],
                    cancelButtonIndex: installedMapApps.length,
                },
                (selectedIndex) => {
                    const selectedApp = installedMapApps[selectedIndex];
                    if (!selectedApp) {
                        return;
                    }
                    void Linking.openURL(
                        selectedApp.url(encodedAddress),
                    ).catch(() => openTencentMapWeb(encodedAddress));
                },
            );
        } catch {
            try {
                await openTencentMapWeb(encodedAddress);
            } catch {
                toast.error("无法打开地图");
            }
        }
    };

    const confirmHideOrder = (orderId: string) => {
        Alert.alert(
            "删除订单",
            "删除后该订单将不再显示在你的订单列表中。",
            [
                { text: "取消", style: "cancel" },
                {
                    text: "删除",
                    style: "destructive",
                    onPress: () => {
                        hideOrderForStaff.mutate(
                            { orderId },
                            {
                                onSuccess: () => {
                                    toast.success("订单已删除");
                                },
                                onError: () => {
                                    toast.error("删除失败，请稍后重试");
                                },
                            },
                        );
                    },
                },
            ],
        );
    };

    return (
        <TouchableOpacity
            className="mb-3 rounded-[14px] border border-border/60 bg-card px-4 py-3 shadow-lg shadow-black/5"
            onPress={() => router.push(`/orders/${order.id}` as never)}
            activeOpacity={0.88}
        >
            <View className="flex-row items-start gap-3">
                {serviceIconUrl ? (
                    <Image
                        className="h-[42px] w-[42px] rounded-xl bg-muted"
                        source={{ uri: serviceIconUrl }}
                        placeholder={
                            serviceIconBlurhash
                                ? { blurhash: serviceIconBlurhash }
                                : undefined
                        }
                        style={{
                            width: 42,
                            height: 42,
                            borderRadius: 12,
                        }}
                        contentFit="cover"
                    />
                ) : (
                    <View className="h-[42px] w-[42px] items-center justify-center rounded-xl bg-muted">
                        <Text className="text-base font-semibold text-muted-foreground">
                            {order.serviceName.trim().charAt(0) || "服"}
                        </Text>
                    </View>
                )}
                <View className="min-w-0 flex-1">
                    <Text
                        className="text-lg font-bold leading-6 text-foreground"
                        numberOfLines={1}
                    >
                        {order.serviceName}
                    </Text>
                    {order.serviceSpecification ? (
                        <View className="mt-1 self-start rounded-md bg-primary/10 px-2 py-0.5">
                            <Text
                                className="text-xs font-semibold leading-4 text-primary"
                                numberOfLines={1}
                            >
                                {order.serviceSpecification}
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View
                    className={cn(
                        "min-w-[66px] items-center rounded-full border px-2.5 py-1",
                        meta.badgeClassName,
                    )}
                >
                    <Text
                        className={cn(
                            "text-sm font-semibold leading-5",
                            meta.textClassName,
                        )}
                    >
                        {meta.label}
                    </Text>
                </View>
            </View>

            <View className="my-3 h-px bg-border" />

            <View className="gap-2">
                <OrderInfoRow icon="receipt-outline" label="订单号">
                    <Text
                        className="min-w-0 max-w-[150px] text-sm leading-5 text-foreground"
                        numberOfLines={1}
                        ellipsizeMode="middle"
                        selectable
                    >
                        {order.id}
                    </Text>
                    <TouchableOpacity
                        className="ml-1 flex-row items-center rounded-full bg-primary/10 px-2 py-0.5"
                        accessibilityLabel="复制订单号"
                        hitSlop={8}
                        onPress={(event) => {
                            event.stopPropagation();
                            void copyOrderNumber(order.id);
                        }}
                    >
                        <Ionicons
                            name="copy-outline"
                            size={14}
                            color="#2196F3"
                        />
                        <Text className="ml-1 text-xs font-semibold leading-4 text-primary">
                            复制
                        </Text>
                    </TouchableOpacity>
                </OrderInfoRow>

                <OrderInfoRow icon="time-outline" label="下单时间">
                    <Text className="flex-1 text-sm leading-5 text-foreground">
                        {orderTime}
                    </Text>
                </OrderInfoRow>

                <OrderInfoRow icon="calendar-outline" label="预约时间">
                    <Text className="flex-1 text-sm leading-5 text-foreground">
                        {appointment}
                    </Text>
                </OrderInfoRow>

                <OrderInfoRow icon="location-outline" label="服务地址">
                    <Text
                        className="min-w-0 flex-1 text-sm leading-5 text-foreground"
                        numberOfLines={2}
                        selectable
                    >
                        {address || "未提供服务地址"}
                    </Text>
                    {address ? (
                        <TouchableOpacity
                            className="ml-2 flex-row items-center rounded-full px-1.5 py-0.5"
                            accessibilityLabel="打开地址导航"
                            hitSlop={8}
                            onPress={(event) => {
                                event.stopPropagation();
                                void openAddressNavigation(address);
                            }}
                        >
                            <Ionicons
                                name="navigate-circle-outline"
                                size={18}
                                color="#2196F3"
                            />
                            <Text className="ml-1 text-xs font-semibold leading-4 text-primary">
                                导航
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </OrderInfoRow>

                {remark ? (
                    <OrderInfoRow icon="document-text-outline" label="备注">
                        <Text
                            className="flex-1 text-sm leading-5 text-foreground"
                            numberOfLines={2}
                            ellipsizeMode="tail"
                            selectable
                        >
                            {remark}
                        </Text>
                    </OrderInfoRow>
                ) : null}
            </View>

            <View className="my-3 border-t border-dashed border-border" />

            <View className="flex-row items-center justify-between gap-3">
                {canHideOrder ? (
                    <HoverCard>
                        <HoverCardTrigger>
                            <Text>更多...</Text>
                        </HoverCardTrigger>
                        <HoverCardContent align="start" className="w-1/4">
                            <TouchableOpacity
                                disabled={hideOrderForStaff.isPending}
                                onPress={(event) => {
                                    event.stopPropagation();
                                    confirmHideOrder(order.id);
                                }}
                            >
                                <Text>
                                    {hideOrderForStaff.isPending
                                        ? "删除中..."
                                        : "删除"}
                                </Text>
                            </TouchableOpacity>
                        </HoverCardContent>
                    </HoverCard>
                ) : (
                    <View />
                )}
                <Text className="text-2xl font-bold leading-8 text-destructive">
                    {price}
                </Text>
            </View>
        </TouchableOpacity>
    );
}

function normalizeDate(value?: string | Date | null) {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    return date;
}

function formatFriendlyDayLabel(date: Date) {
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
    );

    if (sameDay) {
        return "今天";
    }
    if (date.toDateString() === yesterday.toDateString()) {
        return "昨天";
    }
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function formatTimeOnly(date: Date) {
    return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function formatFriendlyTime(value?: string | Date | null) {
    const date = normalizeDate(value);
    if (!date) return "--";
    return `${formatFriendlyDayLabel(date)} ${formatTimeOnly(date)}`;
}

function formatFriendlyAppointmentTime(value?: string | Date | null) {
    const date = normalizeDate(value);
    if (!date) return "--";
    const end = new Date(date.getTime() + 2 * 60 * 60 * 1000);
    return `${formatFriendlyDayLabel(date)} ${formatTimeOnly(date)}-${formatTimeOnly(end)}`;
}

function formatCurrency(value?: number | string | null) {
    const amount = typeof value === "string" ? Number(value) : (value ?? 0);
    return `¥${amount.toFixed(2)}`;
}
