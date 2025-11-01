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
            document.documentElement.classList.add("bg-background");
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
                headerBackTitle: "返回", // 为返回按钮添加文字
                headerStyle: {
                    backgroundColor: NAV_THEME[colorScheme ?? "light"].colors.card, // 动态设置导航栏背景颜色
                },
                headerTintColor: NAV_THEME[colorScheme ?? "light"].colors.primary, // 动态设置返回按钮和标题颜色
                headerTitleStyle: {
                    color: NAV_THEME[colorScheme ?? "light"].colors.text, // 动态设置标题文字颜色
                },
            }}
        >
            <Stack.Screen
                name="(tabs)"
                options={{
                    headerShown: false,
                }}
            />
        </Stack>
    );
}

const useIsomorphicLayoutEffect =
    Platform.OS === "web" && typeof window === "undefined"
        ? React.useEffect
        : React.useLayoutEffect;
