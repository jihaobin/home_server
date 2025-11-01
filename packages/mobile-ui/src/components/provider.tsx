import {
    focusManager,
    onlineManager,
    QueryClientProvider,
    QueryErrorResetBoundary,
} from "@tanstack/react-query";
import * as Clipboard from "expo-clipboard";
import * as Network from "expo-network";
import type React from "react";
import { Suspense, useEffect } from "react";
import { ErrorBoundary } from "react-error-boundary";
import {
    ActivityIndicator,
    AppState,
    type AppStateStatus,
    Platform,
    Pressable,
    Text,
    View,
} from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Toaster } from "sonner-native";
import { queryClient } from "@repo/lib/query-client";
import { SessionProvider } from "./SessionProvider";
import { SplashScreenController } from "./splash";
import { DevToolsBubble } from "react-native-react-query-devtools";

const onCopy = async (text: string) => {
    try {
        await Clipboard.setStringAsync(text);
        return true;
    } catch {
        return false;
    }
};

// react native 断网重连时自动重新获取配置
onlineManager.setEventListener((setOnline) => {
    const eventSubscription = Network.addNetworkStateListener((state) => {
        setOnline(!!state.isConnected);
    });
    return eventSubscription.remove;
});

function onAppStateChange(status: AppStateStatus) {
    if (Platform.OS !== "web") {
        focusManager.setFocused(status === "active");
    }
}

export function Provider({ children }: { children: React.ReactNode }) {
    // react native 应用获取焦点时重新获取数据配置
    useEffect(() => {
        const subscription = AppState.addEventListener("change", onAppStateChange);

        return () => subscription.remove();
    }, []);

    return (
        <SafeAreaProvider>
            <QueryErrorResetBoundary>
                {({ reset }) => (
                    <ErrorBoundary
                        fallbackRender={({ error, resetErrorBoundary }) => (
                            <View className="flex-1 items-center justify-center px-5 bg-white">
                                <Text className="text-xl font-semibold text-red-500 mb-4 text-center">
                                    应用遇到了问题
                                </Text>
                                <Text className="text-gray-600 mb-4 text-center">
                                    {error.message || "发生了未知错误，请稍后重试"}
                                </Text>
                                <Pressable
                                    onPress={() => resetErrorBoundary()}
                                    className="bg-primary px-4 py-2 rounded"
                                >
                                    <Text className="text-primary-foreground">重新尝试</Text>
                                </Pressable>
                            </View>
                        )}
                        onReset={reset}
                    >
                        <QueryClientProvider client={queryClient}>
                            <SessionProvider>
                                <Suspense
                                    fallback={
                                        <View className="flex-1 items-center justify-center bg-white">
                                            <ActivityIndicator size="large" />
                                            <Text className="mt-4 text-gray-600">加载中...</Text>
                                        </View>
                                    }
                                >
                                    <SplashScreenController />
                                    {children}
                                </Suspense>
                            </SessionProvider>
                            <DevToolsBubble onCopy={onCopy} queryClient={queryClient} />
                            <Toaster
                                position="top-center"
                                duration={3000}
                                swipeToDismissDirection="up"
                                richColors
                            />
                        </QueryClientProvider>
                    </ErrorBoundary>
                )}
            </QueryErrorResetBoundary>
        </SafeAreaProvider>
    );
}
