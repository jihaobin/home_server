import { Ionicons } from "@expo/vector-icons";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { LinearGradient, type LinearGradientProps } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { cssInterop } from "nativewind";
import type { ComponentType } from "react";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

cssInterop(LinearGradient, { className: "style" });

const NativeWindLinearGradient = LinearGradient as ComponentType<
    LinearGradientProps & { className?: string }
>;

type ServiceCardIcon = keyof typeof Ionicons.glyphMap;

type ServiceCardTone = "slate" | "amber";

type ServiceCardData = {
    id: string;
    title: string;
    description: string;
    tone: ServiceCardTone;
    icon: ServiceCardIcon;
    badge?: string;
};

export default function ServiceSettingsRedesignScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const {
        data: profile,
        isFetching,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () => (userId ? refetchProfile() : Promise.resolve()),
    });

    const services = profile?.services ?? [];
    const hasQualification = Boolean(
        profile?.merchantQualificationImage || profile?.vocationalQualificationImage,
    );
    const serviceCards = services.map<ServiceCardData>((service, index) => {
        const icon: ServiceCardIcon =
            index === 0 ? "sparkles-outline" : "briefcase-outline";
        return {
            id: service.serviceId,
            title: service.serviceName,
            description: buildServiceDescription(service),
            tone: index % 2 === 0 ? "slate" : "amber",
            icon,
            badge: needsQualification(service, hasQualification) ? "需资质" : undefined,
        };
    });

    const openServiceManage = (mode: "add" | "manage") => {
        router.push(
            `/profile/service-settings-manage-redesign?mode=${mode}` as never,
        );
    };


    const openServiceDetail = (serviceId: string) => {
        router.push({
            pathname: "/profile/service-settings-detail-redesign",
            params: { serviceId },
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
                        <Ionicons name="chevron-back" size={22} color="#111827" />
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
                    已启用服务
                </Text>

                <View className="mt-3 gap-3">
                    {serviceCards.length > 0 ? (
                        serviceCards.map((service) => (
                            <ServiceCard
                                key={service.id}
                                title={service.title}
                                description={service.description}
                                icon={service.icon}
                                tone={service.tone}
                                badge={service.badge}
                                onPress={() => openServiceDetail(service.id)}
                            />
                        ))
                    ) : (
                        <View className="items-center rounded-2xl bg-white px-5 py-8">
                            <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1F5]">
                                <Ionicons name="briefcase-outline" size={24} color="#99A1AF" />
                            </View>
                            <Text className="mt-3 text-[15px] leading-[23px] text-black">
                                暂无已启用服务
                            </Text>
                            <Text className="mt-1 text-center text-xs leading-[18px] text-[#6A7282]">
                                添加服务后会在这里展示服务状态
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

function ServiceCard(props: {
    title: string;
    description: string;
    icon: ServiceCardIcon;
    tone: ServiceCardTone;
    badge?: string;
    onPress: () => void;
}) {
    return (
        <Pressable
            className="flex-row items-center rounded-2xl bg-white p-4"
            onPress={props.onPress}
        >
            <View
                className={
                    props.tone === "slate"
                        ? "h-11 w-11 items-center justify-center rounded-[14px] bg-slate-100"
                        : "h-11 w-11 items-center justify-center rounded-[14px] bg-amber-100"
                }
            >
                <Ionicons name={props.icon} size={22} color="#2B3440" />
            </View>
            <View className="ml-3 flex-1">
                <Text className="text-[15px] leading-[23px] text-black">
                    {props.title}
                </Text>
                <Text className="mt-0.5 text-xs leading-[18px] text-[#6A7282]" numberOfLines={1}>
                    {props.description}
                </Text>
            </View>
            {props.badge ? (
                <View className="rounded-lg bg-[#EEF1F5] px-2.5 py-1">
                    <Text className="text-[11px] leading-[17px] text-[#FF5252]">
                        {props.badge}
                    </Text>
                </View>
            ) :   <Text className="text-[13px] leading-5 text-[#2B6EF5]">
                    编辑
                </Text>}
        </Pressable>
    );
}

function buildServiceDescription(service: {
    categoryName?: string | null;
    personnelDescription?: string | null;
    serviceDescription?: string | null;
    specifications: { price?: string | number | null }[];
}) {
    const prices = service.specifications
        .map((spec) => Number(spec.price))
        .filter((price) => Number.isFinite(price) && price > 0);
    const priceText =
        prices.length > 0
            ? `¥${Math.min(...prices)}-${Math.max(...prices)}`
            : service.personnelDescription || service.serviceDescription || "暂无服务说明";
    const prefix = service.categoryName ? `${service.categoryName}：` : "";
    return `${prefix}${priceText}、${service.specifications.length || 1}个规格`;
}

function needsQualification(
    service: { categoryName?: string | null; serviceName: string },
    hasQualification: boolean,
) {
    return `${service.categoryName ?? ""}`.includes("按摩") && !hasQualification;
}
