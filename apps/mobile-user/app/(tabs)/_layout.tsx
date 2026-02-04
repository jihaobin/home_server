import { Ionicons } from "@expo/vector-icons";
import { House } from "@repo/mobile-ui/lib/icons/house";
import { Tabs } from "expo-router";
import { Platform } from "react-native";
import { useEffect, useState } from "react";

export default function TabLayout() {
    const [isMounted, setIsMounted] = useState(false);

    useEffect(() => {
        setIsMounted(true);
    }, []);

    if (!isMounted) {
        return null;
    }

    return (
        <Tabs
            screenOptions={{
                headerShown: false,
                tabBarStyle: Platform.select({
                    ios: {
                        // 在 iOS 上使用透明背景以配合底部毛玻璃效果
                        position: "absolute",
                    },
                    default: {},
                }),
            }}
        >
            <Tabs.Screen
                name="index"
                options={{
                    title: "首页",
                    tabBarIcon: ({ color, size }) => (
                        <House size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="orders/index"
                options={{
                    title: "订单",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="receipt-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: "聊天",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="chatbubble-ellipses-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
            <Tabs.Screen
                name="profile"
                options={{
                    title: "我的",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="person-circle-outline"
                            size={size}
                            color={color}
                        />
                    ),
                }}
            />
        </Tabs>
    );
}
