import "@repo/mobile-ui/styles/global.css";
import {
    DarkTheme,
    DefaultTheme,
    type Theme,
    ThemeProvider,
} from "@react-navigation/native";
import { NAV_THEME } from "@repo/mobile-ui/lib/constants";
import { useColorScheme } from "@repo/mobile-ui/lib/useColorScheme";
import { PortalHost } from "@rn-primitives/portal";
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as React from "react";
import { Platform } from "react-native";
import { Provider } from "@/components/provider";

const LIGHT_THEME: Theme = {
    ...DefaultTheme,
    colors: NAV_THEME.light,
};
const DARK_THEME: Theme = {
    ...DarkTheme,
    colors: NAV_THEME.dark,
};

export default function RootLayout() {
    const hasMounted = React.useRef(false);
    const { isDarkColorScheme } = useColorScheme();
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
        <Provider>
            <ThemeProvider value={isDarkColorScheme ? DARK_THEME : LIGHT_THEME}>
                <StatusBar style={isDarkColorScheme ? "light" : "dark"} />
                <Stack
                    screenOptions={{
                        headerShown: true,
                        headerBackTitle: "返回", // 为返回按钮添加文字
                        headerStyle: {
                            backgroundColor: "#ffffff", // 设置导航栏背景颜色为白色
                        },
                        headerTintColor: "#16a34a", // 设置返回按钮和标题颜色为蓝色
                    }}
                >
                    <Stack.Screen name="auth" />
                    <Stack.Screen
                        name="(tabs)"
                        options={{
                            title: "上门服务",
                        }}
                    />
                    <Stack.Screen
                        name="address/edit-address"
                        options={{
                            headerShown: false,
                        }}
                    />
                </Stack>
                <PortalHost />
            </ThemeProvider>
        </Provider>
    );
}

const useIsomorphicLayoutEffect =
    Platform.OS === "web" && typeof window === "undefined"
        ? React.useEffect
        : React.useLayoutEffect;
