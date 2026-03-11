import * as React from "react";
import { useOrderCardsListInfinite } from "@repo/hooks/api/order";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { OrderCardsTab } from "@repo/types";
import { Search, X } from "lucide-react-native";
import { ActivityIndicator, FlatList, Pressable, View } from "react-native";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { OrderCardPreview } from "../orders_screen/components/OrderCardPreview";

type PickerTab = {
    id: OrderCardsTab;
    label: string;
};

const ORDER_TABS: readonly PickerTab[] = [
    { id: "all", label: "全部" },
    { id: "pending_payment", label: "待付款" },
    { id: "paid", label: "待服务" },
    { id: "in_progress", label: "待验收" },
    { id: "needs_review", label: "待评价" },
];

export function ChatOrderPickerSheet(props: {
    visible: boolean;
    onClose: () => void;
    onSendOrderCard: (payload: {
        orderId: string;
        snapshot: {
            title?: string;
            status?: string;
            appointmentTime?: string;
            totalAmount?: string;
            workerName?: string;
            workerAvatar?: string;
            workerAvatarBlurhash?: string;
        };
    }) => void;
}) {
    const [activeTab, setActiveTab] = React.useState<OrderCardsTab>("all");
    const [keyword, setKeyword] = React.useState("");
    const cardsQuery = useOrderCardsListInfinite({ tab: activeTab, limit: 10 });

    React.useEffect(() => {
        if (!props.visible) {
            setKeyword("");
            setActiveTab("all");
        }
    }, [props.visible]);

    const rawItems = React.useMemo(() => {
        return cardsQuery.data?.pages.flatMap((page) => page.data) ?? [];
    }, [cardsQuery.data]);

    const normalizedKeyword = keyword.trim().toLowerCase();

    const items = React.useMemo(() => {
        if (!normalizedKeyword) {
            return rawItems;
        }
        return rawItems.filter((item) => {
            const fields = [
                item.title,
                item.serviceName,
                item.workerName ?? "",
                item.id,
            ];
            return fields.some((field) =>
                field.toLowerCase().includes(normalizedKeyword),
            );
        });
    }, [normalizedKeyword, rawItems]);

    const loadMore = React.useCallback(() => {
        if (cardsQuery.hasNextPage && !cardsQuery.isFetchingNextPage) {
            cardsQuery.fetchNextPage();
        }
    }, [cardsQuery]);

    return (
        <BottomSheetModal
            visible={props.visible}
            onClose={props.onClose}
            showDragIndicator={false}
            initialHeightRatio={0.78}
            minHeightRatio={0.62}
            maxHeightRatio={0.92}
            backdropClassName="bg-black/30"
            sheetClassName="rounded-t-3xl bg-card"
        >
            <View className="flex-1 px-4 pb-3">
                <View className="h-14 flex-row items-center justify-center">
                    <Text className="text-base font-puhui-medium text-foreground">
                        请选择要发送的订单
                    </Text>
                    <Pressable
                        onPress={props.onClose}
                        className="absolute right-0 h-9 w-9 items-center justify-center rounded-full bg-muted"
                    >
                        <Icon
                            as={X}
                            size={16}
                            className="text-muted-foreground"
                        />
                    </Pressable>
                </View>

                <View className="flex-row border-b border-border">
                    {ORDER_TABS.map((tab) => {
                        const isActive = tab.id === activeTab;
                        return (
                            <Pressable
                                key={tab.id}
                                onPress={() => setActiveTab(tab.id)}
                                className="mr-5 pb-2"
                            >
                                <Text
                                    className={
                                        isActive
                                            ? "text-sm font-puhui-medium text-primary"
                                            : "text-sm font-puhui-regular text-muted-foreground"
                                    }
                                >
                                    {tab.label}
                                </Text>
                                <View
                                    className={
                                        isActive
                                            ? "mt-1 h-[2px] rounded-full bg-primary"
                                            : "mt-1 h-[2px] bg-transparent"
                                    }
                                />
                            </Pressable>
                        );
                    })}
                </View>

                <View className="mt-3 h-10 flex-row items-center rounded-xl bg-muted px-3">
                    <Icon
                        as={Search}
                        size={16}
                        className="text-muted-foreground"
                    />
                    <Input
                        value={keyword}
                        onChangeText={setKeyword}
                        placeholder="搜索订单"
                        className="ml-2 flex-1 text-sm text-foreground"
                    />
                </View>

                <FlatList
                    data={items}
                    keyExtractor={(item) => item.id}
                    style={{ marginTop: 12, flex: 1 }}
                    contentContainerStyle={{ paddingBottom: 12 }}
                    keyboardShouldPersistTaps="handled"
                    keyboardDismissMode="on-drag"
                    nestedScrollEnabled
                    scrollEnabled
                    onEndReached={loadMore}
                    onEndReachedThreshold={0.2}
                    renderItem={({ item }) => (
                        <OrderPickerRow
                            title={item.title}
                            serviceName={item.serviceName}
                            amount={item.totalAmount}
                            itemCount={item.itemCount}
                            appointmentTime={item.appointmentTime}
                            workerAvatarUrl={item.workerAvatarUrl ?? null}
                            workerAvatarBlurhash={
                                item.workerAvatarBlurhash ?? null
                            }
                            onSend={() =>
                                props.onSendOrderCard({
                                    orderId: item.id,
                                    snapshot: {
                                        title: item.title,
                                        status: resolveStatusLabel(item.status),
                                        appointmentTime: item.appointmentTime,
                                        totalAmount:
                                            item.totalAmount.toFixed(2),
                                        workerName:
                                            item.workerName ?? undefined,
                                        workerAvatar:
                                            item.workerAvatarUrl ??
                                            item.workerAvatar ??
                                            undefined,
                                        workerAvatarBlurhash:
                                            item.workerAvatarBlurhash ??
                                            undefined,
                                    },
                                })
                            }
                        />
                    )}
                    ListFooterComponent={
                        cardsQuery.isFetchingNextPage ? (
                            <View className="py-3">
                                <ActivityIndicator size="small" />
                            </View>
                        ) : null
                    }
                    ListEmptyComponent={
                        cardsQuery.isLoading ? (
                            <View className="py-8">
                                <ActivityIndicator size="small" />
                            </View>
                        ) : cardsQuery.isError ? (
                            <View className="py-8">
                                <Text className="text-center text-sm text-muted-foreground">
                                    订单加载失败
                                </Text>
                            </View>
                        ) : (
                            <View className="py-8">
                                <Text className="text-center text-sm text-muted-foreground">
                                    暂无可发送订单
                                </Text>
                            </View>
                        )
                    }
                />
            </View>
        </BottomSheetModal>
    );
}

function OrderPickerRow(props: {
    title: string;
    serviceName: string;
    amount: number;
    itemCount: number;
    appointmentTime: string;
    workerAvatarUrl: string | null;
    workerAvatarBlurhash: string | null;
    onSend: () => void;
}) {
    return (
        <View className="border-b border-border py-3">
            <View className="mb-2 flex-row items-center justify-between px-1">
                <Text className="text-xs text-muted-foreground">
                    下单时间 {formatDateTime(props.appointmentTime)}
                </Text>
            </View>

            <View className="rounded-2xl border border-border bg-card px-3 py-3">
                <OrderCardPreview
                    title={props.title}
                    subtitle={props.serviceName}
                    amountText={`¥${props.amount.toFixed(2)}`}
                    imageUrl={props.workerAvatarUrl}
                    imageBlurhash={props.workerAvatarBlurhash}
                />
                <View className="mt-2 flex-row items-center justify-between px-1">
                    <Text className="text-xs text-muted-foreground">
                        x{Math.max(1, props.itemCount ?? 1)}
                    </Text>
                    <Pressable
                        onPress={props.onSend}
                        className="h-8 min-w-[58px] items-center justify-center rounded-full bg-primary px-3"
                    >
                        <Text className="text-xs font-puhui-medium text-primary-foreground">
                            发送
                        </Text>
                    </Pressable>
                </View>
            </View>
        </View>
    );
}

function formatDateTime(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "--";
    }
    const year = date.getFullYear();
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    const hour = `${date.getHours()}`.padStart(2, "0");
    const minute = `${date.getMinutes()}`.padStart(2, "0");
    return `${year}-${month}-${day} ${hour}:${minute}`;
}

function resolveStatusLabel(status: string) {
    switch (status) {
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
            return "订单";
    }
}
