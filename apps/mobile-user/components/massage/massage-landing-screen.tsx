import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { cssInterop, useColorScheme } from "nativewind";
import { Pressable, ScrollView, View } from "react-native";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { SvgXml } from "react-native-svg";
import { Text } from "@repo/mobile-ui/components/ui/text";
import {
    MASSAGE_PAGE_MOCK,
    createMassageDetailRouteParams,
    type MassageAvatarCard,
    type MassageCategoryCard,
    type MassageCoupon,
    type MassageEntry,
    type MassageMerchant,
    type MassageProject,
} from "@/components/massage/mock";

cssInterop(ExpoImage, { className: { target: "style" } });

const Image = ExpoImage as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

const TOP_BACKGROUND_XML = `<svg preserveAspectRatio="none" width="100%" height="100%" viewBox="0 0 375 130" fill="none" xmlns="http://www.w3.org/2000/svg"><path fill-rule="evenodd" clip-rule="evenodd" d="M0 0H375V116.254C375 116.254 317 130 189 130C61 130 0 116.254 0 116.254V0Z" fill="#FFE8C9"/></svg>`;

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
    return (
        <View className="flex-1 items-center justify-center">
            <View className="flex-row items-center">
                <SvgXml xml={item.iconXml} width={32} height={32} />
                <Text
                    className="ml-2 text-base font-puhui-medium"
                    style={{ color: item.textColor }}
                >
                    {item.label}
                </Text>
            </View>
        </View>
    );
}

function CouponCard({ item }: { item: MassageCoupon }) {
    return (
        <View className="relative h-[78px] w-[65px] overflow-hidden rounded-[12px] border border-[#ffd7d1] bg-[#fff7f7]">
            <View
                className="absolute -left-[4px] top-[30px] h-2 w-2 rounded-full"
                style={{ backgroundColor: MASSAGE_PAGE_MOCK.backgroundColor }}
            />
            <View
                className="absolute -right-[4px] top-[30px] h-2 w-2 rounded-full"
                style={{ backgroundColor: MASSAGE_PAGE_MOCK.backgroundColor }}
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
                <View
                    className="mt-[7px] h-5 w-[53px] items-center justify-center rounded-[4px]"
                    style={{
                        backgroundColor: "#fd7c48",
                    }}
                >
                    <Text className="text-[12px] font-puhui-regular text-white">
                        {item.actionLabel}
                    </Text>
                </View>
            </View>
        </View>
    );
}

function CategoryCard({ item }: { item: MassageCategoryCard }) {
    return (
        <View
            className="h-[102px] w-[153px] overflow-hidden rounded-[10px] border border-white px-4 pt-4"
            style={{
                backgroundColor: item.gradientTo,
            }}
        >
            <View
                className="absolute inset-0"
                style={{
                    backgroundColor: item.gradientFrom,
                    opacity: 0.78,
                }}
            />
            <View className="relative z-10 flex-1 flex-row items-start justify-between">
                <View className="pt-[2px]">
                    <Text
                        className="text-[18px] font-puhui-medium"
                        style={{ color: item.titleColor }}
                    >
                        {item.title}
                    </Text>
                    <Text
                        className="mt-1 text-[11px] leading-[15px] font-puhui-regular"
                        style={{ color: item.descriptionColor }}
                    >
                        {item.description}
                    </Text>
                </View>
                <Image
                    source={item.imageSource}
                    contentFit="contain"
                    className={item.imageClassName}
                />
            </View>
        </View>
    );
}

function ProjectCard({ item }: { item: MassageProject }) {
    return (
        <View className="mr-[14px] h-[168px] w-[126px] rounded-[12px] border border-[#eaeaea] bg-white p-[13px]">
            <View className="h-[68px] overflow-hidden rounded-[6px]">
                <Image
                    source={item.imageSource}
                    contentFit="cover"
                    className="h-full w-full"
                />
            </View>
            <Text className="mt-3 text-[14px] font-puhui-regular text-[#211f1c]">
                {item.name}
            </Text>
            <View className="mt-1 rounded-[4px] bg-[#fff6f6] px-[2px] py-[1px] self-start">
                <Text className="text-[11px] font-puhui-regular text-[#e80019]">
                    {item.description}
                </Text>
            </View>
            <View className="mt-[5px] flex-row items-end justify-between">
                <View className="flex-row items-start">
                    <Text className="pt-[2px] text-[12px] font-din-alt-bold text-[#e80019]">
                        ￥
                    </Text>
                    <Text className="text-[18px] font-din-alt-bold leading-[20px] text-[#e80019]">
                        {item.price}
                    </Text>
                </View>
                <View className="rounded-[10px] border border-[#f7c5a1] bg-[#fff6ec] px-[5px] py-[2px]">
                    <Text className="text-[11px] font-puhui-medium text-[#f06b22]">
                        {item.badge}
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
                    params: createMassageDetailRouteParams({
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
                    source={item.imageSource}
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
                    params: createMassageDetailRouteParams({
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
                        source={item.imageSource}
                        contentFit="contain"
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
                                <View className="rounded-[4px] border border-[#e80019] px-[4px] py-[1px]">
                                    <Text className="text-[11px] font-puhui-medium text-[#e85d0d]">
                                        {item.badge}
                                    </Text>
                                </View>
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
                        <Text className="pt-[2px] text-[12px] font-puhui-regular text-[#f7951b]">
                            {item.availableTime}
                        </Text>
                    </View>
                    <View className="mt-[10px] flex-row items-center justify-between">
                        <View className="flex-row items-center">
                            <Image
                                source={
                                    MASSAGE_PAGE_MOCK.merchantStatsIconSource
                                }
                                contentFit="contain"
                                className="h-4 w-4"
                            />
                            <Text className="ml-1 text-[12px] font-puhui-regular text-[#777777]">
                                {item.favoriteCount}
                            </Text>
                            <Image
                                source={
                                    MASSAGE_PAGE_MOCK.merchantCommentIconSource
                                }
                                contentFit="contain"
                                className="ml-3 h-4 w-4"
                            />
                            <Text className="ml-1 text-[12px] font-puhui-regular text-[#777777]">
                                {item.commentCount}
                            </Text>
                            <Text className="ml-3 text-[12px] font-puhui-regular text-[#da1f33]">
                                {item.benefit}
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

export function MassageLandingScreen() {
    const { colorScheme } = useColorScheme();
    const insets = useSafeAreaInsets();

    return (
        <View
            className="flex-1"
            style={{ backgroundColor: MASSAGE_PAGE_MOCK.backgroundColor }}
        >
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
            <ScrollView
                className="flex-1"
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}
                style={{ backgroundColor: MASSAGE_PAGE_MOCK.backgroundColor }}
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
                                    {MASSAGE_PAGE_MOCK.brandTitle}
                                </Text>
                                <Text className="ml-2 pb-[1px] text-[12px] font-puhui-medium text-[#333333]">
                                    {MASSAGE_PAGE_MOCK.brandSubtitle}
                                </Text>
                            </View>
                        </View>
                    </SafeAreaView>
                </View>

                <View className="-mt-[37px] px-4">
                    <View className="overflow-hidden rounded-[12px] border border-white bg-white shadow-sm">
                        <Image
                            source={MASSAGE_PAGE_MOCK.bannerImageSource}
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
                                MASSAGE_PAGE_MOCK.entryBar.leftDecorationSource
                            }
                            contentFit="contain"
                            className="absolute left-0 top-0 h-full w-[150px]"
                        />
                        <Image
                            source={
                                MASSAGE_PAGE_MOCK.entryBar.rightDecorationSource
                            }
                            contentFit="contain"
                            className="absolute right-0 top-0 h-full w-[150px]"
                        />
                        <View className="flex-1 flex-row items-center">
                            <EntryItem
                                item={MASSAGE_PAGE_MOCK.entryBar.entries[0]}
                            />
                            <View className="h-full w-px bg-[#efe2cc]" />
                            <EntryItem
                                item={MASSAGE_PAGE_MOCK.entryBar.entries[1]}
                            />
                        </View>
                    </View>

                    <View className="mt-3 rounded-[10px] bg-white px-4 pb-[11px] pt-3 shadow-sm">
                        <SectionHeader title="新人专享" accent="·大礼包" />
                        <View className="mt-2 flex-row justify-between">
                            {MASSAGE_PAGE_MOCK.coupons.map((item) => (
                                <CouponCard key={item.id} item={item} />
                            ))}
                        </View>
                    </View>

                    <View className="mt-3 flex-row justify-between gap-2">
                        <View className="justify-between">
                            {MASSAGE_PAGE_MOCK.categoryCards.map((item) => (
                                <View key={item.id} className="mb-3 last:mb-0">
                                    <CategoryCard item={item} />
                                </View>
                            ))}
                        </View>

                        <View
                            className="h-[216px] w-[178px] rounded-[10px] border border-white bg-white px-4 pt-3"
                            style={{ backgroundColor: "#fff8ee" }}
                        >
                            <SectionHeader title="推荐项目" />
                            <ScrollView
                                horizontal
                                showsHorizontalScrollIndicator={false}
                                className="mt-2"
                            >
                                <View className="flex-row">
                                    {MASSAGE_PAGE_MOCK.projects.map((item) => (
                                        <ProjectCard
                                            key={item.id}
                                            item={item}
                                        />
                                    ))}
                                </View>
                            </ScrollView>
                            <View className="mt-[2px] flex-row justify-center gap-[5px]">
                                {MASSAGE_PAGE_MOCK.projects.map(
                                    (item, index) => (
                                        <View
                                            key={item.id}
                                            className="h-[3px] w-[3px] rounded-full"
                                            style={{
                                                backgroundColor:
                                                    index === 0
                                                        ? "#f6a320"
                                                        : "#d9d9d9",
                                            }}
                                        />
                                    ),
                                )}
                            </View>
                        </View>
                    </View>

                    <View className="mt-3 overflow-hidden rounded-[10px] bg-white px-4 pb-[13px] pt-3 shadow-sm">
                        <View className="flex-row">
                            {MASSAGE_PAGE_MOCK.newcomerColumns.map(
                                (column, index) => (
                                    <View
                                        key={column.id}
                                        className="flex-1"
                                        style={
                                            index === 0
                                                ? { paddingRight: 16 }
                                                : { paddingLeft: 16 }
                                        }
                                    >
                                        <View
                                            className="flex-row items-center justify-between"
                                            style={
                                                index === 0
                                                    ? {
                                                          borderRightWidth: 1,
                                                          borderRightColor:
                                                              "#efefef",
                                                          paddingRight: 16,
                                                      }
                                                    : undefined
                                            }
                                        >
                                            <Text className="text-[16px] font-puhui-medium text-[#333333]">
                                                {column.title}
                                            </Text>
                                            <Text className="text-base text-[#c2c2c2]">
                                                ›
                                            </Text>
                                        </View>
                                        <View className="mt-4 flex-row justify-between">
                                            {column.cards.map((card) => (
                                                <AvatarCard
                                                    key={card.id}
                                                    item={card}
                                                />
                                            ))}
                                        </View>
                                    </View>
                                ),
                            )}
                        </View>
                    </View>

                    <View className="mt-3 rounded-[8px] bg-white px-4 pb-1 pt-4 shadow-sm">
                        <Text className="text-[16px] font-puhui-medium text-[#333333]">
                            推荐商户
                        </Text>
                        <View className="mt-4 gap-4">
                            {MASSAGE_PAGE_MOCK.merchants.map((item) => (
                                <MerchantRow key={item.id} item={item} />
                            ))}
                        </View>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
