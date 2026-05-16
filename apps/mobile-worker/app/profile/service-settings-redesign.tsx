import { Ionicons } from "@expo/vector-icons";
import { useMyWorkerServices } from "@repo/hooks/api/work-skill";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { StatusBadge } from "@repo/mobile-ui/components/StatusBadge";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { WorkerServiceItem } from "@repo/types";
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    WORKER_SERVICE_TABS,
    formatAuditElapsed,
    getWorkerServiceReason,
    getWorkerServiceStatusLabel,
    getWorkerServiceStatusTone,
    getWorkerServiceTitle,
    groupWorkerServicesByTab,
    hasPendingUpdateForTakenDownService,
    type WorkerServiceTabKey,
} from "./service-settings-audit-model";

const EMPTY_WORKER_SERVICES: WorkerServiceItem[] = [];

type WorkerServiceWithLegacyOffering = WorkerServiceItem & {
    offering?: {
        id?: string | null;
        name?: string | null;
        categoryName?: string | null;
        takedownReason?: string | null;
    } | null;
};

export default function ServiceSettingsRedesignScreen() {
    const router = useRouter();
    const {
        data: workerServicesResponse,
        isFetching,
        refetch: refetchWorkerServices,
    } = useMyWorkerServices();
    const [activeTab, setActiveTab] = useState<WorkerServiceTabKey>("active");
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () => refetchWorkerServices(),
    });

    const workerServices =
        workerServicesResponse?.services ?? EMPTY_WORKER_SERVICES;
    const groupedServices = useMemo(
        () => groupWorkerServicesByTab(workerServices),
        [workerServices],
    );
    const visibleServices = groupedServices[activeTab];

    const openServiceManage = (mode: "add" | "manage") => {
        router.push(
            `/profile/service-settings-manage-redesign?mode=${mode}` as never,
        );
    };

    const openServiceDetail = (item: WorkerServiceWithLegacyOffering) => {
        router.push({
            pathname: "/profile/service-settings-detail-redesign",
            params: {
                serviceId: item.serviceId,
                mode: item.derivedStatus,
                draftId: item.draft?.id,
            },
        } as never);
    };

    return (
        <SafeAreaView className="flex-1 bg-[#F5F6F8]" edges={["top", "bottom"]}>
            <ScrollView
                className="flex-1"
                contentContainerClassName="px-4 pb-6 pt-3"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing || isFetching}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#2B6EF5"
                    />
                }
            >
                <View className="flex-row items-center justify-between px-1 pb-5">
                    <Pressable
                        className="h-10 w-10 items-center justify-center rounded-full bg-white/80"
                        hitSlop={10}
                        onPress={() => router.back()}
                    >
                        <Ionicons
                            name="chevron-back"
                            size={22}
                            color="#111827"
                        />
                    </Pressable>
                    {isFetching ? (
                        <ActivityIndicator size="small" color="#2B6EF5" />
                    ) : (
                        <View className="h-10 w-10" />
                    )}
                </View>

                <Text className="px-1 text-[26px] leading-[39px] text-black">
                    服务设置
                </Text>

                <Text className="mt-5 px-1 text-[15px] leading-[23px] text-black">
                    我的服务
                </Text>

                <View className="mt-3 flex-row gap-2">
                    {WORKER_SERVICE_TABS.map((tab) => {
                        const selected = tab.key === activeTab;
                        const count = groupedServices[tab.key].length;
                        return (
                            <Pressable
                                key={tab.key}
                                className={
                                    selected
                                        ? "flex-1 items-center rounded-full border border-[#2B6EF5] px-2 py-2.5"
                                        : "flex-1 items-center rounded-full border border-[#E5E7EB] bg-white px-2 py-2.5"
                                }
                                style={
                                    selected
                                        ? { backgroundColor: "#EEF4FF" }
                                        : undefined
                                }
                                onPress={() => setActiveTab(tab.key)}
                            >
                                <Text
                                    className={
                                        selected
                                            ? "text-center text-[12px] leading-[18px] text-[#2B6EF5]"
                                            : "text-center text-[12px] leading-[18px] text-[#6A7282]"
                                    }
                                    numberOfLines={1}
                                >
                                    {tab.label} {count}
                                </Text>
                            </Pressable>
                        );
                    })}
                </View>

                <View className="mt-3 gap-3">
                    {visibleServices.length > 0 ? (
                        visibleServices.map((service) => (
                            <AuditServiceCard
                                key={`${service.serviceId}-${service.draft?.id ?? "current"}`}
                                service={service}
                                onPress={() => openServiceDetail(service)}
                            />
                        ))
                    ) : (
                        <View className="items-center rounded-2xl bg-white px-5 py-8">
                            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1F5]">
                                <Ionicons
                                    name="briefcase-outline"
                                    size={24}
                                    color="#99A1AF"
                                />
                            </View>
                            <Text className="mt-3 text-[15px] leading-[23px] text-black">
                                当前状态暂无服务
                            </Text>
                            <Text className="mt-1 text-center text-xs leading-[18px] text-[#6A7282]">
                                点击右下角添加服务，提交后会进入审核流程。
                            </Text>
                        </View>
                    )}
                </View>
            </ScrollView>

            <View className="flex-row gap-3 bg-[#F5F6F8] px-4 pb-5 pt-3">
                <Pressable
                    className="flex-1 rounded-full border border-[#E5E7EB] bg-white py-4"
                    onPress={() => openServiceManage("add")}
                >
                    <Text className="text-center text-sm leading-[21px] text-black">
                        + 添加服务
                    </Text>
                </Pressable>
                <Pressable
                    className="flex-1 rounded-full bg-[#2B6EF5] py-4"
                    onPress={() => openServiceManage("manage")}
                >
                    <Text className="text-center text-sm leading-[21px] text-white">
                        管理服务
                    </Text>
                </Pressable>
            </View>
        </SafeAreaView>
    );
}

function AuditServiceCard(props: {
    service: WorkerServiceWithLegacyOffering;
    onPress: () => void;
}) {
    const reason = getWorkerServiceReason(props.service);
    const hasTakenDownPendingUpdate = hasPendingUpdateForTakenDownService(
        props.service,
    );
    const submittedAt =
        props.service.draft?.submittedAt ?? props.service.lastSubmittedAt;
    const categoryName =
        props.service.current?.categoryName ??
        props.service.offering?.categoryName ??
        "平台服务";

    return (
        <Pressable className="rounded-2xl bg-white p-4" onPress={props.onPress}>
            <View className="flex-row items-start justify-between gap-3">
                <View className="flex-1">
                    <Text className="text-[15px] leading-[23px] text-black">
                        {getWorkerServiceTitle(props.service)}
                    </Text>
                    <Text className="mt-1 text-xs leading-[18px] text-[#6A7282]">
                        {categoryName}
                    </Text>
                </View>
                <StatusBadge
                    label={getWorkerServiceStatusLabel(props.service)}
                    tone={getWorkerServiceStatusTone(props.service)}
                />
            </View>

            {props.service.derivedStatus === "active_with_pending_update" ||
            hasTakenDownPendingUpdate ? (
                <View className="mt-3 rounded-xl bg-[#FFF7ED] px-3 py-2">
                    <Text className="text-xs leading-[18px] text-[#B45309]">
                        {hasTakenDownPendingUpdate
                            ? "整改内容已提交，等待管理员重新审核。已提交 "
                            : "更新审核中，老版本继续运营。已提交 "}
                        {formatAuditElapsed(submittedAt)}
                    </Text>
                </View>
            ) : null}

            {reason ? (
                <View className="mt-3 rounded-xl bg-[#FEF2F2] px-3 py-2">
                    <Text className="text-xs leading-[18px] text-[#DC2626]">
                        {reason}
                    </Text>
                </View>
            ) : null}

            <View className="mt-3 flex-row items-center justify-between">
                <Text className="text-xs leading-[18px] text-[#99A1AF]">
                    {submittedAt
                        ? `已提交 ${formatAuditElapsed(submittedAt)}`
                        : "查看服务详情"}
                </Text>
                <Ionicons name="chevron-forward" size={18} color="#99A1AF" />
            </View>
        </Pressable>
    );
}
