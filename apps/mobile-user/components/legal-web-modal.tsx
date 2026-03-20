import { useEffect, useRef, useState } from "react";
import {
    Animated,
    Easing,
    Modal,
    Pressable,
    ScrollView,
    View,
    useWindowDimensions,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { WebView } from "react-native-webview";

import { Skeleton } from "@repo/mobile-ui/components/ui/skeleton";
import { Text } from "@repo/mobile-ui/components/ui/text";

type LegalWebModalProps = {
    visible: boolean;
    title: string;
    url: string;
    onClose: () => void;
};

function SkeletonLine({
    widthClassName,
    heightClassName = "h-4",
    className = "",
}: {
    widthClassName: string;
    heightClassName?: string;
    className?: string;
}) {
    return (
        <Skeleton
            className={`${heightClassName} ${widthClassName} rounded-full ${className}`}
        />
    );
}

function LegalDocumentLoadingSkeleton({ title }: { title: string }) {
    const isTerms = title === "用户协议";

    return (
        <ScrollView
            className="flex-1 bg-card"
            contentContainerClassName="pb-8"
            showsVerticalScrollIndicator={false}
        >
            <View className="h-16 flex-row items-center border-b border-border bg-card px-4">
                <View className="flex-row items-center">
                    <Skeleton className="h-8 w-8 rounded-xl bg-primary" />
                    <SkeletonLine
                        widthClassName="ml-3 w-24"
                        heightClassName="h-5"
                    />
                </View>
                <View className="ml-auto flex-row items-center gap-3">
                    <Skeleton className="h-10 w-10 rounded-full" />
                    <Skeleton className="h-10 w-24 rounded-full bg-primary" />
                </View>
            </View>

            <View className="px-4 pt-8">
                <SkeletonLine widthClassName="w-36" heightClassName="h-10" />
                <SkeletonLine
                    widthClassName="mt-4 w-28"
                    heightClassName="h-4"
                />

                <View className="mt-6 rounded-3xl border border-border bg-card px-5 py-6 shadow-xs">
                    <SkeletonLine
                        widthClassName="w-full"
                        heightClassName="h-5"
                    />
                    <SkeletonLine
                        widthClassName="mt-4 w-11/12"
                        heightClassName="h-5"
                    />
                    <SkeletonLine
                        widthClassName="mt-4 w-9/12"
                        heightClassName="h-5"
                    />

                    <SkeletonLine
                        widthClassName={isTerms ? "mt-8 w-32" : "mt-8 w-56"}
                        heightClassName="h-8"
                        className="bg-primary"
                    />

                    {isTerms ? (
                        <View className="mt-5 gap-5">
                            {[0, 1, 2].map((item) => (
                                <View
                                    key={item}
                                    className="flex-row items-start"
                                >
                                    <Skeleton className="mt-2 h-2.5 w-2.5 rounded-full" />
                                    <View className="ml-3 flex-1">
                                        <SkeletonLine
                                            widthClassName="w-full"
                                            heightClassName="h-5"
                                        />
                                        <SkeletonLine
                                            widthClassName="mt-3 w-11/12"
                                            heightClassName="h-5"
                                        />
                                        <SkeletonLine
                                            widthClassName="mt-3 w-10/12"
                                            heightClassName="h-5"
                                        />
                                        <SkeletonLine
                                            widthClassName="mt-3 w-8/12"
                                            heightClassName="h-5"
                                        />
                                    </View>
                                </View>
                            ))}
                        </View>
                    ) : (
                        <View className="mt-5">
                            {["w-full", "w-11/12", "w-10/12", "w-9/12"].map(
                                (widthClassName, index) => (
                                    <SkeletonLine
                                        key={`${widthClassName}-${index}`}
                                        widthClassName={`${index === 0 ? "" : "mt-4 "}${widthClassName}`}
                                        heightClassName="h-5"
                                    />
                                ),
                            )}

                            <View className="mt-8">
                                <SkeletonLine
                                    widthClassName="w-44"
                                    heightClassName="h-8"
                                    className="bg-primary"
                                />
                                {["w-full", "w-11/12", "w-9/12"].map(
                                    (widthClassName, index) => (
                                        <SkeletonLine
                                            key={`${widthClassName}-${index}`}
                                            widthClassName={`${index === 0 ? "mt-5 " : "mt-4 "}${widthClassName}`}
                                            heightClassName="h-5"
                                        />
                                    ),
                                )}
                            </View>
                        </View>
                    )}
                </View>
            </View>
        </ScrollView>
    );
}

export function LegalWebModal({
    visible,
    title,
    url,
    onClose,
}: LegalWebModalProps) {
    const { width } = useWindowDimensions();
    const translateX = useRef(new Animated.Value(width)).current;
    const [isDisplayed, setIsDisplayed] = useState(visible);
    const [isPageLoading, setIsPageLoading] = useState(visible);

    useEffect(() => {
        if (visible) {
            setIsDisplayed(true);
            setIsPageLoading(true);
            translateX.setValue(width);
            Animated.timing(translateX, {
                toValue: 0,
                duration: 260,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
            return;
        }

        if (!isDisplayed) {
            return;
        }

        Animated.timing(translateX, {
            toValue: width,
            duration: 220,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setIsDisplayed(false);
            }
        });
    }, [isDisplayed, translateX, visible, width]);

    if (!isDisplayed) {
        return null;
    }

    return (
        <Modal
            visible={isDisplayed}
            animationType="none"
            presentationStyle="fullScreen"
            onRequestClose={onClose}
        >
            <Animated.View
                className="flex-1"
                style={{ transform: [{ translateX }] }}
            >
                <SafeAreaView className="flex-1 bg-background" edges={["top"]}>
                    <View className="h-12 flex-row items-center border-b border-border px-4">
                        <Pressable
                            onPress={onClose}
                            className="py-2 pr-3"
                            hitSlop={8}
                        >
                            <Text className="text-sm font-puhui-regular text-primary">
                                关闭
                            </Text>
                        </Pressable>
                        <Text className="flex-1 text-center text-base font-puhui-medium text-foreground">
                            {title}
                        </Text>
                        <View className="w-[44px]" />
                    </View>
                    <View className="flex-1">
                        <WebView
                            source={{ uri: url }}
                            onLoadStart={() => setIsPageLoading(true)}
                            onLoadEnd={() => setIsPageLoading(false)}
                            onError={() => setIsPageLoading(false)}
                            style={{ opacity: isPageLoading ? 0 : 1 }}
                        />
                        {isPageLoading ? (
                            <View className="absolute inset-0 bg-card">
                                <LegalDocumentLoadingSkeleton title={title} />
                            </View>
                        ) : null}
                    </View>
                </SafeAreaView>
            </Animated.View>
        </Modal>
    );
}
