import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useEffect, useMemo, useRef, useState } from "react";
import type React from "react";
import { Pressable, RefreshControl, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import type { OrderCardsTab, OrderStatus } from "@repo/types";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useOrderCardsListInfinite } from "@repo/hooks/api/order";
import { useOrderActions } from "@/components/orders_screen/hooks/useOrderActions";
import { useLocalSearchParams, useRouter } from "expo-router";
import { usePaymentCountdown } from "@/hooks/usePaymentCountdown";
import { Image as ExpoImage } from "expo-image";
import { cssInterop } from "nativewind";
import { FlashList, type FlashListRef } from "@shopify/flash-list";

// Enable NativeWind `className` on expo-image.
cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

type OrdersTabId = OrderCardsTab;

type OrdersTab = {
    id: OrdersTabId;
    label: string;
};

const TABS: readonly OrdersTab[] = [
    { id: "all", label: "全部" },
    { id: "pending_payment", label: "待付款" },
    { id: "paid", label: "待服务" },
    { id: "in_progress", label: "待验收" },
    { id: "needs_review", label: "待评价" },
];

type OrderCardActionVariant =
    | "primary"
    | "outline"
    | "outlineMuted"
    | "outlinePrimary";

type OrderCardActionKey =
    | "cancel"
    | "pay"
    | "progress"
    | "confirm"
    | "review"
    | "reorder";

type OrderCardAction = {
    key: OrderCardActionKey;
    label: string;
    variant: OrderCardActionVariant;
};

type OrderCardViewModel = {
    id: string;
    title: string;
    status: OrderStatus;
    statusText: string;
    workerName: string;
    workerAvatarUrl?: string | null;
    workerAvatarBlurhash?: string | null;
    serviceName: string;
    serviceId: string;
    servicePersonnelId?: string | null;
    totalAmount: number;
    paymentExpiresAt?: string | null;
    itemCountText: string;
    appointmentText: string;
    totalAmountText: string;
    needsReview?: boolean;
    actions: readonly OrderCardAction[];
};

const pad2 = (value: number) => String(value).padStart(2, "0");

const formatAppointmentText = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "--";
    }
    const end = new Date(date.getTime() + 2 * 60 * 60 * 1000);
    const yyyy = date.getFullYear();
    const mm = pad2(date.getMonth() + 1);
    const dd = pad2(date.getDate());
    const hh = pad2(date.getHours());
    const min = pad2(date.getMinutes());
    const endHh = pad2(end.getHours());
    const endMin = pad2(end.getMinutes());
    return `${yyyy}-${mm}-${dd} ${hh}:${min}-${endHh}:${endMin}`;
};

const formatTotalAmountText = (amount: number) => {
    if (Number.isNaN(amount)) {
        return "--";
    }
    return `¥${amount.toFixed(2)}`;
};

const resolveStatusText = (status: OrderStatus, needsReview: boolean) => {
    if (status === "completed" && needsReview) {
        return "待评价";
    }

    switch (status) {
        case "pending_payment":
            return "订单待付款";
        case "pending_acceptance":
            return "等待接单";
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
            return "--";
    }
};

const resolveActions = (
    status: OrderStatus,
    needsReview: boolean,
): readonly OrderCardAction[] => {
    if (status === "pending_payment") {
        return [
            { key: "cancel", label: "取消订单", variant: "outlineMuted" },
            { key: "pay", label: "立即支付", variant: "primary" },
        ];
    }

    if (status === "pending_acceptance") {
        return [
            { key: "cancel", label: "取消订单", variant: "outlineMuted" },
            { key: "progress", label: "查看进度", variant: "outlinePrimary" },
        ];
    }

    if (status === "paid") {
        return [
            { key: "progress", label: "查看进度", variant: "outlinePrimary" },
            // paid 状态下的“确认收货”业务含义可能会变，这里先跳详情由详情页承接。
            { key: "confirm", label: "确认收货", variant: "primary" },
        ];
    }

    if (status === "in_progress") {
        return [{ key: "confirm", label: "确认验收", variant: "primary" }];
    }

    if (status === "completed" && needsReview) {
        return [{ key: "review", label: "评价", variant: "primary" }];
    }

    if (
        status === "cancelled" ||
        status === "payment_timeout" ||
        status === "refunded" ||
        status === "staff_rejected"
    ) {
        return [{ key: "reorder", label: "再来一单", variant: "outline" }];
    }

    return [];
};

function OrderActionButton({
    action,
    onPress,
    disabled,
}: {
    action: OrderCardAction;
    onPress: () => void;
    disabled?: boolean;
}) {
    const base = "h-7 w-20 items-center justify-center rounded-full";

    const className =
        action.variant === "primary"
            ? `${base} bg-primary`
            : action.variant === "outlinePrimary"
                ? `${base} border border-primary bg-transparent`
                : `${base} border border-border bg-transparent`;

    const textClassName =
        action.variant === "primary"
            ? "text-sm font-puhui-regular text-primary-foreground"
            : action.variant === "outlinePrimary"
                ? "text-sm font-puhui-regular text-primary"
                : action.variant === "outlineMuted"
                    ? "text-sm font-puhui-regular text-muted-foreground"
                    : "text-sm font-puhui-regular text-foreground";

    return (
        <Pressable
            className={className}
            style={disabled ? { opacity: 0.6 } : undefined}
            disabled={disabled}
            onPress={onPress}
        >
            <Text className={textClassName}>{action.label}</Text>
        </Pressable>
    );
}

function OrderCard({
    order,
    onActionPress,
    actionsDisabled,
}: {
    order: OrderCardViewModel;
    onActionPress: (params: {
        order: OrderCardViewModel;
        action: OrderCardAction;
    }) => void;
    actionsDisabled?: boolean;
}) {
    const router = useRouter();

    const statusTextClassName =
        order.status === "pending_payment"
            ? "text-destructive"
            : order.status === "paid" || order.status === "pending_acceptance"
                ? "text-primary"
                : order.status === "cancelled"
                    ? "text-muted-foreground"
                    : "text-foreground";

    const workerAvatarSource = order.workerAvatarUrl
        ? { uri: order.workerAvatarUrl }
        : require("@/assets/images/promo-2.png");

    const countdown = usePaymentCountdown(order.paymentExpiresAt);
    const showPaymentCountdown = order.status === "pending_payment";

    return (
        <Pressable onPress={() => router.push(`/order/${order.id}`)} className="mx-4 mt-3 rounded-lg bg-card shadow-sm">
            <View className="px-3 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-puhui-regular text-foreground">
                        {order.title}
                    </Text>
                    <Text
                        className={`text-sm font-puhui-regular ${statusTextClassName}`}
                    >
                        {order.statusText}
                    </Text>
                </View>

                {showPaymentCountdown ? (
                    <View className="mt-2 flex-row items-center justify-between">
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            支付剩余：
                            <Text
                                className={
                                    countdown.isExpired
                                        ? "text-destructive"
                                        : "text-primary"
                                }
                            >
                                {countdown.formatted}
                            </Text>
                        </Text>
                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                            逾期将自动取消
                        </Text>
                    </View>
                ) : null}
            </View>

            <View className="h-px bg-border" />

            <View className="px-3 py-2">
                <View className="flex-row items-start">
                    <Image
                        source={workerAvatarSource}
                        placeholder={
                            order.workerAvatarBlurhash
                                ? { blurhash: order.workerAvatarBlurhash }
                                : undefined
                        }
                        contentFit="cover"
                        transition={200}
                        className="h-[68px] w-[68px] rounded-sm"
                    />
                    <View className="ml-2 flex-1">
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-2">
                                <Text className="text-sm font-puhui-regular text-foreground">
                                    {order.workerName}
                                </Text>
                                <Text className="mt-2 text-xs font-puhui-regular text-muted-foreground">
                                    {order.serviceName}
                                </Text>
                            </View>
                            <View className="w-12 items-end">
                                <Text className="mt-7 text-xs font-puhui-regular text-muted-foreground">
                                    {order.itemCountText}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>
            </View>

            <View className="h-px bg-border" />

            <View className="px-3 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                    <Text className="text-xs font-puhui-regular">
                        <Text className="text-xs text-foreground">
                            预约时间：
                        </Text>
                        <Text className="text-xs text-muted-foreground">
                            {order.appointmentText}
                        </Text>
                    </Text>

                    <View className="flex-row items-end">
                        <Text className="font-puhui-regular text-foreground">
                            应付总额：
                        </Text>
                        <Text className="ml-1 font-din-alt-bold text-foreground">
                            {order.totalAmountText}
                        </Text>
                    </View>
                </View>

                <View className="mt-3 flex-row justify-end gap-4">
                    {order.actions.map((action: OrderCardAction) => (
                        <OrderActionButton
                            key={action.key}
                            action={action}
                            disabled={actionsDisabled}
                            onPress={() => onActionPress({ order, action })}
                        />
                    ))}
                </View>
            </View>
        </Pressable>
    );
}

function OrderCardSkeleton() {
    return (
        <View className="mx-4 mt-3 rounded-lg bg-card shadow-sm">
            <View className="px-3 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                    <Skeleton className="h-4 w-28" />
                    <Skeleton className="h-4 w-16" />
                </View>
                <View className="mt-2 flex-row items-center justify-between">
                    <Skeleton className="h-3 w-32" />
                    <Skeleton className="h-3 w-20" />
                </View>
            </View>

            <View className="h-px bg-border" />

            <View className="px-3 py-2">
                <View className="flex-row items-start">
                    <Skeleton className="h-[68px] w-[68px] rounded-sm" />
                    <View className="ml-2 flex-1">
                        <Skeleton className="h-4 w-24" />
                        <Skeleton className="mt-2 h-3 w-36" />
                        <View className="mt-3 flex-row items-center justify-between">
                            <Skeleton className="h-3 w-20" />
                            <Skeleton className="h-3 w-10" />
                        </View>
                    </View>
                </View>
            </View>

            <View className="h-px bg-border" />

            <View className="px-3 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                    <Skeleton className="h-3 w-36" />
                    <Skeleton className="h-4 w-20" />
                </View>
                <View className="mt-3 flex-row justify-end gap-4">
                    <Skeleton className="h-7 w-20 rounded-full" />
                    <Skeleton className="h-7 w-20 rounded-full" />
                </View>
            </View>
        </View>
    );
}

function OrdersListSkeleton({ count = 4 }: { count?: number }) {
    return (
        <View className="flex-1">
            {Array.from({ length: count }).map((_, index) => (
                <OrderCardSkeleton key={index} />
            ))}
        </View>
    );
}

export default function OrdersIndex() {
    const [activeTabId, setActiveTabId] = useState<OrdersTabId>("all");

    const params = useLocalSearchParams<{
        tab?: string | string[];
        requestId?: string | string[];
    }>();
    const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
    const requestIdParam = Array.isArray(params.requestId)
        ? params.requestId[0]
        : params.requestId;

    const listRef = useRef<FlashListRef<OrderCardViewModel> | null>(null);

    useEffect(() => {
        if (!tabParam) {
            return;
        }
        const requestedTab = tabParam as OrdersTabId;
        const isValid = TABS.some((tab) => tab.id === requestedTab);
        if (!isValid) {
            return;
        }

        setActiveTabId((prev) => (prev === requestedTab ? prev : requestedTab));
        listRef.current?.scrollToOffset({ offset: 0, animated: false });
    }, [tabParam, requestIdParam]);

    const cardsQuery = useOrderCardsListInfinite({
        tab: activeTabId,
        limit: 10,
    });
    const rawItems = useMemo(() => {
        return cardsQuery.data?.pages.flatMap((page) => page.data) ?? [];
    }, [cardsQuery.data]);

    const visibleOrders: readonly OrderCardViewModel[] = useMemo(() => {
        return rawItems.map((item) => {
            const needsReview = Boolean(item.needsReview);
            return {
                id: item.id,
                title: item.title,
                status: item.status,
                statusText: resolveStatusText(item.status, needsReview),
                workerName: item.workerName ?? "待分配",
                workerAvatarUrl: item.workerAvatarUrl,
                workerAvatarBlurhash: item.workerAvatarBlurhash,
                serviceName: item.serviceName,
                serviceId: item.serviceId,
                servicePersonnelId: item.servicePersonnelId,
                totalAmount: item.totalAmount,
                paymentExpiresAt: item.paymentExpiresAt,
                itemCountText: `共${item.itemCount ?? 0}件`,
                appointmentText: formatAppointmentText(item.appointmentTime),
                totalAmountText: formatTotalAmountText(item.totalAmount),
                needsReview,
                actions: resolveActions(item.status, needsReview),
            };
        });
    }, [rawItems]);

    const router = useRouter();
    const {
        payExistingOrder,
        isPaying,
        cancelOrder,
        isCancelling,
        completeOrder,
        isCompleting,
        reorder,
    } = useOrderActions();

    const actionsDisabled = isPaying || isCancelling || isCompleting;

    const onActionPress = useMemo(() => {
        return async ({
            order,
            action,
        }: {
            order: OrderCardViewModel;
            action: OrderCardAction;
        }) => {
            switch (action.key) {
                case "cancel":
                    await cancelOrder({ orderId: order.id });
                    return;
                case "pay":
                    await payExistingOrder({
                        orderId: order.id,
                        amount: order.totalAmount,
                        paymentExpiresAt: order.paymentExpiresAt,
                    });
                    return;
                case "progress":
                    router.push(`/order/${order.id}`);
                    return;
                case "confirm":
                    // paid 状态下的 confirm 先走详情；in_progress 直接确认完成。
                    if (order.status === "in_progress") {
                        await completeOrder({ orderId: order.id });
                        return;
                    }
                    router.push(`/order/${order.id}`);
                    return;
                case "review":
                    router.push(`/order/${order.id}`);
                    return;
                case "reorder":
                    if (order.serviceId && order.servicePersonnelId) {
                        router.push({
                            pathname: "/servicePersonnel/[id]",
                            params: {
                                id: order.servicePersonnelId,
                                serviceId: order.serviceId,
                                serviceName: order.serviceName,
                            },
                        });
                        return;
                    }
                    reorder();
                    return;
                default:
                    return;
            }
        };
    }, [cancelOrder, completeOrder, payExistingOrder, reorder, router]);

    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <SafeAreaView edges={["top"]} className="bg-card">
                    <View className="h-11 items-center justify-center">
                        <Text className="text-base font-puhui-medium text-foreground">
                            订单
                        </Text>
                    </View>

                    <View className="pb-2">
                        <View className="mx-4 h-[30px] flex-row items-start justify-between">
                            {TABS.map((tab) => {
                                const isActive = tab.id === activeTabId;
                                return (
                                    <Pressable
                                        key={tab.id}
                                        className="items-center"
                                        onPress={() => {
                                            setActiveTabId(tab.id);
                                            listRef.current?.scrollToOffset({
                                                offset: 0,
                                                animated: false,
                                            });
                                        }}
                                    >
                                        <Text
                                            className={
                                                isActive
                                                    ? "text-sm font-puhui-regular text-primary"
                                                    : "text-sm font-puhui-regular text-muted-foreground"
                                            }
                                        >
                                            {tab.label}
                                        </Text>
                                        <View className="mt-2 h-[3px] w-11 rounded-full bg-transparent">
                                            {isActive ? (
                                                <View className="h-[3px] w-11 rounded-full bg-primary" />
                                            ) : null}
                                        </View>
                                    </Pressable>
                                );
                            })}
                        </View>
                    </View>
                </SafeAreaView>

                <FlashList
                    ref={(ref) => {
                        listRef.current = ref;
                    }}
                    data={visibleOrders as OrderCardViewModel[]}
                    keyExtractor={(item) => item.id}
                    renderItem={({ item }) => (
                        <OrderCard
                            order={item}
                            onActionPress={onActionPress}
                            actionsDisabled={actionsDisabled}
                        />
                    )}
                    contentContainerStyle={{
                        paddingTop: 12,
                        paddingBottom: 24,
                    }}
                    showsVerticalScrollIndicator={false}
                    refreshControl={
                        <RefreshControl
                            refreshing={
                                Boolean(cardsQuery.isFetching) &&
                                !cardsQuery.isFetchingNextPage
                            }
                            onRefresh={() => {
                                cardsQuery.refetch();
                            }}
                        />
                    }
                    ListEmptyComponent={
                        cardsQuery.isLoading ? (
                            <OrdersListSkeleton />
                        ) : cardsQuery.isError ? (
                            <View className="flex-1 items-center justify-center py-12">
                                <Text className="text-sm text-muted-foreground">
                                    订单加载失败
                                </Text>
                            </View>
                        ) : (
                            <View className="flex-1 items-center justify-center py-12">
                                <Text className="text-sm text-muted-foreground">
                                    暂无订单
                                </Text>
                            </View>
                        )
                    }
                    ListFooterComponent={
                        cardsQuery.isFetchingNextPage ? (
                            <View className="pb-6">
                                <OrderCardSkeleton />
                            </View>
                        ) : null
                    }
                    onEndReachedThreshold={0.2}
                    onEndReached={() => {
                        if (
                            cardsQuery.hasNextPage &&
                            !cardsQuery.isFetchingNextPage
                        ) {
                            cardsQuery.fetchNextPage();
                        }
                    }}
                />
            </View>
        </RequireAuth>
    );
}
