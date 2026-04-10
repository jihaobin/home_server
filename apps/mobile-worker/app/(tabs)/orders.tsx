import { Ionicons } from "@expo/vector-icons";
import { useStaffOrdersList } from "@repo/hooks/api/order";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import type { StaffOrderListResponse } from "@repo/types";
import { useRouter } from "expo-router";
import React, { Suspense, useMemo, useState } from "react";
import {
    FlatList,
    RefreshControl,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";
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
    { key: "in_progress", label: "服务中" },
    { key: "completed", label: "已完成" },
    { key: "cancelled", label: "已取消" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["key"];
type OrdersTabStatus = Exclude<StatusFilter, "all">;
type GroupedOrderRow =
    | { type: "group"; key: string; title: string; count: number }
    | { type: "order"; key: string; order: StaffOrder };

const ORDER_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
    pending_payment: { label: "待支付", color: "#FF9800" },
    payment_timeout: { label: "支付超时", color: "#9E9E9E" },
    pending_acceptance: { label: "待接单", color: "#FFB300" },
    paid: { label: "待服务", color: "#FF9800" },
    in_progress: { label: "服务中", color: "#4CAF50" },
    completed: { label: "已完成", color: "#2196F3" },
    cancelled: { label: "已取消", color: "#9E9E9E" },
    refunded: { label: "已退款", color: "#9E9E9E" },
    staff_rejected: { label: "已拒绝", color: "#9E9E9E" },
};

const DECISION_STATUS_DISPLAY: Record<
    StaffOrder["decisionStatus"],
    { label: string; color: string }
> = {
    pending: { label: "待接单确认", color: "#FFB300" },
    accepted: { label: "已确认接单", color: "#4CAF50" },
    rejected: { label: "已拒绝", color: "#9E9E9E" },
};

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
                {error.message || "请稍后重试"}
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
                <Text style={styles.subtitle}>优先显示待接单和服务中订单</Text>
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

    const renderOrderCard = ({ item }: { item: StaffOrder }) => {
        const meta =
            ORDER_STATUS_DISPLAY[item.status] ?? ORDER_STATUS_DISPLAY.cancelled;
        const orderTime = formatFriendlyTime(item.createdAt);
        const appointment = formatFriendlyAppointmentTime(item.appointmentTime);
        const price = formatCurrency(item.totalAmount);
        const decisionMeta =
            DECISION_STATUS_DISPLAY[item.decisionStatus ?? "pending"];
        const remark = item.remark?.trim();

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => router.push(`/orders/${item.id}` as never)}
            >
                <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.orderService}>
                            {item.serviceName}
                        </Text>
                        {item.serviceSpecification ? (
                            <Text style={styles.specText}>
                                {item.serviceSpecification}
                            </Text>
                        ) : null}
                    </View>
                    <View style={styles.badgesColumn}>
                        <View
                            style={[
                                styles.statusBadge,
                                { backgroundColor: meta.color },
                            ]}
                        >
                            <Text style={styles.statusText}>{meta.label}</Text>
                        </View>
                        {decisionMeta ? (
                            <View
                                style={[
                                    styles.decisionBadge,
                                    { borderColor: decisionMeta.color },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.decisionText,
                                        { color: decisionMeta.color },
                                    ]}
                                >
                                    {decisionMeta.label}
                                </Text>
                            </View>
                        ) : null}
                    </View>
                </View>

                <View style={styles.orderInfo}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>下单时间：{orderTime}</Text>
                </View>
                <View style={styles.orderInfo}>
                    <Ionicons name="calendar-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>预约时间：{appointment}</Text>
                </View>
                <View style={styles.orderInfo}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>
                        {item.address || "未提供服务地址"}
                    </Text>
                </View>
                {remark ? (
                    <View style={styles.orderInfo}>
                        <Ionicons
                            name="document-text-outline"
                            size={16}
                            color="#666"
                        />
                        <Text
                            style={styles.remarkText}
                            numberOfLines={2}
                            ellipsizeMode="tail"
                        >
                            {remark}
                        </Text>
                    </View>
                ) : null}
                <View style={styles.orderFooter}>
                    <Text style={styles.orderPrice}>{price}</Text>
                    <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() =>
                            router.push(`/orders/${item.id}` as never)
                        }
                    >
                        <Text style={styles.detailButtonText}>查看详情</Text>
                    </TouchableOpacity>
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
