import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import {
    useEarningsOverview,
    useWithdraw,
    useInfiniteWorkerEarningsRecords,
    useWorkerAlipayBindingStatus,
} from "@repo/hooks/api/pay";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { useRouter } from "expo-router";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
    Alert,
    ActivityIndicator,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

export default function WithdrawScreen() {
    return (
        <RequireAuth>
            <WithdrawContent />
        </RequireAuth>
    );
}

function WithdrawContent() {
    const router = useRouter();
    const [amount, setAmount] = useState("");
    const [remark, setRemark] = useState("");
    const { data: overview, refetch: refetchOverview } = useEarningsOverview();
    const { mutateAsync: submitWithdraw, isPending: isWithdrawing } =
        useWithdraw();
    const {
        data: bindingStatus,
        isLoading: isBindingStatusLoading,
        refetch: refetchBindingStatus,
    } = useWorkerAlipayBindingStatus();
    const withdrawalQueryParams = useMemo(
        () => ({
            limit: 3,
            category: "withdrawal" as const,
        }),
        [],
    );
    const {
        data: withdrawalRecordPages,
        isLoading: withdrawalRecordsLoading,
        refetch: refetchWithdrawalRecords,
    } = useInfiniteWorkerEarningsRecords(withdrawalQueryParams);
    const [hasSubmitted, setHasSubmitted] = useState(false);
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                refetchOverview(),
                refetchWithdrawalRecords(),
                refetchBindingStatus(),
            ]),
    });

    const maxWithdraw = 5000;

    const quickAmounts = [100, 500, 1000, 2000];

    const availableBalance = overview?.balance?.available ?? 0;
    const withdrawableLimit = Math.min(availableBalance, maxWithdraw);
    const frozenBalance = overview?.balance?.frozen ?? 0;
    const totalBalance = availableBalance + frozenBalance;
    const withdrawalRecords = useMemo(() => {
        const pages = withdrawalRecordPages?.pages ?? [];
        return pages.flatMap((page) => page.items);
    }, [withdrawalRecordPages]);
    const pendingHistoryReview = useMemo(
        () =>
            withdrawalRecords.some((record) => {
                const status = record.withdrawal?.status;
                return status === "pending" || status === "approved";
            }),
        [withdrawalRecords],
    );
    const hasPendingReview = frozenBalance > 0 || pendingHistoryReview;
    const latestWithdrawalRecords = useMemo(
        () => withdrawalRecords.slice(0, 3),
        [withdrawalRecords],
    );
    const isWithdrawButtonDisabled =
        !amount ||
        isWithdrawing ||
        hasPendingReview ||
        hasSubmitted ||
        isBindingStatusLoading ||
        !bindingStatus?.bound;

    useEffect(() => {
        if (!hasPendingReview) {
            setHasSubmitted(false);
        }
    }, [hasPendingReview]);

    const handleQuickSelect = (value: number) => {
        const normalized = Math.min(withdrawableLimit, value);
        setAmount(normalized > 0 ? normalized.toString() : "");
    };

    const handleAll = () => {
        if (withdrawableLimit <= 0) {
            setAmount("");
            return;
        }
        setAmount(withdrawableLimit.toString());
    };

    const handleOpenRecords = () => {
        router.push({
            pathname: "/(tabs)/earnings",
            params: { tab: "withdrawal" },
        } as never);
    };

    const handleOpenBinding = () => {
        router.push("/profile/account-binding" as never);
    };

    const handleWithdraw = () => {
        if (hasPendingReview) {
            Alert.alert(
                "提示",
                "当前有提现申请正在审核，请等待审核完成后再试。",
            );
            return;
        }
        if (isBindingStatusLoading) {
            Alert.alert("提示", "正在获取支付宝绑定信息，请稍后重试");
            return;
        }
        if (!bindingStatus?.bound) {
            Alert.alert("提示", "请先绑定支付宝账号后再提现。", [
                { text: "取消", style: "cancel" },
                {
                    text: "去绑定",
                    onPress: handleOpenBinding,
                },
            ]);
            return;
        }

        const withdrawAmount = parseFloat(amount);
        const normalizedRemark = remark.trim();

        if (!amount || isNaN(withdrawAmount)) {
            Alert.alert("提示", "请输入提现金额");
            return;
        }

        if (withdrawAmount < 0.1) {
            Alert.alert("提示", "提现金额需大于或等于 0.1 元");
            return;
        }

        if (withdrawAmount > maxWithdraw) {
            Alert.alert("提示", `单次提现金额不能超过¥${maxWithdraw}`);
            return;
        }

        if (withdrawAmount > availableBalance) {
            Alert.alert("提示", "余额不足");
            return;
        }

        if (withdrawAmount >= 50000 && !normalizedRemark) {
            Alert.alert("提示", "单笔提现金额满 50000 元时需填写备注");
            return;
        }

        const targetAccount =
            bindingStatus?.alipayUserId ||
            bindingStatus?.alipayOpenId ||
            "已绑定支付宝";

        Alert.alert(
            "确认提现",
            `提现申请提交后将进入后台审核并打款至 ${targetAccount}，预计1-3个工作日内完成。确认提交¥${withdrawAmount}的提现申请吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "提交申请",
                    onPress: () => submitWithdrawRequest(withdrawAmount),
                },
            ],
        );
    };

    const submitWithdrawRequest = async (withdrawAmount: number) => {
        try {
            await submitWithdraw({
                amount: withdrawAmount,
                currency: "CNY",
                payType: "alipay",
                remark: remark.trim() || undefined,
            });
            setHasSubmitted(true);
            setAmount("");
            await Promise.allSettled([
                refetchOverview(),
                refetchWithdrawalRecords(),
                refetchBindingStatus(),
            ]);
            setRemark("");
            Alert.alert(
                "提现申请已提交",
                "后台正在进行审核，预计 1-3 个工作日内完成，请关注提现记录更新。",
                [
                    {
                        text: "确定",
                        onPress: () => router.back(),
                    },
                ],
            );
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "提现失败，请稍后重试";
            Alert.alert("提现失败", message);
        }
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>提现</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || withdrawalRecordsLoading}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#4CAF50"
                    />
                }
            >
                {/* 余额显示 */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>
                        账户余额（含审核中）
                    </Text>
                    <Text style={styles.balanceAmount}>
                        ¥{formatCurrency(totalBalance)}
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
                </View>

                {/* 提现金额输入 */}
                <View style={styles.amountSection}>
                    <Text style={styles.sectionTitle}>提现金额</Text>
                    <View style={styles.inputCard}>
                        <Text style={styles.currencySymbol}>¥</Text>
                        <TextInput
                            style={styles.amountInput}
                            value={amount}
                            onChangeText={setAmount}
                            placeholder="请输入提现金额"
                            keyboardType="decimal-pad"
                            maxLength={10}
                        />
                        <TouchableOpacity
                            style={styles.allButton}
                            onPress={handleAll}
                        >
                            <Text style={styles.allButtonText}>全部</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>
                        单次提现金额不超过 ¥{maxWithdraw}
                    </Text>

                    {/* 快捷金额 */}
                    <View style={styles.quickAmounts}>
                        {quickAmounts.map((value) => (
                            <TouchableOpacity
                                key={value}
                                style={[
                                    styles.quickButton,
                                    amount === value.toString() &&
                                        styles.quickButtonActive,
                                ]}
                                onPress={() => handleQuickSelect(value)}
                            >
                                <Text
                                    style={[
                                        styles.quickButtonText,
                                        amount === value.toString() &&
                                            styles.quickButtonTextActive,
                                    ]}
                                >
                                    ¥{value}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>

                    <View style={styles.reviewNotice}>
                        <Ionicons
                            name="information-circle-outline"
                            size={20}
                            color="#2196F3"
                        />
                        <View style={styles.reviewNoticeContent}>
                            <Text style={styles.reviewNoticeTitle}>
                                提现需后台审核
                            </Text>
                            <Text style={styles.reviewNoticeText}>
                                申请提交后由财务审核，预计 1-3
                                个工作日内打款。可随时在提现记录中查看审核进展。
                            </Text>
                            <TouchableOpacity
                                onPress={handleOpenRecords}
                                style={styles.reviewNoticeLink}
                            >
                                <Text style={styles.reviewNoticeLinkText}>
                                    查看提现记录
                                </Text>
                                <Ionicons
                                    name="arrow-forward"
                                    size={16}
                                    color="#2196F3"
                                />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>

                <View style={styles.remarkSection}>
                    <Text style={styles.sectionTitle}>提现备注</Text>
                    <View style={[styles.inputCard, styles.remarkInputCard]}>
                        <TextInput
                            style={styles.remarkInput}
                            value={remark}
                            onChangeText={setRemark}
                            placeholder="可填写打款备注，单笔金额 ≥ 50000 元时必填"
                            multiline
                            maxLength={200}
                            textAlignVertical="top"
                        />
                    </View>
                    <Text style={styles.hint}>
                        备注会随提现申请传递给审核及打款流程，留空则为无备注
                    </Text>
                </View>

                <View style={styles.historySection}>
                    <View style={styles.historyHeader}>
                        <Text style={styles.sectionTitle}>提现记录</Text>
                        <TouchableOpacity
                            style={styles.historyLink}
                            onPress={handleOpenRecords}
                        >
                            <Text style={styles.historyLinkText}>
                                查看全部记录
                            </Text>
                            <Ionicons
                                name="arrow-forward"
                                size={14}
                                color="#2196F3"
                            />
                        </TouchableOpacity>
                    </View>
                    {withdrawalRecordsLoading ? (
                        <View style={styles.historyEmpty}>
                            <ActivityIndicator size="small" color="#2196F3" />
                            <Text style={styles.historyEmptyText}>
                                提现记录加载中...
                            </Text>
                        </View>
                    ) : latestWithdrawalRecords.length === 0 ? (
                        <View style={styles.historyEmpty}>
                            <Ionicons
                                name="receipt-outline"
                                size={32}
                                color="#ccc"
                            />
                            <Text style={styles.historyEmptyText}>
                                暂无提现记录
                            </Text>
                        </View>
                    ) : (
                        latestWithdrawalRecords.map((record, index) => {
                            const detail = record.withdrawal;
                            const statusMeta = getWithdrawalStatusMeta(
                                detail?.status,
                            );
                            const note =
                                detail?.reviewNote ??
                                detail?.failureReason ??
                                detail?.remark ??
                                "";
                            const timestamp =
                                detail?.requestedAt ?? record.occurredAt;

                            return (
                                <View
                                    key={record.id}
                                    style={[
                                        styles.historyCard,
                                        index === 0 && styles.historyCardFirst,
                                    ]}
                                >
                                    <View style={styles.historyRow}>
                                        <Text style={styles.historyAmount}>
                                            ¥
                                            {formatCurrency(
                                                Math.abs(record.amount),
                                            )}
                                        </Text>
                                        <Text style={styles.historyTime}>
                                            {formatTransactionTime(timestamp)}
                                        </Text>
                                    </View>
                                    {statusMeta ? (
                                        <Text
                                            style={[
                                                styles.historyStatus,
                                                { color: statusMeta.color },
                                            ]}
                                        >
                                            {statusMeta.label}
                                        </Text>
                                    ) : null}
                                    {note ? (
                                        <Text style={styles.historyNote}>
                                            审核备注：{note}
                                        </Text>
                                    ) : null}
                                </View>
                            );
                        })
                    )}
                </View>

                {/* 收款账户 */}
                <View style={styles.accountSection}>
                    <Text style={styles.sectionTitle}>收款账户</Text>

                    <View
                        style={[
                            styles.accountCard,
                            !bindingStatus?.bound && styles.accountCardPending,
                        ]}
                    >
                        <View style={styles.accountLeft}>
                            <View
                                style={[
                                    styles.accountIcon,
                                    { backgroundColor: "#1677FF" },
                                ]}
                            >
                                <Ionicons
                                    name="logo-alipay"
                                    size={24}
                                    color="white"
                                />
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={styles.accountType}>支付宝</Text>
                                <Text style={styles.accountDetail}>
                                    {isBindingStatusLoading
                                        ? "加载中..."
                                        : bindingStatus?.bound
                                          ? `已绑定 ${bindingStatus.alipayUserId || bindingStatus.alipayOpenId || ""}`
                                          : "未绑定，绑定后才能提交提现"}
                                </Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={styles.accountActionButton}
                            onPress={handleOpenBinding}
                            disabled={isBindingStatusLoading}
                        >
                            <Text style={styles.accountActionButtonText}>
                                {bindingStatus?.bound ? "更换账号" : "去绑定"}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {!bindingStatus?.bound ? (
                        <Text style={styles.accountWarning}>
                            绑定支付宝账号后才能发起提现，点击按钮前往绑定
                        </Text>
                    ) : null}
                </View>

                {/* 提现说明 */}
                <View style={styles.tipsSection}>
                    <Text style={styles.tipsTitle}>提现说明</Text>
                    <View style={styles.tipItem}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.tipText}>
                            提交后由后台审核，预计1-3个工作日内打款
                        </Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <Text style={styles.tipText}>
                            单次提现最高 ¥{maxWithdraw}
                        </Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons
                            name="shield-checkmark-outline"
                            size={16}
                            color="#666"
                        />
                        <Text style={styles.tipText}>提现免手续费</Text>
                    </View>
                </View>
            </ScrollView>

            {/* 提现按钮 */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.withdrawButton,
                        isWithdrawButtonDisabled &&
                            styles.withdrawButtonDisabled,
                    ]}
                    onPress={handleWithdraw}
                    disabled={isWithdrawButtonDisabled}
                >
                    <Text style={styles.withdrawButtonText}>
                        {hasPendingReview || hasSubmitted
                            ? "申请已提交，等待审核"
                            : isWithdrawing
                              ? "提现申请提交中..."
                              : `提交提现申请${amount ? ` ¥${amount}` : ""}`}
                    </Text>
                </TouchableOpacity>
                <Text style={styles.footerHint}>
                    提交后由管理员审核，预计 1-3 个工作日处理
                </Text>
                <Text
                    style={[
                        styles.footerHint,
                        (hasPendingReview || hasSubmitted) &&
                            styles.footerHintWarning,
                    ]}
                >
                    审核期间不可重复申请，请关注提现记录更新
                </Text>
            </View>
        </View>
    );
}

function formatCurrency(value: number) {
    return value.toFixed(2);
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
    let dayLabel = `${date.getFullYear()}-${String(
        date.getMonth() + 1,
    ).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
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

const WITHDRAWAL_STATUS_META: Record<string, { label: string; color: string }> =
    {
        pending: { label: "待审核", color: "#FF9800" },
        approved: { label: "审核通过，待打款", color: "#2196F3" },
        completed: { label: "已打款", color: "#4CAF50" },
        rejected: { label: "已驳回", color: "#FF5722" },
    };

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

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 60,
        paddingBottom: 20,
        backgroundColor: "white",
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    placeholder: {
        width: 32,
    },
    content: {
        flex: 1,
    },
    balanceCard: {
        backgroundColor: "#4CAF50",
        margin: 16,
        borderRadius: 12,
        padding: 24,
        alignItems: "center",
    },
    balanceSubRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "center",
        marginTop: 12,
    },
    balanceSubText: {
        fontSize: 12,
        color: "rgba(255,255,255,0.85)",
        marginHorizontal: 8,
    },
    balanceDivider: {
        width: 1,
        height: 12,
        backgroundColor: "rgba(255,255,255,0.6)",
    },
    balanceLabel: {
        fontSize: 14,
        color: "rgba(255,255,255,0.9)",
        marginBottom: 8,
    },
    balanceAmount: {
        fontSize: 36,
        fontWeight: "bold",
        color: "white",
    },
    amountSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    historySection: {
        backgroundColor: "white",
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        padding: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    historyHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 8,
    },
    historyLink: {
        flexDirection: "row",
        alignItems: "center",
    },
    historyLinkText: {
        color: "#2196F3",
        fontSize: 12,
        marginRight: 4,
    },
    historyCard: {
        borderTopWidth: 1,
        borderTopColor: "#f0f0f0",
        paddingVertical: 12,
    },
    historyCardFirst: {
        borderTopWidth: 0,
        paddingTop: 4,
    },
    historyRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    historyAmount: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    historyTime: {
        fontSize: 12,
        color: "#999",
    },
    historyStatus: {
        fontSize: 13,
        fontWeight: "500",
    },
    historyNote: {
        fontSize: 12,
        color: "#666",
        marginTop: 4,
        lineHeight: 18,
    },
    historyEmpty: {
        alignItems: "center",
        justifyContent: "center",
        paddingVertical: 24,
    },
    historyEmptyText: {
        fontSize: 13,
        color: "#999",
        marginTop: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 12,
    },
    inputCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    currencySymbol: {
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
        marginRight: 8,
    },
    amountInput: {
        flex: 1,
        fontSize: 24,
        fontWeight: "bold",
        color: "#333",
    },
    allButton: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 12,
        backgroundColor: "#2196F3",
    },
    allButtonText: {
        fontSize: 14,
        color: "white",
        fontWeight: "bold",
    },
    hint: {
        fontSize: 12,
        color: "#999",
        marginTop: 8,
    },
    quickAmounts: {
        flexDirection: "row",
        flexWrap: "wrap",
        marginTop: 16,
    },
    quickButton: {
        width: "23%",
        marginRight: "2.66%",
        marginBottom: 12,
        paddingVertical: 10,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#ddd",
        backgroundColor: "white",
        alignItems: "center",
    },
    quickButtonActive: {
        borderColor: "#2196F3",
        backgroundColor: "#E3F2FD",
    },
    quickButtonText: {
        fontSize: 14,
        color: "#666",
    },
    quickButtonTextActive: {
        color: "#2196F3",
        fontWeight: "bold",
    },
    remarkSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    remarkInputCard: {
        alignItems: "flex-start",
    },
    remarkInput: {
        flex: 1,
        fontSize: 14,
        color: "#333",
        minHeight: 72,
    },
    reviewNotice: {
        marginTop: 16,
        flexDirection: "row",
        padding: 16,
        borderRadius: 12,
        backgroundColor: "#E8F4FF",
        gap: 12,
    },
    reviewNoticeContent: {
        flex: 1,
        gap: 6,
    },
    reviewNoticeTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1e88e5",
    },
    reviewNoticeText: {
        fontSize: 12,
        color: "#555",
        lineHeight: 18,
    },
    reviewNoticeLink: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    reviewNoticeLinkText: {
        fontSize: 13,
        color: "#1e88e5",
        fontWeight: "600",
    },
    accountSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    accountCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 12,
        borderWidth: 2,
        borderColor: "transparent",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    accountCardPending: {
        borderColor: "#FF9800",
    },
    accountCardActive: {
        borderColor: "#2196F3",
    },
    accountLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    accountIcon: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    accountInfo: {
        flex: 1,
    },
    accountType: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 4,
    },
    accountDetail: {
        fontSize: 12,
        color: "#999",
    },
    accountActionButton: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        backgroundColor: "#2196F3",
    },
    accountActionButtonText: {
        color: "#fff",
        fontSize: 13,
        fontWeight: "600",
    },
    accountWarning: {
        fontSize: 12,
        color: "#FF9800",
        marginTop: 4,
        marginLeft: 4,
    },
    radio: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: "#ddd",
        justifyContent: "center",
        alignItems: "center",
    },
    radioActive: {
        borderColor: "#2196F3",
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#2196F3",
    },
    tipsSection: {
        paddingHorizontal: 16,
        marginBottom: 16,
    },
    tipsTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#666",
        marginBottom: 12,
    },
    tipItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    tipText: {
        fontSize: 12,
        color: "#666",
        marginLeft: 8,
    },
    footer: {
        padding: 16,
        backgroundColor: "white",
        borderTopWidth: 1,
        borderTopColor: "#eee",
    },
    withdrawButton: {
        height: 48,
        borderRadius: 24,
        backgroundColor: "#4CAF50",
        justifyContent: "center",
        alignItems: "center",
    },
    withdrawButtonDisabled: {
        backgroundColor: "#ccc",
    },
    withdrawButtonText: {
        fontSize: 16,
        color: "white",
        fontWeight: "bold",
    },
    footerHint: {
        marginTop: 8,
        fontSize: 12,
        color: "#999",
    },
    footerHintWarning: {
        color: "#FF9800",
        fontWeight: "600",
    },
});
