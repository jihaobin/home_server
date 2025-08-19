import React, { useEffect } from "react";

import {
    focusManager,
    onlineManager,
    QueryClientProvider,
} from '@tanstack/react-query'
import { DevToolsBubble } from 'react-native-react-query-devtools';
import * as Clipboard from 'expo-clipboard';
import * as Network from 'expo-network'
import { AppState, AppStateStatus, Platform } from "react-native";
import { queryClient } from "@/lib/query-client";
import { Toaster } from 'sonner-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

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
        setOnline(!!state.isConnected)
    })
    return eventSubscription.remove
})

function onAppStateChange(status: AppStateStatus) {
    if (Platform.OS !== 'web') {
        focusManager.setFocused(status === 'active')
    }
}

export function Provider({ children }: { children: React.ReactNode }) {
    // react native 应用获取焦点时重新获取数据配置

    useEffect(() => {
        const subscription = AppState.addEventListener('change', onAppStateChange)

        return () => subscription.remove()
    }, [])

    return (
        <GestureHandlerRootView>
                    <QueryClientProvider client={queryClient}>
            {children}
            <DevToolsBubble onCopy={onCopy} queryClient={queryClient} />
            <Toaster
                position="top-center"
                duration={3000}
                swipeToDismissDirection="up"
                richColors
            />
        </QueryClientProvider>
        </GestureHandlerRootView>

    );
}