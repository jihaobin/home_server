import { Ionicons } from "@expo/vector-icons";
import { useStaffOrdersList } from "@repo/hooks/api/order";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import type { StaffOrderListResponse } from "@repo/types";
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
import { WorkerOrderCard } from "@/components/orders/worker-order-card";

type StaffOrder = StaffOrderListResponse["items"][number];
type StaffOrderGroup = NonNullable<StaffOrderListResponse["groups"]>[number];


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
                    <OrdersList status={statusParam} />
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
}: {
    status?: OrdersTabStatus;
}) {
    const { data, refetch, isFetching } = useStaffOrdersList({
        page: 1,
        limit: 20,
        sortOrder: "asc",
        prioritySort: true,
        includeGroups: true,
        ...(status ? { status } : {}),
    });
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            refetch({
                throwOnError: false,
            }),
    });

    const orders = useMemo(() => data?.items ?? [], [data]);
    const groups = useMemo(() => data?.groups ?? [], [data]);
    const isAllTabView = !status;
    const groupedRows = useMemo<GroupedOrderRow[]>(() => {
        if (!isAllTabView) {
            return [];
        }
        if (!groups.length) {
            return orders.map((order) => ({
                type: "order",
                key: `order-${order.id}`,
                order,
            }));
        }
        return groups.flatMap((group: StaffOrderGroup) => {
            const rows: GroupedOrderRow[] = [
                {
                    type: "group",
                    key: `group-${group.key}`,
                    title: group.title,
                    count: group.count,
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
    }, [groups, isAllTabView, orders]);

    const renderOrderCard = ({ item }: { item: StaffOrder }) => (
        <WorkerOrderCard order={item} />
    );

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
            data={orders}
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
