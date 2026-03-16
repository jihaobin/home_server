import { useEffect } from 'react';
import { View, ActivityIndicator } from 'react-native';
import { router } from 'expo-router';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { useSession } from '@repo/mobile-ui/components/SessionProvider';

export default function IndexScreen() {
    useEffect(() => {
        checkAuthStatus();
    }, []);

    const checkAuthStatus = async () => {
        try {
            // 检查用户是否已登录
            const { session } = useSession();

            if (session) {
                // 用户已登录，跳转到主页
                router.replace('/(tabs)');
            } else {
                // 用户未登录，跳转到登录页
                router.replace('/auth/login' as any);
            }
        } catch (error) {
            // 发生错误时跳转到登录页
            router.replace('/auth/login' as any);
        }
    };

    return (
        <View className="flex-1 justify-center items-center bg-background">
            {/* Logo/Brand Section */}
            <View className="items-center mb-8">
                <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-6">
                    <Text className="text-primary-foreground text-3xl font-bold">H</Text>
                </View>
                <Text className="text-3xl font-bold text-foreground mb-2">上门服务</Text>
                <Text className="text-base text-muted-foreground">
                    专业便民，服务到家
                </Text>
            </View>

            {/* Loading Indicator */}
            <ActivityIndicator size="large" className="text-primary" />
            <Text className="text-muted-foreground mt-4">正在加载...</Text>
        </View>
    );
}
