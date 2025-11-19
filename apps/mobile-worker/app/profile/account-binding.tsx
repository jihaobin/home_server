import { Ionicons } from "@expo/vector-icons";
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

interface AccountInfo {
    type: "alipay" | "wechat";
    account: string;
    name: string;
}

export default function AccountBindingScreen() {
    const router = useRouter();
    const [alipayAccount, setAlipayAccount] = useState("");
    const [alipayName, setAlipayName] = useState("");
    const [wechatAccount, setWechatAccount] = useState("");
    const [wechatName, setWechatName] = useState("");

    // 模拟已绑定的账户
    const [boundAccounts, setBoundAccounts] = useState<AccountInfo[]>([
        {
            type: "alipay",
            account: "138****1234",
            name: "张**",
        },
    ]);

    const [showAlipayForm, setShowAlipayForm] = useState(false);
    const [showWechatForm, setShowWechatForm] = useState(false);

    const handleBindAlipay = () => {
        if (!alipayAccount.trim() || !alipayName.trim()) {
            Alert.alert("提示", "请填写完整的支付宝信息");
            return;
        }

        // TODO: 调用API绑定支付宝
        Alert.alert("绑定成功", "支付宝账号已绑定");
        setBoundAccounts((prev) => [
            ...prev.filter((acc) => acc.type !== "alipay"),
            {
                type: "alipay",
                account: alipayAccount,
                name: alipayName,
            },
        ]);
        setShowAlipayForm(false);
        setAlipayAccount("");
        setAlipayName("");
    };

    const handleBindWechat = () => {
        if (!wechatAccount.trim() || !wechatName.trim()) {
            Alert.alert("提示", "请填写完整的微信信息");
            return;
        }

        // TODO: 调用API绑定微信
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

    const handleUnbind = (type: "alipay" | "wechat") => {
        Alert.alert(
            "确认解绑",
            `确定要解绑${type === "alipay" ? "支付宝" : "微信"}账号吗？`,
            [
                { text: "取消", style: "cancel" },
                {
                    text: "确定",
                    onPress: () => {
                        // TODO: 调用API解绑
                        setBoundAccounts((prev) => prev.filter((acc) => acc.type !== type));
                        Alert.alert("解绑成功");
                    },
                    style: "destructive",
                },
            ],
        );
    };

    const isAlipayBound = boundAccounts.some((acc) => acc.type === "alipay");
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
                {/* 提示信息 */}
                <View style={styles.tipCard}>
                    <Ionicons name="information-circle" size={20} color="#2196F3" />
                    <Text style={styles.tipText}>
                        绑定支付宝或微信账号，用于提现服务收益
                    </Text>
                </View>

                {/* 支付宝 */}
                <View style={styles.accountCard}>
                    <View style={styles.accountHeader}>
                        <View style={styles.accountLeft}>
                            <View style={[styles.iconWrapper, { backgroundColor: "#1677FF" }]}>
                                <Ionicons name="logo-alipay" size={24} color="white" />
                            </View>
                            <Text style={styles.accountType}>支付宝</Text>
                        </View>
                        {!isAlipayBound && !showAlipayForm && (
                            <TouchableOpacity
                                style={styles.bindButton}
                                onPress={() => setShowAlipayForm(true)}
                            >
                                <Text style={styles.bindButtonText}>绑定</Text>
                            </TouchableOpacity>
                        )}
                    </View>

                    {isAlipayBound && (
                        <View style={styles.accountInfo}>
                            <View>
                                <Text style={styles.accountName}>
                                    {
                                        boundAccounts.find((acc) => acc.type === "alipay")
                                            ?.name
                                    }
                                </Text>
                                <Text style={styles.accountNumber}>
                                    {
                                        boundAccounts.find((acc) => acc.type === "alipay")
                                            ?.account
                                    }
                                </Text>
                            </View>
                            <TouchableOpacity onPress={() => handleUnbind("alipay")}>
                                <Text style={styles.unbindText}>解绑</Text>
                            </TouchableOpacity>
                        </View>
                    )}

                    {showAlipayForm && !isAlipayBound && (
                        <View style={styles.formSection}>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>支付宝账号</Text>
                                <TextInput
                                    style={styles.input}
                                    value={alipayAccount}
                                    onChangeText={setAlipayAccount}
                                    placeholder="手机号或邮箱"
                                    keyboardType="email-address"
                                />
                            </View>
                            <View style={styles.formGroup}>
                                <Text style={styles.label}>真实姓名</Text>
                                <TextInput
                                    style={styles.input}
                                    value={alipayName}
                                    onChangeText={setAlipayName}
                                    placeholder="与支付宝实名认证一致"
                                />
                            </View>
                            <View style={styles.formActions}>
                                <TouchableOpacity
                                    style={styles.cancelButton}
                                    onPress={() => setShowAlipayForm(false)}
                                >
                                    <Text style={styles.cancelButtonText}>取消</Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={styles.confirmButton}
                                    onPress={handleBindAlipay}
                                >
                                    <Text style={styles.confirmButtonText}>确认绑定</Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                </View>

                {/* 微信 */}
                <View style={styles.accountCard}>
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
                </View>

                {/* 安全提示 */}
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
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
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
        backgroundColor: "#2196F3",
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
