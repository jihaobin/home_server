import { Suspense, useCallback, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Switch } from "@repo/mobile-ui/components/ui/switch";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { cn } from "@repo/mobile-ui/lib/utils";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { LogoutButton } from "@repo/mobile-ui/components/LogoutButton";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useUserRealNameProfile } from "@repo/hooks/api/user";
import { useOrdersList } from "@repo/hooks/api/order";

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
    realName?: string;
    phoneNumber?: string;
    idCardNumber?: string;
    verified: boolean;
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

const maskIdCardNumber = (value?: string) => {
    if (!value) {
        return "未上传身份证";
    }

    if (value.length <= 8) {
        return `${value.slice(0, 2)}****${value.slice(-2)}`;
    }

    return `${value.slice(0, 3)}********${value.slice(-4)}`;
};

type OrderQuickActionCounts = Record<OrderQuickActionId, number>;

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

function UserInfoCard({
    info,
    isLoading,
    onOpenSettings,
}: {
    info: UserProfileSummary;
    isLoading: boolean;
    onOpenSettings: () => void;
}) {
    const { colorScheme, setColorScheme } = useColorScheme();
    const isDark = colorScheme === "dark";
    const maskedIdCard = maskIdCardNumber(info.idCardNumber);
    const phoneNumber = info.phoneNumber ?? "未绑定手机号";
    const realName = info.realName ?? "未完善";
    const indicatorColor = isDark ? "#94a3b8" : "#64748b";

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
                <View className="h-16 w-16 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                    <Icon as={lucideIconRegistry.User} size={32} className="text-primary" />
                </View>

                <View className="ml-4 flex-1">
                    <View className="flex-row items-center">
                        <Text className="text-lg font-semibold text-foreground" numberOfLines={1}>
                            {info.displayName}
                        </Text>
                        {isLoading ? (
                            <ActivityIndicator size="small" color={indicatorColor} style={{ marginLeft: 8 }} />
                        ) : (
                            <View
                                className={cn(
                                    "ml-2 rounded-full px-2 py-0.5",
                                    info.verified ? "bg-emerald-100" : "bg-amber-100",
                                )}
                            >
                                <Text
                                    className={cn(
                                        "text-[11px] font-medium",
                                        info.verified ? "text-emerald-700" : "text-amber-700",
                                    )}
                                >
                                    {info.verified ? "已实名" : "未实名"}
                                </Text>
                            </View>
                        )}
                    </View>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                        实名姓名：{realName}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                        身份证号：{maskedIdCard}
                    </Text>
                    <Text className="mt-1 text-sm text-muted-foreground" numberOfLines={1}>
                        绑定手机：{phoneNumber}
                    </Text>
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
}

function OrderQuickActionsCard({
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
}

function ServiceActionsCard({
    onOpenCart,
    onOpenHistory,
    onOpenFavorites,
}: {
    onOpenCart: () => void;
    onOpenHistory: () => void;
    onOpenFavorites: () => void;
}) {
    return (
        <View
            className="mx-4 mt-4 rounded-2xl border border-border bg-card p-4"
            style={{
                shadowColor: "rgba(15, 23, 42, 0.08)",
                shadowOffset: { width: 0, height: 4 },
                shadowOpacity: 0.12,
                shadowRadius: 10,
                elevation: 3,
            }}
        >
            <View className="mb-3">
                <Text className="text-base font-semibold text-foreground">
                    我的服务
                </Text>
            </View>

            <View className="flex-row items-center justify-around">
                <Pressable
                    className="items-center"
                    onPress={onOpenCart}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: true,
                    }}
                >
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                        <Icon as={lucideIconRegistry.ShoppingCart} size={24} className="text-primary" />
                    </View>
                    <Text className="mt-2 text-xs text-foreground">购物车</Text>
                </Pressable>

                <Pressable
                    className="items-center"
                    onPress={onOpenHistory}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: true,
                    }}
                >
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                        <Icon as={lucideIconRegistry.History} size={24} className="text-primary" />
                    </View>
                    <Text className="mt-2 text-xs text-foreground">浏览历史</Text>
                </Pressable>

                <Pressable
                    className="items-center"
                    onPress={onOpenFavorites}
                    android_ripple={{
                        color: "rgba(148, 163, 184, 0.16)",
                        borderless: true,
                    }}
                >
                    <View className="h-12 w-12 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
                        <Icon as={lucideIconRegistry.Star} size={24} className="text-primary" />
                    </View>
                    <Text className="mt-2 text-xs text-foreground">关注</Text>
                </Pressable>
            </View>
        </View>
    );
}

function MenuList({ items }: { items: MenuItem[] }) {
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
}

/**
 * 带 Suspense 的订单快捷操作卡片
 */
function OrderQuickActionsCardWithData({
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
}

/**
 * 订单快捷操作卡片骨架屏
 */
function OrderQuickActionsCardSkeleton() {
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
}

export default function Profile() {
    const { session } = useSession();
    const user = session?.user;
    const userId = user?.id;
    const router = useRouter();
    const [isRefreshing, setIsRefreshing] = useState(false);
    const queryClient = useQueryClient();

    const {
        data: userProfile,
        isLoading: isProfileLoading,
        isFetching: isProfileFetching,
        refetch: refetchUserProfile,
    } = useUserRealNameProfile(userId);

    const userInfo = useMemo<UserProfileSummary>(() => ({
        displayName: user?.name ?? "未命名用户",
        realName: userProfile?.realName ?? user?.name ?? undefined,
        phoneNumber: user?.phone ?? undefined,
        idCardNumber: userProfile?.idCardNumber,
        verified: Boolean(userProfile?.idCardNumber),
    }), [user, userProfile]);

    const navigateToOrderCenter = useCallback(
        (_target?: OrderQuickActionId) => {
            // TODO: 根据目标状态跳转并筛选订单
            router.push("/(tabs)/orders");
        },
        [router],
    );

    const handleViewAllOrders = useCallback(() => {
        navigateToOrderCenter();
    }, [navigateToOrderCenter]);

    const handleFeaturePlaceholder = useCallback((feature: string) => {
        // TODO: 替换为 `${feature}` 功能的实际实现
        console.log(`[Profile] ${feature} 功能待实现`);
    }, []);

    const handleOpenProfileSettings = useCallback(() => {
        handleFeaturePlaceholder("个人资料设置");
    }, [handleFeaturePlaceholder]);

    const handleOpenShoppingCart = useCallback(() => {
        handleFeaturePlaceholder("购物车");
    }, [handleFeaturePlaceholder]);

    const handleOpenBrowsingHistory = useCallback(() => {
        handleFeaturePlaceholder("浏览历史");
    }, [handleFeaturePlaceholder]);

    const handleOpenFavorites = useCallback(() => {
        handleFeaturePlaceholder("关注");
    }, [handleFeaturePlaceholder]);

    const menuItems = useMemo<MenuItem[]>(() => {
        return MENU_CONFIG.map((item) => ({
            ...item,
            onPress: () => handleFeaturePlaceholder(item.label),
        }));
    }, [handleFeaturePlaceholder]);

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            await Promise.all([
                refetchUserProfile({ throwOnError: false }),
                queryClient.invalidateQueries({ queryKey: ["orders-list"] }),
                queryClient.invalidateQueries({ queryKey: ["orders-list-infinite"] }),
            ]);
        } finally {
            setIsRefreshing(false);
        }
    }, [queryClient, refetchUserProfile]);

    const isRefreshingState = isRefreshing || isProfileFetching;

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
                        isLoading={isProfileLoading || isProfileFetching}
                        onOpenSettings={handleOpenProfileSettings}
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
                    <ServiceActionsCard
                        onOpenCart={handleOpenShoppingCart}
                        onOpenHistory={handleOpenBrowsingHistory}
                        onOpenFavorites={handleOpenFavorites}
                    />
                    <MenuList items={menuItems} />
                </ScrollView>
            </SafeAreaView>
        </RequireAuth>
    );
}
