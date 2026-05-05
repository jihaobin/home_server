import { Ionicons } from "@expo/vector-icons";
import {
    useHideOrderForStaff,
    useStaffOrdersList,
} from "@repo/hooks/api/order";
import { cn } from "@repo/mobile-ui/lib/utils";
import {
    HoverCard,
    HoverCardContent,
    HoverCardTrigger,
} from "@repo/mobile-ui/components/ui/hover-card";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import type { StaffOrderListResponse } from "@repo/types";
import * as Clipboard from "expo-clipboard";
import * as IntentLauncher from "expo-intent-launcher";
import { useRouter } from "expo-router";
import React, { Suspense, useMemo, useState } from "react";
import {
    Alert,
    ActionSheetIOS,
    FlatList,
    Linking,
    Platform,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";
import { toast } from "sonner-native";
import {
    buildWorkerOrderGroups,
    sortWorkerOrdersForTab,
} from "../../lib/order-priority";

type StaffOrder = StaffOrderListResponse["items"][number];


const STATUS_TABS = [
    { key: "all", label: "全部" },
    {
        key: "pending_acceptance",
        label: "待接单",
    },
    { key: "paid", label: "待服务" },
    { key: "completed", label: "已完成" },
    { key: "cancelled", label: "已取消" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["key"];
type OrdersTabStatus = Exclude<StatusFilter, "all">;
type GroupedOrderRow =
    | { type: "group"; key: string; title: string; count: number }
    | { type: "order"; key: string; order: StaffOrder };

type MapApp = {
    name: string;
    url: (encodedAddress: string) => string;
};

const MAP_REFERER = "dingdong-worker";
const MAP_APPS: MapApp[] = [
    {
        name: "腾讯地图",
        url: (encodedAddress) =>
            `qqmap://map/search?keyword=${encodedAddress}&referer=${MAP_REFERER}`,
    },
    {
        name: "百度地图",
        url: (encodedAddress) =>
            `baidumap://map/geocoder?address=${encodedAddress}&src=${MAP_REFERER}`,
    },
    {
        name: "高德地图",
        url: (encodedAddress) => {
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

type IoniconName = React.ComponentProps<typeof Ionicons>["name"];

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

const isHideableOrderStatus = (status: StaffOrder["status"]) =>
    status === "completed" ||
    status === "cancelled" ||
    status === "payment_timeout" ||
    status === "refunded" ||
    status === "staff_rejected";

function OrdersErrorFallback({
    error,
    resetErrorBoundary,
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) {
    return (
        <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>订单加载失败</Text>
            <Text style={styles.errorMessage}>
                {"请稍后重试"}
            </Text>
            <TouchableOpacity
                style={styles.retryButton}
                onPress={resetErrorBoundary}
            >
                <Text style={styles.retryText}>重新加载</Text>
            </TouchableOpacity>
        </View>
    );
}

function OrdersContent() {
    const [selectedTab, setSelectedTab] = useState<StatusFilter>("all");
    const statusParam =
        selectedTab === "all" ? undefined : (selectedTab as OrdersTabStatus);
    const decisionStatusFilter =
        selectedTab === "pending_acceptance"
            ? ("pending" as StaffOrder["decisionStatus"])
            : undefined;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>我的订单</Text>
                <Text style={styles.subtitle}>优先显示待接单和待服务订单</Text>
            </View>

            <View style={styles.tabsContainer}>
                <FlatList
                    data={STATUS_TABS}
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => {
                        const isActive = selectedTab === item.key;
                        return (
                            <TouchableOpacity
                                style={[
                                    styles.tabButton,
                                    isActive && styles.tabButtonActive,
                                ]}
                                onPress={() => setSelectedTab(item.key)}
                            >
                                <Text
                                    style={[
                                        styles.tabText,
                                        isActive && styles.tabTextActive,
                                    ]}
                                >
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        );
                    }}
                    contentContainerStyle={styles.tabsContent}
                />
            </View>

            <View style={styles.listWrapper}>
                <Suspense fallback={<OrdersListSkeleton />}>
                    <OrdersList
                        status={statusParam}
                        decisionStatusFilter={decisionStatusFilter}
                    />
                </Suspense>
            </View>
        </View>
    );
}

export default function OrdersScreen() {
    return (
        <ErrorBoundary FallbackComponent={OrdersErrorFallback}>
            <OrdersContent />
        </ErrorBoundary>
    );
}

function OrdersList({
    status,
    decisionStatusFilter,
}: {
    status?: OrdersTabStatus;
    decisionStatusFilter?: StaffOrder["decisionStatus"];
}) {
    const router = useRouter();

    const { data, refetch, isFetching } = useStaffOrdersList({
        page: 1,
        limit: 20,
        status,
        sortOrder: "asc",
    });
    const hideOrderForStaff = useHideOrderForStaff();
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            refetch({
                throwOnError: false,
            }),
    });

    const orders = useMemo(() => data?.items ?? [], [data]);
    const isAllTabView = !status && !decisionStatusFilter;
    const sortedOrders = useMemo(
        () =>
            sortWorkerOrdersForTab(orders, {
                statusFilter: status,
                decisionStatusFilter,
            }),
        [decisionStatusFilter, orders, status],
    );
    const groupedRows = useMemo<GroupedOrderRow[]>(() => {
        if (!isAllTabView) {
            return [];
        }
        return buildWorkerOrderGroups(orders).flatMap((group) => {
            const rows: GroupedOrderRow[] = [
                {
                    type: "group",
                    key: `group-${group.key}`,
                    title: group.title,
                    count: group.items.length,
                },
            ];
            for (const order of group.items) {
                rows.push({
                    type: "order",
                    key: `order-${order.id}`,
                    order,
                });
            }
            return rows;
        });
    }, [isAllTabView, orders]);

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

    const openAddressNavigation = async (address: string) => {
        const encodedAddress = encodeURIComponent(address);
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

    const renderOrderCard = ({ item }: { item: StaffOrder }) =>{
        const meta =
            ORDER_STATUS_DISPLAY[item.status] ?? ORDER_STATUS_DISPLAY.cancelled;
        const orderTime = formatFriendlyTime(item.createdAt);
        const appointment = formatFriendlyAppointmentTime(item.appointmentTime);
        const price = formatCurrency(item.totalAmount);
        const remark = item.remark?.trim();
        const address = item.address?.trim();
        const serviceIconUrl = item.serviceIconUrl?.trim();
        const serviceIconBlurhash = item.serviceIconBlurhash?.trim();
        const canHideOrder = isHideableOrderStatus(item.status);

        return (
            <TouchableOpacity
                className="mb-3 rounded-[14px] border border-border/60 bg-card px-4 py-3 shadow-lg shadow-black/5"
                onPress={() => router.push(`/orders/${item.id}` as never)}
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
                            contentFit="cover"
                        />
                    ) : (
                        <View className="h-[42px] w-[42px] items-center justify-center rounded-xl bg-muted">
                            <Text className="text-base font-semibold text-muted-foreground">
                                {item.serviceName.trim().charAt(0) || "服"}
                            </Text>
                        </View>
                    )}
                    <View className="min-w-0 flex-1">
                        <Text
                            className="text-lg font-bold leading-6 text-foreground"
                            numberOfLines={1}
                        >
                            {item.serviceName}
                        </Text>
                        {item.serviceSpecification ? (
                            <View className="mt-1 self-start rounded-md bg-primary/10 px-2 py-0.5">
                                <Text
                                    className="text-xs font-semibold leading-4 text-primary"
                                    numberOfLines={1}
                                >
                                    {item.serviceSpecification}
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
                            {item.id}
                        </Text>
                        <TouchableOpacity
                            className="ml-1 flex-row items-center rounded-full bg-primary/10 px-2 py-0.5"
                            accessibilityLabel="复制订单号"
                            hitSlop={8}
                            onPress={(event) => {
                                event.stopPropagation();
                                void copyOrderNumber(item.id);
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
                        <OrderInfoRow
                            icon="document-text-outline"
                            label="备注"
                        >
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
                                        confirmHideOrder(item.id);
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
    };

    const renderGroupedRow = ({ item }: { item: GroupedOrderRow }) => {
        if (item.type === "group") {
            return (
                <View style={styles.groupHeader}>
                    <Text style={styles.groupTitle}>{item.title}</Text>
                    <Text style={styles.groupCount}>{item.count} 单</Text>
                </View>
            );
        }
        return renderOrderCard({ item: item.order });
    };

    const emptyView = (
        <View style={styles.emptyContainer}>
            <Ionicons name="cube-outline" size={48} color="#bbb" />
            <Text style={styles.emptyText}>暂无相关订单</Text>
        </View>
    );

    if (isAllTabView) {
        return (
            <FlatList
                data={groupedRows}
                keyExtractor={(item) => item.key}
                contentContainerStyle={styles.listContent}
                renderItem={renderGroupedRow}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || isFetching}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#2196F3"
                    />
                }
                ListEmptyComponent={emptyView}
            />
        );
    }

    return (
        <FlatList
            data={sortedOrders}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            renderItem={renderOrderCard}
            refreshControl={
                <RefreshControl
                    refreshing={refreshing || isFetching}
                    onRefresh={() => {
                        void onRefresh();
                    }}
                    tintColor="#2196F3"
                />
            }
            ListEmptyComponent={emptyView}
        />
    );
}

function OrdersListSkeleton() {
    return (
        <View style={styles.skeletonList}>
            {Array.from({ length: 3 }).map((_, index) => (
                <View key={index} style={styles.skeletonCard}>
                    <View style={styles.skeletonHeader}>
                        <View style={styles.skeletonLineLong} />
                        <View style={styles.skeletonBadge} />
                    </View>
                    <View style={styles.skeletonLine} />
                    <View style={styles.skeletonLineShort} />
                    <View style={styles.skeletonFooter}>
                        <View style={styles.skeletonPrice} />
                        <View style={styles.skeletonButton} />
                    </View>
                </View>
            ))}
        </View>
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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    header: {
        paddingHorizontal: 16,
        paddingTop: 48,
        paddingBottom: 16,
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    listWrapper: {
        flex: 1,
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    subtitle: {
        marginTop: 4,
        fontSize: 14,
        color: "#666",
    },
    tabsContainer: {
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    tabsContent: {
        flexDirection: "row",
        paddingHorizontal: 16,
        paddingVertical: 8,
    },
    tabButton: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        marginRight: 8,
        borderRadius: 14,
        backgroundColor: "#F1F1F1",
    },
    tabButtonActive: {
        backgroundColor: "#2196F3",
    },
    tabText: {
        fontSize: 14,
        color: "#666",
    },
    tabTextActive: {
        color: "white",
        fontWeight: "bold",
    },
    listContent: {
        padding: 16,
        paddingBottom: 40,
    },
    groupHeader: {
        marginBottom: 8,
        paddingHorizontal: 2,
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    groupTitle: {
        fontSize: 14,
        color: "#555",
        fontWeight: "bold",
    },
    groupCount: {
        fontSize: 12,
        color: "#999",
    },
    orderCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    orderService: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    specText: {
        marginTop: 4,
        fontSize: 12,
        color: "#999",
    },
    badgesColumn: {
        alignItems: "flex-end",
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: "white",
        fontSize: 12,
        fontWeight: "bold",
    },
    decisionBadge: {
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderWidth: 1,
        borderRadius: 10,
    },
    decisionText: {
        fontSize: 11,
        fontWeight: "bold",
    },
    orderInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    orderNumberRow: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 4,
    },
    orderNumberText: {
        flexShrink: 1,
        marginLeft: 8,
        marginRight: 4,
        fontSize: 13,
        color: "#666",
    },
    copyButton: {
        width: 32,
        height: 32,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 16,
        backgroundColor: "#E3F2FD",
    },
    infoText: {
        fontSize: 14,
        color: "#666",
        marginLeft: 8,
        flex: 1,
    },
    remarkText: {
        fontSize: 14,
        color: "#444",
        marginLeft: 8,
        flex: 1,
    },
    orderFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 16,
    },
    orderPrice: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#FF5722",
    },
    detailButton: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 20,
        backgroundColor: "#2196F3",
    },
    detailButtonText: {
        color: "white",
        fontSize: 14,
        fontWeight: "bold",
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 80,
    },
    emptyText: {
        fontSize: 16,
        color: "#999",
        marginTop: 16,
    },
    skeletonList: {
        padding: 16,
    },
    skeletonCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    skeletonHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    skeletonLineLong: {
        height: 16,
        borderRadius: 8,
        backgroundColor: "#E0E0E0",
        width: "60%",
    },
    skeletonLine: {
        height: 12,
        borderRadius: 6,
        backgroundColor: "#E0E0E0",
        marginBottom: 8,
    },
    skeletonLineShort: {
        height: 12,
        borderRadius: 6,
        backgroundColor: "#E0E0E0",
        width: "50%",
        marginBottom: 12,
    },
    skeletonBadge: {
        width: 72,
        height: 20,
        borderRadius: 10,
        backgroundColor: "#E0E0E0",
    },
    skeletonFooter: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 8,
    },
    skeletonPrice: {
        width: 80,
        height: 18,
        borderRadius: 8,
        backgroundColor: "#E0E0E0",
    },
    skeletonButton: {
        width: 90,
        height: 28,
        borderRadius: 14,
        backgroundColor: "#E0E0E0",
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#d32f2f",
    },
    errorMessage: {
        marginTop: 8,
        color: "#666",
        textAlign: "center",
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#2196F3",
    },
    retryText: {
        color: "white",
        fontWeight: "bold",
    },
});
