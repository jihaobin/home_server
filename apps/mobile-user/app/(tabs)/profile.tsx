import { Suspense, useCallback, useEffect, useMemo, useState, memo } from "react";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Switch } from "@repo/mobile-ui/components/ui/switch";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { ImageUploader } from "@/components/image-uploader";
import { cn } from "@repo/mobile-ui/lib/utils";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { LogoutButton } from "@repo/mobile-ui/components/LogoutButton";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useOrdersList } from "@repo/hooks/api/order";
import { useFile, useUploadFile, useUserFiles } from "@repo/hooks/api/files";
import { authClient } from "@repo/lib/auth-client";
import type { OrderStatus } from "@repo/types";
import type { OrderTabId } from "@/components/orders_screen/types";

type OrderQuickActionId = "unpaid" | "pending" | "verifying";

type OrderQuickAction = {
    id: OrderQuickActionId;
    label: string;
    icon: keyof typeof lucideIconRegistry;
    count?: number;
    onPress?: () => void;
};

type MenuItem = {
    id: string;
    label: string;
    icon: keyof typeof lucideIconRegistry;
    badge?: string;
    onPress?: () => void;
};

type UserProfileSummary = {
    displayName: string;
};

const ORDER_QUICK_ACTION_CONFIG: ReadonlyArray<
    Omit<OrderQuickAction, "count" | "onPress">
> = [
        { id: "unpaid", label: "待付款", icon: "Wallet" },
        { id: "pending", label: "待服务", icon: "Clock" },
        { id: "verifying", label: "待验收", icon: "ClipboardCheck" },
    ];

const MENU_CONFIG: ReadonlyArray<Omit<MenuItem, "onPress">> = [
    { id: "complaint", label: "投诉/售后", icon: "MessageCircle" },
    { id: "address", label: "服务地址", icon: "MapPin" },
    { id: "customer-service", label: "官方客服", icon: "Headphones" },
];

type OrderQuickActionCounts = Record<OrderQuickActionId, number>;

const QUICK_ACTION_TARGET_TAB_MAP: Record<OrderQuickActionId, OrderTabId> = {
    unpaid: "pending",
    pending: "paid",
    verifying: "paid",
};

const QUICK_ACTION_TARGET_STATUS_MAP: Record<OrderQuickActionId, OrderStatus> = {
    unpaid: "pending_payment",
    pending: "paid",
    verifying: "in_progress",
};

/**
 * 使用 Suspense 的订单统计组件
 * 分别查询各个状态的订单数量
 */
function OrderCountsFetcher({ userId }: { userId: string }) {
    // 查询待付款订单
    const { data: unpaidOrders } = useOrdersList({
        customerId: userId,
        status: "pending_payment",
        page: 1,
        limit: 1, // 只需要获取总数,不需要列表数据
        sortOrder: "desc",
    });

    // 查询待服务订单
    const { data: pendingOrders } = useOrdersList({
        customerId: userId,
        status: "paid",
        page: 1,
        limit: 1,
        sortOrder: "desc",
    });

    // 查询待验收订单
    const { data: verifyingOrders } = useOrdersList({
        customerId: userId,
        status: "in_progress",
        page: 1,
        limit: 1,
        sortOrder: "desc",
    });

    const counts: OrderQuickActionCounts = {
        unpaid: unpaidOrders.meta.total,
        pending: pendingOrders.meta.total,
        verifying: verifyingOrders.meta.total,
    };

    return counts;
}

const UserInfoCard = memo(function UserInfoCard({
    info,
    isLoading,
    avatarUrl,
    onAvatarChange,
}: {
    info: UserProfileSummary;
    isLoading: boolean;
    avatarUrl?: string | null;
    onAvatarChange?: (fileIdentifier: string, fileUrl: string) => void;
}) {
    const { colorScheme, setColorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const indicatorColor = isDark ? "#94a3b8" : "#64748b";

    const uploadFile = useUploadFile();

    const handleAvatarUpload = useCallback(
        async (file: { uri: string; name: string; type: string }) => {
            // 上传文件到后端
            const result = await uploadFile.mutateAsync({
                file,
                fileType: "avatar",
            });

            // result.fileUrl 实际是 fileHash，可以用于访问文件
            // 返回格式：{ fileIdentifier: id, fileUrl: fileHash }
            // fileHash 可以通过 GET /files/{fileHash} 获取实际的图片URL
            return {
                fileIdentifier: result.id,
                fileUrl: result.fileUrl, // 这是 fileHash
            };
        },
        [uploadFile]
    );

    return (
        <View
            className="mx-4 rounded-2xl border border-border bg-card p-4"
            style={{
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
        >
            <View className="flex-row items-center">
                <ImageUploader
                    value={avatarUrl}
                    onUpload={handleAvatarUpload}
                    onUploadSuccess={onAvatarChange}
                    size={64}
                    circular
                    maxWidth={512}
                    maxHeight={512}
                    maxFileSize={1024 * 1024}
                    compressQuality={0.8}
                    className="shadow-sm"
                />

                <View className="ml-4 flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                            {info.displayName}
                        </Text>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={indicatorColor} style={{ marginLeft: 8 }} />
                        ) : null}
                    </View>
                </View>
                {/*
                <Pressable
                    className="h-10 w-10 items-center justify-center rounded-full bg-muted/60 dark:bg-muted/40"
                    onPress={onOpenSettings}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: true,
                    }}
                >
                    <Icon
                        as={lucideIconRegistry.Settings}
                        size={20}
                        className="text-muted-foreground"
                    />
                </Pressable> */}
            </View>

            <View className="mt-4 flex-row items-center justify-between rounded-xl bg-muted/40 px-4 py-3">
                <View className="flex-row items-center">
                    <Icon as={lucideIconRegistry[isDark ? "Moon" : "Sun"]} size={20} className="text-foreground" />
                    <Text className="ml-3 text-sm font-medium text-foreground">
                        {isDark ? "深色模式" : "浅色模式"}
                    </Text>
                </View>
                <Switch
                    checked={isDark}
                    onCheckedChange={(checked) => {
                        setColorScheme(checked ? "dark" : "light");
                    }}
                />
            </View>
        </View>
    );
});

const OrderQuickActionsCard = memo(function OrderQuickActionsCard({
    actions,
    onViewAll,
}: {
    actions: OrderQuickAction[];
    onViewAll: () => void;
}) {
    return (
        <View
            className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4"
            style={{
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
        >
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-semibold text-foreground">
                    我的订单
                </Text>
                <Pressable
                    className="flex-row items-center"
                    onPress={onViewAll}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: true,
                    }}
                >
                    <Text className="text-sm text-muted-foreground">全部</Text>
                    <Icon as={lucideIconRegistry.ChevronRight} size={16} className="ml-1 text-muted-foreground" />
                </Pressable>
            </View>

            <View className="flex-row items-center justify-between">
                {actions.map((action) => (
                    <Pressable
                        key={action.id}
                        className="flex-1 items-center"
                        onPress={action.onPress}
                        android_ripple={{
                            color: "rgba(148, 163, 184, 0.16)",
                            borderless: true,
                        }}
                    >
                        <View className="relative h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                            <Icon as={lucideIconRegistry[action.icon]} size={24} className="text-primary" />
                            {action.count !== undefined && action.count > 0 ? (
                                <View className="absolute -right-1 -top-1 h-5 min-w-[20px] items-center justify-center rounded-full bg-destructive px-1">
                                    <Text className="text-[10px] font-semibold text-white">
                                        {action.count > 99 ? "99+" : action.count}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                        <Text className="mt-2 text-xs text-foreground">{action.label}</Text>
                    </Pressable>
                ))}
            </View>
        </View>
    );
});


const MenuList = memo(function MenuList({ items }: { items: MenuItem[] }) {
    return (
        <View
            className="mx-4 mt-3 rounded-2xl border border-border bg-card"
            style={{
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
        >
            {items.map((item, index) => (
                <Pressable
                    key={item.id}
                    className={cn(
                        "flex-row items-center justify-between px-4 py-4",
                        index !== items.length - 1 ? "border-b border-border" : undefined,
                    )}
                    onPress={item.onPress}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: false,
                    }}
                >
                    <View className="flex-row items-center">
                        <View className="h-9 w-9 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                            <Icon as={lucideIconRegistry[item.icon]} size={20} className="text-primary" />
                        </View>
                        <Text className="ml-3 text-sm font-medium text-foreground">
                            {item.label}
                        </Text>
                    </View>
                    <Icon as={lucideIconRegistry.ChevronRight} size={20} className="text-muted-foreground" />
                </Pressable>
            ))}

            <View className="px-4 py-3">
                <LogoutButton variant="destructive" size="default" className="w-full" />
            </View>
        </View>
    );
});

/**
 * 带 Suspense 的订单快捷操作卡片
 */
const OrderQuickActionsCardWithData = memo(function OrderQuickActionsCardWithData({
    userId,
    onViewAll,
    navigateToOrderCenter,
}: {
    userId: string;
    onViewAll: () => void;
    navigateToOrderCenter: (target?: OrderQuickActionId) => void;
}) {
    const orderCounts = OrderCountsFetcher({ userId });

    const orderQuickActions = useMemo<OrderQuickAction[]>(() => {
        return ORDER_QUICK_ACTION_CONFIG.map((config) => ({
            ...config,
            count: orderCounts[config.id] ?? 0,
            onPress: () => navigateToOrderCenter(config.id),
        }));
    }, [navigateToOrderCenter, orderCounts]);

    return <OrderQuickActionsCard actions={orderQuickActions} onViewAll={onViewAll} />;
});

/**
 * 订单快捷操作卡片骨架屏
 */
const OrderQuickActionsCardSkeleton = memo(function OrderQuickActionsCardSkeleton() {
    return (
        <View
            className="mx-4 mt-3 rounded-2xl border border-border bg-card p-4"
            style={{
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
        >
            <View className="mb-3 flex-row items-center justify-between">
                <Skeleton className="h-5 w-20" />
                <Skeleton className="h-4 w-12" />
            </View>

            <View className="flex-row items-center justify-between">
                {[1, 2, 3].map((i) => (
                    <View key={i} className="flex-1 items-center">
                        <Skeleton className="h-12 w-12 rounded-full" />
                        <Skeleton className="mt-2 h-3 w-12" />
                    </View>
                ))}
            </View>
        </View>
    );
});

export default function Profile() {
    const { session, refetch: refetchSession } = useSession();

    const user = session?.user;
    const userId = user?.id;
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);
    // avatarFileHash 存储 fileHash，用于获取实际图片 URL
    const [avatarFileHash, setAvatarFileHash] = useState<string | null>(user?.image || null);

    // 同步 session 中的头像变化到本地状态（仅在 user.image 变化时更新）
    // 注意：只依赖 user?.image，避免 avatarFileHash 变化时触发回滚
    useEffect(() => {
        // 只有当 session 的 image 有值，且与当前本地状态不同时才更新
        // 这样可以在应用重启时同步 session 数据，但不会干扰手动上传的过程
        if (user?.image !== undefined) {
            setAvatarFileHash(user.image);
        }
    }, [user?.image]);

    // 通过 fileHash 获取实际的图片 URL
    const { data: avatarFileData } = useFile(avatarFileHash);
    const avatarUrl = avatarFileData?.fileUrl || null;

    const userInfo = useMemo<UserProfileSummary>(() => ({
        displayName: user?.name ?? "未命名用户",
    }), [user]);

    const navigateToOrderCenter = useCallback(
        (target?: OrderQuickActionId) => {
            if (!target) {
                router.push("/(tabs)/orders");
                return;
            }

            const tab = QUICK_ACTION_TARGET_TAB_MAP[target];
            const status = QUICK_ACTION_TARGET_STATUS_MAP[target];

            router.push({
                pathname: "/(tabs)/orders",
                params: {
                    tab,
                    status,
                    requestId: Date.now().toString(),
                },
            });
        },
        [router],
    );

    const handleViewAllOrders = useCallback(() => {
        navigateToOrderCenter();
    }, [navigateToOrderCenter]);

    const handleFeaturePlaceholder = useCallback((feature: string) => {
        if (feature === "服务地址") {
            router.push("/address/service-address");
        }
    }, [router]);

    const handleAvatarChange = useCallback(
        async (fileIdentifier: string, fileUrl: string) => {

            try {
                // fileUrl 实际上是 fileHash，立即更新本地状态用于获取实际图片 URL
                setAvatarFileHash(fileUrl);

                // 调用 better-auth 的 updateUser API 更新用户头像
                // 注意：这里存储的是 fileHash，不是完整 URL
                const result = await authClient.updateUser({
                    image: fileUrl,
                });

                if (result.error) {
                    console.error("[Profile] 更新用户头像失败:", result.error);
                    // 如果更新失败，回滚本地状态
                    setAvatarFileHash(user?.image || null);
                    return;
                }

                // 注意：不立即刷新 session，避免触发全局 Suspense fallback
                // 本地状态已更新，UI 会立即反映变化
                // session 会在下次应用重启或需要时自动获取最新数据
            } catch (error) {
                console.error("[Profile] 更新用户头像异常:", error);
                // 回滚本地状态
                setAvatarFileHash(user?.image || null);
            }
        },
        [user?.image]
    );

    const menuItems = useMemo<MenuItem[]>(() => {
        return MENU_CONFIG.map((item) => ({
            ...item,
            onPress: () => handleFeaturePlaceholder(item.label),
        }));
    }, [handleFeaturePlaceholder]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await refetchSession();
        } finally {
            setIsRefreshing(false);
        }
    }, [refetchSession]);

    const isRefreshingState = isRefreshing;

    return (
        <RequireAuth>
            <SafeAreaView className="flex-1 bg-background">
                <ScrollView
                    showsVerticalScrollIndicator={false}
                    contentContainerStyle={{
                        paddingTop: 20,
                        paddingBottom: 32,
                    }}
                    refreshControl={
                        <RefreshControl
                            refreshing={isRefreshingState}
                            onRefresh={handleRefresh}
                        />
                    }
                >
                    <UserInfoCard
                        info={userInfo}
                        isLoading={isRefreshingState}
                        avatarUrl={avatarUrl}
                        onAvatarChange={handleAvatarChange}
                    />
                    {userId ? (
                        <Suspense fallback={<OrderQuickActionsCardSkeleton />}>
                            <OrderQuickActionsCardWithData
                                userId={userId}
                                onViewAll={handleViewAllOrders}
                                navigateToOrderCenter={navigateToOrderCenter}
                            />
                        </Suspense>
                    ) : (
                        <OrderQuickActionsCardSkeleton />
                    )}
                    <MenuList items={menuItems} />
                </ScrollView>
            </SafeAreaView>
        </RequireAuth>
    );
}
