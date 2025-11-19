import { Ionicons } from "@expo/vector-icons";
import { useStaffOrdersList } from "@repo/hooks/api/order";
import type { StaffOrderListResponse } from "@repo/types";
import { useRouter } from "expo-router";
import React, { Suspense, useCallback, useMemo, useState } from "react";
import {
    ActivityIndicator,
    FlatList,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";

const STATUS_TABS = [
    { key: "all", label: "全部" },
    { key: "paid", label: "待服务" },
    { key: "in_progress", label: "服务中" },
    { key: "completed", label: "已完成" },
    { key: "cancelled", label: "已取消" },
] as const;

type StatusFilter = (typeof STATUS_TABS)[number]["key"];

type StaffOrder = StaffOrderListResponse["items"][number];

const ORDER_STATUS_DISPLAY: Record<string, { label: string; color: string }> = {
    pending_payment: { label: "待支付", color: "#FF9800" },
    paid: { label: "待服务", color: "#FF9800" },
    in_progress: { label: "服务中", color: "#4CAF50" },
    completed: { label: "已完成", color: "#2196F3" },
    cancelled: { label: "已取消", color: "#9E9E9E" },
    refunded: { label: "已退款", color: "#9E9E9E" },
};

function OrdersSkeleton() {
    return (
        <View style={styles.skeletonContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.skeletonText}>订单加载中...</Text>
        </View>
    );
}

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
            <Text style={styles.errorMessage}>{error.message || "请稍后重试"}</Text>
            <TouchableOpacity style={styles.retryButton} onPress={resetErrorBoundary}>
                <Text style={styles.retryText}>重新加载</Text>
            </TouchableOpacity>
        </View>
    );
}

function OrdersContent() {
    const router = useRouter();
    const [selectedTab, setSelectedTab] = useState<StatusFilter>("all");
    const [refreshing, setRefreshing] = useState(false);

    const { data, refetch, isFetching } = useStaffOrdersList({
        page: 1,
        limit: 20,
        status: selectedTab === "all" ? undefined : selectedTab,
        onlyAccepted: true,
        sortOrder: "asc"
    });

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await refetch();
        } catch (error) {
            console.error("刷新订单列表失败", error);
        } finally {
            setRefreshing(false);
        }
    }, [refetch]);

    const orders = data.items ?? [];

    const sortedOrders = useMemo(() => {
        return [...orders].sort((a, b) => {
            const dateA = new Date(a.appointmentTime ?? Date.now()).getTime();
            const dateB = new Date(b.appointmentTime ?? Date.now()).getTime();
            return dateB - dateA;
        });
    }, [orders]);

    const renderOrderCard = ({ item }: { item: StaffOrder }) => {
        const meta = ORDER_STATUS_DISPLAY[item.status] ?? ORDER_STATUS_DISPLAY.cancelled;
        const appointment = formatDateTime(item.appointmentTime);
        const price = formatCurrency(item.totalAmount);

        return (
            <TouchableOpacity
                style={styles.orderCard}
                onPress={() => router.push(`/orders/${item.id}` as never)}
            >
                <View style={styles.orderHeader}>
                    <View style={{ flex: 1 }}>
                        <Text style={styles.orderService}>{item.serviceName}</Text>
                        {item.serviceSpecification ? (
                            <Text style={styles.specText}>{item.serviceSpecification}</Text>
                        ) : null}
                    </View>
                    <View style={[styles.statusBadge, { backgroundColor: meta.color }]}>
                        <Text style={styles.statusText}>{meta.label}</Text>
                    </View>
                </View>

                <View style={styles.orderInfo}>
                    <Ionicons name="time-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{appointment}</Text>
                </View>
                <View style={styles.orderInfo}>
                    <Ionicons name="location-outline" size={16} color="#666" />
                    <Text style={styles.infoText}>{item.address || "未提供服务地址"}</Text>
                </View>
                <View style={styles.orderFooter}>
                    <Text style={styles.orderPrice}>{price}</Text>
                    <TouchableOpacity
                        style={styles.detailButton}
                        onPress={() => router.push(`/orders/${item.id}` as never)}
                    >
                        <Text style={styles.detailButtonText}>查看详情</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        );
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>我的订单</Text>
                <Text style={styles.subtitle}>基于状态查看预约进展</Text>
            </View>

            <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                style={styles.tabsContainer}
                contentContainerStyle={styles.tabsContent}
            >
                {STATUS_TABS.map((tab) => {
                    const isActive = selectedTab === tab.key;
                    return (
                        <TouchableOpacity
                            key={tab.key}
                            style={[styles.tabButton, isActive && styles.tabButtonActive]}
                            onPress={() => setSelectedTab(tab.key)}
                        >
                            <Text style={[styles.tabText, isActive && styles.tabTextActive]}>
                                {tab.label}
                            </Text>
                        </TouchableOpacity>
                    );
                })}
            </ScrollView>

            <FlatList
                data={sortedOrders}
                keyExtractor={(item) => item.id}
                contentContainerStyle={styles.listContent}
                renderItem={renderOrderCard}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || isFetching}
                        onRefresh={handleRefresh}
                        tintColor="#2196F3"
                    />
                }
                ListEmptyComponent={
                    <View style={styles.emptyContainer}>
                        <Ionicons name="cube-outline" size={48} color="#bbb" />
                        <Text style={styles.emptyText}>暂无相关订单</Text>
                    </View>
                }
            />
        </View>
    );
}

export default function OrdersScreen() {
    return (
        <ErrorBoundary FallbackComponent={OrdersErrorFallback}>
            <Suspense fallback={<OrdersSkeleton />}>
                <OrdersContent />
            </Suspense>
        </ErrorBoundary>
    );
}

function formatDateTime(value?: string | Date | null) {
    if (!value) return "--";
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return "--";
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const dd = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mi = `${date.getMinutes()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

function formatCurrency(value?: number | string | null) {
    const amount = typeof value === "string" ? Number(value) : value ?? 0;
    return `¥${amount.toFixed(2)}`;
}

const styles = StyleSheet.create({
    container: {
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
    skeletonContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    skeletonText: {
        marginTop: 12,
        color: "#666",
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
