import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { type Href, router } from "expo-router";
import { Heart, MessageCircle } from "lucide-react-native";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { StatusBar } from "expo-status-bar";
import { useMassageLanding } from "@repo/hooks/api/massage";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cssInterop, useColorScheme } from "nativewind";
import { Suspense, useMemo } from "react";
import { Pressable, ScrollView, View } from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { useHomeLocationStore } from "@/stores/home-location-store";
import { createMassageTagFilterRouteParams } from "./route";
import { createServicePersonnelRouteParams } from "@/lib/service-personnel-route";
import { getAlternatingMassageTagVisual } from "./tag-entry-visuals";

cssInterop(ExpoImage, { className: { target: "style" } });

const Image = ExpoImage as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

const BACKGROUND_COLOR = "#f4f5f7";
const FAVORITE_PERSONNEL_ROUTE =
    "/profile/favorite-personnel" as Href;

const TOP_BACKGROUND_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 375 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H375V116.254C375 116.254 317 130 189 130C61 130 0 116.254 0 116.254V0Z" fill="#FFE8C9"/></svg>`;
const ENTRY_MERCHANT_ICON_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" overflow="visible" style="display: block;" viewBox="0 0 29.9991 26.9163" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M4.03822 2.59195H24.2293C24.3913 2.59517 24.5522 2.56381 24.7012 2.49997C24.8502 2.43613 24.9838 2.34126 25.0932 2.2217C25.3226 1.96971 25.4463 1.63919 25.4388 1.29854C25.4476 0.956183 25.3238 0.623671 25.0932 0.370436C24.9836 0.251124 24.8499 0.156429 24.701 0.0926043C24.5521 0.02878 24.3913 -0.00272039 24.2293 0.000184051H4.03822C3.87622 -0.00272039 3.71545 0.02878 3.56653 0.0926043C3.4176 0.156429 3.28391 0.251124 3.1743 0.370436C2.94374 0.623671 2.81994 0.956183 2.82873 1.29854C2.82008 1.46363 2.84482 1.62877 2.90147 1.78408C2.95812 1.93939 3.04552 2.08168 3.15844 2.20243C3.27135 2.32318 3.40747 2.41991 3.55863 2.48684C3.7098 2.55377 3.87291 2.58952 4.03822 2.59195ZM7.10391 11.6261C8.04188 11.3546 8.62441 14.3462 10.3276 14.3709C12.0307 14.3956 12.9341 13.4922 13.9314 11.6952C14.5534 11.0238 14.8446 12.2284 15.1063 12.7418C15.3679 13.2552 16.1924 14.6177 17.7919 14.5486C19.7172 14.4696 19.9443 13.3836 21.0649 11.5866C21.598 11.2657 21.8251 11.8532 22.1559 12.6036C23.0314 12.2882 23.9622 12.1554 24.891 12.2131C25.8197 12.2708 26.7269 12.5179 27.5566 12.9393C28.0153 12.2224 28.2634 11.391 28.2725 10.54L25.7696 3.74714H24.6835H2.42392L0 10.5302C0 12.5591 1.56987 14.5338 3.50999 14.5338C5.45011 14.5338 6.35353 11.8631 7.10391 11.6261Z" fill="#800000"/><path d="M21.4057 25.3994C21.1959 25.1083 20.9542 24.8417 20.6849 24.6046C19.4779 23.7897 18.5645 22.6087 18.0792 21.2356C17.5939 19.8624 17.5625 18.3697 17.9895 16.9774H17.6736C16.8999 16.9645 16.1487 16.7155 15.5205 16.2637C14.8923 15.812 14.4171 15.1791 14.1586 14.4498C13.8922 15.1813 13.4094 15.8144 12.7745 16.265C12.1396 16.7156 11.3827 16.9623 10.6042 16.9724C9.83115 16.9599 9.08035 16.7116 8.45222 16.2608C7.82408 15.81 7.34857 15.1782 7.08928 14.4498C6.76837 15.3656 6.10552 16.1218 5.23957 16.5598C4.37362 16.9978 3.37176 17.0838 2.44385 16.7997V25.1772C2.44385 25.9523 3.25347 26.9001 3.97916 26.9001H22.2844C22.2118 26.7629 22.1523 26.6191 22.1067 26.4706C21.9734 26.2436 21.7216 25.8239 21.4057 25.3944V25.3994Z" fill="#800000"/><path d="M24.4711 13.4428C23.2807 13.4442 22.1225 13.8295 21.1684 14.5414C20.2143 15.2533 19.5152 16.2539 19.1748 17.3946C18.8345 18.5354 18.8711 19.7555 19.2791 20.8738C19.6872 21.9921 20.445 22.949 21.44 23.6025C21.8107 23.9152 22.1422 24.2716 22.4274 24.6639C22.7335 25.0913 23.0169 25.5346 23.2765 25.9919C23.3453 26.2609 23.5033 26.4987 23.7246 26.6665C23.9459 26.8344 24.2175 26.9223 24.4952 26.916C24.7729 26.9097 25.0402 26.8095 25.2537 26.6319C25.4672 26.4542 25.6142 26.2095 25.6708 25.9375C25.8323 25.4461 26.0946 24.9938 26.4409 24.6096C26.806 24.2091 27.2095 23.8454 27.6454 23.5235L27.8281 23.3902L27.9861 23.2865H27.9416L27.991 23.247C28.8689 22.5213 29.5015 21.5423 29.8024 20.4437C30.1033 19.3452 30.0579 18.1805 29.6724 17.1086C29.2869 16.0368 28.58 15.1101 27.6482 14.4549C26.7165 13.7997 25.6053 13.448 24.4662 13.4477L24.4711 13.4428ZM24.4711 21.5488C23.9615 21.5488 23.4632 21.3977 23.0395 21.1145C22.6157 20.8314 22.2854 20.4289 22.0903 19.958C21.8953 19.4871 21.8443 18.969 21.9437 18.4691C22.0431 17.9692 22.2886 17.5101 22.649 17.1497C23.0094 16.7893 23.4685 16.5439 23.9684 16.4444C24.4683 16.345 24.9864 16.396 25.4573 16.5911C25.9282 16.7861 26.3306 17.1164 26.6138 17.5402C26.897 17.964 27.0481 18.4622 27.0481 18.9719C27.0481 19.3103 26.9814 19.6454 26.8519 19.958C26.7224 20.2707 26.5326 20.5548 26.2933 20.794C26.054 21.0333 25.77 21.2232 25.4573 21.3527C25.1447 21.4822 24.8096 21.5488 24.4711 21.5488Z" fill="#800000"/></g></svg>`;
const ENTRY_FAVORITE_ICON_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" overflow="visible" style="display: block;" viewBox="0 0 32 25.627" fill="none" xmlns="http://www.w3.org/2000/svg"><g><path d="M5.01539 8.48129C5.36531 7.29825 6.44836 6.46513 7.68139 6.41514H27.2098C27.2098 4.64892 25.7768 3.21595 24.0106 3.21595H11.997L10.7973 1.01651C10.564 0.416664 9.96414 0.0167659 9.3143 0.000103459H3.19919C1.43297 0.0167659 0 1.44974 0 3.21595V20.0117C0 21.2447 0.716485 22.3778 1.84953 22.8943L5.01539 8.48129ZM26.8265 21.478C27.0098 21.1447 27.1431 20.7948 27.2098 20.4283L26.8265 21.478Z" fill="#00306B" fill-opacity="0.77"/><path d="M29.1425 8.01478H9.28087C8.04785 8.04811 6.96479 8.88123 6.61488 10.0809L3.21574 25.627H25.6101C26.8431 25.577 27.9261 24.7439 28.276 23.5608L31.8085 12.3637C32.525 10.2642 31.142 8.01478 29.1425 8.01478ZM22.5608 16.2127L20.5114 18.2289L20.9946 21.0781C21.0445 21.3114 20.9612 21.5447 20.7946 21.6946C20.7113 21.778 20.5947 21.8113 20.478 21.7946C20.3614 21.7946 20.2281 21.7613 20.1281 21.6946L17.5954 20.3617L15.0627 21.7113C14.8628 21.8446 14.5962 21.8446 14.4129 21.7113C14.2296 21.5613 14.1463 21.3281 14.2129 21.0948L14.6962 18.2455L12.6467 16.2127C12.3967 16.0294 12.3301 15.6962 12.5134 15.4462C12.6134 15.2963 12.78 15.213 12.9633 15.213L15.8125 14.7964L17.0956 12.1971C17.1955 11.9138 17.5121 11.7638 17.7954 11.8638C17.9453 11.9138 18.0786 12.0471 18.1286 12.1971L19.4116 14.7964L22.2609 15.213C22.5608 15.213 22.8108 15.4629 22.8108 15.7795C22.8108 15.9461 22.7108 16.1127 22.5608 16.2127Z" fill="#00306B"/></g></svg>`;

type MassageEntry = {
    id: string;
    label: string;
    textColor: string;
    iconXml: string;
    onPress?: () => void;
};

type MassageCoupon = {
    id: string;
    amount: number;
    title: string;
    actionLabel: string;
};

type MassageCategoryCard = {
    id: string;
    title: string;
    description: string;
    titleColor: string;
    descriptionColor: string;
    gradientFrom: string;
    gradientTo: string;
    categoryMaskSource: React.ComponentProps<typeof ExpoImage>["source"];
    imageSource: React.ComponentProps<typeof ExpoImage>["source"];
    imageClassName: string;
    onPress: () => void;
};

type MassageAvatarCard = {
    id: string;
    name: string;
    avatarUrl: string | null;
    avatarBlurhash?: string | null;
    serviceId: string | null;
    pricingId: string | null;
    serviceName: string | null;
};

type MassageMerchant = {
    id: string;
    name: string;
    score: string;
    shopName: string;
    orderSummary: string;
    availableTime: string;
    favoriteCount: string;
    commentCount: string;
    avatarUrl: string | null;
    avatarBlurhash?: string | null;
    serviceId: string | null;
    pricingId: string | null;
    serviceName: string | null;
};

const CATEGORY_WAVE_LAYERS = [
    {
        top: -31,
        right: -30,
    },
    {
        top: 28,
        right: -30,
    },
] as const;

const CATEGORY_PERSONNEL_IMAGE_POSITION = {
    right: 6,
    bottom: -4,
} as const;

function createCategoryCardGradientXml(from: string, to: string) {
    return `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 167 102" fill="none" xmlns="http://www.w3.org/2000/svg"><defs><linearGradient id="categoryCardGradient" x1="83.5" y1="0" x2="83.5" y2="102" gradientUnits="userSpaceOnUse"><stop stop-color="${from}"/><stop offset="0.62745" stop-color="${to}"/></linearGradient></defs><rect width="167" height="102" rx="10" fill="url(#categoryCardGradient)"/></svg>`;
}

const LANDING_STATIC = {
    brandTitle: "叮咚上门",
    brandSubtitle: "严选商户-平台保障  就在叮咚",
    bannerImageSource: require("@/assets/images/massage-banner.png"),
    entryBar: {
        leftDecorationSource: require("@/assets/images/massage-entry-left-decoration.svg"),
        rightDecorationSource: require("@/assets/images/massage-entry-right-decoration.svg"),
        entries: [
            {
                id: "merchant-settle",
                label: "商户入驻",
                textColor: "#800000",
                iconXml: ENTRY_MERCHANT_ICON_XML,
            },
            {
                id: "favorite-merchant",
                label: "收藏商户",
                textColor: "#00306b",
                iconXml: ENTRY_FAVORITE_ICON_XML,
            },
        ] as readonly MassageEntry[],
    },
    coupons: [
        { id: "coupon-1", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-2", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-3", amount: 40, title: "现金券", actionLabel: "去使用" },
        { id: "coupon-4", amount: 40, title: "现金券", actionLabel: "去使用" },
    ] as readonly MassageCoupon[],
} as const;

function SectionHeader({ title, accent }: { title: string; accent?: string }) {
    return (
        <View className="flex-row items-center justify-between">
            <View className="flex-row items-center">
                <Text className="text-base font-puhui-medium text-[#333333]">
                    {title}
                </Text>
                {accent ? (
                    <Text className="text-base font-puhui-medium text-[#ff763f]">
                        {accent}
                    </Text>
                ) : null}
            </View>
            <Text className="text-base text-[#c2c2c2]">›</Text>
        </View>
    );
}

function EntryItem({ item }: { item: MassageEntry }) {
    const content = (
        <View className="flex-row items-center">
            <SvgXml xml={item.iconXml} width={32} height={32} />
            <Text
                className="ml-2 text-base font-puhui-medium"
                style={{ color: item.textColor }}
            >
                {item.label}
            </Text>
        </View>
    );

    if (!item.onPress) {
        return <View className="flex-1 items-center justify-center">{content}</View>;
    }

    return (
        <Pressable
            className="flex-1 items-center justify-center"
            onPress={item.onPress}
        >
            {content}
        </Pressable>
    );
}

function CouponCard({ item }: { item: MassageCoupon }) {
    return (
        <View className="relative h-[78px] w-[65px] overflow-hidden rounded-[12px] border border-[#ffd7d1] bg-[#fff7f7]">
            <View
                className="absolute -left-[4px] top-[30px] h-2 w-2 rounded-full"
                style={{ backgroundColor: BACKGROUND_COLOR }}
            />
            <View
                className="absolute -right-[4px] top-[30px] h-2 w-2 rounded-full"
                style={{ backgroundColor: BACKGROUND_COLOR }}
            />
            <View className="items-center pt-[7px]">
                <View className="flex-row items-start">
                    <Text className="pt-[2px] text-xs font-puhui-medium text-[#f06b22]">
                        ￥
                    </Text>
                    <Text className="text-[20px] font-puhui-medium leading-[22px] text-[#f06b22]">
                        {item.amount}
                    </Text>
                </View>
                <Text className="-mt-[1px] text-[12px] font-puhui-regular leading-[16px] text-[#f06b22]">
                    {item.title}
                </Text>
                <View className="mt-[7px] h-5 w-[53px] items-center justify-center rounded-[4px] bg-[#fd7c48]">
                    <Text className="text-[12px] font-puhui-regular text-white">
                        {item.actionLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function CategoryCard({ item }: { item: MassageCategoryCard }) {
    const gradientXml = useMemo(
        () => createCategoryCardGradientXml(item.gradientFrom, item.gradientTo),
        [item.gradientFrom, item.gradientTo],
    );

    return (
        <View className="relative h-[102px] flex-1 overflow-hidden rounded-[10px] border border-white shadow-sm">
            <SvgXml
                xml={gradientXml}
                width="100%"
                height="100%"
                style={{ position: "absolute", inset: 0 }}
            />

            {CATEGORY_WAVE_LAYERS.map((layer, index) => (
                <Image
                    key={`${item.id}-wave-${index}`}
                    pointerEvents="none"
                    source={item.categoryMaskSource}
                    contentFit="fill"
                    style={{
                        position: "absolute",
                        top: layer.top,
                        right: layer.right,
                        width: 118,
                        height: 108,
                    }}
                />
            ))}

            <View
                pointerEvents="none"
                style={{
                    position: "absolute",
                    zIndex: 2,
                    ...CATEGORY_PERSONNEL_IMAGE_POSITION,
                }}
            >
                <Image
                    source={item.imageSource}
                    contentFit="contain"
                    className={item.imageClassName}
                />
            </View>

            <View className="relative z-10 flex-1 px-[17px] pt-[15px]">
                <View className="w-[76px]">
                    <Text
                        className="text-[18px] font-puhui-medium leading-[20px]"
                        style={{ color: item.titleColor }}
                    >
                        {item.title}
                    </Text>
                    <Text
                        className="mt-[5px] text-[11px] font-puhui-regular leading-[15px]"
                        style={{ color: item.descriptionColor }}
                    >
                        {item.description}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function AvatarCard({ item }: { item: MassageAvatarCard }) {
    return (
        <Pressable
            className="items-center"
            onPress={() =>
                router.push({
                    pathname: "/servicePersonnel/[id]",
                    params: createServicePersonnelRouteParams({
                        id: item.id,
                        serviceId: item.serviceId,
                        pricingId: item.pricingId,
                        serviceName: item.serviceName,
                        personnelName: item.name,
                    }),
                })
            }
        >
            <View className="h-[53px] w-[53px] rounded-[8px] border border-[#e4e4e4] bg-[#f3f4fb]">
                <Image
                    source={
                        item.avatarUrl
                            ? { uri: item.avatarUrl }
                            : require("@/assets/images/massage-personnel-white.png")
                    }
                    placeholder={
                        item.avatarUrl && item.avatarBlurhash
                            ? { blurhash: item.avatarBlurhash }
                            : undefined
                    }
                    contentFit="contain"
                    className="h-full w-full"
                />
            </View>
            <Text className="mt-1 text-[12px] font-puhui-regular text-[#333333]">
                {item.name}
            </Text>
        </Pressable>
    );
}

function MerchantRow({ item }: { item: MassageMerchant }) {
    return (
        <Pressable
            className="border-b border-[#f2f2f2] pb-4 pt-[2px]"
            onPress={() =>
                router.push({
                    pathname: "/servicePersonnel/[id]",
                    params: createServicePersonnelRouteParams({
                        id: item.id,
                        serviceId: item.serviceId,
                        pricingId: item.pricingId,
                        serviceName: item.serviceName,
                        personnelName: item.name,
                    }),
                })
            }
        >
            <View className="flex-row">
                <View className="h-[68px] w-[68px] rounded-[8px] border border-[#e4e4e4] bg-[#f3f4fb]">
                    <Image
                        source={
                            item.avatarUrl
                                ? { uri: item.avatarUrl }
                                : require("@/assets/images/massage-personnel-blue.png")
                        }
                        placeholder={
                            item.avatarUrl && item.avatarBlurhash
                                ? { blurhash: item.avatarBlurhash }
                                : undefined
                        }
                        contentFit="cover"
                        className="h-full w-full"
                    />
                </View>
                <View className="ml-3 flex-1 pt-[2px]">
                    <View className="flex-row items-start justify-between">
                        <View>
                            <View className="flex-row items-center gap-[6px]">
                                <Text className="text-[15px] font-puhui-regular text-black">
                                    {item.name}
                                </Text>
                            </View>
                            <View className="mt-[2px] flex-row items-center">
                                <Text className="text-[12px] font-puhui-medium text-[#e80019]">
                                    {item.score}
                                </Text>
                                <Text className="mx-1 text-[12px] text-[#999999]">
                                    |
                                </Text>
                                <Text className="text-[12px] font-puhui-regular text-[#777777]">
                                    {item.shopName}
                                </Text>
                                <Text className="mx-1 text-[12px] text-[#999999]">
                                    |
                                </Text>
                                <Text className="text-[12px] font-puhui-regular text-[#777777]">
                                    {item.orderSummary}
                                </Text>
                            </View>
                        </View>
                        <Text className="pt-[2px] text-[12px] font-puhui-regular text-primary">
                            {item.availableTime}
                        </Text>
                    </View>
                    <View className="mt-[10px] flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Icon
                                as={Heart}
                                className="h-4 w-4 text-primary"
                                size={16}
                            />
                            <Text className="ml-1 text-[12px] font-puhui-regular text-[#777777]">
                                {item.favoriteCount}
                            </Text>
                            <Icon
                                as={MessageCircle}
                                className="ml-3 h-4 w-4 text-[#777777]"
                                size={16}
                            />
                            <Text className="ml-1 text-[12px] font-puhui-regular text-[#777777]">
                                {item.commentCount}
                            </Text>
                        </View>
                        <View className="h-7 w-[66px] items-center justify-center rounded-full bg-[#f7951b]">
                            <Text className="text-[12px] font-puhui-medium text-white">
                                去下单
                            </Text>
                        </View>
                    </View>
                </View>
            </View>
        </Pressable>
    );
}

function MassageLandingScreenContent() {
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();
    const selectedHomeLocation = useHomeLocationStore(
        (state) => state.selectedLocation,
    );

    const resolvedCoords = useMemo(() => {
        if (
            selectedHomeLocation &&
            Number.isFinite(selectedHomeLocation.lat) &&
            Number.isFinite(selectedHomeLocation.lng)
        ) {
            return {
                lat: selectedHomeLocation.lat,
                lng: selectedHomeLocation.lng,
            };
        }
        return null;
    }, [selectedHomeLocation]);

    const landingQuery = useMassageLanding(
        resolvedCoords
            ? { lat: resolvedCoords.lat, lng: resolvedCoords.lng }
            : {},
    );

    const categoryCards = useMemo<MassageCategoryCard[]>(
        () =>
            landingQuery.data.tagEntries.map((tag, index) => {
                const visual = getAlternatingMassageTagVisual(index);
                return {
                    id: tag.tagId,
                    title: tag.tagName,
                    description: visual.description,
                    titleColor: visual.titleColor,
                    descriptionColor: visual.descriptionColor,
                    gradientFrom: visual.gradientFrom,
                    gradientTo: visual.gradientTo,
                    categoryMaskSource: visual.categoryMaskSource,
                    imageSource: visual.imageSource,
                    imageClassName: visual.imageClassName,
                    onPress: () => {
                        router.push({
                            pathname: "/category/filter",
                            params: createMassageTagFilterRouteParams({
                                tagId: tag.tagId,
                                tagName: tag.tagName,
                                tagDomain: tag.domain,
                            }),
                        });
                    },
                };
            }),
        [landingQuery.data.tagEntries],
    );

    const newcomerCards = useMemo<MassageAvatarCard[]>(
        () =>
            landingQuery.data.newcomerPersonnel.map((item) => ({
                id: item.personnelId,
                name: item.name,
                avatarUrl: item.avatarUrl,
                avatarBlurhash: item.avatarBlurhash ?? null,
                serviceId: item.serviceId,
                pricingId: item.pricingId,
                serviceName: item.serviceName,
            })),
        [landingQuery.data.newcomerPersonnel],
    );

    const merchants = useMemo<MassageMerchant[]>(
        () =>
            landingQuery.data.recommendedPersonnel.map((item) => ({
                id: item.personnelId,
                name: item.name,
                score: `${item.ratingValue.toFixed(1)}分`,
                shopName: item.serviceName ?? "上门按摩",
                orderSummary: item.orderCountLabel ?? "一年0单",
                availableTime: item.availableTimeText ?? "可预约",
                favoriteCount: String(item.favoriteCount),
                commentCount: String(item.reviewCount),
                avatarUrl: item.avatarUrl,
                avatarBlurhash: item.avatarBlurhash ?? null,
                serviceId: item.serviceId,
                pricingId: item.pricingId,
                serviceName: item.serviceName,
            })),
        [landingQuery.data.recommendedPersonnel],
    );

    const bannerSource = landingQuery.data.banner?.imageUrl
        ? { uri: landingQuery.data.banner.imageUrl }
        : LANDING_STATIC.bannerImageSource;
    const bannerPlaceholder =
        landingQuery.data.banner?.imageUrl &&
        landingQuery.data.banner.imageBlurhash
            ? { blurhash: landingQuery.data.banner.imageBlurhash }
            : undefined;

    return (
        <View className="flex-1" style={{ backgroundColor: BACKGROUND_COLOR }}>
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <ScrollView
                className="flex-1"
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                style={{ backgroundColor: BACKGROUND_COLOR }}
            >
                <View className="relative h-[130px] overflow-hidden">
                    <SvgXml
                        xml={TOP_BACKGROUND_XML}
                        width="100%"
                        height="100%"
                        style={{ position: "absolute", inset: 0 }}
                    />
                    <SafeAreaView edges={["top"]} className="px-4 pt-[10px]">
                        <View className="h-11 justify-center">
                            <View className="flex-row items-end">
                                <Text className="text-[18px] font-puhui-medium text-[#333333]">
                                    {LANDING_STATIC.brandTitle}
                                </Text>
                                <Text className="ml-2 pb-[1px] text-[12px] font-puhui-medium text-[#333333]">
                                    {LANDING_STATIC.brandSubtitle}
                                </Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </View>

                <View className="-mt-[37px] px-4">
                    <View className="overflow-hidden rounded-[12px] border border-white bg-white shadow-sm">
                        <Image
                            source={bannerSource}
                            placeholder={bannerPlaceholder}
                            contentFit="cover"
                            className="h-[121px] w-full"
                        />
                    </View>

                    <View
                        className="mt-3 h-[55px] overflow-hidden rounded-[10px] border border-white bg-white"
                        style={{
                            shadowColor: "#623800",
                            shadowOffset: { width: 0, height: 5 },
                            shadowOpacity: 0.18,
                            shadowRadius: 9.8,
                            elevation: 3,
                        }}
                    >
                        <View className="absolute inset-0 bg-[#fff5ea]" />
                        <Image
                            source={
                                LANDING_STATIC.entryBar.leftDecorationSource
                            }
                            contentFit="contain"
                            className="absolute left-0 top-0 h-full w-[150px]"
                        />
                        <Image
                            source={
                                LANDING_STATIC.entryBar.rightDecorationSource
                            }
                            contentFit="contain"
                            className="absolute right-0 top-0 h-full w-[150px]"
                        />
                        <View className="flex-1 flex-row items-center">
                            <EntryItem
                                item={LANDING_STATIC.entryBar.entries[0]}
                            />
                            <View className="h-full w-px bg-[#efe2cc]" />
                            <EntryItem
                                item={{
                                    ...LANDING_STATIC.entryBar.entries[1],
                                    onPress: () => {
                                        router.push(FAVORITE_PERSONNEL_ROUTE);
                                    },
                                }}
                            />
                        </View>
                    </View>

                    {/* <View className="mt-3 rounded-[10px] bg-white px-4 pb-[11px] pt-3 shadow-sm">
                        <SectionHeader title="新人专享" accent="·大礼包" />
                        <View className="mt-2 flex-row justify-between">
                            {LANDING_STATIC.coupons.map((item) => (
                                <CouponCard key={item.id} item={item} />
                            ))}
                        </View>
                    </View> */}

                    <View className="mt-3 flex-row gap-[13px]">
                        {categoryCards.map((item) => (
                            <Pressable
                                key={item.id}
                                className="flex-1"
                                onPress={item.onPress}
                            >
                                <CategoryCard item={item} />
                            </Pressable>
                        ))}
                    </View>

                    <View className="mt-3 overflow-hidden rounded-[10px] bg-white px-4 pb-4 pt-3 shadow-sm">
                        <SectionHeader title="新人上线" />
                        <View className="mt-3 flex-row items-start justify-between">
                            {newcomerCards.map((card) => (
                                <AvatarCard key={card.id} item={card} />
                            ))}
                        </View>
                    </View>

                    <View className="mt-3 rounded-[8px] bg-white px-4 pb-1 pt-4 shadow-sm">
                        <Text className="text-[16px] font-puhui-medium text-[#333333]">
                            推荐商户
                        </Text>
                        <View className="mt-4 gap-4">
                            {merchants.map((item) => (
                                <MerchantRow key={item.id} item={item} />
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

function MassageLandingSkeleton() {
    return (
        <View className="flex-1" style={{ backgroundColor: BACKGROUND_COLOR }}>
            <ScrollView
                className="flex-1"
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
            >
                <View className="relative h-[130px] overflow-hidden" />
                <View className="-mt-[37px] px-4 pb-5">
                    <View className="overflow-hidden rounded-[12px] border border-white bg-white shadow-sm">
                        <Skeleton className="h-[121px] w-full rounded-none" />
                    </View>

                    <View className="mt-3 h-[55px] overflow-hidden rounded-[10px] border border-white bg-white p-3">
                        <View className="flex-1 flex-row items-center justify-between">
                            <Skeleton className="h-6 w-[140px]" />
                            <Skeleton className="h-6 w-[140px]" />
                        </View>
                    </View>

                    <View className="mt-3 rounded-[10px] bg-white px-4 pb-[11px] pt-3 shadow-sm">
                        <Skeleton className="h-5 w-28 rounded-md" />
                        <View className="mt-2 flex-row justify-between">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <Skeleton
                                    key={`coupon-skeleton-${idx}`}
                                    className="h-[78px] w-[65px] rounded-[12px]"
                                />
                            ))}
                        </View>
                    </View>

                    <View className="mt-3 flex-row gap-[13px]">
                        <Skeleton className="h-[102px] flex-1 rounded-[10px]" />
                        <Skeleton className="h-[102px] flex-1 rounded-[10px]" />
                    </View>

                    <View className="mt-3 overflow-hidden rounded-[10px] bg-white px-4 pb-4 pt-3 shadow-sm">
                        <Skeleton className="h-5 w-20 rounded-md" />
                        <View className="mt-3 flex-row items-start justify-between">
                            {Array.from({ length: 4 }).map((_, idx) => (
                                <View
                                    key={`newcomer-skeleton-${idx}`}
                                    className="items-center"
                                >
                                    <Skeleton className="h-[53px] w-[53px] rounded-[8px]" />
                                    <Skeleton className="mt-1 h-4 w-10 rounded" />
                                </View>
                            ))}
                        </View>
                    </View>

                    <View className="mt-3 rounded-[8px] bg-white px-4 pb-1 pt-4 shadow-sm">
                        <Skeleton className="h-5 w-24 rounded-md" />
                        <View className="mt-4 gap-4">
                            {Array.from({ length: 2 }).map((_, idx) => (
                                <Skeleton
                                    key={`merchant-skeleton-${idx}`}
                                    className="h-[92px] w-full rounded-[8px]"
                                />
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}

export function MassageLandingScreen() {
    return (
        <Suspense fallback={<MassageLandingSkeleton />}>
            <MassageLandingScreenContent />
        </Suspense>
    );
}
