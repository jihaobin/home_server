import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { isApiClientError } from "@repo/utils/api-client";
import { useUserRealNameProfile, useVerifyAndSaveRealName } from "@repo/hooks/api/user";

function maskIdCardNumber(value: string) {
    const normalized = value.trim();
    if (normalized.length <= 8) {
        if (normalized.length <= 2) {
            return `${normalized[0] ?? ""}${"*".repeat(Math.max(normalized.length - 1, 0))}`;
        }
        return `${normalized.slice(0, 1)}${"*".repeat(Math.max(normalized.length - 2, 0))}${normalized.slice(-1)}`;
    }
    const prefix = normalized.slice(0, 3);
    const suffix = normalized.slice(-4);
    return `${prefix}${"*".repeat(Math.max(normalized.length - 7, 0))}${suffix}`;
}

export default function IdCardVerificationScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const { data: profile } = useUserRealNameProfile(userId);
    const [realName, setRealName] = useState("");
    const [idCard, setIdCard] = useState("");
    const verifyRealNameMutation = useVerifyAndSaveRealName();
    const loading = verifyRealNameMutation.isPending;
    const maskedIdCard = profile?.idCardNumber ? maskIdCardNumber(profile.idCardNumber) : "";

    // 验证身份证号格式
    const validateIdCard = (id: string): boolean => {
        const idCardRegex =
            /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
        return idCardRegex.test(id);
    };

    // 提交认证
    const handleSubmit = async () => {
        if (!realName.trim()) {
            Alert.alert("提示", "请输入真实姓名");
            return;
        }

        if (!idCard.trim()) {
            Alert.alert("提示", "请输入身份证号");
            return;
        }

        if (!validateIdCard(idCard)) {
            Alert.alert("提示", "身份证号格式不正确");
            return;
        }

        if (!userId) {
            Alert.alert("提示", "登录状态已失效，请重新登录后再试");
            return;
        }

        try {
            const normalizedName = realName.trim();
            const normalizedIdCard = idCard.trim().toUpperCase();
            const verificationResult = await verifyRealNameMutation.mutateAsync({
                name: normalizedName,
                idCard: normalizedIdCard,
                userId,
            });

            Alert.alert("认证成功", verificationResult.description ?? "您的实名认证已通过", [
                {
                    text: "确定",
                    onPress: () => router.back(),
                },
            ]);
            setIdCard("");

        } catch (error: unknown) {
            const message = isApiClientError(error)
                ? error.message || "实名认证请求失败，请稍后重试"
                : "实名认证请求失败，请稍后重试";
            Alert.alert("认证失败", message);
        }
    };

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : "height"}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>实名认证</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
            >
                {profile && (
                    <View style={styles.currentInfoCard}>
                        <Text style={styles.infoTitle}>当前认证信息</Text>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>真实姓名</Text>
                            <Text style={styles.infoValue}>{profile.realName ?? "未填写"}</Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>身份证号</Text>
                            <Text style={styles.infoValue}>{maskedIdCard || "已保护"}</Text>
                        </View>
                    </View>
                )}

                {/* 提示信息 */}
                <View style={styles.tipCard}>
                    <Ionicons name="information-circle" size={24} color="#2196F3" />
                    <View style={styles.tipContent}>
                        <Text style={styles.tipTitle}>为什么要实名认证？</Text>
                        <Text style={styles.tipText}>
                            根据国家相关规定，从事服务行业需要进行实名认证。您的信息将被严格保密。
                        </Text>
                    </View>
                </View>

                {/* 认证表单 */}
                <View style={styles.formCard}>
                    <View style={styles.formGroup}>
                        <Text style={styles.label}>真实姓名</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="person-outline" size={20} color="#999" />
                            <TextInput
                                style={styles.input}
                                placeholder="请输入您的真实姓名"
                                value={realName}
                                onChangeText={setRealName}
                                autoCapitalize="none"
                            />
                        </View>
                    </View>

                    <View style={styles.formGroup}>
                        <Text style={styles.label}>身份证号</Text>
                        <View style={styles.inputWrapper}>
                            <Ionicons name="card-outline" size={20} color="#999" />
                            <TextInput
                                style={styles.input}
                                placeholder="请输入18位身份证号"
                                value={idCard}
                                onChangeText={setIdCard}
                                maxLength={18}
                                autoCapitalize="none"
                            />
                        </View>
                        <Text style={styles.hint}>
                            {profile?.idCardNumber ? "已认证，如需重新认证请再次提交完整信息" : "请确保身份证号与真实姓名一致"}
                        </Text>
                    </View>
                </View>

                {/* 安全说明 */}
                <View style={styles.securityCard}>
                    <View style={styles.securityItem}>
                        <Ionicons name="shield-checkmark" size={20} color="#4CAF50" />
                        <Text style={styles.securityText}>信息加密传输</Text>
                    </View>
                    <View style={styles.securityItem}>
                        <Ionicons name="lock-closed" size={20} color="#4CAF50" />
                        <Text style={styles.securityText}>严格保密</Text>
                    </View>
                    <View style={styles.securityItem}>
                        <Ionicons name="checkmark-circle" size={20} color="#4CAF50" />
                        <Text style={styles.securityText}>仅用于身份验证</Text>
                    </View>
                </View>

                {/* 提交按钮 */}
                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <Text style={styles.submitText}>
                        {loading ? "认证中..." : "提交认证"}
                    </Text>
                </TouchableOpacity>
            </ScrollView>
        </KeyboardAvoidingView>
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
        backgroundColor: "#E3F2FD",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
    },
    tipContent: {
        flex: 1,
        marginLeft: 12,
    },
    tipTitle: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#1976D2",
        marginBottom: 4,
    },
    tipText: {
        fontSize: 12,
        color: "#1976D2",
        lineHeight: 18,
    },
    formCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 20,
        marginBottom: 16,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    formGroup: {
        marginBottom: 20,
    },
    label: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 12,
    },
    inputWrapper: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f5f5f5",
        borderRadius: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    input: {
        flex: 1,
        height: 48,
        fontSize: 16,
        color: "#333",
        marginLeft: 8,
    },
    hint: {
        fontSize: 12,
        color: "#999",
        marginTop: 8,
    },
    securityCard: {
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
    securityItem: {
        flexDirection: "row",
        alignItems: "center",
        marginVertical: 8,
    },
    securityText: {
        fontSize: 14,
        color: "#666",
        marginLeft: 12,
    },
    submitButton: {
        backgroundColor: "#4CAF50",
        borderRadius: 12,
        padding: 16,
        alignItems: "center",
        marginBottom: 32,
    },
    submitButtonDisabled: {
        backgroundColor: "#ccc",
    },
    submitText: {
        fontSize: 16,
        fontWeight: "bold",
        color: "white",
    },
    currentInfoCard: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: "#e0e0e0",
    },
    infoTitle: {
        fontSize: 16,
        fontWeight: "bold",
        marginBottom: 12,
        color: "#333",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    infoLabel: {
        fontSize: 14,
        color: "#666",
    },
    infoValue: {
        fontSize: 14,
        color: "#333",
    },

});
