import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import {
    useEarningsOverview,
    useWorkerEarningsRecords,
    useWorkerWithdrawalRecords,
} from "@repo/hooks/api/pay";
import type { WorkerEarningsRecordListResponse } from "@repo/types";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    NativeScrollEvent,
    NativeSyntheticEvent,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type TabFilter = "all" | "income" | "withdrawal";
type TransactionItem = WorkerEarningsRecordListResponse["items"][number];
type WithdrawalItem = TransactionItem;

const WITHDRAWAL_STATUS_META: Record<
    string,
    { label: string; color: string }
> = {
    pending: { label: "待审核", color: "#FF9800" },
    approved: { label: "审核通过，待打款", color: "#2196F3" },
    completed: { label: "已打款", color: "#4CAF50" },
    rejected: { label: "已驳回", color: "#FF5722" },
};

export default function EarningsScreen() {
    return (
        <RequireAuth>
            <EarningsContent />
        </RequireAuth>
    );
}

function EarningsContent() {
    const router = useRouter();
    const params = useLocalSearchParams<{ tab?: string }>();
    const [selectedTab, setSelectedTab] = useState<TabFilter>(() => {
        const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
        return isValidTabFilter(tabParam) ? tabParam : "all";
    });
    useEffect(() => {
        const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
        if (isValidTabFilter(tabParam)) {
            setSelectedTab(tabParam);
        }
    }, [params.tab]);
    const [refreshing, setRefreshing] = useState(false);

    const recordCategory = useMemo(
        () => mapTabToCategory(selectedTab),
        [selectedTab],
    );
    const transactionQuery = useMemo(
        () => ({
            page: 1,
            limit: 50,
            category: recordCategory,
        }),
        [recordCategory],
    );

    const {
        data: overview,
        isLoading: overviewLoading,
        isFetching: overviewFetching,
        error: overviewError,
        refetch: refetchOverview,
    } = useEarningsOverview();

    const isWithdrawalTab = selectedTab === "withdrawal";

    const {
        data: transactionsData,
        isLoading: transactionsLoading,
        isFetching: transactionsFetching,
        error: transactionsError,
        refetch: refetchTransactions,
    } = useWorkerEarningsRecords(transactionQuery, {
        enabled: !isWithdrawalTab,
    });

    const {
        data: withdrawalRecords,
        isLoading: withdrawalRecordsLoading,
        isFetching: withdrawalRecordsFetching,
        error: withdrawalRecordsError,
        fetchNextPage: fetchMoreWithdrawals,
        hasNextPage: hasMoreWithdrawals,
        isFetchingNextPage: isFetchingNextWithdrawalPage,
        refetch: refetchWithdrawalRecords,
    } = useWorkerWithdrawalRecords(
        { limit: 20 },
        { enabled: isWithdrawalTab },
    );

    const handleRefresh = useCallback(async () => {
        setRefreshing(true);
        try {
            await Promise.allSettled([
                refetchOverview(),
                isWithdrawalTab
                    ? refetchWithdrawalRecords()
                    : refetchTransactions(),
            ]);
        } finally {
            setRefreshing(false);
        }
    }, [
        refetchOverview,
        refetchTransactions,
        refetchWithdrawalRecords,
        isWithdrawalTab,
    ]);

    const handleLoadMoreWithdrawals = useCallback(() => {
        if (
            !isWithdrawalTab ||
            !hasMoreWithdrawals ||
            isFetchingNextWithdrawalPage
        ) {
            return;
        }
        fetchMoreWithdrawals();
    }, [
        isWithdrawalTab,
        hasMoreWithdrawals,
        isFetchingNextWithdrawalPage,
        fetchMoreWithdrawals,
    ]);
    const handlePageScroll = useCallback(
        (event: NativeSyntheticEvent<NativeScrollEvent>) => {
            if (!isWithdrawalTab) {
                return;
            }
            const { layoutMeasurement, contentOffset, contentSize } =
                event.nativeEvent;
            const paddingToBottom = 200;
            if (
                layoutMeasurement.height + contentOffset.y >=
                contentSize.height - paddingToBottom
            ) {
                handleLoadMoreWithdrawals();
            }
        },
        [isWithdrawalTab, handleLoadMoreWithdrawals],
    );

    const availableBalance = overview?.balance?.available ?? 0;
    const frozenBalance = overview?.balance?.frozen ?? 0;
    const accountBalance = availableBalance + frozenBalance;
    const monthlyEarnings = overview?.monthlyEarnings ?? 0;
    const totalEarnings = overview?.totalEarnings ?? 0;
    const transactions = transactionsData?.items ?? [];
    const withdrawalItems = useMemo(() => {
        const pages = withdrawalRecords?.pages ?? [];
        return pages.flatMap((page) => page.items);
    }, [withdrawalRecords]);
    const currentItems = isWithdrawalTab ? withdrawalItems : transactions;
    const shouldShowEmptyState = currentItems.length === 0;

    const isInitialLoading =
        overviewLoading ||
        (isWithdrawalTab ? withdrawalRecordsLoading : transactionsLoading);
    const isRefreshing =
        refreshing ||
        overviewFetching ||
        (isWithdrawalTab
            ? withdrawalRecordsFetching
            : transactionsFetching);
    const activeError =
        overviewError ||
        (isWithdrawalTab
            ? (withdrawalRecordsError as Error | null)
            : transactionsError);
    const hasError = Boolean(activeError);

    const emptyTitle = useMemo(() => {
        if (isWithdrawalTab) {
            if (withdrawalRecordsFetching) {
                return "提现记录加载中...";
            }
            return "暂无提现记录";
        }
        if (transactionsFetching) {
            return "收益记录加载中...";
        }
        return "暂无记录";
    }, [
        isWithdrawalTab,
        withdrawalRecordsFetching,
        transactionsFetching,
        selectedTab,
    ]);

    const retryFetch = useCallback(() => {
        refetchOverview();
        if (isWithdrawalTab) {
            refetchWithdrawalRecords();
        } else {
            refetchTransactions();
        }
    }, [
        refetchOverview,
        refetchTransactions,
        refetchWithdrawalRecords,
        isWithdrawalTab,
    ]);

    const renderTransaction = (item: TransactionItem) => {
        const isIncome = item.flowType === "income";
        const amountColor = isIncome ? "#4CAF50" : "#FF5722";
        const statusMeta = !isIncome
            ? getWithdrawalStatusMeta(item.withdrawal?.status)
            : null;
        const withdrawNote = !isIncome ? getWithdrawalNote(item) : null;

        return (
            <View key={item.id} style={styles.transactionCard}>
                <View style={styles.transactionIcon}>
                    <Ionicons
                        name={isIncome ? "arrow-down" : "arrow-up"}
                        size={24}
                        color={amountColor}
                    />
                </View>
                <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>
                        {getTransactionDescription(item)}
                    </Text>
                    <Text style={styles.transactionTime}>
                        {formatTransactionTime(item.occurredAt)}
                    </Text>
                    {statusMeta ? (
                        <Text
                            style={[
                                styles.transactionStatus,
                                { color: statusMeta.color },
                            ]}
                        >
                            {statusMeta.label}
                        </Text>
                    ) : null}
                    {withdrawNote ? (
                        <Text style={styles.transactionNote}>
                            审核备注：{withdrawNote}
                        </Text>
                    ) : null}
                </View>
                <Text style={[styles.transactionAmount, { color: amountColor }]}>
                    {isIncome ? "+" : "-"}
                    ¥{formatCurrency(Math.abs(item.amount))}
                </Text>
            </View>
        );
    };

    const renderWithdrawalTransaction = (item: WithdrawalItem) => {
        const amountColor = "#FF5722";
        const statusMeta = getWithdrawalStatusMeta(item.withdrawal?.status);
        const withdrawNote = getWithdrawalNote(item) ?? "";
        const timestamp = item.withdrawal?.requestedAt ?? item.occurredAt;

        return (
            <View key={item.id} style={styles.transactionCard}>
                <View style={styles.transactionIcon}>
                    <Ionicons name="arrow-up" size={24} color={amountColor} />
                </View>
                <View style={styles.transactionInfo}>
                    <Text style={styles.transactionDesc}>余额提现</Text>
                    <Text style={styles.transactionTime}>
                        {formatTransactionTime(timestamp)}
                    </Text>
                    {statusMeta ? (
                        <Text
                            style={[
                                styles.transactionStatus,
                                { color: statusMeta.color },
                            ]}
                        >
                            {statusMeta.label}
                        </Text>
                    ) : null}
                    {withdrawNote ? (
                        <Text style={styles.transactionNote}>
                            审核备注：{withdrawNote}
                        </Text>
                    ) : null}
                </View>
                <Text style={[styles.transactionAmount, { color: amountColor }]}>
                    -¥{formatCurrency(Math.abs(item.amount))}
                </Text>
            </View>
        );
    };

    if (isInitialLoading) {
        return (
            <View style={styles.loadingContainer}>
                <ActivityIndicator size="large" color="#2196F3" />
                <Text style={styles.loadingText}>收益数据加载中...</Text>
            </View>
        );
    }

    if (hasError) {
        return (
            <View style={styles.errorContainer}>
                <Ionicons
                    name="alert-circle-outline"
                    size={48}
                    color="#FF5722"
                />
                <Text style={styles.errorTitle}>收益数据加载失败</Text>
                <Text style={styles.errorMessage}>
                    {overviewError?.message ||
                        (isWithdrawalTab
                            ? (withdrawalRecordsError as Error | null)?.message
                            : transactionsError?.message) ||
                        "请稍后重试"}
                </Text>
                <TouchableOpacity style={styles.retryButton} onPress={retryFetch}>
                    <Text style={styles.retryText}>重新加载</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <ScrollView
                style={styles.scrollView}
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshing}
                        onRefresh={handleRefresh}
                        tintColor="#2196F3"
                    />
                }
                showsVerticalScrollIndicator={false}
                onScroll={isWithdrawalTab ? handlePageScroll : undefined}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>我的收益</Text>
                </View>

                <View style={styles.accountCard}>
                    <View style={styles.balanceSection}>
                        <Text style={styles.balanceLabel}>账户余额（含审核中）</Text>
                        <Text style={styles.balanceAmount}>
                            ¥{formatCurrency(accountBalance)}
                        </Text>
                        <View style={styles.balanceSubRow}>
                            <Text style={styles.balanceSubText}>
                                可提现 ¥{formatCurrency(availableBalance)}
                            </Text>
                            <View style={styles.balanceDivider} />
                            <Text style={styles.balanceSubText}>
                                审核中 ¥{formatCurrency(frozenBalance)}
                            </Text>
                        </View>
                        <TouchableOpacity
                            style={styles.withdrawButton}
                            onPress={() => router.push("/earnings/withdraw" as any)}
                        >
                            <Ionicons name="wallet-outline" size={20} color="white" />
                            <Text style={styles.withdrawText}>立即提现</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.statsSection}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                ¥{formatCurrency(monthlyEarnings)}
                            </Text>
                            <Text style={styles.statLabel}>本月收益</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                ¥{formatCurrency(totalEarnings)}
                            </Text>
                            <Text style={styles.statLabel}>累计收益</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.tabs}>
                    <TabButton
                        label="全部"
                        active={selectedTab === "all"}
                        onPress={() => setSelectedTab("all")}
                    />
                    <TabButton
                        label="收入"
                        active={selectedTab === "income"}
                        onPress={() => setSelectedTab("income")}
                    />
                    <TabButton
                        label="提现"
                        active={selectedTab === "withdrawal"}
                        onPress={() => setSelectedTab("withdrawal")}
                    />
                </View>

                <View style={styles.listContent}>
                    {shouldShowEmptyState ? (
                        <View style={styles.emptyContainer}>
                            {isWithdrawalTab ? (
                                withdrawalRecordsFetching ? (
                                    <ActivityIndicator
                                        size="small"
                                        color="#2196F3"
                                    />
                                ) : (
                                    <Ionicons
                                        name="receipt-outline"
                                        size={64}
                                        color="#ccc"
                                    />
                                )
                            ) : transactionsFetching ? (
                                <ActivityIndicator size="small" color="#2196F3" />
                            ) : (
                                <Ionicons
                                    name="receipt-outline"
                                    size={64}
                                    color="#ccc"
                                />
                            )}
                            <Text style={styles.emptyText}>{emptyTitle}</Text>
                        </View>
                    ) : (
                        currentItems.map((item) =>
                            isWithdrawalTab
                                ? renderWithdrawalTransaction(item)
                                : renderTransaction(item),
                        )
                    )}

                    {isWithdrawalTab && isFetchingNextWithdrawalPage ? (
                        <View style={styles.listFooter}>
                            <ActivityIndicator size="small" color="#2196F3" />
                        </View>
                    ) : null}
                </View>
            </ScrollView>
        </View>
    );
}

function TabButton({
    label,
    active,
    onPress,
}: {
    label: string;
    active: boolean;
    onPress: () => void;
}) {
    return (
        <TouchableOpacity
            style={[styles.tabButton, active && styles.tabButtonActive]}
            onPress={onPress}
        >
            <Text style={[styles.tabText, active && styles.tabTextActive]}>
                {label}
            </Text>
        </TouchableOpacity>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    scrollView: {
        flex: 1,
    },
    scrollContent: {
        flexGrow: 1,
        paddingBottom: 40,
    },
    header: {
        backgroundColor: "white",
        padding: 20,
        paddingTop: 60,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    accountCard: {
        backgroundColor: "white",
        margin: 16,
        borderRadius: 12,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    balanceSection: {
        display: "flex",
        gap: 5,
        alignItems: "center",
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    balanceSubRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 8,
    },
    balanceSubText: {
        fontSize: 12,
        color: "#666",
        marginHorizontal: 8,
    },
    balanceDivider: {
        width: 1,
        height: 12,
        backgroundColor: "#ddd",
    },
    balanceLabel: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 16,
    },
    withdrawButton: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#4CAF50",
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    withdrawText: {
        color: "white",
        fontSize: 16,
        fontWeight: "bold",
        marginLeft: 8,
    },
    statsSection: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 20,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
    },
    statLabel: {
        fontSize: 12,
        color: "#666",
    },
    statDivider: {
        width: 1,
        backgroundColor: "#eee",
    },
    tabs: {
        flexDirection: "row",
        backgroundColor: "white",
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    tabButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        marginRight: 8,
        borderRadius: 16,
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
    listFooter: {
        paddingVertical: 16,
        alignItems: "center",
    },
    transactionCard: {
        flexDirection: "row",
        alignItems: "center",
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
    transactionIcon: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: "#f5f5f5",
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    transactionInfo: {
        flex: 1,
    },
    transactionDesc: {
        fontSize: 16,
        color: "#333",
        marginBottom: 4,
    },
    transactionTime: {
        fontSize: 12,
        color: "#999",
    },
    transactionStatus: {
        fontSize: 12,
        marginTop: 4,
    },
    transactionNote: {
        fontSize: 12,
        color: "#666",
        marginTop: 2,
    },
    transactionAmount: {
        fontSize: 18,
        fontWeight: "bold",
    },
    emptyContainer: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 60,
    },
    emptyText: {
        fontSize: 16,
        color: "#999",
        marginTop: 16,
    },
    loadingContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
    },
    loadingText: {
        marginTop: 12,
        color: "#666",
        fontSize: 16,
    },
    errorContainer: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
        paddingHorizontal: 32,
        backgroundColor: "#f5f5f5",
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
        marginTop: 12,
        marginBottom: 8,
    },
    errorMessage: {
        fontSize: 14,
        color: "#666",
        textAlign: "center",
        marginBottom: 16,
    },
    retryButton: {
        backgroundColor: "#2196F3",
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 24,
    },
    retryText: {
        color: "white",
        fontWeight: "bold",
    },
});

function formatCurrency(value?: number | string | null) {
    const amount = Number(value ?? 0);
    if (Number.isNaN(amount)) {
        return "0.00";
    }
    return amount.toFixed(2);
}

function formatTransactionTime(value: string | Date) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "";
    }
    const now = new Date();
    const sameDay = date.toDateString() === now.toDateString();
    const yesterday = new Date(
        now.getFullYear(),
        now.getMonth(),
        now.getDate() - 1,
    );
    let dayLabel = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
        2,
        "0",
    )}-${String(date.getDate()).padStart(2, "0")}`;
    if (sameDay) {
        dayLabel = "今天";
    } else if (date.toDateString() === yesterday.toDateString()) {
        dayLabel = "昨天";
    }
    const timeLabel = `${String(date.getHours()).padStart(2, "0")}:${String(
        date.getMinutes(),
    ).padStart(2, "0")}`;
    return `${dayLabel} ${timeLabel}`;
}

function getTransactionDescription(item: TransactionItem) {
    if (item.description) {
        return item.description;
    }
    switch (item.transactionType) {
        case "service_earning":
            return "服务收益入账";
        case "withdrawal":
            return "余额提现";
        case "bonus":
            return "平台奖励";
        case "penalty":
            return "平台扣款";
        case "adjustment":
            return "财务调整";
        default:
            return "资金变动";
    }
}

function isValidTabFilter(value?: string | string[] | null): value is TabFilter {
    if (Array.isArray(value)) {
        return isValidTabFilter(value[0]);
    }
    return value === "all" || value === "income" || value === "withdrawal";
}

function getWithdrawalStatusMeta(status?: string | null) {
    if (!status) {
        return null;
    }
    return (
        WITHDRAWAL_STATUS_META[status] ?? {
            label: "处理中",
            color: "#FF9800",
        }
    );
}

function getWithdrawalNote(item: TransactionItem) {
    if (!item.withdrawal) {
        return null;
    }
    const note =
        item.withdrawal.reviewNote ??
        item.withdrawal.failureReason ??
        item.withdrawal.remark;
    if (!note) {
        return null;
    }
    return note.trim();
}

function mapTabToCategory(tab: TabFilter): "mixed" | "income" | "withdrawal" {
    switch (tab) {
        case "income":
            return "income";
        case "withdrawal":
            return "withdrawal";
        default:
            return "mixed";
    }
}
