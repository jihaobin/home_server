import "@repo/mobile-ui/styles/mobile-user.css";
import { ThemeProvider } from "@react-navigation/native";
import { NAV_THEME } from "@repo/mobile-ui/lib/mobile-user-constants";
import { PortalHost } from "@rn-primitives/portal";
import { Stack, usePathname } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { Platform, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "@repo/mobile-ui/components/provider";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { AppUpdateProvider } from "@repo/mobile-ui/app-update/AppUpdateProvider";
import { toast } from "@repo/mobile-ui/lib/toast";
import { useChatSocket } from "../hooks/use-chat-socket";
import { usePendingWechatPaymentReturn } from "../hooks/usePendingWechatPaymentReturn";
import { useWechatPayResultListener } from "../hooks/useWechatPayResultListener";
import { ensureWeChatAppRegistered } from "@repo/lib/pay";

export default function RootLayout() {
    const hasMounted = React.useRef(false);
    const { colorScheme } = useColorScheme();
    const navTheme = NAV_THEME[colorScheme ?? "light"];
    const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

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
            <Provider>
                <AppUpdateProvider app="mobile-user">
                    <ThemeProvider value={navTheme}>
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
    const pathname = usePathname();
    const isAuthenticated = !!session?.user?.id;

    useWechatPayResultListener();
    usePendingWechatPaymentReturn(pathname, isAuthenticated);

    React.useEffect(() => {
        const appId =
            process.env.EXPO_PUBLIC_WECHAT_USER_APP_ID?.trim() ||
            process.env.EXPO_PUBLIC_WECHAT_APP_ID?.trim();
        const universalLink =
            process.env.EXPO_PUBLIC_WECHAT_USER_UNIVERSAL_LINK?.trim() ||
            process.env.EXPO_PUBLIC_WECHAT_UNIVERSAL_LINK?.trim();

        if (!appId || !universalLink) {
            return;
        }

        void ensureWeChatAppRegistered({
            appId,
            universalLink,
        }).catch((error) => {
            const message =
                error instanceof Error ? error.message : "微信 SDK 初始化失败";
            console.warn(message);
        });
    }, []);

    React.useEffect(() => {
        // 路由切换时主动清理未消失 toast，避免回退与 overlay 卸载并发导致 Android 视图树竞态。
        toast.dismiss();
    }, [pathname]);

    return (
        <>
            {isAuthenticated ? (
                <ChatSocketBridge enabled={isAuthenticated} />
            ) : null}
            <Stack
                screenListeners={{
                    beforeRemove: () => {
                        toast.dismiss();
                    },
                    transitionStart: () => {
                        toast.dismiss();
                    },
                }}
                screenOptions={{
                    headerShown: false,
                    headerBackTitle: "返回", // 为返回按钮添加文字
                    headerStyle: {
                        backgroundColor:
                            NAV_THEME[colorScheme ?? "light"].colors.card, // 动态设置导航栏背景颜色
                    },
                    headerTintColor:
                        NAV_THEME[colorScheme ?? "light"].colors.primary, // 动态设置返回按钮和标题颜色
                    headerTitleStyle: {
                        color: NAV_THEME[colorScheme ?? "light"].colors.text, // 动态设置标题文字颜色
                    },
                }}
            >
                <Stack.Protected guard={!!session?.user.id}>
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            headerShown: false,
                        }}
                    />

                    <Stack.Screen
                        name="address/edit-address"
                        options={{
                            headerShown: true,
                        }}
                    />
                    <Stack.Screen
                        name="address/service-address"
                        options={{
                            title: "服务地址",
                            headerShown: true,
                        }}
                    />
                    <Stack.Screen
                        name="address/select-city"
                        options={{
                            title: "服务地址",
                            headerShown: true,
                        }}
                    />
                    <Stack.Screen
                        name="address/select-address"
                        options={{
                            title: "详细地址",
                            headerShown: true,
                        }}
                    />

                    <Stack.Screen
                        name="category/filter"
                        options={{
                            headerShown: false,
                        }}
                    />
                    <Stack.Screen
                        name="search/index"
                        options={{
                            title: "搜索",
                            headerShown: true,
                        }}
                    />
                    <Stack.Screen
                        name="search/result"
                        options={{
                            title: "搜索结果",
                            headerShown: true,
                        }}
                    />
                </Stack.Protected>

                <Stack.Protected guard={!session?.user.id}>
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

const useIsomorphicLayoutEffect =
    Platform.OS === "web" &&
    typeof (globalThis as Record<string, unknown>).window === "undefined"
        ? React.useEffect
        : React.useLayoutEffect;
