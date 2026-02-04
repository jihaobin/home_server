import { Ionicons } from "@expo/vector-icons";
import { House } from "@repo/mobile-ui/lib/icons/house";
import type { BottomTabBarProps } from "@react-navigation/bottom-tabs";
import { useTheme } from "@react-navigation/native";
import { Tabs } from "expo-router";
import {
    Platform,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

function WorkerTabBar({ state, descriptors, navigation }: BottomTabBarProps) {
    const { colors } = useTheme();
    const insets = useSafeAreaInsets();

    return (
        <View
            style={[
                styles.tabBar,
                {
                    paddingBottom: Math.max(insets.bottom, 8),
                    backgroundColor: colors.card,
                    borderTopColor: colors.border,
                },
                Platform.OS === "ios" ? styles.tabBarIOS : null,
            ]}
        >
            {state.routes.map((route, index) => {
                const descriptor = descriptors[route.key];
                const { options } = descriptor;
                const isFocused = state.index === index;
                const labelPosition =
                    options.tabBarLabelPosition ?? "below-icon";
                const labelText =
                    typeof options.title === "string"
                        ? options.title
                        : route.name;
                const renderLabel = () => {
                    if (options.tabBarShowLabel === false) {
                        return null;
                    }
                    if (typeof options.tabBarLabel === "function") {
                        return options.tabBarLabel({
                            focused: isFocused,
                            color,
                            position: labelPosition,
                            children: labelText,
                        });
                    }
                    const resolvedLabel =
                        typeof options.tabBarLabel === "string"
                            ? options.tabBarLabel
                            : labelText;
                    return (
                        <Text style={[styles.tabLabel, { color }]}>
                            {resolvedLabel}
                        </Text>
                    );
                };
                const color = isFocused
                    ? (options.tabBarActiveTintColor ?? colors.primary)
                    : (options.tabBarInactiveTintColor ?? colors.text);

                const icon =
                    typeof options.tabBarIcon === "function"
                        ? options.tabBarIcon({
                              focused: isFocused,
                              color,
                              size: 22,
                          })
                        : null;

                const onPress = () => {
                    const event = navigation.emit({
                        type: "tabPress",
                        target: route.key,
                        canPreventDefault: true,
                    });

                    if (!isFocused && !event.defaultPrevented) {
                        navigation.navigate(route.name, route.params);
                    }
                };

                const onLongPress = () => {
                    navigation.emit({
                        type: "tabLongPress",
                        target: route.key,
                    });
                };

                return (
                    <TouchableOpacity
                        key={route.key}
                        accessibilityRole="button"
                        accessibilityState={isFocused ? { selected: true } : {}}
                        accessibilityLabel={options.tabBarAccessibilityLabel}
                        testID={options.tabBarButtonTestID}
                        onPress={onPress}
                        onLongPress={onLongPress}
                        style={styles.tabItem}
                        activeOpacity={0.8}
                    >
                        {icon}
                        {renderLabel()}
                    </TouchableOpacity>
                );
            })}
        </View>
    );
}

export default function TabLayout() {
    return (
        <Tabs
            screenOptions={{
                headerShown: false,
            }}
            tabBar={(props) => <WorkerTabBar {...props} />}
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
                name="orders"
                options={{
                    title: "订单",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="list" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="earnings"
                options={{
                    title: "收益",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons name="wallet" size={size} color={color} />
                    ),
                }}
            />
            <Tabs.Screen
                name="chat"
                options={{
                    title: "聊天",
                    tabBarIcon: ({ color, size }) => (
                        <Ionicons
                            name="chatbubbles-outline"
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
                        <Ionicons name="person" size={size} color={color} />
                    ),
                }}
            />
        </Tabs>
    );
}

const styles = StyleSheet.create({
    tabBar: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-around",
        borderTopWidth: StyleSheet.hairlineWidth,
        paddingTop: 8,
        paddingHorizontal: 8,
    },
    tabBarIOS: {
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
    },
    tabItem: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        gap: 4,
    },
    tabLabel: {
        fontSize: 12,
    },
});
