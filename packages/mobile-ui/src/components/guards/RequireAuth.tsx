import { Text } from "@repo/mobile-ui/components/ui/text";
import { useFocusEffect, useRouter } from "expo-router";
import { type ReactNode, useCallback } from "react";
import { ActivityIndicator, View } from "react-native";
import { useSession } from "../SessionProvider";

type RequireAuthProps = {
    children: ReactNode;
    fallback?: ReactNode;
};

export function RequireAuth({ children, fallback }: RequireAuthProps) {
    const router = useRouter();
    const { session } = useSession();

    useFocusEffect(
        useCallback(() => {
            const frameId = requestAnimationFrame(() => {
                if (!session?.user?.id) {
                    router.replace("/auth/login");
                }
            });

            return () => cancelAnimationFrame(frameId);
        }, [session?.user?.id, router]),
    );

    if (!session?.user?.id) {
        return (
            fallback ?? (
                <View className="flex-1 items-center justify-center bg-background">
                    <ActivityIndicator size="large" />
                    <Text className="mt-4 text-gray-600">加载中...</Text>
                </View>
            )
        );
    }

    return <>{children}</>;
}
