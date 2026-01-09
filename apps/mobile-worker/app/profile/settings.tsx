import { Ionicons } from "@expo/vector-icons";
import { Directory, Paths } from "expo-file-system";
import { useRouter } from "expo-router";
import React, { useCallback, useState } from "react";
import {
    Alert,
    ScrollView,
    StyleSheet,
    Switch,
    Text,
    TouchableOpacity,
    View,
    ActivityIndicator,
} from "react-native";
import Constants from "expo-constants";
import { useAppUpdate } from "@repo/mobile-ui/app-update/AppUpdateProvider";

export default function SettingsScreen() {
    const router = useRouter();
    const { checkForUpdate, status: updateStatus } = useAppUpdate();
    const [pushEnabled, setPushEnabled] = useState(true);
    const [soundEnabled, setSoundEnabled] = useState(true);
    const [vibrationEnabled, setVibrationEnabled] = useState(true);
    const versionLabel = Constants.expoConfig?.version
        ? `v${Constants.expoConfig.version}`
        : "未设置";

    const clearCache = () => {
        try {
            const cacheDir = new Directory(Paths.cache);
            if (!cacheDir.exists) {
                Alert.alert("提示", "没有可清理的缓存");
                return;
            }

            cacheDir.list().forEach((entry) => entry.delete());

            Alert.alert("成功", "缓存已清除");
        } catch (error) {
            Alert.alert("提示", "清除缓存时出现问题，请稍后再试");
        }
    };

    const handleClearCache = () => {
        Alert.alert("清除缓存", "确定要清除缓存吗？", [
            { text: "取消", style: "cancel" },
            {
                text: "确定",
                onPress: () => {
                    clearCache();
                },
            },
        ]);
    };

    const handleAbout = () => {
        Alert.alert("关于我们", "服务人员端 v1.0.0\n© 2025 Home Service Platform");
    };

    const handlePrivacy = () => {
        Alert.alert("隐私政策", "隐私政策详情...");
    };

    const handleTerms = () => {
        Alert.alert("服务条款", "服务条款详情...");
    };

    const handleCheckUpdate = useCallback(() => {
        void checkForUpdate({ manual: true, force: true });
    }, [checkForUpdate]);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>设置</Text>
                <View style={styles.placeholder} />
            </View>

            <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
                {/* 通知设置 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>通知设置</Text>
                    <View style={styles.settingCard}>
                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="notifications-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>推送通知</Text>
                            </View>
                            <Switch
                                value={pushEnabled}
                                onValueChange={setPushEnabled}
                                trackColor={{ false: "#ddd", true: "#4CAF50" }}
                            />
                        </View>

                        <View style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="volume-high-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>声音提醒</Text>
                            </View>
                            <Switch
                                value={soundEnabled}
                                onValueChange={setSoundEnabled}
                                trackColor={{ false: "#ddd", true: "#4CAF50" }}
                            />
                        </View>

                        <View style={[styles.settingItem, styles.settingItemLast]}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="phone-portrait-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>震动提醒</Text>
                            </View>
                            <Switch
                                value={vibrationEnabled}
                                onValueChange={setVibrationEnabled}
                                trackColor={{ false: "#ddd", true: "#4CAF50" }}
                            />
                        </View>
                    </View>
                </View>

                {/* 账号安全 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>账号安全</Text>
                    <View style={styles.settingCard}>
                        <TouchableOpacity style={styles.settingItem}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="lock-closed-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>修改密码</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.settingItem, styles.settingItemLast]}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="shield-checkmark-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>账号安全</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>
                    </View>
                </View>

                {/* 其他设置 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>其他</Text>
                    <View style={styles.settingCard}>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={handleClearCache}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="trash-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>清除缓存</Text>
                            </View>
                            <View style={styles.settingRight}>
                                <Text style={styles.cacheSize}>12.5 MB</Text>
                                <Ionicons name="chevron-forward" size={20} color="#999" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={handleCheckUpdate}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="cloud-download-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>检查更新</Text>
                            </View>
                            <View style={styles.settingRight}>
                                {updateStatus === "checking" ? (
                                    <ActivityIndicator size="small" color="#666" />
                                ) : (
                                    <Text style={styles.version}>{versionLabel}</Text>
                                )}
                                <Ionicons name="chevron-forward" size={20} color="#999" />
                            </View>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={handlePrivacy}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="document-text-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>隐私政策</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>

                        <TouchableOpacity style={styles.settingItem} onPress={handleTerms}>
                            <View style={styles.settingLeft}>
                                <Ionicons name="document-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>服务条款</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.settingItem, styles.settingItemLast]}
                            onPress={handleAbout}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="information-circle-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>关于我们</Text>
                            </View>
                            <View style={styles.settingRight}>
                                <Text style={styles.version}>v1.0.0</Text>
                                <Ionicons name="chevron-forward" size={20} color="#999" />
                            </View>
                        </TouchableOpacity>
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
    },
    section: {
        marginTop: 16,
        paddingHorizontal: 16,
    },
    sectionTitle: {
        fontSize: 14,
        color: "#999",
        marginBottom: 8,
        marginLeft: 4,
    },
    settingCard: {
        backgroundColor: "white",
        borderRadius: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    settingItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#f5f5f5",
    },
    settingItemLast: {
        borderBottomWidth: 0,
    },
    settingLeft: {
        flexDirection: "row",
        alignItems: "center",
        flex: 1,
    },
    settingText: {
        fontSize: 16,
        color: "#333",
        marginLeft: 12,
    },
    settingRight: {
        flexDirection: "row",
        alignItems: "center",
    },
    cacheSize: {
        fontSize: 14,
        color: "#999",
        marginRight: 8,
    },
    version: {
        fontSize: 14,
        color: "#999",
        marginRight: 8,
    },
});
