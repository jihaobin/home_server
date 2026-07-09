import { Ionicons } from "@expo/vector-icons";
import { useMyWorkerServices } from "@repo/hooks/api/work-skill";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { WorkerServiceItem } from "@repo/types";
import { useRouter } from "expo-router";
import { useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import {
    WorkerServiceAuditList,
    type WorkerServiceWithLegacyOffering,
} from "../../components/profile/WorkerServiceAuditList";
import { type WorkerServiceTabKey } from "./service-settings-audit-model";

const EMPTY_WORKER_SERVICES: WorkerServiceItem[] = [];

export default function ServiceSettingsRedesignScreen() {
    const router = useRouter();
    const {
        data: workerServicesResponse,
        isFetching,
        refetch: refetchWorkerServices,
    } = useMyWorkerServices();
    const [activeTab, setActiveTab] = useState<WorkerServiceTabKey>("all");
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () => refetchWorkerServices(),
    });

    const workerServices =
        workerServicesResponse?.services ?? EMPTY_WORKER_SERVICES;

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

                <WorkerServiceAuditList
                    activeTab={activeTab}
                    services={workerServices}
                    onChangeTab={setActiveTab}
                    onPressService={openServiceDetail}
                />
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
