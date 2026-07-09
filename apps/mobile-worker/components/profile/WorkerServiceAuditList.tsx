import { Ionicons } from "@expo/vector-icons";
import { StatusBadge } from "@repo/mobile-ui/components/StatusBadge";
import { Text } from "@repo/mobile-ui/components/ui/text";
import type { WorkerServiceItem } from "@repo/types";
import { Pressable, View } from "react-native";

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
} from "../../app/profile/service-settings-audit-model";

export type WorkerServiceWithLegacyOffering = WorkerServiceItem & {
    offering?: {
        id?: string | null;
        name?: string | null;
        categoryName?: string | null;
        takedownReason?: string | null;
    } | null;
};

type WorkerServiceAuditListProps = {
    activeTab: WorkerServiceTabKey;
    services: readonly WorkerServiceWithLegacyOffering[];
    onChangeTab: (tab: WorkerServiceTabKey) => void;
    onPressService: (service: WorkerServiceWithLegacyOffering) => void;
};

export function WorkerServiceAuditList(props: WorkerServiceAuditListProps) {
    const groupedServices = groupWorkerServicesByTab(props.services);
    const visibleServices = groupedServices[props.activeTab];

    return (
        <>
            <View className="mt-3 flex-row bg-white">
                {WORKER_SERVICE_TABS.map((tab) => {
                    const selected = tab.key === props.activeTab;
                    const count = groupedServices[tab.key].length;
                    return (
                        <Pressable
                            key={tab.key}
                            className={
                                selected
                                    ? "flex-1 items-center border border-[#2B6EF5] px-1 py-2.5"
                                    : "flex-1 items-center border border-[#E5E7EB] bg-white px-1 py-2.5"
                            }
                            style={
                                selected
                                    ? { backgroundColor: "#EEF4FF" }
                                    : undefined
                            }
                            onPress={() => props.onChangeTab(tab.key)}
                        >
                            <Text
                                className={
                                    selected
                                        ? "text-center text-[12px] leading-[18px] text-[#2B6EF5]"
                                        : "text-center text-[12px] leading-[18px] text-[#6A7282]"
                                }
                                adjustsFontSizeToFit
                                minimumFontScale={0.75}
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
                            onPress={() => props.onPressService(service)}
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
        </>
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
