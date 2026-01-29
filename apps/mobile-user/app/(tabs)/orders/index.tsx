import { Text } from "@repo/mobile-ui/components/ui/text";
import { useMemo, useState } from "react";
import { Image, Pressable, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

type OrdersTabId = "all" | "pending_payment" | "paid" | "in_progress" | "needs_review";

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

type OrderCardStatus = "pending_payment" | "cancelled" | "completed" | "paid";

type OrderCardActionVariant = "primary" | "outline" | "outlineMuted" | "outlinePrimary";

type OrderCardAction = {
    label: string;
    variant: OrderCardActionVariant;
};

type MockOrderCard = {
    id: string;
    title: string;
    status: OrderCardStatus;
    statusText: string;
    workerName: string;
    serviceName: string;
    itemCountText: string;
    appointmentText: string;
    totalAmountText: string;
    needsReview?: boolean;
    actions: readonly OrderCardAction[];
};

const MOCK_ORDERS: readonly MockOrderCard[] = [
    {
        id: "o-1",
        title: "叮咚上门直选",
        status: "pending_payment",
        statusText: "订单待付款",
        workerName: "吴师傅",
        serviceName: "家庭保洁3小时",
        itemCountText: "共1件",
        appointmentText: "2026-01-23 16:30",
        totalAmountText: "¥180.00",
        actions: [
            { label: "取消订单", variant: "outlineMuted" },
            { label: "立即支付", variant: "primary" },
        ],
    },
    {
        id: "o-2",
        title: "叮咚上门直选",
        status: "cancelled",
        statusText: "未支付取消",
        workerName: "吴师傅",
        serviceName: "家庭保洁3小时",
        itemCountText: "共1件",
        appointmentText: "2026-01-23 16:30",
        totalAmountText: "¥180.00",
        actions: [{ label: "再来一单", variant: "outline" }],
    },
    {
        id: "o-3",
        title: "叮咚上门直选",
        status: "completed",
        statusText: "已完成",
        workerName: "吴师傅",
        serviceName: "家庭保洁3小时",
        itemCountText: "共1件",
        appointmentText: "2026-01-23 16:30",
        totalAmountText: "¥180.00",
        needsReview: true,
        actions: [{ label: "评价", variant: "primary" }],
    },
    {
        id: "o-4",
        title: "叮咚上门直选",
        status: "paid",
        statusText: "待服务",
        workerName: "吴师傅",
        serviceName: "家庭保洁3小时",
        itemCountText: "共1件",
        appointmentText: "2026-01-23 16:30",
        totalAmountText: "¥180.00",
        actions: [
            { label: "查看进度", variant: "outlinePrimary" },
            { label: "确认收货", variant: "primary" },
        ],
    },
] as const;

function OrderActionButton({ action }: { action: OrderCardAction }) {
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
        <Pressable className={className}>
            <Text className={textClassName}>{action.label}</Text>
        </Pressable>
    );
}

function OrderCard({ order }: { order: MockOrderCard }) {
    const statusTextClassName =
        order.status === "pending_payment"
            ? "text-destructive"
            : order.status === "paid"
                ? "text-primary"
                : order.status === "cancelled"
                    ? "text-muted-foreground"
                    : "text-foreground";

    const workerAvatar = require("@/assets/images/promo-2.png");

    return (
        <View className="mx-4 mt-3 rounded-lg bg-card shadow-sm">
            <View className="px-3 pt-3 pb-3">
                <View className="flex-row items-center justify-between">
                    <Text className="text-sm font-puhui-regular text-foreground">{order.title}</Text>
                    <Text className={`text-sm font-puhui-regular ${statusTextClassName}`}>{order.statusText}</Text>
                </View>
            </View>

            <View className="h-px bg-border" />

            <View className="px-3 py-2">
                <View className="flex-row items-start">
                    <Image source={workerAvatar} className="h-[68px] w-[68px] rounded-sm" resizeMode="cover" />
                    <View className="ml-2 flex-1">
                        <View className="flex-row items-start justify-between">
                            <View className="flex-1 pr-2">
                                <Text className="text-sm font-puhui-regular text-foreground">{order.workerName}</Text>
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
                        <Text className="text-xs text-foreground">预约时间：</Text>
                        <Text className="text-xs text-muted-foreground">{order.appointmentText}</Text>
                    </Text>

                    <View className="flex-row items-end">
                        <Text className="font-puhui-regular text-foreground">应付总额：</Text>
                        <Text className="ml-1 font-din-alt-bold text-foreground">
                            {order.totalAmountText}
                        </Text>
                    </View>
                </View>

                <View className="mt-3 flex-row justify-end gap-4">
                    {order.actions.map((action) => (
                        <OrderActionButton key={action.label} action={action} />
                    ))}
                </View>
            </View>
        </View>
    );
}

export default function OrdersIndex() {
    const [activeTabId, setActiveTabId] = useState<OrdersTabId>("all");

    const visibleOrders = useMemo(() => {
        if (activeTabId === "all") {
            return MOCK_ORDERS;
        }
        if (activeTabId === "needs_review") {
            return MOCK_ORDERS.filter((order) => Boolean(order.needsReview));
        }
        if (activeTabId === "in_progress") {
            // 设计稿里“待验收”卡片视觉同“待服务”区块，这里仅做 mock 过滤。
            return MOCK_ORDERS.filter((order) => order.status === "paid");
        }
        return MOCK_ORDERS.filter((order) => order.status === activeTabId);
    }, [activeTabId]);

    return (
        <View className="flex-1 bg-background">
            <SafeAreaView edges={["top"]} className="bg-card">
                <View className="h-11 items-center justify-center">
                    <Text className="text-base font-puhui-medium text-foreground">订单</Text>
                </View>

                <View className="pb-2">
                    <View className="mx-4 h-[30px] flex-row items-start justify-between">
                        {TABS.map((tab) => {
                            const isActive = tab.id === activeTabId;
                            return (
                                <Pressable
                                    key={tab.id}
                                    className="items-center"
                                    onPress={() => setActiveTabId(tab.id)}
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

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingTop: 12, paddingBottom: 24 }}
            >
                {visibleOrders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                ))}
            </ScrollView>
        </View>
    );
}
