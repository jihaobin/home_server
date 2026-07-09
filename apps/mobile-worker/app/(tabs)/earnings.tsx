import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import {
    useEarningsOverview,
    useWorkerEarningsRecords,
    useWorkerWithdrawalRecords,
} from "@repo/hooks/api/pay";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
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
import {
    formatOptionalTransactionTime,
    formatTransactionTime,
} from "../../lib/transaction-time";

type TabFilter = "all" | "income" | "withdrawal";
type TransactionItem = WorkerEarningsRecordListResponse["items"][number];
type WithdrawalItem = TransactionItem;
type IncomeBadgeMeta = {
    label: string;
    textColor: string;
    backgroundColor: string;
    borderColor: string;
};
type IncomeInfoItemMeta = {
    label: string;
    value: string;
};

const WITHDRAWAL_STATUS_META: Record<string, { label: string; color: string }> =
    {
        pending: { label: "待审核", color: "#FF9800" },
        approved: { label: "审核通过，待打款", color: "#2196F3" },
        processing: { label: "处理中，待确认收款", color: "#9C27B0" },
        completed: { label: "已打款", color: "#4CAF50" },
        failed: { label: "打款失败", color: "#FF5722" },
        cancelled: { label: "已取消", color: "#9E9E9E" },
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
    const [expandedIncomeIds, setExpandedIncomeIds] = useState<
        Record<string, boolean>
    >({});
    useEffect(() => {
        const tabParam = Array.isArray(params.tab) ? params.tab[0] : params.tab;
        if (isValidTabFilter(tabParam)) {
            setSelectedTab(tabParam);
        }
    }, [params.tab]);
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
    } = useWorkerWithdrawalRecords({ limit: 20 }, { enabled: isWithdrawalTab });

    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                refetchOverview(),
                isWithdrawalTab
                    ? refetchWithdrawalRecords()
                    : refetchTransactions(),
            ]),
    });

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
        (isWithdrawalTab ? withdrawalRecordsFetching : transactionsFetching);
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

    const toggleIncomeExpanded = useCallback((itemId: string) => {
        setExpandedIncomeIds((prev) => ({
            ...prev,
            [itemId]: !prev[itemId],
        }));
    }, []);

    const renderTransaction = (item: TransactionItem) => {
        const isIncome = item.flowType === "income";
        const amountColor = "#4CAF50";
        const customerLabel = getIncomeCustomerLabel(item);
        const customerPhone = getIncomeCustomerPhone(item);
        const financialFallback =
            item.transactionType === "service_earning" ? "暂无" : "不涉及";
        const incomeTimeLabel = formatOptionalTransactionTime(
            resolveTransactionOccurredAt(item),
        );
        const incomeExplainMeta = getIncomeExplainMeta(item);
        const commissionRateLabel = formatCommissionRate(
            item.commissionRate,
            financialFallback,
        );
        const settlementAmountLabel = formatOptionalAmount(
            item.settlementAmount,
            financialFallback,
        );
        const originalOrderPriceLabel = formatOptionalAmount(
            item.originalOrderPrice,
            financialFallback,
        );
        const commissionAmountLabel = formatOptionalAmount(
            item.commissionAmount,
            financialFallback,
        );
        const incomeInfoItems = getIncomeInfoItems(item, {
            orderNumberLabel: getIncomeOrderNumberLabel(item),
            customerLabel,
            customerPhone,
            serviceName: item.serviceName?.trim() || "未知服务",
            specificationName: item.specificationName?.trim() || "未提供规格",
            commissionRateLabel,
            originalOrderPriceLabel,
            settlementAmountLabel,
            commissionAmountLabel,
            incomeTimeLabel,
        });

        if (isIncome) {
            const resolvedIncomeSummary = getIncomeSummary(item);
            const isExpanded = Boolean(expandedIncomeIds[item.id]);
            return (
                <View key={item.id} style={styles.incomeCard}>
                    <TouchableOpacity
                        activeOpacity={0.85}
                        onPress={() => toggleIncomeExpanded(item.id)}
                        style={styles.incomeHeaderButton}
                    >
                        <View style={styles.incomeCardTop}>
                            <View style={styles.incomeCardTopLeft}>
                                <View style={styles.incomeIconWrap}>
                                    <Ionicons
                                        name="arrow-down"
                                        size={20}
                                        color="#12B76A"
                                    />
                                </View>
                                <View style={styles.incomeTitleWrap}>
                                    <Text style={styles.incomeTitle}>
                                        {resolvedIncomeSummary.title}
                                    </Text>
                                    <Text style={styles.incomeSubtitle}>
                                        {resolvedIncomeSummary.subtitle}
                                    </Text>
                                </View>
                            </View>
                            <View style={styles.incomeHeaderRight}>
                                <Text
                                    style={[
                                        styles.incomeAmount,
                                        { color: amountColor },
                                    ]}
                                >
                                    +¥{formatCurrency(Math.abs(item.amount))}
                                </Text>
                                <Ionicons
                                    name={
                                        isExpanded
                                            ? "chevron-up"
                                            : "chevron-down"
                                    }
                                    size={18}
                                    color="#98A2B3"
                                />
                            </View>
                        </View>

                        <View style={styles.incomeBadgeRow}>
                            <View
                                style={[
                                    styles.incomeBadge,
                                    {
                                        backgroundColor:
                                            incomeExplainMeta.sourceBadge
                                                .backgroundColor,
                                        borderColor:
                                            incomeExplainMeta.sourceBadge
                                                .borderColor,
                                    },
                                ]}
                            >
                                <Text
                                    style={[
                                        styles.incomeBadgeText,
                                        {
                                            color: incomeExplainMeta.sourceBadge
                                                .textColor,
                                        },
                                    ]}
                                >
                                    {incomeExplainMeta.sourceBadge.label}
                                </Text>
                            </View>
                            {incomeExplainMeta.ruleBadge ? (
                                <View
                                    style={[
                                        styles.incomeBadge,
                                        {
                                            backgroundColor:
                                                incomeExplainMeta.ruleBadge
                                                    .backgroundColor,
                                            borderColor:
                                                incomeExplainMeta.ruleBadge
                                                    .borderColor,
                                        },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.incomeBadgeText,
                                            {
                                                color: incomeExplainMeta.ruleBadge
                                                    .textColor,
                                            },
                                        ]}
                                    >
                                        {incomeExplainMeta.ruleBadge.label}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </TouchableOpacity>

                    {isExpanded ? (
                        <>
                            <View style={styles.incomeInfoGrid}>
                                {incomeInfoItems.map((infoItem) => (
                                    <View
                                        key={`${item.id}-${infoItem.label}`}
                                        style={styles.incomeInfoItem}
                                    >
                                        <Text style={styles.incomeInfoLabel}>
                                            {infoItem.label}
                                        </Text>
                                        <Text style={styles.incomeInfoValue}>
                                            {infoItem.value}
                                        </Text>
                                    </View>
                                ))}
                            </View>
                        </>
                    ) : null}
                </View>
            );
        }

        return renderWithdrawalTransaction(item);
    };

    const renderWithdrawalTransaction = (item: WithdrawalItem) => {
        const amountColor = "#FF5722";
        const statusMeta = getWithdrawalStatusMeta(item.withdrawal?.status);
        const withdrawNote = getWithdrawalNote(item) ?? "";
        const methodMeta = getWithdrawalMethodMeta(item.withdrawal?.method);
        const requestedTime = formatOptionalTransactionTime(
            item.withdrawal?.requestedAt ?? resolveTransactionOccurredAt(item),
        );
        const resultTime = getWithdrawalResultTimeLabel(item);

        return (
            <View key={item.id} style={styles.withdrawalCard}>
                <View style={styles.withdrawalCardTop}>
                    <View style={styles.withdrawalCardTopLeft}>
                        <View
                            style={[
                                styles.withdrawalMethodIcon,
                                {
                                    backgroundColor: methodMeta.iconBackground,
                                },
                            ]}
                        >
                            <Ionicons
                                name={methodMeta.icon}
                                size={20}
                                color={methodMeta.iconColor}
                            />
                        </View>
                        <View style={styles.withdrawalCardTitleWrap}>
                            <Text style={styles.withdrawalCardTitle}>
                                余额提现
                            </Text>
                            <Text style={styles.withdrawalCardMethod}>
                                {methodMeta.label}
                            </Text>
                        </View>
                    </View>
                    {statusMeta ? (
                        <View
                            style={[
                                styles.withdrawalStatusBadge,
                                {
                                    backgroundColor: `${statusMeta.color}14`,
                                    borderColor: `${statusMeta.color}26`,
                                },
                            ]}
                        >
                            <Text
                                style={[
                                    styles.withdrawalStatusBadgeText,
                                    { color: statusMeta.color },
                                ]}
                            >
                                {statusMeta.label}
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.withdrawalAmountRow}>
                    <Text style={styles.withdrawalAmountLabel}>提现金额</Text>
                    <Text
                        style={[
                            styles.withdrawalAmountValue,
                            { color: amountColor },
                        ]}
                    >
                        -¥{formatCurrency(Math.abs(item.amount))}
                    </Text>
                </View>

                <View style={styles.withdrawalMetaGrid}>
                    <View style={styles.withdrawalMetaItem}>
                        <Text style={styles.withdrawalMetaLabel}>提现方式</Text>
                        <Text style={styles.withdrawalMetaValue}>
                            {methodMeta.label}
                        </Text>
                    </View>
                    <View style={styles.withdrawalMetaItem}>
                        <Text style={styles.withdrawalMetaLabel}>申请时间</Text>
                        <Text style={styles.withdrawalMetaValue}>
                            {requestedTime}
                        </Text>
                    </View>
                    <View
                        style={[
                            styles.withdrawalMetaItem,
                            styles.withdrawalMetaItemFull,
                        ]}
                    >
                        <Text style={styles.withdrawalMetaLabel}>
                            {resultTime.label}
                        </Text>
                        <Text style={styles.withdrawalMetaValue}>
                            {resultTime.value}
                        </Text>
                    </View>
                </View>

                {withdrawNote ? (
                    <View style={styles.withdrawalNoteBox}>
                        <Ionicons
                            name="document-text-outline"
                            size={14}
                            color="#8A6A2F"
                        />
                        <Text style={styles.withdrawalNoteText}>
                            处理备注：{withdrawNote}
                        </Text>
                    </View>
                ) : null}
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
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={retryFetch}
                >
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
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#2196F3"
                    />
                }
                showsVerticalScrollIndicator={false}
                onScroll={isWithdrawalTab ? handlePageScroll : undefined}
                scrollEventThrottle={16}
            >
                <View style={styles.header}>
                    <Text style={styles.title}>我的收益</Text>
                    <Text style={styles.subtitle}>
                        查看收入流水与提现进度
                    </Text>
                </View>

                <View style={styles.infoBanner}>
                    <Text style={styles.infoTitle}>收益分成说明</Text>
                    <Text style={styles.infoText}>
                        服务订单会按固定抽成、动态档位或新手保护规则结算；下面每条收入都会说明收益来源、命中的抽成规则，以及订单原价、订单实付、平台抽成和实际入账金额。
                    </Text>
                </View>

                <View style={styles.accountCard}>
                    <View style={styles.balanceSection}>
                        <Text style={styles.balanceLabel}>
                            账户余额（含审核中）
                        </Text>
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
                            onPress={() =>
                                router.push("/earnings/withdraw" as any)
                            }
                        >
                            <Ionicons
                                name="wallet-outline"
                                size={20}
                                color="white"
                            />
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
        minHeight: 128,
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 20,
        justifyContent: "center",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    title: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    subtitle: {
        marginTop: 6,
        fontSize: 14,
        color: "#666",
    },
    infoBanner: {
        marginHorizontal: 16,
        marginTop: 12,
        padding: 12,
        borderRadius: 8,
        backgroundColor: "#f0f7ff",
        borderWidth: 1,
        borderColor: "#c8ddff",
        gap: 6,
    },
    infoTitle: {
        fontSize: 13,
        fontWeight: "bold",
        color: "#1f5fb8",
    },
    infoText: {
        fontSize: 13,
        color: "#3b4d65",
        lineHeight: 18,
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
    withdrawalCard: {
        backgroundColor: "white",
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#10233d",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
        elevation: 3,
        gap: 14,
    },
    withdrawalCardTop: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        gap: 12,
    },
    withdrawalCardTopLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    withdrawalMethodIcon: {
        width: 40,
        height: 40,
        borderRadius: 14,
        justifyContent: "center",
        alignItems: "center",
    },
    withdrawalCardTitleWrap: {
        flex: 1,
        gap: 2,
    },
    withdrawalCardTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1d2939",
    },
    withdrawalCardMethod: {
        fontSize: 12,
        color: "#667085",
    },
    withdrawalStatusBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    withdrawalStatusBadgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    withdrawalAmountRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "flex-end",
    },
    withdrawalAmountLabel: {
        fontSize: 12,
        color: "#98A2B3",
    },
    withdrawalAmountValue: {
        fontSize: 24,
        fontWeight: "700",
        letterSpacing: -0.3,
    },
    withdrawalMetaGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    withdrawalMetaItem: {
        width: "48%",
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 4,
    },
    withdrawalMetaItemFull: {
        width: "100%",
    },
    withdrawalMetaLabel: {
        fontSize: 11,
        color: "#98A2B3",
    },
    withdrawalMetaValue: {
        fontSize: 13,
        color: "#344054",
        fontWeight: "500",
        lineHeight: 18,
    },
    withdrawalNoteBox: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 8,
        backgroundColor: "#FFF8E8",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
    },
    withdrawalNoteText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 18,
        color: "#7A5A20",
    },
    incomeCard: {
        backgroundColor: "white",
        borderRadius: 18,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#0f172a",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.05,
        shadowRadius: 16,
        elevation: 3,
        gap: 14,
    },
    incomeCardTop: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
    },
    incomeCardTopLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
        gap: 12,
    },
    incomeIconWrap: {
        width: 42,
        height: 42,
        borderRadius: 15,
        backgroundColor: "#EAFBF3",
        alignItems: "center",
        justifyContent: "center",
    },
    incomeTitleWrap: {
        flex: 1,
        gap: 2,
    },
    incomeTitle: {
        fontSize: 16,
        fontWeight: "700",
        color: "#1D2939",
    },
    incomeSubtitle: {
        fontSize: 12,
        color: "#667085",
    },
    incomeAmount: {
        fontSize: 24,
        fontWeight: "700",
        letterSpacing: -0.3,
    },
    incomeHeaderButton: {
        gap: 14,
    },
    incomeHeaderRight: {
        alignItems: "flex-end",
        gap: 6,
    },
    incomeBadgeRow: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    incomeBadge: {
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 999,
        borderWidth: 1,
    },
    incomeBadgeText: {
        fontSize: 12,
        fontWeight: "600",
    },
    incomeInfoGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    incomeInfoItem: {
        width: "48%",
        backgroundColor: "#F8FAFC",
        borderRadius: 14,
        paddingHorizontal: 12,
        paddingVertical: 10,
        gap: 4,
    },
    incomeInfoLabel: {
        fontSize: 11,
        color: "#98A2B3",
    },
    incomeInfoValue: {
        fontSize: 13,
        color: "#344054",
        fontWeight: "500",
        lineHeight: 18,
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

function getIncomeTitle(item: TransactionItem) {
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
            return "服务收益入账";
    }
}

function isValidTabFilter(
    value?: string | string[] | null,
): value is TabFilter {
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

function getIncomeSummary(item: TransactionItem) {
    switch (item.transactionType) {
        case "service_earning":
            return {
                title: "服务收益入账",
                subtitle: "系统已完成本次收益入账",
            };
        case "bonus":
            return {
                title: "平台奖励",
                subtitle: "奖励金额已发放到账户",
            };
        case "adjustment":
            return {
                title: "财务调整",
                subtitle: "平台已更新本次收入流水",
            };
        default:
            return {
                title: getIncomeTitle(item),
                subtitle: "收入已计入账户余额",
            };
    }
}

function getIncomeExplainMeta(item: TransactionItem) {
    const sourceBadge = getIncomeSourceBadge(item.transactionType);
    const ruleMeta = getIncomeRuleMeta(item);

    return {
        sourceBadge,
        ruleBadge: ruleMeta?.badge,
    };
}

function getIncomeCustomerLabel(item: TransactionItem) {
    return item.customerName?.trim() || "未知用户";
}

function getIncomeCustomerPhone(item: TransactionItem) {
    return item.customerPhone?.trim() || "暂无手机号";
}

function getIncomeOrderNumberLabel(item: TransactionItem) {
    return item.id?.trim();
}

function getIncomeSourceBadge(
    transactionType: TransactionItem["transactionType"],
): IncomeBadgeMeta {
    switch (transactionType) {
        case "service_earning":
            return {
                label: "服务订单",
                textColor: "#127A4C",
                backgroundColor: "#EAFBF3",
                borderColor: "#CBEFD9",
            };
        case "bonus":
            return {
                label: "平台奖励",
                textColor: "#A15C07",
                backgroundColor: "#FFF5E8",
                borderColor: "#F7D7A0",
            };
        case "adjustment":
            return {
                label: "财务调整",
                textColor: "#2457B2",
                backgroundColor: "#EEF4FF",
                borderColor: "#D4E2FF",
            };
        default:
            return {
                label: "其他收入",
                textColor: "#475467",
                backgroundColor: "#F2F4F7",
                borderColor: "#E4E7EC",
            };
    }
}

function getIncomeRuleMeta(item: TransactionItem) {
    const shouldExplainCommission =
        item.transactionType === "service_earning" ||
        Boolean(item.commissionRuleType) ||
        typeof item.commissionRate === "number" ||
        typeof item.commissionAmount === "number";

    if (!shouldExplainCommission) {
        return null;
    }

    const commissionRateLabel = formatCommissionRate(
        item.commissionRate,
        "当前规则",
    );
    const thresholdAmountLabel = formatCurrencyAmount(item.commissionThreshold);
    const monthlyIncomeLabel = formatCurrencyAmount(item.monthlyIncomeSnapshot);

    switch (item.commissionRuleType) {
        case "fixed":
            return {
                badge: {
                    label: "固定抽成",
                    textColor: "#2457B2",
                    backgroundColor: "#EEF4FF",
                    borderColor: "#D4E2FF",
                },
                description:
                    commissionRateLabel === "当前规则"
                        ? "这笔服务收入按固定抽成规则结算。"
                        : `这笔服务收入按固定抽成规则结算，本单抽成比例为 ${commissionRateLabel}。`,
            };
        case "dynamic": {
            const badge = {
                label: "动态抽成",
                textColor: "#0F6CBD",
                backgroundColor: "#EDF7FF",
                borderColor: "#CFE5FF",
            } satisfies IncomeBadgeMeta;

            if (monthlyIncomeLabel && thresholdAmountLabel) {
                return {
                    badge,
                    description:
                        commissionRateLabel === "当前规则"
                            ? `结算前当月收入 ${monthlyIncomeLabel}，命中 ${thresholdAmountLabel} 档，按动态规则结算。`
                            : `结算前当月收入 ${monthlyIncomeLabel}，命中 ${thresholdAmountLabel} 档，因此本单按 ${commissionRateLabel} 抽成。`,
                };
            }

            if (monthlyIncomeLabel) {
                return {
                    badge,
                    description:
                        commissionRateLabel === "当前规则"
                            ? `结算前当月收入为 ${monthlyIncomeLabel}，本单按动态规则结算。`
                            : `结算前当月收入为 ${monthlyIncomeLabel}，本单按动态规则以 ${commissionRateLabel} 抽成。`,
                };
            }

            if (thresholdAmountLabel) {
                return {
                    badge,
                    description:
                        commissionRateLabel === "当前规则"
                            ? `本单命中 ${thresholdAmountLabel} 档，按动态规则结算。`
                            : `本单命中 ${thresholdAmountLabel} 档，因此按 ${commissionRateLabel} 抽成。`,
                };
            }

            return {
                badge,
                description:
                    commissionRateLabel === "当前规则"
                        ? "这笔服务收入按动态抽成规则结算。"
                        : `这笔服务收入按动态抽成规则结算，本单抽成比例为 ${commissionRateLabel}。`,
            };
        }
        case "beginner-protection":
            return {
                badge: {
                    label: "新手保护",
                    textColor: "#127A4C",
                    backgroundColor: "#ECFDF3",
                    borderColor: "#CBEFD9",
                },
                description:
                    commissionRateLabel === "当前规则"
                        ? "当前命中新手保护规则，这笔服务收入按保护期规则结算。"
                        : `当前命中新手保护规则，因此本单按 ${commissionRateLabel} 抽成。`,
            };
        default:
            return {
                badge: {
                    label: "规则结算",
                    textColor: "#475467",
                    backgroundColor: "#F2F4F7",
                    borderColor: "#E4E7EC",
                },
                description:
                    commissionRateLabel === "当前规则"
                        ? "这笔收入按平台结算规则入账。"
                        : `这笔收入按平台结算规则入账，当前抽成比例为 ${commissionRateLabel}。`,
            };
    }
}

function getIncomeInfoItems(
    item: TransactionItem,
    values: {
        orderNumberLabel: string;
        customerLabel: string;
        customerPhone: string;
        serviceName: string;
        specificationName: string;
        commissionRateLabel: string;
        originalOrderPriceLabel: string;
        settlementAmountLabel: string;
        commissionAmountLabel: string;
        incomeTimeLabel: string;
    },
): IncomeInfoItemMeta[] {
    const shouldShowCustomerInfo =
        item.transactionType === "service_earning" ||
        Boolean(item.customerName?.trim()) ||
        Boolean(item.customerPhone?.trim());
    const amountLabels =
        item.transactionType === "service_earning"
            ? {
                  commissionRate: "抽成比例",
                  originalOrderPrice: "订单原价",
                  settlementAmount: "订单实付",
                  commissionAmount: "平台抽成",
              }
            : {
                  commissionRate: "规则比例",
                  originalOrderPrice: "原始金额",
                  settlementAmount: "结算金额",
                  commissionAmount: "规则扣减",
              };
    const items: IncomeInfoItemMeta[] = [
        {
            label: "订单号",
            value: values.orderNumberLabel,
        },
    ];

    if (shouldShowCustomerInfo) {
        if (item.transactionType === "service_earning") {
            items.push(
                {
                    label: "服务项目",
                    value: values.serviceName,
                },
                {
                    label: "服务规格",
                    value: values.specificationName,
                },
            );
        }

        items.push(
            {
                label: "下单用户",
                value: values.customerLabel,
            },
            {
                label: "联系手机",
                value: values.customerPhone,
            },
        );
    }

    items.push(
        {
            label: amountLabels.commissionRate,
            value: values.commissionRateLabel,
        },
        {
            label: amountLabels.originalOrderPrice,
            value: values.originalOrderPriceLabel,
        },
        {
            label: amountLabels.settlementAmount,
            value: values.settlementAmountLabel,
        },
        {
            label: amountLabels.commissionAmount,
            value: values.commissionAmountLabel,
        },
        {
            label: "入账时间",
            value: values.incomeTimeLabel,
        },
    );

    return items;
}

function formatCommissionRate(value?: number | null, fallback = "暂无") {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return fallback;
    }

    return `${value}%`;
}

function formatOptionalAmount(value?: number | null, fallback = "暂无") {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return fallback;
    }

    return `¥${formatCurrency(value)}`;
}

function formatCurrencyAmount(value?: number | null) {
    if (typeof value !== "number" || Number.isNaN(value)) {
        return null;
    }

    return `¥${formatCurrency(value)}`;
}

function getWithdrawalMethodMeta(method?: string | null) {
    switch (method) {
        case "wechat_pay":
            return {
                label: "微信提现",
                icon: "logo-wechat" as const,
                iconColor: "#07C160",
                iconBackground: "#E9FBF1",
            };
        case "alipay":
            return {
                label: "支付宝提现",
                icon: "logo-alipay" as const,
                iconColor: "#1677FF",
                iconBackground: "#EEF4FF",
            };
        default:
            return {
                label: "账户提现",
                icon: "wallet-outline" as const,
                iconColor: "#667085",
                iconBackground: "#F2F4F7",
            };
    }
}

function getWithdrawalResultTimeLabel(item: TransactionItem) {
    const status = item.withdrawal?.status;
    if (status === "rejected") {
        return {
            label: "驳回时间",
            value: formatOptionalTransactionTime(item.withdrawal?.reviewedAt),
        };
    }
    if (
        status === "completed" ||
        status === "failed" ||
        status === "cancelled"
    ) {
        return {
            label: "完成时间",
            value: formatOptionalTransactionTime(
                item.withdrawal?.processedAt ?? item.withdrawal?.reviewedAt,
            ),
        };
    }
    return {
        label: "处理时间",
        value: "处理中",
    };
}

function resolveTransactionOccurredAt(
    item: TransactionItem,
): string | Date | null {
    const legacyCreatedAt = (
        item as TransactionItem & {
            createdAt?: string | Date | null;
        }
    ).createdAt;

    return item.occurredAt ?? legacyCreatedAt ?? null;
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
