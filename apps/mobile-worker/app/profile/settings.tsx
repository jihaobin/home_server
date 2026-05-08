import { Ionicons } from "@expo/vector-icons";
import { Directory, File, Paths } from "expo-file-system";
import { useFocusEffect, useRouter } from "expo-router";
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

type MenuItem = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    route: string;
};

const MENU_ITEMS: MenuItem[] = [
    {
        icon: "wallet-outline",
        title: "账号绑定",
        route: "/profile/account-binding",
    },
    { icon: "person-outline", title: "个人信息", route: "/profile/edit" },
    {
        icon: "construct-outline",
        title: "服务发布",
        route: "/profile/service-settings-redesign",
    },
    { icon: "card-outline", title: "实名认证", route: "/verification/id-card" },
    {
        icon: "call-outline",
        title: "紧急联系人",
        route: "/profile/emergency-contact",
    },

];

const formatCacheSize = (bytes: number | null) => {
    if (bytes === null) {
        return "计算中...";
    }
    if (bytes < 1024) {
        return `${bytes} B`;
    }

    const units = ["KB", "MB", "GB"];
    let size = bytes / 1024;
    let unitIndex = 0;

    while (size >= 1024 && unitIndex < units.length - 1) {
        size /= 1024;
        unitIndex += 1;
    }

    return `${size.toFixed(size >= 10 ? 0 : 1)} ${units[unitIndex]}`;
};

const getDirectorySize = (directory: Directory): number => {
    if (!directory.exists) {
        return 0;
    }

    return directory.list().reduce((total, entry) => {
        try {
            if (entry instanceof Directory) {
                return total + getDirectorySize(entry);
            }
            if (entry instanceof File) {
                return total + entry.size;
            }
        } catch {
            return total;
        }

        return total;
    }, 0);
};

export default function SettingsScreen() {
    const router = useRouter();
    const { checkForUpdate, status: updateStatus } = useAppUpdate();
    const [cacheSizeBytes, setCacheSizeBytes] = useState<number | null>(null);
    const [isClearingCache, setIsClearingCache] = useState(false);
    const versionLabel = Constants.expoConfig?.version
        ? `v${Constants.expoConfig.version}`
        : "未设置";

    const refreshCacheSize = useCallback(() => {
        try {
            const cacheDir = new Directory(Paths.cache);
            setCacheSizeBytes(getDirectorySize(cacheDir));
        } catch {
            setCacheSizeBytes(0);
        }
    }, []);

    useFocusEffect(refreshCacheSize);

    const clearCache = () => {
        if (isClearingCache) {
            return;
        }

        setIsClearingCache(true);
        try {
            const cacheDir = new Directory(Paths.cache);
            if (!cacheDir.exists) {
                setCacheSizeBytes(0);
                Alert.alert("提示", "没有可清理的缓存");
                return;
            }

            cacheDir.list().forEach((entry) => entry.delete());
            setCacheSizeBytes(0);

            Alert.alert("成功", "缓存已清除");
        } catch {
            refreshCacheSize();
            Alert.alert("提示", "清除缓存时出现问题，请稍后再试");
        } finally {
            setIsClearingCache(false);
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
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>账号与服务</Text>
                    <View style={styles.settingCard}>
                        {MENU_ITEMS.map((item, index) => (
                            <TouchableOpacity
                                key={item.route}
                                style={[
                                    styles.settingItem,
                                    index === MENU_ITEMS.length - 1 &&
                                        styles.settingItemLast,
                                ]}
                                onPress={() => router.push(item.route as never)}
                            >
                                <View style={styles.settingLeft}>
                                    <Ionicons
                                        name={item.icon}
                                        size={20}
                                        color="#666"
                                    />
                                    <Text style={styles.settingText}>
                                        {item.title}
                                    </Text>
                                </View>
                                <Ionicons
                                    name="chevron-forward"
                                    size={20}
                                    color="#999"
                                />
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>

                {/* 其他设置 */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>其他</Text>
                    <View style={styles.settingCard}>
                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={() =>
                                router.push("/profile/account-cancellation" as never)
                            }
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons
                                    name="person-remove-outline"
                                    size={20}
                                    color="#666"
                                />
                                <Text style={styles.settingText}>注销账号</Text>
                            </View>
                            <Ionicons name="chevron-forward" size={20} color="#999" />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.settingItem}
                            onPress={handleClearCache}
                            disabled={isClearingCache}
                        >
                            <View style={styles.settingLeft}>
                                <Ionicons name="trash-outline" size={20} color="#666" />
                                <Text style={styles.settingText}>清除缓存</Text>
                            </View>
                            <View style={styles.settingRight}>
                                {isClearingCache ? (
                                    <ActivityIndicator size="small" color="#666" />
                                ) : (
                                    <Text style={styles.cacheSize}>
                                        {formatCacheSize(cacheSizeBytes)}
                                    </Text>
                                )}
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
