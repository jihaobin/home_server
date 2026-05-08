import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScreen } from "@repo/mobile-ui/components/app/KeyboardAwareScreen";
import { KeyboardAwareScrollView } from "@repo/mobile-ui/components/app/KeyboardAwareScrollView";
import { Image } from "@repo/mobile-ui/components/ui/image";
import {
    useServicePersonnelProfile,
    useUpdateServicePersonnelProfile,
} from "@repo/hooks/api/service-personnel";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";

const PHONE_PATTERN = /^1[3-9]\d{9}$/;

export default function EmergencyContactScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const { data: profile, isFetching, refetch } =
        useServicePersonnelProfile(userId);
    const updateProfile = useUpdateServicePersonnelProfile();
    const [phone, setPhone] = useState("");
    const [name, setName] = useState("");

    useEffect(() => {
        if (!profile) return;
        setPhone(profile.emergencyContactPhone ?? "");
        setName(profile.emergencyContactName ?? "");
    }, [profile]);

    const handleSave = useCallback(async () => {
        const normalizedPhone = phone.trim();
        const normalizedName = name.trim();

        if (!PHONE_PATTERN.test(normalizedPhone)) {
            Alert.alert("提示", "请输入正确的紧急联系人手机号");
            return;
        }

        if (!normalizedName) {
            Alert.alert("提示", "请输入紧急联系人姓名");
            return;
        }

        try {
            await updateProfile.mutateAsync({
                emergencyContactPhone: normalizedPhone,
                emergencyContactName: normalizedName,
            });
            await refetch();
            Alert.alert("保存成功", "紧急联系人已更新", [
                { text: "好的", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("[EmergencyContact] 保存失败", error);
            Alert.alert("保存失败", "请稍后重试");
        }
    }, [name, phone, refetch, router, updateProfile]);

    const saving = updateProfile.isPending;
    const isLoading = isFetching && !profile;

    return (
        <KeyboardAwareScreen style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="chevron-back" size={30} color="#111" />
                </TouchableOpacity>
            </View>

            <KeyboardAwareScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.contentContainer}
            >
                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2F7DF6" />
                    </View>
                ) : (
                    <>
                        <View style={styles.heroRow}>
                            <Text style={styles.title}>
                                添加紧急联系人，{"\n"}一键发送位置信息
                            </Text>
                            <Image
                                source={require("../../assets/images/urgent.png")}
                                className="w-[135px] h-full"
                                contentFit="cover"
                            />
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.description}>
                                添加紧急联系人后，当您使用“一键通知”或“110报警”功能时，您的位置信息会通过短信自动分享给紧急联系人。紧急情况下，紧急联系人可致电上单客服确认您的服务/位置信息。
                            </Text>

                            <View style={styles.formItem}>
                                <Text style={styles.label}>联系人手机：</Text>
                                <TextInput
                                    style={styles.input}
                                    value={phone}
                                    onChangeText={setPhone}
                                    placeholder="请输入紧急联系人手机号"
                                    placeholderTextColor="#9B9B9B"
                                    keyboardType="phone-pad"
                                    maxLength={11}
                                />
                            </View>

                            <View style={styles.formItem}>
                                <Text style={styles.label}>联系人姓名：</Text>
                                <TextInput
                                    style={styles.input}
                                    value={name}
                                    onChangeText={setName}
                                    placeholder="请输入紧急联系人姓名"
                                    placeholderTextColor="#9B9B9B"
                                    maxLength={50}
                                />
                            </View>
                        </View>

                        <TouchableOpacity
                            style={[styles.saveButton, saving && styles.saveButtonDisabled]}
                            onPress={handleSave}
                            disabled={saving}
                        >
                            {saving ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text style={styles.saveText}>保存</Text>
                            )}
                        </TouchableOpacity>
                    </>
                )}
            </KeyboardAwareScrollView>
        </KeyboardAwareScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F4F4F4",
    },
    header: {
        paddingTop: 52,
        paddingHorizontal: 14,
        paddingBottom: 10,
    },
    backButton: {
        width: 40,
        height: 40,
        alignItems: "flex-start",
        justifyContent: "center",
    },
    content: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    loader: {
        minHeight: 320,
        alignItems: "center",
        justifyContent: "center",
    },
    heroRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: 10,
        marginBottom: 12,
    },
    title: {
        flex: 1,
        fontSize: 21,
        lineHeight: 32,
        fontWeight: "700",
        color: "#111111",
    },
    card: {
        backgroundColor: "#FFFFFF",
        borderRadius: 4,
        paddingHorizontal: 16,
        paddingTop: 16,
        paddingBottom: 22,
    },
    description: {
        fontSize: 14,
        lineHeight: 23,
        color: "#333333",
        marginBottom: 16,
    },
    formItem: {
        gap: 10,
        marginTop: 12,
    },
    label: {
        fontSize: 14,
        lineHeight: 20,
        fontWeight: "700",
        color: "#222222",
    },
    input: {
        height: 48,
        borderRadius: 5,
        backgroundColor: "#F4F4F4",
        paddingHorizontal: 12,
        fontSize: 16,
        color: "#111111",
    },
    saveButton: {
        marginTop: 32,
        height: 48,
        borderRadius: 5,
        backgroundColor: "#2F7DF6",
        alignItems: "center",
        justifyContent: "center",
    },
    saveButtonDisabled: {
        opacity: 0.7,
    },
    saveText: {
        fontSize: 17,
        color: "#FFFFFF",
        fontWeight: "500",
    },
});
