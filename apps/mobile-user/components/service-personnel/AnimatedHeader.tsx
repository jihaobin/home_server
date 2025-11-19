import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { NAV_THEME } from "@repo/mobile-ui/lib/constants";
import { cn } from "@repo/mobile-ui/lib/utils";
import { useRouter } from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useColorScheme } from "nativewind";
import { Pressable, View } from "react-native";
import Animated, {
    Extrapolation,
    interpolate,
    interpolateColor,
    useAnimatedStyle,
    type SharedValue,
} from "react-native-reanimated";
import { hslToRgba } from "@repo/lib/utils";

const ICON_MAP = lucideIconRegistry;

interface AnimatedHeaderProps {
    selectedTab: string;
    onTabChange: (tab: string) => void;
    scrollY: SharedValue<number>;
}

export function AnimatedHeader({ selectedTab, onTabChange, scrollY }: AnimatedHeaderProps) {
    const router = useRouter();
    const { colorScheme } = useColorScheme();

    const opacity = useAnimatedStyle(() => {
        // 只在服务tab时显示滚动动画效果
        if (selectedTab !== "service") {
            return { opacity: 1 };
        }
        return {
            opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
        };
    });

    const backgroundAnimatedStyle = useAnimatedStyle(() => {
        // 只在服务tab时显示滚动动画效果
        if (selectedTab !== "service") {
            return {
                backgroundColor: NAV_THEME[colorScheme ?? "light"].colors.background,
            };
        }
        const backgroundColor = interpolateColor(
            scrollY.value,
            [0, 50],
            ["rgba(0,0,0,0)", NAV_THEME[colorScheme ?? "light"].colors.background],
        );
        return { backgroundColor };
    });

    const backgroundColor = hslToRgba(
        NAV_THEME[colorScheme ?? "light"].colors.foreground,
        0.3,
    );

    const backBackgroundAnimatedStyle = useAnimatedStyle(() => {
        // 只在服务tab时显示滚动动画效果
        if (selectedTab !== "service") {
            return { backgroundColor: "rgba(0,0,0,0)" };
        }
        return {
            backgroundColor: interpolateColor(
                scrollY.value,
                [0, 50],
                [backgroundColor, "rgba(0,0,0,0)"],
            ),
        };
    });

    // 第一个图标的透明度动画 (popover 颜色)
    const backIcon1AnimatedStyle = useAnimatedStyle(() => {
        // 只在服务tab时显示滚动动画效果
        if (selectedTab !== "service") {
            return { opacity: 0 };
        }
        return {
            opacity: interpolate(scrollY.value, [0, 50], [1, 0], Extrapolation.CLAMP),
        };
    });

    // 第二个图标的透明度动画 (primary 颜色)
    const backIcon2AnimatedStyle = useAnimatedStyle(() => {
        // 只在服务tab时显示滚动动画效果
        if (selectedTab !== "service") {
            return { opacity: 1 };
        }
        return {
            opacity: interpolate(scrollY.value, [0, 50], [0, 1], Extrapolation.CLAMP),
        };
    });

    return (
        <Animated.View
            style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                zIndex: 100,
            }}
        >
            <Animated.View
                className="flex-row items-center px-3 pt-12 pb-0"
                style={[backgroundAnimatedStyle]}
            >
                {/* 返回按钮 */}
                <Animated.View
                    className="h-10 w-10 items-center justify-center active:opacity-60 bg-foreground/30 rounded-full"
                    hitSlop={8}
                    style={backBackgroundAnimatedStyle}
                >
                    <Pressable onPress={() => router.back()}>
                        <View className="relative">
                            <Animated.View
                                style={[{ position: "absolute" }, backIcon1AnimatedStyle]}
                            >
                                <Icon
                                    as={ICON_MAP.ChevronLeft}
                                    size={20}
                                    className="text-popover"
                                />
                            </Animated.View>
                            <Animated.View style={backIcon2AnimatedStyle}>
                                <Icon
                                    as={ICON_MAP.ChevronLeft}
                                    size={20}
                                    className="text-primary"
                                />
                            </Animated.View>
                        </View>
                    </Pressable>
                </Animated.View>

                {/* Tab切换 */}
                <Animated.View
                    className="flex-1 flex-row items-center justify-center mx-2"
                    style={opacity}
                >
                    {["service", "reviews"].map((tab) => (
                        <Pressable
                            key={tab}
                            onPress={() => onTabChange(tab)}
                            className={cn(
                                "items-center px-4 py-3 border-b-2",
                                selectedTab === tab
                                    ? "border-primary"
                                    : "border-transparent",
                            )}
                        >
                            <Text
                                className={cn(
                                    "text-base font-medium",
                                    selectedTab === tab
                                        ? "text-foreground"
                                        : "text-muted-foreground",
                                )}
                            >
                                {tab === "service" ? "服务" : "评价"}
                            </Text>
                        </Pressable>
                    ))}
                </Animated.View>
            </Animated.View>
        </Animated.View>
    );
}
