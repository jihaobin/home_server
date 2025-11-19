import { Ionicons } from "@expo/vector-icons";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useEarningsOverview, useWithdraw } from "@repo/hooks/api/pay";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
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
    const [selectedAccount, setSelectedAccount] = useState<"alipay" | "wechat">(
        "alipay",
    );
    const { data: overview, refetch: refetchOverview } = useEarningsOverview();
    const { mutateAsync: submitWithdraw, isPending: isWithdrawing } = useWithdraw();

    const minWithdraw = 100;
    const maxWithdraw = 5000;

    const quickAmounts = [100, 500, 1000, 2000];

    const accounts = {
        alipay: {
            name: "张**",
            account: "138****1234",
        },
        wechat: {
            name: "张三",
            account: "wxid_****",
        },
    };

    const availableBalance = overview?.balance?.available ?? 0;
    const withdrawableLimit = Math.min(availableBalance, maxWithdraw);

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

    const handleWithdraw = () => {
        if (selectedAccount !== "alipay") {
            Alert.alert("提示", "当前仅支持提现到支付宝账号");
            return;
        }

        const withdrawAmount = parseFloat(amount);

        if (!amount || isNaN(withdrawAmount)) {
            Alert.alert("提示", "请输入提现金额");
            return;
        }

        if (withdrawAmount < minWithdraw) {
            Alert.alert("提示", `最低提现金额为¥${minWithdraw}`);
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

        Alert.alert(
            "确认提现",
            `确认提现¥${withdrawAmount}到${selectedAccount === "alipay" ? "支付宝" : "微信"}吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "确定",
                    onPress: () => submitWithdrawRequest(withdrawAmount),
                },
            ],
        );
    };

    const submitWithdrawRequest = async (withdrawAmount: number) => {
        try {
            const account = accounts[selectedAccount];
            await submitWithdraw({
                amount: withdrawAmount,
                currency: "CNY",
                payType: "alipay",
                payee: {
                    identity: account.account,
                    identity_type: "ALIPAY_LOGON_ID",
                    name: account.name,
                },
                remark: "师傅端提现",
            });
            await refetchOverview();
            Alert.alert("提现成功", "预计1-3个工作日到账", [
                {
                    text: "确定",
                    onPress: () => router.back(),
                },
            ]);
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

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 余额显示 */}
                <View style={styles.balanceCard}>
                    <Text style={styles.balanceLabel}>可提现余额</Text>
                    <Text style={styles.balanceAmount}>
                        ¥{formatCurrency(availableBalance)}
                    </Text>
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
                        <TouchableOpacity style={styles.allButton} onPress={handleAll}>
                            <Text style={styles.allButtonText}>全部</Text>
                        </TouchableOpacity>
                    </View>
                    <Text style={styles.hint}>
                        单次提现：¥{minWithdraw} - ¥{maxWithdraw}
                    </Text>

                    {/* 快捷金额 */}
                    <View style={styles.quickAmounts}>
                        {quickAmounts.map((value) => (
                            <TouchableOpacity
                                key={value}
                                style={[
                                    styles.quickButton,
                                    amount === value.toString() && styles.quickButtonActive,
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
                </View>

                {/* 选择提现账户 */}
                <View style={styles.accountSection}>
                    <Text style={styles.sectionTitle}>提现到</Text>

                    {/* 支付宝 */}
                    <TouchableOpacity
                        style={[
                            styles.accountCard,
                            selectedAccount === "alipay" && styles.accountCardActive,
                        ]}
                        onPress={() => setSelectedAccount("alipay")}
                    >
                        <View style={styles.accountLeft}>
                            <View
                                style={[styles.accountIcon, { backgroundColor: "#1677FF" }]}
                            >
                                <Ionicons name="logo-alipay" size={24} color="white" />
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={styles.accountType}>支付宝</Text>
                                <Text style={styles.accountDetail}>
                                    {accounts.alipay.name} {accounts.alipay.account}
                                </Text>
                            </View>
                        </View>
                        <View
                            style={[
                                styles.radio,
                                selectedAccount === "alipay" && styles.radioActive,
                            ]}
                        >
                            {selectedAccount === "alipay" && (
                                <View style={styles.radioDot} />
                            )}
                        </View>
                    </TouchableOpacity>

                    {/* 微信 */}
                    <TouchableOpacity
                        style={[
                            styles.accountCard,
                            selectedAccount === "wechat" && styles.accountCardActive,
                        ]}
                        onPress={() => setSelectedAccount("wechat")}
                    >
                        <View style={styles.accountLeft}>
                            <View
                                style={[styles.accountIcon, { backgroundColor: "#07C160" }]}
                            >
                                <Ionicons name="logo-wechat" size={24} color="white" />
                            </View>
                            <View style={styles.accountInfo}>
                                <Text style={styles.accountType}>微信</Text>
                                <Text style={styles.accountDetail}>
                                    {accounts.wechat.name} {accounts.wechat.account}
                                </Text>
                            </View>
                        </View>
                        <View
                            style={[
                                styles.radio,
                                selectedAccount === "wechat" && styles.radioActive,
                            ]}
                        >
                            {selectedAccount === "wechat" && (
                                <View style={styles.radioDot} />
                            )}
                        </View>
                    </TouchableOpacity>
                </View>

                {/* 提现说明 */}
                <View style={styles.tipsSection}>
                    <Text style={styles.tipsTitle}>提现说明</Text>
                    <View style={styles.tipItem}>
                        <Ionicons name="time-outline" size={16} color="#666" />
                        <Text style={styles.tipText}>预计1-3个工作日到账</Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons name="cash-outline" size={16} color="#666" />
                        <Text style={styles.tipText}>
                            单次提现范围：¥{minWithdraw} - ¥{maxWithdraw}
                        </Text>
                    </View>
                    <View style={styles.tipItem}>
                        <Ionicons name="shield-checkmark-outline" size={16} color="#666" />
                        <Text style={styles.tipText}>提现免手续费</Text>
                    </View>
                </View>
            </ScrollView>

            {/* 提现按钮 */}
            <View style={styles.footer}>
                <TouchableOpacity
                    style={[
                        styles.withdrawButton,
                        (!amount || isWithdrawing) && styles.withdrawButtonDisabled,
                    ]}
                    onPress={handleWithdraw}
                    disabled={!amount || isWithdrawing}
                >
                    <Text style={styles.withdrawButtonText}>
                        {isWithdrawing
                            ? "提现处理中..."
                            : `确认提现${amount ? ` ¥${amount}` : ""}`}
                    </Text>
                </TouchableOpacity>
            </View>
        </View>
    );
}

function formatCurrency(value: number) {
    return value.toFixed(2);
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
});
