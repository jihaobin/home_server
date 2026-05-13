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
    className,
    heightClassName,
    widthClassName,
}: {
    className?: string;
    heightClassName: string;
    widthClassName: string;
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
            contentContainerClassName="px-4 pb-6"
            showsVerticalScrollIndicator={false}
        >
            <View className="py-3">
                <SkeletonLine widthClassName="w-40" heightClassName="h-8" />
                <View className="mt-3 flex-row items-center">
                    <SkeletonLine widthClassName="w-24" heightClassName="h-4" />
                    <SkeletonLine
                        className="ml-3"
                        widthClassName="w-24"
                        heightClassName="h-4"
                    />
                </View>
                <SkeletonLine
                    className="mt-4"
                    widthClassName={isTerms ? "w-36" : "w-28"}
                    heightClassName="h-10"
                />
                <SkeletonLine
                    className="mt-4"
                    widthClassName="w-24"
                    heightClassName="h-4"
                />
            </View>

            <View className="gap-3">
                <SkeletonLine widthClassName="w-full" heightClassName="h-4" />
                <SkeletonLine
                    widthClassName="w-11/12"
                    heightClassName="h-4"
                />
                <SkeletonLine
                    widthClassName="w-9/12"
                    heightClassName="h-4"
                />
                <SkeletonLine
                    widthClassName="w-10/12"
                    heightClassName="h-4"
                />
                <SkeletonLine
                    widthClassName="w-8/12"
                    heightClassName="h-4"
                />
            </View>

            <View className="mt-6 gap-3">
                <SkeletonLine widthClassName="w-full" heightClassName="h-4" />
                <SkeletonLine
                    widthClassName="w-10/12"
                    heightClassName="h-4"
                />
                <SkeletonLine
                    widthClassName="w-9/12"
                    heightClassName="h-4"
                />
                <SkeletonLine
                    widthClassName="w-11/12"
                    heightClassName="h-4"
                />
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
                duration: 240,
                easing: Easing.out(Easing.cubic),
                useNativeDriver: true,
            }).start();
            return;
        }

        Animated.timing(translateX, {
            toValue: width,
            duration: 200,
            easing: Easing.in(Easing.cubic),
            useNativeDriver: true,
        }).start(({ finished }) => {
            if (finished) {
                setIsDisplayed(false);
            }
        });
    }, [translateX, visible, width]);

    useEffect(() => {
        if (visible) {
            setIsPageLoading(true);
        }
    }, [visible]);

    if (!isDisplayed) {
        return null;
    }

    return (
        <Modal visible transparent animationType="none" onRequestClose={onClose}>
            <View className="flex-1 bg-black/20">
                <Pressable className="flex-1" onPress={onClose} />
                <Animated.View
                    style={{ transform: [{ translateX }] }}
                    className="h-[86%] rounded-t-[28px] bg-background shadow-2xl shadow-black/20"
                >
                    <SafeAreaView edges={["top"]} className="flex-1">
                        <View className="flex-row items-center justify-between px-4 py-3">
                            <Text className="text-base font-semibold text-foreground">
                                {title}
                            </Text>
                            <Pressable
                                className="h-9 w-9 items-center justify-center rounded-full bg-muted"
                                onPress={onClose}
                            >
                                <Text className="text-lg text-foreground">×</Text>
                            </Pressable>
                        </View>
                        <View className="h-px bg-border/70" />
                        <View className="flex-1">
                            {isPageLoading ? (
                                <LegalDocumentLoadingSkeleton title={title} />
                            ) : null}
                            <WebView
                                source={{ uri: url }}
                                onLoadEnd={() => setIsPageLoading(false)}
                                className="flex-1 bg-background"
                            />
                        </View>
                    </SafeAreaView>
                </Animated.View>
            </View>
        </Modal>
    );
}
