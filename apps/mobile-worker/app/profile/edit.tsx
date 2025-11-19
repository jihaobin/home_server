import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
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
import { useCallback, useEffect, useMemo, useState } from "react";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useUpsertWorkInfo } from "@repo/hooks/api/work-skill";
import { useUploadFile } from "@repo/hooks/api/files";
import { authClient } from "../../lib/auth";
import { ImageUploader } from "../../components/ImageUploader";

export default function EditProfileScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;

    const {
        data: profile,
        isFetching,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);
    const upsertWorkInfo = useUpsertWorkInfo();
    const uploadFile = useUploadFile();

    const [displayName, setDisplayName] = useState("");
    const [bio, setBio] = useState("");
    const [workYears, setWorkYears] = useState("");
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile) return;
        setDisplayName(profile.name ?? session?.user?.name ?? "");
        setBio(profile.bio ?? "");
        setWorkYears(
            typeof profile.yearsOfExperience === "number"
                ? profile.yearsOfExperience.toString()
                : "",
        );
    }, [profile, session?.user?.name]);

    const currentAvatar = useMemo(
        () => profile?.avatar?.url ?? null,
        [profile],
    );

    const handleAvatarUpload = useCallback(
        async (file: { uri: string; name: string; type: string }) => {
            const response = await uploadFile.mutateAsync({
                file,
                fileType: "avatar",
            });
            const updated = await authClient.updateUser({
                image: response.fileUrl,
            });
            if (updated.error) {
                throw new Error(updated.error.message ?? "头像更新失败");
            }
            await refetchProfile();
            return {
                fileIdentifier: response.id,
                fileUrl: response.fileUrl,
            };
        },
        [refetchProfile, uploadFile],
    );

    const handleSave = useCallback(async () => {
        if (!profile) return;
        if (!displayName.trim()) {
            Alert.alert("提示", "请填写用户名");
            return;
        }

        setSaving(true);
        try {
            const updates: Array<Promise<unknown>> = [];
            if (displayName.trim() !== session?.user?.name) {
                updates.push(
                    authClient.updateUser({ name: displayName.trim() }),
                );
            }

            const years = Number.parseInt(workYears, 10) || 0;
            const locationData = profile
                ? ((profile as any).location as { lng: number; lat: number } | null)
                : null;

            const payload = {
                bio: bio.trim() || undefined,
                yearsOfExperience: years,
                province: profile.province || "未设置",
                district: profile.district ?? "",
                county: profile.county ?? "",
                detailedAddress: profile.detailedAddress ?? "",
                workStartTime: profile.workStartTime ?? "08:00:00",
                workEndTime: profile.workEndTime ?? "18:00:00",
                workDays: profile.workDays ?? "1234567",
                isAvailable: profile.isAvailable,
                currentStatus: profile.currentStatus,
                location:
                    locationData ??
                    ({
                        lng: 0,
                        lat: 0,
                    } as const),
            };

            updates.push(upsertWorkInfo.mutateAsync(payload));

            await Promise.all(updates);
            await refetchProfile();
            Alert.alert("保存成功", "个人资料已更新", [
                { text: "好的", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("[EditProfile] 保存失败", error);
            Alert.alert("保存失败", "请稍后重试");
        } finally {
            setSaving(false);
        }
    }, [
        bio,
        displayName,
        profile,
        router,
        session?.user?.name,
        upsertWorkInfo,
        workYears,
        refetchProfile,
    ]);

    const isLoading = isFetching && !profile;

    return (
        <KeyboardAvoidingView
            style={styles.container}
            behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>个人资料</Text>
                <TouchableOpacity
                    style={styles.saveButton}
                    disabled={saving || !profile}
                    onPress={handleSave}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#2196F3" />
                    ) : (
                        <Text style={styles.saveText}>保存</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2196F3" />
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>头像</Text>
                            <ImageUploader
                                value={currentAvatar}
                                size={100}
                                circular
                                onUpload={handleAvatarUpload}
                                disabled={!profile}
                            />
                            <Text style={styles.helperText}>
                                支持 jpg/png，长按拍照，单击从相册选择
                            </Text>
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>基础信息</Text>
                            <View style={styles.formItem}>
                                <Text style={styles.label}>用户名</Text>
                                <TextInput
                                    style={styles.input}
                                    value={displayName}
                                    onChangeText={setDisplayName}
                                    placeholder="请输入用户名"
                                />
                            </View>
                            <View style={styles.formItem}>
                                <Text style={styles.label}>工作年限</Text>
                                <TextInput
                                    style={styles.input}
                                    value={workYears}
                                    onChangeText={setWorkYears}
                                    placeholder="例如 5"
                                    keyboardType="numeric"
                                />
                            </View>
                            <View style={styles.formItemColumn}>
                                <Text style={styles.label}>个人简介</Text>
                                <TextInput
                                    style={styles.textArea}
                                    value={bio}
                                    onChangeText={setBio}
                                    placeholder="介绍擅长的服务、保障等信息"
                                    multiline
                                    numberOfLines={4}
                                    textAlignVertical="top"
                                />
                            </View>
                        </View>
                    </>
                )}
            </ScrollView>
        </KeyboardAvoidingView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fb",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 16,
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: "#111",
    },
    saveButton: {
        minWidth: 60,
        alignItems: "flex-end",
        padding: 4,
    },
    saveText: {
        fontSize: 16,
        color: "#2196F3",
        fontWeight: "600",
    },
    content: {
        flex: 1,
    },
    loader: {
        flex: 1,
        paddingTop: 80,
    },
    card: {
        backgroundColor: "white",
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 16,
    },
    helperText: {
        marginTop: 12,
        fontSize: 12,
        color: "#888",
    },
    formItem: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 16,
    },
    formItemColumn: {
        marginBottom: 12,
    },
    label: {
        width: 80,
        fontSize: 14,
        color: "#555",
    },
    input: {
        flex: 1,
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: "#111",
    },
    textArea: {
        marginTop: 8,
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 12,
        fontSize: 15,
        color: "#111",
        minHeight: 120,
    },
});
