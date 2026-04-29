import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
    Alert,
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { Image as ExpoImage } from "@repo/mobile-ui/components/ui/image";
import { FlashList } from "@shopify/flash-list";
import { LinearGradient } from "expo-linear-gradient";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { useUserRealNameProfile } from "@repo/hooks/api/user";
import { useFile } from "@repo/hooks/api/files";
import {
    useServicePersonnelProfile,
    useServicePersonnelDashboardStats,
} from "@repo/hooks/api/service-personnel";
import { signOutWithCleanup } from "../../lib/auth";

type MenuItem = {
    icon: keyof typeof Ionicons.glyphMap;
    title: string;
    route: string;
};

const MENU_ITEMS: MenuItem[] = [
    { icon: "person-outline", title: "个人信息", route: "/profile/edit" },
    {
        icon: "construct-outline",
        title: "服务设置",
        route: "/profile/service-settings-redesign",
    },
    { icon: "card-outline", title: "实名认证", route: "/verification/id-card" },
    {
        icon: "wallet-outline",
        title: "账号绑定",
        route: "/profile/account-binding",
    },
    // { icon: "settings-outline", title: "设置", route: "/profile/settings" },
];

const maskPhone = (value: string) => {
    if (!value) {
        return "";
    }
    if (value.length < 7) {
        return value;
    }
    return `${value.slice(0, 3)}****${value.slice(-4)}`;
};

const WEEKDAY_MAP: Record<string, string> = {
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "日",
};

const formatWorkDays = (value?: string | null) => {
    if (!value) {
        return "未设置";
    }
    const label = value
        .split("")
        .map((day) => (WEEKDAY_MAP[day] ? `周${WEEKDAY_MAP[day]}` : day))
        .join("、");
    return label || "未设置";
};

export default function ProfileScreen() {
    return (
        <RequireAuth>
            <ProfileContent />
        </RequireAuth>
    );
}

function ProfileContent() {
    const router = useRouter();
    const { session, refetch: refetchSession } = useSession();
    const userId = session?.user?.id;
    const {
        data: realNameProfile,
        isFetching: isProfileFetching,
        refetch: refetchProfile,
    } = useUserRealNameProfile(userId);
    const {
        data: personnelProfile,
        isFetching: isPersonnelProfileFetching,
        refetch: refetchPersonnelProfile,
    } = useServicePersonnelProfile(userId);
    const {
        data: dashboardStats,
        isFetching: isDashboardStatsFetching,
        refetch: refetchDashboardStats,
    } = useServicePersonnelDashboardStats(userId);
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                Promise.resolve(refetchSession()),
                userId ? refetchProfile() : Promise.resolve(),
                userId ? refetchPersonnelProfile() : Promise.resolve(),
                userId ? refetchDashboardStats() : Promise.resolve(),
            ]),
    });

    const workerMeta =
        (session?.user?.metadata as Record<string, any> | undefined) ?? {};
    const displayName = personnelProfile?.name ?? "未命名服务者";
    const rawPhone =
        workerMeta.phone ??
        session?.user?.phoneNumber ??
        session?.user?.phone ??
        "";
    const maskedPhone =
        personnelProfile?.maskedPhoneNumber ??
        (rawPhone ? maskPhone(rawPhone) : "未绑定手机号");
    const workYears =
        personnelProfile?.yearsOfExperience ??
        workerMeta.workYears ??
        workerMeta.yearsOfExperience ??
        null;

    const stats = useMemo(() => {
        if (dashboardStats) {
            return {
                serviceCount: dashboardStats.serviceCount ?? 0,
                ratingValue: dashboardStats.rating?.value ?? 5,
                ratingDisplay: dashboardStats.rating?.display ?? "5.0",
                totalEarnings: dashboardStats.balance?.available ?? 0,
            };
        }
        const fallbackRating =
            typeof workerMeta.stats?.rating === "number"
                ? workerMeta.stats.rating
                : typeof workerMeta.rating === "number"
                    ? workerMeta.rating
                    : undefined;
        const rawServiceCount =
            workerMeta.stats?.serviceCount ?? workerMeta.serviceCount ?? 0;
        const fallbackServiceCount =
            typeof rawServiceCount === "number"
                ? rawServiceCount
                : Number(rawServiceCount) || 0;
        const rawTotalEarnings =
            workerMeta.stats?.totalEarnings ?? workerMeta.totalEarnings ?? 0;
        const fallbackTotalEarnings =
            typeof rawTotalEarnings === "number"
                ? rawTotalEarnings
                : Number(rawTotalEarnings) || 0;
        return {
            serviceCount: fallbackServiceCount,
            ratingValue: fallbackRating ?? 5,
            ratingDisplay:
                typeof fallbackRating === "number"
                    ? fallbackRating.toFixed(1)
                    : typeof workerMeta.stats?.rating === "string"
                        ? workerMeta.stats.rating
                        : typeof workerMeta.rating === "string"
                            ? workerMeta.rating
                            : "5.0",
            totalEarnings: fallbackTotalEarnings,
        };
    }, [dashboardStats, workerMeta]);

    const services = personnelProfile?.services ?? [];

    const aggregatedServices = useMemo(() => {
        return services.map((service) => {
            const specs = (service as any)?.specifications ?? [];
            const prices = specs
                .map((s: any) => Number(s.price))
                .filter((p: number) => !isNaN(p) && p > 0);
            const durations = specs
                .map((s: any) => s.estimatedDurationMinutes)
                .filter(
                    (d: any) =>
                        typeof d === "number" && !isNaN(d) && d > 0,
                );
            return {
                ...service,
                minPrice:
                    prices.length > 0
                        ? Math.min(...prices)
                        : null,
                minDuration:
                    durations.length > 0
                        ? Math.min(...durations)
                        : null,
                specCount: specs.length,
            };
        });
    }, [services]);

    const serviceRegionLabel = useMemo(() => {
        if (!personnelProfile) {
            return "未填写";
        }
        const parts = [
            personnelProfile.province,
            personnelProfile.district,
            personnelProfile.county,
            personnelProfile.detailedAddress,
        ].filter(Boolean);
        return parts.length > 0 ? parts.join(" ") : "未填写";
    }, [personnelProfile]);

    const workScheduleLabel = useMemo(() => {
        if (!personnelProfile) {
            return "未填写";
        }
        return `${personnelProfile.workStartTime} - ${personnelProfile.workEndTime}`;
    }, [personnelProfile]);

    const workDaysLabel = useMemo(
        () => formatWorkDays(personnelProfile?.workDays),
        [personnelProfile],
    );

    const ratingLabel = stats.ratingDisplay ?? stats.ratingValue.toFixed(1);
    const avatarIdentifier =
        personnelProfile?.avatar?.fileId ??
        personnelProfile?.avatar?.url ??
        null;
    const trimmedAvatarIdentifier =
        typeof avatarIdentifier === "string" ? avatarIdentifier.trim() : "";
    const isDirectAvatarUrl = Boolean(
        trimmedAvatarIdentifier &&
        /^https?:\/\//i.test(trimmedAvatarIdentifier),
    );
    const { data: avatarFileData } = useFile(
        !isDirectAvatarUrl && trimmedAvatarIdentifier
            ? trimmedAvatarIdentifier
            : null,
    );
    const avatarUri =
        (isDirectAvatarUrl && trimmedAvatarIdentifier) ||
        avatarFileData?.fileUrl ||
        null;
    const isVerified = Boolean(realNameProfile?.idCardNumber);

    useFocusEffect(
        useCallback(() => {
            if (!userId) {
                return;
            }
            void Promise.allSettled([
                refetchProfile(),
                refetchPersonnelProfile(),
                refetchDashboardStats(),
            ]);
        }, [
            refetchProfile,
            refetchPersonnelProfile,
            refetchDashboardStats,
            userId,
        ]),
    );

    const handleLogout = async () => {
        Alert.alert("确认退出", "您确定要退出登录吗？", [
            { text: "取消", style: "cancel" },
            {
                text: "退出",
                style: "destructive",
                onPress: async () => {
                    try {
                        const { error } = await signOutWithCleanup();
                        if (error) {
                            Alert.alert(
                                "退出登录失败",
                                error.message || "登录时发生错误",
                            );
                            return;
                        }
                        refetchSession();
                        router.replace("/(tabs)");
                    } catch (err) {
                        Alert.alert("错误", "退出登录失败，请重试");
                    }
                },
            },
        ]);
    };

    const isRefreshingState =
        refreshing ||
        isProfileFetching ||
        isPersonnelProfileFetching ||
        isDashboardStatsFetching;

    const openServiceDetail = (serviceId: string) => {
        router.push({
            pathname:
                "/profile/service-settings-detail-redesign" as never,
            params: { serviceId },
        } as never);
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={styles.title}>个人中心</Text>
                <Text style={styles.subtitle}>
                    查看资料、认证状态与账号安全
                </Text>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={isRefreshingState}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#4CAF50"
                    />
                }
            >
                <View style={styles.userCard}>
                    <TouchableOpacity
                        style={styles.userInfo}
                        onPress={() => router.push("/profile/edit" as never)}
                    >
                        {avatarUri ? (
                            <Image
                                source={{ uri: avatarUri }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View
                                style={[styles.avatar, styles.avatarFallback]}
                            >
                                <Text style={styles.avatarInitial}>
                                    {displayName.slice(0, 1)}
                                </Text>
                            </View>
                        )}
                        <View style={styles.userDetails}>
                            <View style={styles.nameRow}>
                                <Text style={styles.userName}>
                                    {displayName}
                                </Text>
                                {isVerified && (
                                    <View style={styles.verifiedBadge}>
                                        <Ionicons
                                            name="checkmark-circle"
                                            size={16}
                                            color="#4CAF50"
                                        />
                                        <Text style={styles.verifiedText}>
                                            已认证
                                        </Text>
                                    </View>
                                )}
                            </View>
                            <Text style={styles.userPhone}>{maskedPhone}</Text>
                            <Text style={styles.workYears}>
                                {workYears
                                    ? `工作经验 ${workYears} 年`
                                    : "完善工作年限信息"}
                            </Text>
                        </View>
                        <Ionicons
                            name="chevron-forward"
                            size={24}
                            color="#999"
                        />
                    </TouchableOpacity>

                    <View style={styles.statsRow}>
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                {stats.serviceCount}
                            </Text>
                            <Text style={styles.statLabel}>服务次数</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>{ratingLabel}</Text>
                            <Text style={styles.statLabel}>评分</Text>
                        </View>
                        <View style={styles.statDivider} />
                        <View style={styles.statItem}>
                            <Text style={styles.statValue}>
                                ¥{stats.totalEarnings.toFixed(2)}
                            </Text>
                            <Text style={styles.statLabel}>总收益</Text>
                        </View>
                    </View>
                </View>

                {personnelProfile && (
                    <View style={styles.infoCard}>
                        <TouchableOpacity
                            onPress={() => router.push("/profile/service-area")}
                            style={styles.sectionTitleContainer}
                        >
                            <Text style={styles.sectionTitle}>服务资料</Text>
                            <Ionicons name="chevron-forward" size={16} color="#666" />
                        </TouchableOpacity>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>服务区域</Text>
                            <Text style={styles.infoValue}>
                                {serviceRegionLabel}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>可服务时间</Text>
                            <Text style={styles.infoValue}>
                                {workScheduleLabel}
                            </Text>
                        </View>
                        <View style={styles.infoRow}>
                            <Text style={styles.infoLabel}>工作日</Text>
                            <Text style={styles.infoValue}>
                                {workDaysLabel}
                            </Text>
                        </View>
                    </View>
                )}

                {services.length > 0 && (
                    <View className="mb-4">
                        <Text className="text-xl text-foreground mb-3 px-4">
                            可提供的服务
                        </Text>
                        <View style={{ position: "relative" }}>
                            <FlashList
                                data={aggregatedServices}
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                contentContainerStyle={{ paddingHorizontal: 16 }}
                                ItemSeparatorComponent={() => <View className="w-3" />}
                                renderItem={({ item: service }) => (
                                    <TouchableOpacity
                                        className="bg-card border border-border rounded-2xl p-4 mb-2"
                                        style={{
                                            shadowColor: "#000",
                                            shadowOffset: {
                                                width: 0,
                                                height: 1,
                                            },
                                            shadowOpacity: 0.1,
                                            shadowRadius: 3,
                                            elevation: 2,
                                            width: 160,
                                        }}
                                        onPress={() =>
                                            openServiceDetail(service.serviceId)
                                        }
                                        activeOpacity={0.7}
                                    >
                                        <View
                                            className="size-8 rounded-[10px] items-center justify-center mb-2 overflow-hidden"
                                            style={{
                                                backgroundColor: "#FFF7ED",
                                            }}
                                        >
                                            {service.gallery?.[0]?.url ? (
                                                <ExpoImage
                                                    source={{
                                                        uri: service.gallery[0]
                                                            .url,
                                                    }}
                                                    className="size-full"
                                                    contentFit="cover"
                                                    placeholder={
                                                        service.gallery[0]
                                                            .blurhash
                                                            ? {
                                                                  blurhash:
                                                                      service
                                                                          .gallery[0]
                                                                          .blurhash,
                                                              }
                                                            : undefined
                                                    }
                                                />
                                            ) : (
                                                <Ionicons
                                                    name="sparkles-outline"
                                                    size={18}
                                                    color="#FF6900"
                                                />
                                            )}
                                        </View>

                                        <Text
                                            className="text-base text-foreground font-medium mb-1"
                                            numberOfLines={1}
                                        >
                                            {service.serviceName}
                                        </Text>

                                        {service.personnelDescription ||
                                        service.serviceDescription ? (
                                            <Text
                                                className="text-sm text-muted-foreground mb-2"
                                                numberOfLines={2}
                                            >
                                                {service.personnelDescription ||
                                                    service.serviceDescription}
                                            </Text>
                                        ) : null}

                                        {service.minPrice !== null ? (
                                            <View className="flex-row items-baseline mb-2">
                                                <Text
                                                    className="text-lg font-bold"
                                                    style={{ color: "#FF6900" }}
                                                >
                                                    ¥{service.minPrice}
                                                </Text>
                                                <Text className="text-xs text-muted-foreground ml-0.5">
                                                    起
                                                </Text>
                                            </View>
                                        ) : (
                                            <View className="mb-2">
                                                <Text className="text-sm text-muted-foreground">
                                                    暂无报价
                                                </Text>
                                            </View>
                                        )}

                                        <View className="flex-row gap-2">
                                            {service.minDuration !== null && (
                                                <View className="bg-muted rounded px-2 py-0.5">
                                                    <Text className="text-xs text-muted-foreground">
                                                        {service.minDuration}
                                                        分钟起
                                                    </Text>
                                                </View>
                                            )}
                                            {service.specCount > 0 && (
                                                <View className="bg-muted rounded px-2 py-0.5">
                                                    <Text className="text-xs text-muted-foreground">
                                                        {service.specCount}
                                                        种规格
                                                    </Text>
                                                </View>
                                            )}
                                        </View>
                                    </TouchableOpacity>
                                )}
                            />
                            <LinearGradient
                                colors={["rgba(255,255,255,0)", "rgba(255,255,255,1)"]}
                                start={{ x: 0, y: 0 }}
                                end={{ x: 1, y: 0 }}
                                style={{
                                    position: "absolute",
                                    right: 0,
                                    top: 0,
                                    bottom: 0,
                                    width: 50,
                                }}
                                pointerEvents="none"
                            />
                        </View>
                    </View>
                )}

                <View style={styles.menuSection}>
                    {MENU_ITEMS.map((item, index) => (
                        <TouchableOpacity
                            key={item.route}
                            style={[
                                styles.menuItem,
                                index === MENU_ITEMS.length - 1 &&
                                styles.menuItemLast,
                            ]}
                            onPress={() => router.push(item.route as never)}
                        >
                            <View style={styles.menuLeft}>
                                <Ionicons
                                    name={item.icon}
                                    size={24}
                                    color="#333"
                                />
                                <Text style={styles.menuTitle}>
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

                <TouchableOpacity
                    style={styles.logoutButton}
                    onPress={handleLogout}
                >
                    <Text style={styles.logoutText}>退出登录</Text>
                    <Text style={styles.logoutDesc}>
                        若遇到账号遗失，请立即联系客服冻结
                    </Text>
                </TouchableOpacity>
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
        backgroundColor: "white",
        paddingTop: 56,
        paddingBottom: 24,
        paddingHorizontal: 20,
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
    content: {
        flex: 1,
    },
    userCard: {
        backgroundColor: "white",
        margin: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    avatar: {
        width: 70,
        height: 70,
        borderRadius: 35,
        marginRight: 16,
    },
    avatarFallback: {
        backgroundColor: "#E0E7FF",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: {
        fontSize: 22,
        fontWeight: "bold",
        color: "#312E81",
    },
    userDetails: {
        flex: 1,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 8,
    },
    userName: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
        marginRight: 8,
    },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E8F5E9",
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
    },
    verifiedText: {
        fontSize: 12,
        color: "#4CAF50",
        marginLeft: 4,
    },
    userPhone: {
        fontSize: 14,
        color: "#666",
        marginBottom: 4,
    },
    workYears: {
        fontSize: 14,
        color: "#999",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 20,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 18,
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
    menuSection: {
        backgroundColor: "white",
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 12,
        overflow: "hidden",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    menuItem: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        padding: 16,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    menuItemLast: {
        borderBottomWidth: 0,
    },
    menuLeft: {
        flexDirection: "row",
        alignItems: "center",
    },
    menuTitle: {
        fontSize: 16,
        color: "#333",
        marginLeft: 12,
    },
    logoutButton: {
        backgroundColor: "white",
        marginHorizontal: 16,
        marginBottom: 32,
        padding: 18,
        borderRadius: 12,
        alignItems: "center",
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
        elevation: 3,
    },
    logoutText: {
        fontSize: 16,
        color: "#FF5722",
        fontWeight: "bold",
    },
    logoutDesc: {
        marginTop: 4,
        fontSize: 12,
        color: "#999",
    },
    infoCard: {
        backgroundColor: "white",
        marginHorizontal: 16,
        marginBottom: 16,
        borderRadius: 16,
        padding: 20,
        gap: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.07,
        shadowRadius: 5,
        elevation: 2,
    },
    sectionTitleContainer: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#222",
    },
    infoRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        gap: 16,
    },
    infoLabel: {
        fontSize: 14,
        color: "#777",
        width: 90,
    },
    infoValue: {
        flex: 1,
        fontSize: 14,
        color: "#333",
        textAlign: "right",
    },
    certificateList: {
        marginTop: 8,
    },
    certificateImage: {
        width: 120,
        height: 80,
        borderRadius: 12,
        backgroundColor: "#f2f2f2",
    },
});