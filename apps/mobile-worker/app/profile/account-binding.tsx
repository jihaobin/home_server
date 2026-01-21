import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    useExchangeWorkerAlipayAuthCode,
    useWorkerAlipayAuthorizeParams,
    useWorkerAlipayBindingStatus,
    useUnbindWorkerAlipay,
} from "@repo/hooks/api/pay";
import { aliAuth } from "@repo/lib/pay";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";

interface AccountInfo {
    type: "alipay" | "wechat";
    account: string;
    name: string;
}

const maskAccount = (value?: string | null) => {
    if (!value) return "";
    if (value.length <= 4) return value;
    return `${value.slice(0, 2)}****${value.slice(-2)}`;
};

export default function AccountBindingScreen() {
    const router = useRouter();
    const [boundAccounts, setBoundAccounts] = useState<AccountInfo[]>([]);
    const [wechatAccount, setWechatAccount] = useState("");
    const [wechatName, setWechatName] = useState("");
    const [showWechatForm, setShowWechatForm] = useState(false);
    const [authError, setAuthError] = useState<string | null>(null);
    const [isBindingAlipay, setIsBindingAlipay] = useState(false);

    const {
        refetch: refetchAlipayParams,
        isFetching: isFetchingAlipayParams,
        isLoading: isLoadingAlipayParams,
    } = useWorkerAlipayAuthorizeParams({ enabled: false });
    const {
        data: bindingStatus,
        refetch: refetchBindingStatus,
        isFetching: isFetchingBindingStatus,
    } = useWorkerAlipayBindingStatus();
    const {
        mutateAsync: exchangeAlipayAuthCode,
        isPending: isExchangingAlipayAuth,
    } = useExchangeWorkerAlipayAuthCode();
    const {
        mutateAsync: unbindAlipay,
        isPending: isUnbindingAlipay,
    } = useUnbindWorkerAlipay();

    const alipayBindingLoading =
        isBindingAlipay ||
        isFetchingAlipayParams ||
        isLoadingAlipayParams ||
        isExchangingAlipayAuth ||
        isFetchingBindingStatus ||
        isUnbindingAlipay;

    const handleBindAlipay = async () => {
        if (alipayBindingLoading) return;

        setAuthError(null);
        setIsBindingAlipay(true);
        try {
            const { data } = await refetchAlipayParams();
            console.log("Fetched Alipay params:", data);
            if (!data?.paramString) {
                throw new Error("无法获取支付宝授权参数，请稍后重试");
            }

            const authResult = await aliAuth(data.paramString);
            console.log("Alipay auth result:", authResult);
            if (authResult.resultStatus !== "9000") {
                throw new Error(authResult.memo || "用户取消授权");
            }

            const parsed = new URLSearchParams(authResult.result ?? "");
            if (parsed.get("result_code") !== "200") {
                throw new Error("支付宝未授权成功，请稍后重试");
            }

            console.log("Parsed Alipay auth params:", authResult.result);

            const authCode = parsed.get("auth_code") ?? undefined;

            if (!authCode) {
                throw new Error("未能获取到支付宝授权码，请重新授权");
            }

            await exchangeAlipayAuthCode({
                authCode,
                appId: data.params?.appId,
                scope: data.params?.scope,
                targetId: data.params?.targetId,
            });
            await refetchBindingStatus();
            Alert.alert("绑定成功", "支付宝账号已绑定。");
        } catch (error) {
            const message =
                error instanceof Error ? error.message : "授权失败，请稍后再试";
            setAuthError(message);
            Alert.alert("授权失败", message);
        } finally {
            setIsBindingAlipay(false);
        }
    };

    const handleBindWechat = () => {
        if (!wechatAccount.trim() || !wechatName.trim()) {
            Alert.alert("提示", "请填写完整的微信信息");
            return;
        }

        Alert.alert("绑定成功", "微信账号已绑定");
        setBoundAccounts((prev) => [
            ...prev.filter((acc) => acc.type !== "wechat"),
            {
                type: "wechat",
                account: wechatAccount,
                name: wechatName,
            },
        ]);
        setShowWechatForm(false);
        setWechatAccount("");
        setWechatName("");
    };

    const handleUnbindAlipay = () => {
        Alert.alert("确认解绑", "解绑后需要重新授权才能提现，是否继续？", [
            { text: "取消", style: "cancel" },
            {
                text: "确定",
                style: "destructive",
                onPress: async () => {
                    try {
                        await unbindAlipay();
                        setBoundAccounts((prev) =>
                            prev.filter((acc) => acc.type !== "alipay"),
                        );
                        await refetchBindingStatus();
                        Alert.alert("解绑成功");
                    } catch (error) {
                        const message =
                            error instanceof Error
                                ? error.message
                                : "解绑失败，请稍后再试";
                        Alert.alert("解绑失败", message);
                    }
                },
            },
        ]);
    };

    const handleUnbind = (type: "alipay" | "wechat") => {
        Alert.alert(
            "确认解绑",
            `确定要解绑${type === "alipay" ? "支付宝" : "微信"}账号吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "确定",
                    onPress: () => {
                        setBoundAccounts((prev) =>
                            prev.filter((acc) => acc.type !== type),
                        );
                        Alert.alert("解绑成功");
                    },
                    style: "destructive",
                },
            ],
        );
    };

    const alipayAccountDisplay = maskAccount(
        bindingStatus?.alipayUserId ||
        bindingStatus?.alipayOpenId ||
        boundAccounts.find((acc) => acc.type === "alipay")?.account ||
        "",
    );
    const isAlipayBound = Boolean(bindingStatus?.bound);
    const isWechatBound = boundAccounts.some((acc) => acc.type === "wechat");

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>账号绑定</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                <View style={styles.tipCard}>
                    <Ionicons name="information-circle" size={20} color="#2196F3" />
                    <Text style={styles.tipText}>
                        绑定支付宝账号用于提现收益，授权过程由支付宝官方应用完成。
                    </Text>
                </View>

                <View style={styles.accountCard}>
                    <View style={styles.accountHeader}>
                        <View style={styles.accountLeft}>
                            <View style={[styles.iconWrapper, { backgroundColor: "#1677FF" }]}>
                                <Ionicons name="logo-alipay" size={24} color="white" />
                            </View>
                            <Text style={styles.accountType}>支付宝</Text>
                        </View>
                        <TouchableOpacity
                            style={[
                                styles.bindButton,
                                alipayBindingLoading && styles.disabledButton,
                            ]}
                            onPress={handleBindAlipay}
                            disabled={alipayBindingLoading}
                        >
                            {alipayBindingLoading ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <Text style={styles.bindButtonText}>
                                    {isAlipayBound ? "重新授权" : "绑定"}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>

                    {isAlipayBound ? (
                        <View style={styles.accountInfo}>
                            <View>
                                <Text style={styles.accountName}>
                                    支付宝账号
                                </Text>
                                <Text style={styles.accountNumber}>
                                    {alipayAccountDisplay || "已授权"}
                                </Text>
                            </View>
                            <TouchableOpacity onPress={handleUnbindAlipay}>
                                <Text style={styles.unbindText}>解绑</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <Text style={styles.unboundText}>
                            暂未绑定支付宝账号，点击右上角按钮授权绑定。
                        </Text>
                    )}

                    {authError && (
                        <View style={styles.authError}>
                            <Text style={styles.authErrorText}>{authError}</Text>
                        </View>
                    )}

                    {bindingStatus?.bound && (
                        <View style={styles.authSummary}>
                            <Text style={styles.summaryTitle}>绑定信息</Text>
                            <Text style={styles.summaryText}>
                                当前绑定：{alipayAccountDisplay || "已授权"}
                            </Text>
                            {bindingStatus.boundAt && (
                                <Text style={styles.summaryText}>
                                    更新于：{new Date(bindingStatus.boundAt).toLocaleString()}
                                </Text>
                            )}
                        </View>
                    )}
                </View>

                {/* <View style={styles.accountCard}>
                    <View style={styles.accountHeader}>
                        <View style={styles.accountLeft}>
                            <View style={[styles.iconWrapper, { backgroundColor: "#07C160" }]}>
                                <Ionicons name="logo-wechat" size={24} color="white" />
                            </View>
                            <Text style={styles.accountType}>微信</Text>
                        </View>
                        {!isWechatBound && !showWechatForm && (
                            <TouchableOpacity
                                style={styles.bindButton}
                                onPress={() => setShowWechatForm(true)}
                            >
                                <Text style={styles.bindButtonText}>绑定</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isWechatBound && (
                        <View style={styles.accountInfo}>
                            <View>
                                <Text style={styles.accountName}>
                                    {
                                        boundAccounts.find((acc) => acc.type === "wechat")
                                            ?.name
                                    }
                                </Text>
                                <Text style={styles.accountNumber}>
                                    {
                                        boundAccounts.find((acc) => acc.type === "wechat")
                                            ?.account
                                    }
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => handleUnbind("wechat")}>
                                <Text style={styles.unbindText}>解绑</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showWechatForm && !isWechatBound && (
                        <View style={styles.formSection}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>微信账号</Text>
                                <TextInput
                                    style={styles.input}
                                    value={wechatAccount}
                                    onChangeText={setWechatAccount}
                                    placeholder="微信号或手机号"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>真实姓名</Text>
                                <TextInput
                                    style={styles.input}
                                    value={wechatName}
                                    onChangeText={setWechatName}
                                    placeholder="与微信实名认证一致"
                                />
                            </View>
                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowWechatForm(false)}
                                >
                                    <Text style={styles.cancelButtonText}>取消</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={handleBindWechat}
                                >
                                    <Text style={styles.confirmButtonText}>确认绑定</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View> */}

                <View style={styles.securityCard}>
                    <View style={styles.securityItem}>
                        <Ionicons name="shield-checkmark" size={18} color="#4CAF50" />
                        <Text style={styles.securityText}>信息加密存储</Text>
                    </View>
                    <View style={styles.securityItem}>
                        <Ionicons name="lock-closed" size={18} color="#4CAF50" />
                        <Text style={styles.securityText}>仅用于提现功能</Text>
                    </View>
                </View>
            </ScrollView>
        </View>
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
        padding: 16,
    },
    tipCard: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E3F2FD",
        borderRadius: 8,
        padding: 12,
        marginBottom: 16,
    },
    tipText: {
        fontSize: 12,
        color: "#1976D2",
        marginLeft: 8,
        flex: 1,
    },
    accountCard: {
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
    accountHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    accountLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    iconWrapper: {
        width: 40,
        height: 40,
        borderRadius: 20,
        justifyContent: "center",
        alignItems: "center",
        marginRight: 12,
    },
    accountType: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    bindButton: {
        paddingHorizontal: 20,
        paddingVertical: 8,
        borderRadius: 16,
        backgroundColor: "#1677FF",
    },
    disabledButton: {
        opacity: 0.6,
    },
    bindButtonText: {
        fontSize: 14,
        color: "white",
        fontWeight: "bold",
    },
    accountInfo: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#f5f5f5",
    },
    unboundText: {
        marginTop: 12,
        fontSize: 13,
        color: "#757575",
    },
    accountName: {
        fontSize: 14,
        color: "#333",
        marginBottom: 4,
    },
    accountNumber: {
        fontSize: 12,
        color: "#999",
    },
    unbindText: {
        fontSize: 14,
        color: "#FF5722",
    },
    authSummary: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#F4F6FF",
    },
    summaryTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1677FF",
        marginBottom: 6,
    },
    summaryText: {
        fontSize: 13,
        color: "#45526C",
        marginTop: 2,
    },
    authError: {
        marginTop: 12,
        padding: 12,
        borderRadius: 12,
        backgroundColor: "#FFF3F0",
    },
    authErrorText: {
        color: "#D93025",
        fontSize: 13,
    },
    formSection: {
        marginTop: 12,
        paddingTop: 12,
        borderTopWidth: 1,
        borderTopColor: "#f5f5f5",
    },
    formGroup: {
        marginBottom: 12,
    },
    label: {
        fontSize: 14,
        color: "#666",
        marginBottom: 8,
    },
    input: {
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        color: "#333",
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    formActions: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
    },
    cancelButton: {
        flex: 1,
        paddingVertical: 10,
        marginRight: 8,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: "#ddd",
        alignItems: "center",
    },
    cancelButtonText: {
        fontSize: 14,
        color: "#666",
    },
    confirmButton: {
        flex: 1,
        paddingVertical: 10,
        marginLeft: 8,
        borderRadius: 8,
        backgroundColor: "#4CAF50",
        alignItems: "center",
    },
    confirmButtonText: {
        fontSize: 14,
        color: "white",
        fontWeight: "bold",
    },
    securityCard: {
        flexDirection: "row",
        justifyContent: "space-around",
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    securityItem: {
        flexDirection: "row",
        alignItems: "center",
    },
    securityText: {
        fontSize: 12,
        color: "#666",
        marginLeft: 6,
    },
});
