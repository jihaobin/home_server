import "@repo/mobile-ui/styles/global.css";
import { ThemeProvider } from "@react-navigation/native";
import { NAV_THEME } from "@repo/mobile-ui/lib/constants";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useColorScheme } from "nativewind";
import * as React from "react";
import { Platform } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { Provider } from "@repo/mobile-ui/components/provider";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { authClient } from "../lib/auth";

export default function RootLayout() {
    const hasMounted = React.useRef(false);
    const { colorScheme } = useColorScheme();
    const [isColorSchemeLoaded, setIsColorSchemeLoaded] = React.useState(false);

    useIsomorphicLayoutEffect(() => {
        if (hasMounted.current) {
            return;
        }

        if (Platform.OS === "web") {
            // Adds the background color to the html element to prevent white background on overscroll.
            const doc = (globalThis as Record<string, unknown>).document as
                | { documentElement?: { classList?: { add: (value: string) => void } } }
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
                <ThemeProvider value={NAV_THEME[colorScheme ?? "light"]}>
                    <StatusBar style={colorScheme === "dark" ? "light" : "dark"} />
                    <RootNavigation />
                    <PortalHost />
                </ThemeProvider>
            </Provider>
        </GestureHandlerRootView>
    );
}

function RootNavigation() {
    const { colorScheme } = useColorScheme();
    const { session } = useSession();

    return (
        <Stack
            screenOptions={{
                headerShown: false,
                headerBackTitle: "返回",
                headerStyle: {
                    backgroundColor: NAV_THEME[colorScheme ?? "light"].colors.card,
                },
                headerTintColor: NAV_THEME[colorScheme ?? "light"].colors.primary,
                headerTitleStyle: {
                    color: NAV_THEME[colorScheme ?? "light"].colors.text,
                },
            }}
        >
            <Stack.Protected guard={!!session?.user?.id}>
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
                    name="scan/explore"
                    options={{
                        title: "扫码记录",
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

            <Stack.Protected guard={!session?.user?.id}>
                <Stack.Screen
                    name="auth/login"
                    options={{
                        headerShown: false,
                    }}
                />
                <Stack.Screen
                    name="auth/register"
                    options={{
                        title: "注册服务账号",
                        presentation: "modal",
                    }}
                />
                <Stack.Screen
                    name="auth/forgot-password"
                    options={{
                        title: "重置密码",
                        presentation: "modal",
                    }}
                />
            </Stack.Protected>
        </Stack>
    );
}

const useIsomorphicLayoutEffect =
    Platform.OS === "web" && typeof window === "undefined"
        ? React.useEffect
        : React.useLayoutEffect;
