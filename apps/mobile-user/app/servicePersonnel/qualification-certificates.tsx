import type { ServicePersonnelProfile } from "@repo/types";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
    Building2,
    ChevronLeft,
    FileImage,
    ShieldCheck,
} from "lucide-react-native";
import { useMemo } from "react";
import { Pressable, RefreshControl, ScrollView, View } from "react-native";

const PAGE_BACKGROUND = "#F4F6F8";
const CARD_BACKGROUND = "#FFFFFF";
const CARD_BORDER = "#FFE7C6";
const BADGE_BACKGROUND = "#FFF7ED";
const ACCENT = "#F7951B";
const PRIMARY_TEXT = "#111827";
const SECONDARY_TEXT = "#6B7280";
const TERTIARY_TEXT = "#9CA3AF";
const SHADOW = "0 6px 18px rgba(247, 149, 27, 0.07)";

type QualificationImage = ServicePersonnelProfile["merchantQualificationImage"];

type InfoCardItem = {
    badge: string;
    title: string;
    subtitle?: string;
    description: string;
    icon: typeof ShieldCheck;
};

type CertificateCardItem = {
    title: string;
    height: number;
    image: QualificationImage;
};

function buildInfoCardItems(
    maskedIdCardNumber?: string | null,
): readonly InfoCardItem[] {
    return [
        {
            badge: "已通过认证",
            title: "商家实名认证通过",
            subtitle: maskedIdCardNumber
                ? `身份证 ${maskedIdCardNumber}`
                : "身份证信息暂未完善",
            description: "所有理疗师签约入驻平台时，身份信息均已通过核验",
            icon: ShieldCheck,
        },
        {
            badge: "已通过认证",
            title: "该店铺已在平台完成市场主体登记认证",
            description: "根据相关法律法规要求，经营者相关资质信息公示如下",
            icon: Building2,
        },
    ] as const;
}

function getRouteParam(value?: string | string[]): string {
    if (Array.isArray(value)) {
        return value[0] ?? "";
    }

    return value ? String(value) : "";
}

function ScreenHeader() {
    const router = useRouter();

    return (
        <View style={{ backgroundColor: CARD_BACKGROUND }}>
            <View className="h-[74px] flex-row items-center px-[18px]">
                <View className="w-12 items-start justify-center">
                    <Pressable hitSlop={12} onPress={() => router.back()}>
                        <Icon as={ChevronLeft} size={24} color={PRIMARY_TEXT} />
                    </Pressable>
                </View>
                <View className="flex-1 items-center">
                    <Text
                        className="text-base font-puhui-medium"
                        style={{ color: PRIMARY_TEXT }}
                    >
                        资质证书
                    </Text>
                </View>
                <View className="w-12" />
            </View>
        </View>
    );
}

function StatusBadge({ label }: { label: string }) {
    return (
        <View
            className="self-start rounded-full px-[10px] py-1"
            style={{ backgroundColor: BADGE_BACKGROUND }}
        >
            <Text className="text-xs font-puhui-medium" style={{ color: ACCENT }}>
                {label}
            </Text>
        </View>
    );
}

function InfoCard(props: InfoCardItem) {
    return (
        <View
            className="rounded-[22px] border p-4"
            style={{
                backgroundColor: CARD_BACKGROUND,
                borderColor: CARD_BORDER,
            }}
        >
            <StatusBadge label={props.badge} />

            <View className="mt-3 flex-row" style={{ gap: 14 }}>
                <View
                    className="h-[54px] w-[54px] items-center justify-center rounded-full border"
                    style={{
                        backgroundColor: BADGE_BACKGROUND,
                        borderColor: "#F7B55D",
                        borderWidth: 1.5,
                    }}
                >
                    <Icon as={props.icon} size={24} color={ACCENT} />
                </View>

                <View className="flex-1" style={{ gap: 6 }}>
                    <Text
                        className="text-base font-puhui-medium"
                        style={{ color: PRIMARY_TEXT, lineHeight: 24 }}
                    >
                        {props.title}
                    </Text>
                    {props.subtitle ? (
                        <Text
                            className="text-sm font-puhui-regular"
                            style={{ color: TERTIARY_TEXT }}
                        >
                            {props.subtitle}
                        </Text>
                    ) : null}
                    <Text
                        className="text-sm font-puhui-regular"
                        style={{ color: ACCENT, lineHeight: 22 }}
                    >
                        {props.description}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function EmptyCertificateImage() {
    return (
        <View className="flex-1 items-center justify-center" style={{ gap: 10 }}>
            <View
                className="h-12 w-12 items-center justify-center rounded-full"
                style={{ backgroundColor: BADGE_BACKGROUND }}
            >
                <Icon as={FileImage} size={22} color={ACCENT} />
            </View>
            <Text className="text-sm font-puhui-regular" style={{ color: SECONDARY_TEXT }}>
                暂无图片
            </Text>
        </View>
    );
}

function CertificateImageCard({ item }: { item: CertificateCardItem }) {
    return (
        <View
            className="rounded-[22px] border p-4"
            style={{
                backgroundColor: CARD_BACKGROUND,
                borderColor: CARD_BORDER,
                boxShadow: SHADOW,
            }}
        >
            <Text className="text-base font-puhui-medium" style={{ color: PRIMARY_TEXT }}>
                {item.title}
            </Text>

            <View
                className="mt-[14px] overflow-hidden rounded-[18px]"
                style={{
                    height: item.height,
                    backgroundColor: PAGE_BACKGROUND,
                }}
            >
                {item.image?.url ? (
                    <Image
                        source={{ uri: item.image.url }}
                        placeholder={
                            item.image.blurhash
                                ? { blurhash: item.image.blurhash }
                                : undefined
                        }
                        contentFit="cover"
                        style={{ width: "100%", height: "100%" }}
                    />
                ) : (
                    <EmptyCertificateImage />
                )}
            </View>
        </View>
    );
}

function CertificatesSkeleton() {
    return (
        <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
            style={{ backgroundColor: PAGE_BACKGROUND }}
        >
            {buildInfoCardItems().map((item) => (
                <View
                    key={item.title}
                    className="rounded-[22px] border p-4"
                    style={{
                        backgroundColor: CARD_BACKGROUND,
                        borderColor: CARD_BORDER,
                    }}
                >
                    <Skeleton className="h-6 w-20 rounded-full" />
                    <View className="mt-3 flex-row" style={{ gap: 14 }}>
                        <Skeleton className="h-[54px] w-[54px] rounded-full" />
                        <View className="flex-1">
                            <Skeleton className="h-5 w-40 rounded" />
                            <Skeleton className="mt-2 h-4 w-28 rounded" />
                            <Skeleton className="mt-2 h-4 w-full rounded" />
                        </View>
                    </View>
                </View>
            ))}

            {[224, 212].map((height) => (
                <View
                    key={`cert-skeleton-${height}`}
                    className="rounded-[22px] border p-4"
                    style={{
                        backgroundColor: CARD_BACKGROUND,
                        borderColor: CARD_BORDER,
                    }}
                >
                    <Skeleton className="h-5 w-28 rounded" />
                    <Skeleton className="mt-[14px] w-full rounded-[18px]" style={{ height }} />
                </View>
            ))}
        </ScrollView>
    );
}

function CertificatesError({ onRetry }: { onRetry: () => void }) {
    return (
        <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
            style={{ backgroundColor: PAGE_BACKGROUND }}
        >
            <View
                className="rounded-[22px] border bg-card px-4 py-5"
                style={{ borderColor: CARD_BORDER }}
            >
                <Text className="text-sm font-puhui-regular" style={{ color: SECONDARY_TEXT }}>
                    资质证书加载失败
                </Text>
                <Pressable
                    className="mt-4 self-start rounded-full px-4 py-2"
                    style={{ backgroundColor: ACCENT }}
                    onPress={onRetry}
                >
                    <Text className="text-sm font-puhui-medium text-white">重试</Text>
                </Pressable>
            </View>
        </ScrollView>
    );
}

function CertificatesEmpty({ message }: { message: string }) {
    return (
        <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 28 }}
            style={{ backgroundColor: PAGE_BACKGROUND }}
        >
            <View
                className="rounded-[22px] border bg-card px-4 py-5"
                style={{ borderColor: CARD_BORDER }}
            >
                <Text className="text-sm font-puhui-regular" style={{ color: SECONDARY_TEXT }}>
                    {message}
                </Text>
            </View>
        </ScrollView>
    );
}

function CertificatesContent({ personnelId }: { personnelId: string }) {
    const profileQuery = useServicePersonnelProfile(personnelId);
    const infoCardItems = useMemo(
        () => buildInfoCardItems(profileQuery.data?.maskedIdCardNumber),
        [profileQuery.data?.maskedIdCardNumber],
    );
    const certificateCards = useMemo(
        () => [
            {
                title: "所属商家资质",
                height: 224,
                image: profileQuery.data?.merchantQualificationImage ?? null,
            },
            {
                title: "从业资格证书",
                height: 212,
                image: profileQuery.data?.vocationalQualificationImage ?? null,
            },
        ],
        [
            profileQuery.data?.merchantQualificationImage,
            profileQuery.data?.vocationalQualificationImage,
        ],
    );

    if (profileQuery.isLoading) {
        return <CertificatesSkeleton />;
    }

    if (profileQuery.isError) {
        return <CertificatesError onRetry={() => void profileQuery.refetch()} />;
    }

    if (!profileQuery.data) {
        return <CertificatesEmpty message="未找到服务人员资料" />;
    }

    return (
        <ScrollView
            className="flex-1"
            contentInsetAdjustmentBehavior="automatic"
            showsVerticalScrollIndicator={false}
            contentContainerStyle={{ padding: 16, paddingBottom: 28, gap: 14 }}
            style={{ backgroundColor: PAGE_BACKGROUND }}
            refreshControl={
                <RefreshControl
                    refreshing={profileQuery.isRefetching}
                    onRefresh={() => {
                        void profileQuery.refetch();
                    }}
                />
            }
        >
            {infoCardItems.map((item) => (
                <InfoCard key={item.title} {...item} />
            ))}

            {certificateCards.map((item) => (
                <CertificateImageCard key={item.title} item={item} />
            ))}
        </ScrollView>
    );
}

export default function QualificationCertificatesScreen() {
    const params = useLocalSearchParams<{
        personnelId?: string | string[];
    }>();
    const personnelId = getRouteParam(params.personnelId);

    return (
        <View className="flex-1" style={{ backgroundColor: PAGE_BACKGROUND }}>
            <ScreenHeader />
            {personnelId ? (
                <CertificatesContent personnelId={personnelId} />
            ) : (
                <CertificatesEmpty message="缺少 personnelId，无法加载资质证书" />
            )}
        </View>
    );
}
