import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useEarningsOverview } from "@repo/hooks/api/pay";
import {
    useServicePersonnelDashboardStats,
    useServicePersonnelProfile,
} from "@repo/hooks/api/service-personnel";
import { useStaffOrdersList } from "@repo/hooks/api/order";
import type { StaffOrderListResponse } from "@repo/types";
import { useRouter } from "expo-router";
import React, {
    Suspense,
    useCallback,
    useMemo,
    useState,
} from "react";
import {
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";

type StaffOrder = StaffOrderListResponse["items"][number];

const ORDER_STATUS_DISPLAY: Record<
    StaffOrder["status"],
    { label: string; color: string }
> = {
    pending_payment: { label: "待支付", color: "#FF9800" },
    payment_timeout: { label: "支付超时", color: "#9E9E9E" },
    pending_acceptance: { label: "待接单", color: "#FFB300" },
    staff_rejected: { label: "已拒绝", color: "#9E9E9E" },
    paid: { label: "待服务", color: "#FF9800" },
    in_progress: { label: "服务中", color: "#4CAF50" },
    completed: { label: "已完成", color: "#2196F3" },
    cancelled: { label: "已取消", color: "#9E9E9E" },
    refunded: { label: "已退款", color: "#9E9E9E" },
};

const DECISION_STATUS_DISPLAY: Record<
    StaffOrder["decisionStatus"],
    { label: string; color: string }
> = {
    pending: { label: "待接单确认", color: "#FFB300" },
    accepted: { label: "已确认接单", color: "#4CAF50" },
    rejected: { label: "已拒绝", color: "#9E9E9E" },
};

export default function HomeScreen() {
    return (
        <RequireAuth>
            <ErrorBoundary FallbackComponent={HomeErrorFallback}>
                <Suspense fallback={<HomeSkeleton />}>
                    <HomeContent />
                </Suspense>
            </ErrorBoundary>
        </RequireAuth>
    );
}

function HomeContent() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;

    const {
        data: profile,
        isFetching: profileFetching,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);
    const {
        data: dashboardStats,
        isFetching: statsFetching,
        refetch: refetchStats,
    } = useServicePersonnelDashboardStats(userId);
    const {
        data: earningsOverview,
        isFetching: earningsFetching,
        refetch: refetchEarnings,
    } = useEarningsOverview();
    const {
        data: ordersResponse,
        isFetching: ordersFetching,
        refetch: refetchOrders,
    } = useStaffOrdersList({
        page: 1,
        limit: 20,
        sortOrder: "asc",
    });
    const [refreshing, setRefreshing] = useState(false);

    const orders = ordersResponse.items ?? [];

    const todayOrders = useMemo(() => countTodayOrders(orders), [orders]);
    const upcomingOrders = useMemo(
        () => selectUpcomingOrders(orders),
        [orders],
    );

    const stats = {
        todayOrders,
        monthlyEarnings: earningsOverview?.monthlyEarnings ?? 0,
        completedOrders: dashboardStats?.serviceCount ?? 0,
        ratingDisplay:
            dashboardStats?.rating?.display ??
            dashboardStats?.rating?.value?.toFixed(1) ??
            "5.0",
    };

    const greetingName =
        profile?.name?.trim() ||
        session?.user?.name ||
        session?.user?.email ||
        "服务人员";

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.allSettled([
                refetchProfile(),
                refetchStats(),
                refetchEarnings(),
                refetchOrders(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [refetchProfile, refetchStats, refetchEarnings, refetchOrders]);

    const isRefreshing =
        refreshing ||
        profileFetching ||
        statsFetching ||
        earningsFetching ||
        ordersFetching;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <View>
                    <Text style={styles.greeting}>{`你好，${greetingName}`}</Text>
                    <Text style={styles.subGreeting}>欢迎回来，祝您服务顺利</Text>
                </View>
                <TouchableOpacity onPress={() => router.push("/scan" as never)}>
                    <Ionicons name="qr-code-outline" size={28} color="#333" />
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                }
            >
                <View style={styles.statsCard}>
                    <View style={styles.statsRow}>
                        <StatItem
                            icon="calendar-outline"
                            label="今日订单"
                            value={stats.todayOrders}
                            color="#4CAF50"
                        />
                        <StatItem
                            icon="wallet-outline"
                            label="本月收益"
                            value={`¥${formatCurrency(stats.monthlyEarnings)}`}
                            color="#FF9800"
                        />
                    </View>
                    <View style={styles.statsRow}>
                        <StatItem
                            icon="checkmark-circle-outline"
                            label="完成订单"
                            value={stats.completedOrders}
                            color="#2196F3"
                        />
                        <StatItem
                            icon="star-outline"
                            label="评分"
                            value={stats.ratingDisplay}
                            color="#FFC107"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>快捷操作</Text>
                    <View style={styles.quickActions}>
                        <QuickActionButton
                            icon="qr-code-outline"
                            label="扫码接单"
                            onPress={() => router.push("/scan" as never)}
                            color="#4CAF50"
                        />
                        <QuickActionButton
                            icon="person-outline"
                            label="个人信息"
                            onPress={() => router.push("/profile/edit" as never)}
                            color="#2196F3"
                        />
                        <QuickActionButton
                            icon="settings-outline"
                            label="服务设置"
                            onPress={() => router.push("/profile/service-settings" as never)}
                            color="#FF9800"
                        />
                        <QuickActionButton
                            icon="cash-outline"
                            label="立即提现"
                            onPress={() => router.push("/earnings/withdraw" as never)}
                            color="#9C27B0"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>待处理订单</Text>
                        <TouchableOpacity onPress={() => router.push("/orders" as never)}>
                            <Text style={styles.moreText}>更多</Text>
                        </TouchableOpacity>
                    </View>
                    {upcomingOrders.length === 0 ? (
                        <View style={styles.emptyOrders}>
                            <Ionicons name="checkmark-circle-outline" size={40} color="#bbb" />
                            <Text style={styles.emptyOrdersText}>暂无待处理订单</Text>
                        </View>
                    ) : (
                        upcomingOrders.map((order) => {
                            const statusMeta =
                                ORDER_STATUS_DISPLAY[order.status] ??
                                ORDER_STATUS_DISPLAY.cancelled;
                            const decisionMeta =
                                DECISION_STATUS_DISPLAY[order.decisionStatus ?? 'pending'];
                            return (
                                <TouchableOpacity
                                    key={order.id}
                                    style={styles.orderCard}
                                    onPress={() => router.push(`/orders/${order.id}` as never)}
                                >
                                    <View style={styles.orderHeader}>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.orderService}>{order.serviceName}</Text>
                                            {order.serviceSpecification ? (
                                                <Text style={styles.orderSpec}>
                                                    {order.serviceSpecification}
                                                </Text>
                                            ) : null}
                                        </View>
                                        <View style={styles.homeBadgeColumn}>
                                            <View
                                                style={[
                                                    styles.homeStatusBadge,
                                                    { backgroundColor: statusMeta.color },
                                                ]}
                                            >
                                                <Text style={styles.homeStatusText}>
                                                    {statusMeta.label}
                                                </Text>
                                            </View>
                                            {decisionMeta ? (
                                                <View
                                                    style={[
                                                        styles.homeDecisionBadge,
                                                        { borderColor: decisionMeta.color },
                                                    ]}
                                                >
                                                    <Text
                                                        style={[
                                                            styles.homeDecisionText,
                                                            { color: decisionMeta.color },
                                                        ]}
                                                    >
                                                        {decisionMeta.label}
                                                    </Text>
                                                </View>
                                            ) : null}
                                            <Text style={styles.orderPrice}>
                                                ¥{formatCurrency(order.totalAmount)}
                                            </Text>
                                        </View>
                                    </View>
                                    <View style={styles.orderInfo}>
                                        <Ionicons name="location-outline" size={16} color="#666" />
                                        <Text style={styles.orderAddress}>
                                            {order.address || "客户未提供详细地址"}
                                        </Text>
                                    </View>
                                    <View style={styles.orderInfo}>
                                        <Ionicons name="time-outline" size={16} color="#666" />
                                        <Text style={styles.orderTime}>
                                            {formatDateTime(order.appointmentTime)}
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            );
                        })
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

function HomeSkeleton() {
    return (
        <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#2196F3" />
            <Text style={styles.loadingText}>首页数据加载中...</Text>
        </View>
    );
}

function HomeErrorFallback({
    error,
    resetErrorBoundary,
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) {
    return (
        <View style={styles.errorContainer}>
            <Ionicons name="alert-circle-outline" size={48} color="#FF5252" />
            <Text style={styles.errorTitle}>数据加载失败</Text>
            <Text style={styles.errorMessage}>
                {error.message || "请检查网络连接后重试"}
            </Text>
            <TouchableOpacity style={styles.retryButton} onPress={resetErrorBoundary}>
                <Text style={styles.retryText}>重新加载</Text>
            </TouchableOpacity>
        </View>
    );
}

// 统计项组件
function StatItem({
    icon,
    label,
    value,
    color,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    value: string | number;
    color: string;
}) {
    return (
        <View style={styles.statItem}>
            <Ionicons name={icon} size={24} color={color} />
            <Text style={styles.statValue}>{value}</Text>
            <Text style={styles.statLabel}>{label}</Text>
        </View>
    );
}

// 快捷操作按钮组件
function QuickActionButton({
    icon,
    label,
    onPress,
    color,
}: {
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
    onPress: () => void;
    color: string;
}) {
    return (
        <TouchableOpacity style={styles.actionButton} onPress={onPress}>
            <View style={[styles.actionIcon, { backgroundColor: color }]}>
                <Ionicons name={icon} size={24} color="white" />
            </View>
            <Text style={styles.actionLabel}>{label}</Text>
        </TouchableOpacity>
    );
}

function countTodayOrders(orders: StaffOrder[]) {
    if (!orders.length) {
        return 0;
    }
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    return orders.filter((order) => {
        const appointment = normalizeDate(order.appointmentTime);
        if (!appointment) {
            return false;
        }
        return appointment >= start && appointment < end;
    }).length;
}

function selectUpcomingOrders(orders: StaffOrder[]) {
    const TARGET_STATUSES = new Set(["pending_acceptance", "paid", "in_progress"]);
    return orders
        .filter((order) => TARGET_STATUSES.has(order.status))
        .sort((a, b) => {
            const dateA = normalizeDate(a.appointmentTime)?.getTime() ?? 0;
            const dateB = normalizeDate(b.appointmentTime)?.getTime() ?? 0;
            return dateA - dateB;
        })
        .slice(0, 5);
}

function normalizeDate(value?: string | Date | null) {
    if (!value) {
        return null;
    }
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    return date;
}

function formatCurrency(value?: number | string | null) {
    const amount = typeof value === "string" ? Number(value) : value ?? 0;
    if (!Number.isFinite(amount)) {
        return "0.00";
    }
    return amount.toFixed(2);
}

function formatDateTime(value?: string | Date | null) {
    const date = normalizeDate(value);
    if (!date) {
        return "--";
    }
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const dd = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mi = `${date.getMinutes()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    header: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        padding: 20,
        paddingTop: 60,
        backgroundColor: "white",
    },
    greeting: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    subGreeting: {
        marginTop: 6,
        fontSize: 14,
        color: "#666",
    },
    content: {
        flex: 1,
        padding: 16,
    },
    statsCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        marginVertical: 8,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginTop: 8,
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
    },
    section: {
        marginBottom: 16,
    },
    sectionHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    moreText: {
        fontSize: 14,
        color: "#2196F3",
    },
    quickActions: {
        flexDirection: "row",
        flexWrap: "wrap",
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    actionButton: {
        width: "25%",
        alignItems: "center",
        marginBottom: 16,
    },
    actionIcon: {
        width: 50,
        height: 50,
        borderRadius: 25,
        justifyContent: "center",
        alignItems: "center",
        marginBottom: 8,
    },
    actionLabel: {
        fontSize: 12,
        color: "#333",
        textAlign: "center",
    },
    orderCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 12,
    },
    orderService: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    orderSpec: {
        marginTop: 4,
        fontSize: 12,
        color: "#888",
    },
    homeBadgeColumn: {
        alignItems: "flex-end",
    },
    homeStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 3,
        borderRadius: 12,
        marginBottom: 6,
    },
    homeStatusText: {
        color: "white",
        fontSize: 11,
        fontWeight: "bold",
    },
    homeDecisionBadge: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 8,
        paddingVertical: 2,
        marginBottom: 6,
    },
    homeDecisionText: {
        fontSize: 10,
        fontWeight: "bold",
    },
    orderPrice: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#FF5722",
    },
    orderInfo: {
        flexDirection: "row",
        alignItems: "center",
        marginTop: 8,
    },
    orderAddress: {
        fontSize: 14,
        color: "#666",
        marginLeft: 8,
        flex: 1,
    },
    orderTime: {
        fontSize: 14,
        color: "#666",
        marginLeft: 8,
    },
    emptyOrders: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 32,
        backgroundColor: "white",
        borderRadius: 12,
    },
    emptyOrdersText: {
        marginTop: 8,
        fontSize: 14,
        color: "#999",
    },
    loadingContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    loadingText: {
        marginTop: 12,
        fontSize: 14,
        color: "#666",
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorTitle: {
        marginTop: 12,
        fontSize: 18,
        fontWeight: "bold",
        color: "#d32f2f",
    },
    errorMessage: {
        marginTop: 8,
        fontSize: 14,
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
