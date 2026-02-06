import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    ScrollView,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import Constants from "expo-constants";
import * as ImagePicker from "expo-image-picker";
import { useColorScheme } from "nativewind";

import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import {
    Avatar,
    AvatarFallback,
    AvatarImage,
} from "@repo/mobile-ui/components/ui/avatar";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useAppUpdate } from "@repo/mobile-ui/app-update/AppUpdateProvider";
import { useFile, useUploadFile } from "@repo/hooks/api/files";
import { authClient } from "@repo/lib/auth-client";
import type { OrderCardsTab } from "@repo/types";

type OrderQuickAction = {
    id: "unpaid" | "pending" | "verifying" | "review";
    label: string;
    icon: keyof typeof lucideIconRegistry;
};

type MenuItem = {
    id: "complaint" | "address" | "customer-service" | "check-update";
    label: string;
    icon: keyof typeof lucideIconRegistry;
    badge?: string;
};

const ORDER_TAB_MAP: Record<OrderQuickAction["id"], OrderCardsTab> = {
    unpaid: "pending_payment",
    pending: "paid",
    verifying: "in_progress",
    review: "needs_review",
};

const maskPhone = (value: string | null | undefined) => {
    if (!value) {
        return "";
    }
    const digits = value.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        return `${digits.slice(0, 3)}****${digits.slice(7)}`;
    }
    return "";
};

function ModeSwitch({ checked }: { checked: boolean }) {
    return (
        <View className="h-8 w-8 items-center justify-center">
            {/* Figma: 灰轨道 + 白色滑块；用内联 transform 做状态切换，避免动态拼接 className。 */}
            <View className="h-5 w-9 flex-row items-center rounded-full bg-neutral-500 px-0.5">
                <View
                    className="h-4 w-4 rounded-full bg-white"
                    style={{ transform: [{ translateX: checked ? 16 : 0 }] }}
                />
            </View>
        </View>
    );
}

export default function Profile() {
    const router = useRouter();
    const { session, refetch: refetchSession } = useSession();
    const { colorScheme, setColorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const { checkForUpdate, status: updateStatus } = useAppUpdate();

    const user = session?.user;

    // avatarFileHash 存储 fileHash（用于 /files/{fileHash} 换取可访问 URL）
    const [avatarFileHash, setAvatarFileHash] = useState<string | null>(
        (user?.image as string) || null,
    );

    useEffect(() => {
        if (user?.image !== undefined) {
            setAvatarFileHash((user.image as string) || null);
        }
    }, [user?.image]);

    const uploadFile = useUploadFile();
    const { data: avatarFileData } = useFile(avatarFileHash);
    const avatarUrl = avatarFileData?.fileUrl || null;

    const displayName = useMemo(() => user?.name ?? "未命名用户", [user?.name]);
    const phoneMasked = useMemo(() => {
        const raw =
            (typeof user?.phone === "string" ? user.phone : null) ||
            (typeof user?.phoneNumber === "string" ? user.phoneNumber : null) ||
            (typeof user?.mobile === "string" ? user.mobile : null) ||
            null;
        return maskPhone(raw);
    }, [user?.mobile, user?.phone, user?.phoneNumber]);

    const versionLabel = useMemo(() => {
        const version = Constants.expoConfig?.version;
        return version ? `v${version}` : undefined;
    }, []);

    const orderQuickActions = useMemo<readonly OrderQuickAction[]>(
        () => [
            { id: "unpaid", label: "待付款", icon: "Wallet" },
            { id: "pending", label: "待服务", icon: "Clock" },
            { id: "verifying", label: "待验收", icon: "ClipboardCheck" },
            { id: "review", label: "待评价", icon: "MessageSquare" },
        ],
        [],
    );

    const menuItems = useMemo<readonly MenuItem[]>(
        () => [
            {
                id: "complaint",
                label: "投诉/售后",
                icon: "MessageCircle",
            },
            { id: "address", label: "服务地址", icon: "MapPin" },
            { id: "customer-service", label: "官方客服", icon: "Headphones" },
            {
                id: "check-update",
                label: "检查更新",
                icon: "CloudDownload",
                badge: updateStatus === "checking" ? "检查中..." : versionLabel,
            },
        ],
        [updateStatus, versionLabel],
    );

    const navigateToOrders = useCallback(
        (tab: OrderCardsTab) => {
            router.push({
                pathname: "/(tabs)/orders",
                params: {
                    tab,
                    requestId: Date.now().toString(),
                },
            });
        },
        [router],
    );

    const handlePickAvatar = useCallback(async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsEditing: true,
            aspect: [1, 1],
            quality: 1,
        });

        if (result.canceled || !result.assets?.length) {
            return;
        }

        const asset = result.assets[0];
        const file = {
            uri: asset.uri,
            name: asset.fileName || `avatar_${Date.now()}.jpg`,
            type: asset.mimeType || "image/jpeg",
        };

        const uploadResult = await uploadFile.mutateAsync({
            file,
            fileType: "avatar",
        });

        // fileUrl 实际是 fileHash（用于 /files/{fileHash} 获取可访问 URL）
        setAvatarFileHash(uploadResult.fileUrl);

        const updateResult = await authClient.updateUser({
            image: uploadResult.fileUrl,
        });

        if (updateResult.error) {
            console.error("[Profile] 更新用户头像失败:", updateResult.error);
            setAvatarFileHash((user?.image as string) || null);
        }
    }, [uploadFile, user?.image]);

    const handleLogout = useCallback(() => {
        Alert.alert("确认退出", "您确定要退出登录吗？", [
            { text: "取消", style: "cancel" },
            {
                text: "退出",
                style: "destructive",
                onPress: async () => {
                    try {
                        const { error } = await authClient.signOut();
                        if (error) {
                            Alert.alert(
                                "退出登录失败",
                                error.message || "退出时发生错误",
                            );
                            return;
                        }
                        refetchSession();
                        router.replace("/(tabs)");
                    } catch {
                        Alert.alert("错误", "退出登录失败，请重试");
                    }
                },
            },
        ]);
    }, [refetchSession, router]);

    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{ paddingBottom: 32 }}
                >
                    {/* Header (Figma: 179px) */}
                    <View className="relative h-[179px] bg-primary">
                        <SafeAreaView edges={["top"]} className="flex-1">
                            <View className="px-4 pt-8">
                                <View className="flex-row items-center">
                                    <Pressable
                                        onPress={() => {
                                            void handlePickAvatar();
                                        }}
                                        disabled={uploadFile.isPending}
                                        style={
                                            uploadFile.isPending
                                                ? { opacity: 0.6 }
                                                : undefined
                                        }
                                    >
                                        <Avatar
                                            alt="avatar"
                                            className="h-[60px] w-[60px]"
                                        >
                                            <AvatarImage
                                                source={
                                                    avatarUrl
                                                        ? { uri: avatarUrl }
                                                        : require("@/assets/images/promo-1.png")
                                                }
                                            />
                                            <AvatarFallback>
                                                <Text className="text-sm font-puhui-medium text-foreground">
                                                    用
                                                </Text>
                                            </AvatarFallback>
                                        </Avatar>
                                        {uploadFile.isPending ? (
                                            <View className="absolute inset-0 items-center justify-center">
                                                <ActivityIndicator size="small" />
                                            </View>
                                        ) : null}
                                    </Pressable>

                                    <View className="ml-4">
                                        <Text className="text-base font-puhui-medium text-foreground">
                                            {displayName}
                                        </Text>
                                        <Text className="mt-2 text-xs font-puhui-regular text-zinc-500">
                                            {phoneMasked}
                                        </Text>
                                    </View>
                                </View>
                            </View>
                        </SafeAreaView>

                        {/* Mode row (Figma: y=156, h=44, w=343) */}
                        <Pressable
                            className="absolute left-4 right-4 top-[156px] h-11 flex-row items-center rounded-lg bg-neutral-800 px-3"
                            onPress={() => {
                                setColorScheme(isDark ? "light" : "dark");
                            }}
                        >
                            <Text className="text-base font-puhui-regular text-amber-300">
                                {isDark ? "深色模式" : "浅色模式"}
                            </Text>
                            <View className="ml-auto">
                                <ModeSwitch checked={!isDark} />
                            </View>
                        </Pressable>
                    </View>

                    {/* Orders card (Figma: y=212, h=127, w=343) */}
                    <View
                        className="mx-4 mt-[33px] h-[127px] rounded-lg bg-card"
                        style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.04,
                            shadowRadius: 4,
                            elevation: 1,
                        }}
                    >
                        <View className="px-3 pt-3">
                            <View className="flex-row items-center justify-between">
                                <View className="flex-row items-center">
                                    <View className="h-[18px] w-[2px] bg-amber-700" />
                                    <Text className="ml-2 text-base font-puhui-medium text-foreground">
                                        我的订单
                                    </Text>
                                </View>
                                <Pressable
                                    className="flex-row items-center"
                                    onPress={() => {
                                        navigateToOrders("all");
                                    }}
                                >
                                    <Text className="text-xs font-puhui-regular text-zinc-500">
                                        查看全部
                                    </Text>
                                    <Icon
                                        as={lucideIconRegistry.ChevronRight}
                                        size={14}
                                        className="ml-1 text-zinc-500"
                                    />
                                </Pressable>
                            </View>
                        </View>

                        <View className="mt-3 flex-row items-start justify-between px-[19px]">
                            {orderQuickActions.map((action) => (
                                <Pressable
                                    key={action.id}
                                    className="items-center"
                                    onPress={() => {
                                        navigateToOrders(
                                            ORDER_TAB_MAP[action.id],
                                        );
                                    }}
                                >
                                    <View className="h-11 w-11 items-center justify-center">
                                        <Icon
                                            as={lucideIconRegistry[action.icon]}
                                            size={28}
                                            className="text-primary"
                                        />
                                    </View>
                                    <Text className="mt-1 text-xs font-puhui-regular text-foreground">
                                        {action.label}
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    {/* Menu + logout card (Figma: y=351, h=280, w=343) */}
                    <View
                        className="relative mx-4 mt-3 h-[280px] rounded-lg bg-card"
                        style={{
                            shadowColor: "#000",
                            shadowOffset: { width: 0, height: 1 },
                            shadowOpacity: 0.04,
                            shadowRadius: 4,
                            elevation: 1,
                        }}
                    >
                        <View className="pt-4">
                            {menuItems.map((item) => (
                                <Pressable
                                    key={item.id}
                                    className="h-[52px] flex-row items-center px-3"
                                    onPress={() => {
                                        if (item.id === "address") {
                                            router.push(
                                                "/address/service-address",
                                            );
                                            return;
                                        }
                                        if (item.id === "check-update") {
                                            void checkForUpdate({
                                                manual: true,
                                                force: true,
                                            });
                                        }
                                    }}
                                >
                                    <View className="h-10 w-10 items-center justify-center">
                                        <Icon
                                            as={lucideIconRegistry[item.icon]}
                                            size={22}
                                            className="text-muted-foreground"
                                        />
                                    </View>
                                    <Text className="ml-3 text-xs font-puhui-regular text-foreground">
                                        {item.label}
                                    </Text>

                                    <View className="ml-auto flex-row items-center">
                                        {item.badge ? (
                                            <Text className="mr-2 text-xs font-puhui-regular text-zinc-500">
                                                {item.badge}
                                            </Text>
                                        ) : null}
                                        <Icon
                                            as={lucideIconRegistry.ChevronRight}
                                            size={16}
                                            className="text-muted-foreground"
                                        />
                                    </View>
                                </Pressable>
                            ))}
                        </View>

                        <Pressable
                            className="absolute left-3 right-3 bottom-4 h-10 items-center justify-center rounded-full bg-primary"
                            onPress={handleLogout}
                        >
                            <Text className="text-sm font-puhui-regular text-primary-foreground">
                                退出登录
                            </Text>
                        </Pressable>
                    </View>
                </ScrollView>
            </View>
        </RequireAuth>
    );
}
