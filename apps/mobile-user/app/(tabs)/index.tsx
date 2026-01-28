import type React from "react";
import { Image as ExpoImage } from "expo-image";
import { useFonts } from "expo-font";
import { cssInterop, useColorScheme } from "nativewind";
import { Platform, ScrollView, View } from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { StatusBar } from "expo-status-bar";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-user-constants";

// Enable NativeWind `className` on expo-image.
cssInterop(ExpoImage, { className: { target: "style" } });
const Image = ExpoImage as unknown as React.ComponentType<
    React.ComponentProps<typeof ExpoImage> & { className?: string }
>;

type CategoryItem = {
    id: string;
    label: string;
    icon: number;
};

const CATEGORIES: readonly CategoryItem[] = [
    { id: "home-clean", label: "家庭保洁", icon: require("@/assets/images/家庭保洁.png") },
    { id: "appliance-clean", label: "家电清洗", icon: require("@/assets/images/家电清洗.png") },
    { id: "health-care", label: "康养护理", icon: require("@/assets/images/康养护理.png") },
    { id: "beauty", label: "上门美业", icon: require("@/assets/images/上门美业.png") },
    { id: "storage", label: "整理收纳", icon: require("@/assets/images/整理收纳.png") },
    { id: "deep-clean", label: "深度保洁", icon: require("@/assets/images/深度保洁.png") },
    { id: "laundry", label: "衣物洗护", icon: require("@/assets/images/衣物洗护.png") },
    { id: "massage", label: "推拿按摩", icon: require("@/assets/images/推拿按摩.png") },
    { id: "furniture-care", label: "家具养护", icon: require("@/assets/images/家具养护.png") },
    { id: "nanny", label: "保姆月嫂", icon: require("@/assets/images/保姆月嫂.png") },
] as const;

type GuaranteeItem = {
    id: string;
    label: string;
    icon: number;
};

const GUARANTEES: readonly GuaranteeItem[] = [
    { id: "late-comp", label: "迟到必赔", icon: require("@/assets/images/迟到必赔.png") },
    { id: "redo", label: "不满意重做", icon: require("@/assets/images/不满意重做.png") },
    { id: "24h", label: "7×24小时服务", icon: require("@/assets/images/7_24小时服务.png") },
    { id: "all-guarantee", label: "全场保障", icon: require("@/assets/images/全场保障.png") },
] as const;

type PromoItem = {
    id: string;
    name: string;
    tag: string;
    price: number;
    image: number;
};

const PROMOS: readonly PromoItem[] = [
    { id: "promo-1", name: "丛师傅", tag: "家具养护", price: 100, image: require("@/assets/images/promo-1.png") },
    { id: "promo-2", name: "魏师傅", tag: "家庭保洁", price: 100, image: require("@/assets/images/promo-2.png") },
    { id: "promo-3", name: "安师傅", tag: "上门美业", price: 100, image: require("@/assets/images/promo-3.png") },
] as const;

type ProviderCardData = {
    id: string;
    name: string;
    years: string;
    tag: string;
    price: number;
    distance: string;
    address: string;
    scheduleLine1: string;
    scheduleLine2: string;
    image: number;
};

const PROVIDERS: readonly ProviderCardData[] = [
    {
        id: "p1",
        name: "魏师傅·",
        years: "2年经验",
        tag: "家具养护",
        price: 100,
        distance: "24m",
        address: "兴雨科技大楼210",
        scheduleLine1: "周一、周二、周三、周四、周五、周六、周日",
        scheduleLine2: "08:00-18:00",
        image: require("@/assets/images/promo-2.png"),
    },
    {
        id: "p2",
        name: "魏师傅·",
        years: "2年经验",
        tag: "家具养护",
        price: 100,
        distance: "24m",
        address: "兴雨科技大楼210",
        scheduleLine1: "周一、周二、周三、周四、周五、周六、周日",
        scheduleLine2: "08:00-18:00",
        image: require("@/assets/images/promo-2.png"),
    },
    {
        id: "p3",
        name: "魏师傅·",
        years: "2年经验",
        tag: "家具养护",
        price: 100,
        distance: "24m",
        address: "兴雨科技大楼210",
        scheduleLine1: "周一、周二、周三、周四、周五、周六、周日",
        scheduleLine2: "08:00-18:00",
        image: require("@/assets/images/promo-2.png"),
    },
    {
        id: "p4",
        name: "魏师傅·",
        years: "2年经验",
        tag: "家具养护",
        price: 100,
        distance: "24m",
        address: "兴雨科技大楼210",
        scheduleLine1: "周一、周二、周三、周四、周五、周六、周日",
        scheduleLine2: "08:00-18:00",
        image: require("@/assets/images/promo-2.png"),
    },
] as const;

function PriceTag({ price }: { price: number }) {
    return (
        <View className="flex-row items-center">
            <Text className="text-xs text-destructive font-din-alt-bold">￥</Text>
            <Text className="text-lg text-destructive font-din-alt-bold">{price}</Text>
            <Text className="ml-0.5 text-xs text-foreground font-puhui-regular">起</Text>
        </View>
    );
}

function PromoCard({ item }: { item: PromoItem }) {
    return (
        <View className="h-[150px] w-[123px] overflow-hidden rounded-lg border border-border bg-card">
            <Image
                source={item.image}
                contentFit="cover"
                className="w-32 h-20"
            />
            <View className="px-2 pt-1.5">
                <Text className="text-sm text-foreground font-puhui-regular">{item.name}</Text>
                <View className="mt-2 flex-row items-center">
                    <View className="p-[2px] items-center justify-center rounded border border-primary">
                        <Text className="text-xs text-primary font-puhui-regular">{item.tag}</Text>
                    </View>
                </View>
                <View className="mt-2">
                    <PriceTag price={item.price} />
                </View>
            </View>
        </View>
    );
}

function ProviderCard({ item }: { item: ProviderCardData }) {
    return (
        <View className="h-[298px] w-[167px] overflow-hidden rounded-xl border border-border bg-card">
            <Image
                source={item.image}
                contentFit="cover"
                className="h-[170px] w-[167px]"
            />
            <View className="flex-1 px-2 pt-2">
                <View className="flex-row items-center justify-between gap-1">
                    <View className="flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-sm text-foreground font-puhui-regular">{item.name}</Text>
                            <Text className="ml-1 text-sm text-primary font-puhui-medium">{item.years}</Text>
                        </View>
                    </View>
                    <View className="p-[2px]  items-center justify-center rounded border border-primary">
                        <Text className="text-xs text-primary font-puhui-regular">{item.tag}</Text>
                    </View>
                </View>

                <View className="mt-2 flex-row items-center gap-1">
                    <Image
                        source={require("@/assets/images/定位-小.png")}
                        contentFit="contain"
                        className="h-3 w-3"
                    />
                    <Text className=" text-xs text-primary font-puhui-medium">{item.distance}</Text>
                    <Text className="text-xs text-muted-foreground font-puhui-regular"> · </Text>
                    <Text
                        className="flex-1 text-xs text-muted-foreground font-puhui-regular"
                        numberOfLines={1}
                    >
                        {item.address}
                    </Text>
                </View>

                <View className="mt-1.5 flex-row items-start">
                    <Image
                        source={require("@/assets/images/时间.png")}
                        contentFit="contain"
                        className="mt-0.5 h-3 w-3"
                    />
                    <View className="ml-1 flex-1">
                        <Text className="text-xs text-muted-foreground font-puhui-regular">
                            {item.scheduleLine1}
                        </Text>
                        <Text className="text-xs text-muted-foreground font-puhui-regular">
                            {item.scheduleLine2}
                        </Text>
                    </View>
                </View>

                <View className="mt-auto flex-row items-end justify-between pb-1.5">
                    <PriceTag price={item.price} />
                    <View className="h-5 w-16 items-center justify-center rounded-full bg-primary">
                        <Text className="text-xs text-primary-foreground font-puhui-medium">
                            立即预约
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}


function StatusBarBackground({ color }: { color: string }) {
    const insets = useSafeAreaInsets();

    if (Platform.OS === "web" || insets.top === 0) {
        return null;
    }

    return (
        <View
            pointerEvents="none"
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: insets.top,
                backgroundColor: color,
                zIndex: 1,
            }}
        />
    );
}

export default function HomeScreen() {
    const { colorScheme } = useColorScheme();

    const navTheme = NAV_THEME[colorScheme ?? "light"];
    const statusBarBackground = navTheme.colors.primary;

    return (
        <View className="flex-1 bg-background">
            <StatusBar style={colorScheme === "dark" ? "light" : "dark"} backgroundColor={statusBarBackground} />
            <StatusBarBackground color={statusBarBackground} />
            <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
                <View className="pb-6">
                    <View className="bg-primary">
                        <SafeAreaView edges={["top"]}>
                            <View className="bg-primary pb-2">
                                <View className="h-11 flex-row items-center">
                                    <Image
                                        source={require("@/assets/images/定位.png")}
                                        contentFit="contain"
                                        className="ml-4 h-4 w-4"
                                    />
                                    <View className="ml-1 flex-row items-center">
                                        <Text className="text-sm text-foreground font-puhui-medium">
                                            兴雨科技大楼
                                        </Text>
                                        <Image
                                            source={require("@/assets/images/箭头.png")}
                                            contentFit="contain"
                                            className="h-5 w-5"
                                        />
                                    </View>
                                </View>

                                <View className="mx-4 mt-3 h-10 w-[343px] flex-row items-center rounded-full bg-card">
                                    <Text className="ml-3 flex-1 text-sm text-muted-foreground font-puhui-regular">
                                        搜索你想要的服务
                                    </Text>
                                    <Button className="mr-0.5 h-9 w-[60px] items-center justify-center rounded-full bg-primary">
                                        <Text className="text-sm text-foreground font-puhui-regular">
                                            搜索
                                        </Text>
                                    </Button>
                                </View>
                            </View>
                        </SafeAreaView>
                    </View>

                    <View className="mx-4 mt-2 h-[81px] w-[343px] overflow-hidden rounded-xl shadow-lg">
                        <Image
                            source={require("@/assets/images/home-banner.png")}
                            contentFit="cover"
                            className="h-full w-full"
                        />
                    </View>

                    <View className="mx-4 mt-3 w-[343px] flex-row items-center justify-between">
                        {GUARANTEES.map((item) => (
                            <View key={item.id} className="flex-row items-center">
                                <Image source={item.icon} contentFit="contain" className="h-3 w-3" />
                                <Text className="ml-1 text-xs text-muted-foreground font-puhui-regular">
                                    {item.label}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View className="mx-[17px] mt-4 w-[341px] flex-row flex-wrap gap-6">
                        {CATEGORIES.map((item) => (
                            <View key={item.id} className="w-[49px] items-center">
                                <Image source={item.icon} contentFit="contain" className="h-[49px] w-[49px]" />
                                <Text className="mt-1 text-xs text-foreground font-puhui-regular" numberOfLines={1}>
                                    {item.label}
                                </Text>
                            </View>
                        ))}
                    </View>

                    <View className="mx-4 mt-5 h-[205px] rounded-xl bg-card shadow-lg">
                        <Text className="ml-3 mt-3 text-lg text-foreground font-puhui-medium">
                            特惠服务
                        </Text>
                        <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-2">
                            <View className="flex-row gap-3 px-3">
                                {PROMOS.map((item) => (
                                    <PromoCard key={item.id} item={item} />
                                ))}
                            </View>
                        </ScrollView>
                    </View>

                    <Text className="mx-4 mt-3 text-base text-foreground font-puhui-medium">
                        推荐
                    </Text>
                    <View className="mx-4 mt-2 w-[343px] flex-row flex-wrap gap-[9px]">
                        {PROVIDERS.map((item) => (
                            <ProviderCard key={item.id} item={item} />
                        ))}
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
