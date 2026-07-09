import { useCallback, useMemo, useState } from "react";
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import {
    Image,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { useUserRealNameProfile } from "@repo/hooks/api/user";
import { useFile } from "@repo/hooks/api/files";
import { useMyWorkerServices } from "@repo/hooks/api/work-skill";
import {
    useServicePersonnelProfile,
    useServicePersonnelDashboardStats,
} from "@repo/hooks/api/service-personnel";
import type { WorkerServiceItem } from "@repo/types";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Settings } from "lucide-react-native";
import { WorkerServiceAuditList } from "../../components/profile/WorkerServiceAuditList";
import type { WorkerServiceTabKey } from "../profile/service-settings-audit-model";

const EMPTY_WORKER_SERVICES: WorkerServiceItem[] = [];

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
    const [activeServiceTab, setActiveServiceTab] =
        useState<WorkerServiceTabKey>("all");
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
    const {
        data: workerServicesResponse,
        isFetching: isWorkerServicesFetching,
        refetch: refetchWorkerServices,
    } = useMyWorkerServices();
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                Promise.resolve(refetchSession()),
                userId ? refetchProfile() : Promise.resolve(),
                userId ? refetchPersonnelProfile() : Promise.resolve(),
                userId ? refetchDashboardStats() : Promise.resolve(),
                refetchWorkerServices(),
            ]),
    });

    const workerMeta = useMemo(
        () => (session?.user?.metadata as Record<string, any> | undefined) ?? {},
        [session?.user?.metadata]
    );
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
                refetchWorkerServices(),
            ]);
        }, [
            refetchProfile,
            refetchPersonnelProfile,
            refetchDashboardStats,
            refetchWorkerServices,
            userId,
        ]),
    );

    const isRefreshingState =
        refreshing ||
        isProfileFetching ||
        isPersonnelProfileFetching ||
        isDashboardStatsFetching ||
        isWorkerServicesFetching;

    const workerServices =
        workerServicesResponse?.services ?? EMPTY_WORKER_SERVICES;

    const openServiceDetail = (service: (typeof workerServices)[number]) => {
        router.push({
            pathname:
                "/profile/service-settings-detail-redesign" as never,
            params: {
                serviceId: service.serviceId,
                mode: service.derivedStatus,
                draftId: service.draft?.id,
            },
        } as never);
    };

    return (
        <View style={styles.container}>
                <View style={styles.header}>
                    <View style={styles.headerTopRow}>
                        <Text style={styles.title}>个人中心</Text>
                        <TouchableOpacity
                            style={styles.settingsButton}
                            accessibilityRole="button"
                            accessibilityLabel="打开设置"
                            onPress={() =>
                                router.push("/profile/settings" as never)
                            }
                        >
                            <Icon
                                as={Settings}
                                className="text-black"
                                size={25}
                            />
                        </TouchableOpacity>
                    </View>
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
                                            size={12}
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
                            size={18}
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
                            <Text style={styles.sectionTitle}>工作区域</Text>
                            <Ionicons name="chevron-forward" size={16} color="#666" />
                        </TouchableOpacity>
                    </View>
                )}

                {personnelProfile && (
                    <View style={styles.infoCard}>
                        <TouchableOpacity
                            onPress={() => router.push("/profile/work-time")}
                            style={styles.sectionTitleContainer}
                        >
                            <Text style={styles.sectionTitle}>工作时间</Text>
                            <Ionicons name="chevron-forward" size={16} color="#666" />
                        </TouchableOpacity>
                    </View>
                )}

                <View className="mb-4 px-4">
                    <Text className="text-[15px] leading-[23px] text-black">
                        我的服务
                    </Text>
                    <WorkerServiceAuditList
                        activeTab={activeServiceTab}
                        services={workerServices}
                        onChangeTab={setActiveServiceTab}
                        onPressService={openServiceDetail}
                    />
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
        backgroundColor: "white",
        minHeight: 128,
        paddingTop: 56,
        paddingBottom: 20,
        paddingHorizontal: 20,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    headerTopRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
    },
    settingsButton: {
        width: 40,
        height: 40,
        alignItems: "center",
        justifyContent: "center",
        borderRadius: 20,
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
        margin: 10,
        borderRadius: 12,
        padding: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
        elevation: 3,
    },
    userInfo: {
        flexDirection: "row",
        alignItems: "center",
        paddingBottom: 10,
        borderBottomWidth: 1,
        borderBottomColor: "#eee",
    },
    avatar: {
        width: 46,
        height: 46,
        borderRadius: 23,
        marginRight: 10,
    },
    avatarFallback: {
        backgroundColor: "#E0E7FF",
        alignItems: "center",
        justifyContent: "center",
    },
    avatarInitial: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#312E81",
    },
    userDetails: {
        flex: 1,
    },
    nameRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 3,
    },
    userName: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginRight: 6,
    },
    verifiedBadge: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#E8F5E9",
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 9,
    },
    verifiedText: {
        fontSize: 10,
        color: "#4CAF50",
        marginLeft: 3,
    },
    userPhone: {
        fontSize: 11,
        color: "#666",
        marginBottom: 2,
    },
    workYears: {
        fontSize: 11,
        color: "#999",
    },
    statsRow: {
        flexDirection: "row",
        justifyContent: "space-around",
        paddingTop: 10,
        paddingBottom: 10,
    },
    statItem: {
        alignItems: "center",
        flex: 1,
    },
    statValue: {
        fontSize: 14,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 2,
    },
    statLabel: {
        fontSize: 10,
        color: "#666",
    },
    statDivider: {
        width: 1,
        backgroundColor: "#eee",
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
