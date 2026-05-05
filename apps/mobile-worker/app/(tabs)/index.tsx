import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useEarningsOverview } from "@repo/hooks/api/pay";
import {
    useServicePersonnelDashboardStats,
    useServicePersonnelProfile,
} from "@repo/hooks/api/service-personnel";
import { useStaffOrdersList } from "@repo/hooks/api/order";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import type { StaffOrderListResponse } from "@repo/types";
import { useRouter } from "expo-router";
import React, { Suspense, useMemo } from "react";
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
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import type { LucideIcon } from "lucide-react-native";
import { ScanLine, Settings } from "lucide-react-native";
import { WorkerOrderCard } from "@/components/orders/worker-order-card";

type StaffOrder = StaffOrderListResponse["items"][number];

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
        prioritySort: true,
        includeGroups: true,
    });
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                refetchProfile(),
                refetchStats(),
                refetchEarnings(),
                refetchOrders(),
            ]),
    });

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
                    <Text
                        style={styles.greeting}
                    >{`你好，${greetingName}`}</Text>
                    <Text style={styles.subGreeting}>
                        欢迎回来，祝您服务顺利
                    </Text>
                </View>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
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
                            icon={Settings}
                            label="服务发布"
                            onPress={() =>
                                router.push(
                                    "/profile/service-settings-redesign" as never,
                                )
                            }
                            color="#FF9800"
                        />
                        <QuickActionButton
                            icon={ScanLine}
                            label="核销订单"
                            onPress={() =>
                                router.push(`/scan?source=home` as never)
                            }
                            color="#4CAF50"
                        />
                    </View>
                </View>

                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Text style={styles.sectionTitle}>待处理订单</Text>
                        <TouchableOpacity
                            onPress={() => router.push("/orders" as never)}
                        >
                            <Text style={styles.moreText}>更多</Text>
                        </TouchableOpacity>
                    </View>
                    {upcomingOrders.length === 0 ? (
                        <View style={styles.emptyOrders}>
                            <Ionicons
                                name="checkmark-circle-outline"
                                size={40}
                                color="#bbb"
                            />
                            <Text style={styles.emptyOrdersText}>
                                暂无待处理订单
                            </Text>
                        </View>
                    ) : (
                        upcomingOrders.map((order) => (
                            <WorkerOrderCard key={order.id} order={order} />
                        ))
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
            <TouchableOpacity
                style={styles.retryButton}
                onPress={resetErrorBoundary}
            >
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
    icon: LucideIcon;
    label: string;
    onPress: () => void;
    color: string;
}) {
    return (
        <TouchableOpacity
            activeOpacity={0.82}
            style={styles.actionButton}
            onPress={onPress}
        >
            <View style={styles.actionIconWrap}>
                <View style={[styles.actionIcon, { backgroundColor: color }]}>
                    <View style={styles.actionIconGlyph}>
                        <Icon as={icon} size={24} color="white" />
                    </View>
                </View>
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
    return orders
        .filter(
            (order) =>
                (order.status === "pending_acceptance" &&
                    order.decisionStatus === "pending") ||
                order.status === "paid" ||
                (order.status === "pending_acceptance" &&
                    order.decisionStatus === "accepted"),
        )
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
    const amount = typeof value === "string" ? Number(value) : (value ?? 0);
    if (!Number.isFinite(amount)) {
        return "0.00";
    }
    return amount.toFixed(2);
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
        marginBottom: 16,
    },
    moreText: {
        fontSize: 14,
        color: "#2196F3",
    },
    quickActions: {
        flexDirection: "row",
        gap: 12,
        backgroundColor: "white",
        borderRadius: 14,
        padding: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 3,
    },
    actionButton: {
        flex: 1,
        minHeight: 65,
        paddingVertical: 10,
        alignItems: "center",
        justifyContent: "center",
        gap: 6,
        backgroundColor: "#FFFFFF",
    },
    actionIconWrap: {
        width: 48,
        height: 48,
        alignItems: "center",
        justifyContent: "center",
    },
    actionIcon: {
        width: 48,
        height: 48,
        borderRadius: 24,
        position: "relative",
        justifyContent: "center",
        alignItems: "center",
    },
    actionIconGlyph: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
    },
    actionLabel: {
        fontSize: 12,
        fontWeight: "700",
        color: "#2B2B2B",
        textAlign: "center",
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
