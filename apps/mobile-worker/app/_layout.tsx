import "@repo/mobile-ui/styles/mobile-work.css";
import { ThemeProvider } from "@react-navigation/native";
import { useQueryClient } from "@tanstack/react-query";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-work-constants";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import * as Notifications from "expo-notifications";
import * as React from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "@repo/mobile-ui/components/provider";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { ensureWeChatAppRegistered } from "@repo/lib/pay";
import { toast } from "sonner-native";
import {
    useNotificationSocket,
    type NotificationSocketNotification,
} from "../hooks/use-notification-socket";
import { useChatSocket } from "../hooks/use-chat-socket";
import { useWechatAuthResultListener } from "../hooks/useWechatAuthResultListener";
import { useWechatMerchantTransferAutoTrigger } from "../hooks/useWechatMerchantTransferAutoTrigger";
import { useWechatMerchantTransferResultListener } from "../hooks/useWechatMerchantTransferResultListener";
import { authClient } from "../lib/auth";
import { AppUpdateProvider } from "@repo/mobile-ui/app-update/AppUpdateProvider";

import Push from "@tencentcloud/react-native-push";

if (Platform.OS !== "web") {
    Notifications.setNotificationHandler({
        handleNotification: async () => ({
            shouldShowAlert: true,
            shouldShowBanner: true,
            shouldShowList: true,
            shouldPlaySound: true,
            shouldSetBadge: false,
        }),
    });
}

const SDKAppID = Number(process.env.EXPO_PUBLIC_TENCENT_PUSH_SDK_APP_ID || 0); // 来自环境变量
const appKey = process.env.EXPO_PUBLIC_TENCENT_PUSH_APP_KEY; // 来自环境变量
const canInitPush =
    !!Push && Number.isFinite(SDKAppID) && SDKAppID > 0 && !!appKey;

type RegistrationListener = (registrationId: string) => void;
const registrationIdListeners = new Set<RegistrationListener>();
let latestRegistrationId: string | null = null;

function emitRegistrationId(registrationId: string) {
    latestRegistrationId = registrationId;
    registrationIdListeners.forEach((listener) => listener(registrationId));
}

function useRegistrationIdValue() {
    const [registrationId, setRegistrationId] = React.useState<string | null>(
        latestRegistrationId,
    );
    React.useEffect(() => {
        const listener: RegistrationListener = (value) => {
            setRegistrationId(value);
        };
        registrationIdListeners.add(listener);
        return () => {
            registrationIdListeners.delete(listener);
        };
    }, []);
    return registrationId;
}

export default function RootLayout() {
    const hasMounted = React.useRef(false);
    const { colorScheme } = useColorScheme();
    const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

    React.useEffect(() => {
        if (!canInitPush) {
            if (Push) {
                console.warn(
                    "[push] 缺少 EXPO_PUBLIC_TENCENT_PUSH_SDK_APP_ID 或 EXPO_PUBLIC_TENCENT_PUSH_APP_KEY，已跳过推送初始化",
                );
            }
            return;
        }

        let active = true;
        const handleNotificationClicked = (res: unknown) => {
            console.log("notification clicked", res);
        };
        const handleMessageReceived = (res: unknown) => {
            console.log("message received", res);
        };
        const handleMessageRevoked = (res: unknown) => {
            console.log("message revoked", res);
        };

        // 如果您需要与 Chat 的登录 userID 打通（即向此 userID 推送消息），请使用 setRegistrationID 接口
        // Push.setRegistrationID(userID, () => {
        // console.log('setRegistrationID ok', userID);
        // });

        Push.registerPush(
            SDKAppID,
            appKey,
            () => {
                Push.getRegistrationID((registrationID) => {
                    if (!active) {
                        return;
                    }
                    console.log("getRegistrationID ok", registrationID);
                    emitRegistrationId(registrationID);
                });
            },
            (errCode, errMsg) => {
                console.error("registerPush failed", errCode, errMsg);
            },
        );

        // 监听通知栏点击事件，获取推送扩展信息
        Push.addPushListener(
            Push.EVENT.NOTIFICATION_CLICKED,
            handleNotificationClicked,
        );

        // 监听在线推送
        Push.addPushListener(
            Push.EVENT.MESSAGE_RECEIVED,
            handleMessageReceived,
        );

        // 监听在线推送被撤回
        Push.addPushListener(Push.EVENT.MESSAGE_REVOKED, handleMessageRevoked);

        return () => {
            active = false;
            Push.removePushListener(
                Push.EVENT.NOTIFICATION_CLICKED,
                handleNotificationClicked,
            );
            Push.removePushListener(
                Push.EVENT.MESSAGE_RECEIVED,
                handleMessageReceived,
            );
            Push.removePushListener(
                Push.EVENT.MESSAGE_REVOKED,
                handleMessageRevoked,
            );
        };
    }, []);

    useIsomorphicLayoutEffect(() => {
        if (hasMounted.current) {
            return;
        }

        if (Platform.OS === "web") {
            // Adds the background color to the html element to prevent white background on overscroll.
            const doc = (globalThis as Record<string, unknown>).document as
                | {
                      documentElement?: {
                          classList?: { add: (value: string) => void };
                      };
                  }
                | undefined;
            doc?.documentElement?.classList?.add("bg-background");
        }
        setIsColorSchemeLoaded(true);
        hasMounted.current = true;
    }, []);

    if (!isColorSchemeLoaded) {
        return null;
    }

    return (
        <GestureHandlerRootView style={{ flex: 1 }}>
            <Provider authClient={authClient}>
                <AppUpdateProvider app="mobile-worker">
                    <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                        <StatusBar
                            style={colorScheme === "dark" ? "light" : "dark"}
                        />
                        <RootNavigation />
                        <PortalHost />
                    </ThemeProvider>
                </AppUpdateProvider>
            </Provider>
        </GestureHandlerRootView>
    );
}

function RootNavigation() {
    const { colorScheme } = useColorScheme();
    const { session } = useSession();
    const isAuthenticated = !!session?.user?.id;

    useWechatAuthResultListener();
    const { triggerTransferConfirm, processTransferStatusSync } =
        useWechatMerchantTransferAutoTrigger(isAuthenticated);
    useWechatMerchantTransferResultListener({
        onResultReceived: processTransferStatusSync,
    });

    React.useEffect(() => {
        const appId =
            process.env.EXPO_PUBLIC_WECHAT_WORKER_APP_ID?.trim() ||
            process.env.EXPO_PUBLIC_WECHAT_APP_ID?.trim();
        const universalLink =
            process.env.EXPO_PUBLIC_WECHAT_WORKER_UNIVERSAL_LINK?.trim() ||
            process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK?.trim();

        if (!appId) {
            return;
        }

        void ensureWeChatAppRegistered({
            appId,
            universalLink: universalLink ?? "",
        }).catch((error) => {
            const message =
                error instanceof Error ? error.message : "微信 SDK 初始化失败";
            console.warn(message);
        });
    }, []);

    return (
        <>
            {isAuthenticated ? (
                <NotificationSocketBridge
                    enabled={isAuthenticated}
                    onWechatWithdrawalWaitUserConfirm={triggerTransferConfirm}
                />
            ) : null}
            {isAuthenticated ? (
                <ChatSocketBridge enabled={isAuthenticated} />
            ) : null}
            <Stack
                screenOptions={{
                    header: () => null,
                    headerShown: false,
                    headerBackTitle: "返回",
                    headerStyle: {
                        backgroundColor:
                            NAV_THEME[colorScheme ?? "light"].colors.card,
                    },
                    headerTintColor:
                        NAV_THEME[colorScheme ?? "light"].colors.primary,
                    headerTitleStyle: {
                        color: NAV_THEME[colorScheme ?? "light"].colors.text,
                    },
                }}
            >
                <Stack.Protected guard={isAuthenticated}>
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="orders/[id]"
                        options={{
                            title: "订单详情",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="earnings/withdraw"
                        options={{
                            title: "提现申请",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="profile/edit"
                        options={{
                            title: "个人信息",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="profile/service-settings"
                        options={{
                            title: "服务设置",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="profile/service-area"
                        options={{
                            title: "服务区域",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="profile/account-binding"
                        options={{
                            title: "账号绑定",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="profile/settings"
                        options={{
                            title: "系统设置",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="scan/index"
                        options={{
                            title: "扫码核验",
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="verification/id-card"
                        options={{
                            title: "实名认证",
                            headerShown: false,
                        }}
                    />
                </Stack.Protected>

                <Stack.Protected guard={!isAuthenticated}>
                    <Stack.Screen
                        name="auth/login"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="auth/verify"
                        options={{
                            headerShown: false,
                        }}
                    />
                </Stack.Protected>
            </Stack>
        </>
    );
}

function ChatSocketBridge({ enabled }: { enabled: boolean }) {
    const { lastError } = useChatSocket({ enabled });

    React.useEffect(() => {
        if (!enabled || !lastError) {
            return;
        }
        toast.error(`聊天连接异常：${lastError}`);
    }, [enabled, lastError]);

    return null;
}

function NotificationSocketBridge({
    enabled,
    onWechatWithdrawalWaitUserConfirm,
}: {
    enabled: boolean;
    onWechatWithdrawalWaitUserConfirm?: (
        withdrawalId?: string | null,
    ) => Promise<boolean>;
}) {
    const queryClient = useQueryClient();
    useNotificationPermission(enabled);
    const registrationId = useRegistrationIdValue();

    const invalidateOrders = React.useCallback(
        async (orderId?: string) => {
            await queryClient.invalidateQueries({
                queryKey: ["staff-orders-list"],
            });
            if (orderId) {
                await queryClient.invalidateQueries({
                    queryKey: ["order-detail", orderId],
                });
            }
        },
        [queryClient],
    );

    const invalidateEarnings = React.useCallback(async () => {
        await Promise.allSettled([
            queryClient.invalidateQueries({
                queryKey: ["worker-earnings-records"],
            }),
            queryClient.invalidateQueries({ queryKey: ["earnings-overview"] }),
        ]);
    }, [queryClient]);

    const buildNotificationContent = React.useCallback(
        (payload: NotificationSocketNotification["payload"]) => {
            if (payload.event === "withdrawal_wechat_wait_user_confirm") {
                return {
                    title: payload.title ?? "微信提现待确认",
                    body:
                        payload.message ??
                        "您的提现审核已通过，请打开 App 在微信中确认收款",
                };
            }

            const orderLabel =
                payload.serviceName ??
                (payload.orderId ? `订单 ${payload.orderId}` : "订单");
            switch (payload.event) {
                case "order_pending_acceptance_assigned":
                    return {
                        title: "新订单待接单",
                        body:
                            payload.message ??
                            `${orderLabel} 待接单，请尽快处理`,
                    };
                case "order_cancelled":
                    return {
                        title: "订单已取消",
                        body: payload.message ?? "订单已被取消，请查看原因",
                    };
                case "order_payment_expired":
                    return {
                        title: "订单支付超时",
                        body: payload.message ?? "客户支付超时，订单自动取消",
                    };
                case "order_pending_acceptance_warning":
                    return {
                        title: "接单提醒",
                        body:
                            payload.message ??
                            `${orderLabel} 即将超时，请尽快操作`,
                    };
                case "order_service_eta_warning":
                    return {
                        title: "上门提醒",
                        body:
                            payload.message ??
                            `${orderLabel} 即将开始，请不要迟到`,
                    };
                default:
                    return {
                        title: payload.title ?? "订单提醒",
                        body:
                            payload.message ??
                            "您有新的订单消息，请打开应用查看",
                    };
            }
        },
        [],
    );

    const presentNativeNotification = React.useCallback(
        async (payload: NotificationSocketNotification["payload"]) => {
            if (Platform.OS === "web") {
                return;
            }
            try {
                const content = buildNotificationContent(payload);
                await Notifications.scheduleNotificationAsync({
                    content: {
                        ...content,
                        data: {
                            orderId: payload.orderId,
                            withdrawalId: payload.withdrawalId,
                            event: payload.event,
                        },
                    },
                    trigger: null,
                });
            } catch (error) {
                console.warn("[notification] 发送系统通知失败", error);
            }
        },
        [buildNotificationContent],
    );

    const handleNotification = React.useCallback(
        (message: NotificationSocketNotification) => {
            const payload = message.payload;
            if (!payload?.event) {
                return;
            }
            const orderId = payload.orderId;
            switch (payload.event) {
                case "order_pending_acceptance_assigned": {
                    const label =
                        payload.serviceName ?? `订单 ${orderId ?? ""}`.trim();
                    toast.success(
                        payload.message ?? `${label} 待接单，请尽快处理`,
                    );
                    void invalidateOrders(orderId);
                    void presentNativeNotification(payload);
                    break;
                }
                case "order_cancelled": {
                    toast.warning(payload.message ?? "订单已取消，请查看原因");
                    void invalidateOrders(orderId);
                    void presentNativeNotification(payload);
                    break;
                }
                case "order_payment_expired": {
                    toast.info(payload.message ?? "订单支付已超时");
                    void invalidateOrders(orderId);
                    void presentNativeNotification(payload);
                    break;
                }
                case "order_pending_acceptance_warning":
                case "order_service_eta_warning": {
                    toast.info(payload.message ?? "订单提醒");
                    void presentNativeNotification(payload);
                    break;
                }
                case "withdrawal_wechat_wait_user_confirm": {
                    void invalidateEarnings();
                    void onWechatWithdrawalWaitUserConfirm?.(
                        payload.withdrawalId,
                    );
                    break;
                }
                default:
                    void presentNativeNotification(payload);
            }
        },
        [
            invalidateEarnings,
            invalidateOrders,
            onWechatWithdrawalWaitUserConfirm,
            presentNativeNotification,
        ],
    );

    const { lastError, lastAckError } = useNotificationSocket({
        enabled,
        onNotification: handleNotification,
        metadata: {
            registrationId: registrationId ?? undefined,
        },
    });

    React.useEffect(() => {
        if (!enabled || !lastError) {
            return;
        }
        toast.error(`通知连接异常：${lastError}`);
    }, [enabled, lastError]);

    React.useEffect(() => {
        if (!enabled || !lastAckError) {
            return;
        }
        toast.error(`通知 ACK 失败：${lastAckError}`);
    }, [enabled, lastAckError]);

    return null;
}

const hasDomWindow =
    typeof globalThis !== "undefined" &&
    typeof (globalThis as { window?: unknown }).window !== "undefined";
const useIsomorphicLayoutEffect =
    Platform.OS === "web" && !hasDomWindow
        ? React.useEffect
        : React.useLayoutEffect;

function useNotificationPermission(enabled: boolean) {
    React.useEffect(() => {
        if (!enabled || Platform.OS === "web") {
            return;
        }
        let active = true;
        (async () => {
            try {
                const settings = await Notifications.getPermissionsAsync();
                if (!active) {
                    return;
                }
                if (!settings.granted) {
                    await Notifications.requestPermissionsAsync();
                }
            } catch (error) {
                console.warn("[notification] 请求通知权限失败", error);
            }
        })();
        return () => {
            active = false;
        };
    }, [enabled]);
}
