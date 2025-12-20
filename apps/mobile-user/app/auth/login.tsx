import { Button } from "@repo/mobile-ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/mobile-ui/components/ui/card";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { authClient } from "@repo/lib/auth-client";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { EmailVerificationModal } from "../../components/EmailVerificationModal";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function LoginScreen() {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [showVerificationModal, setShowVerificationModal] = useState(false);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { refetch } = useSession();
    const navigation = useNavigation();

    useFocusEffect(
        useCallback(() => {
            const redirectToHome = () => {
                router.replace("/(tabs)");
                return true;
            };

            const hardwareBackSub = BackHandler.addEventListener(
                "hardwareBackPress",
                redirectToHome,
            );

            const removeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
                if (event.data.action?.type !== "GO_BACK") {
                    return;
                }

                event.preventDefault();
                redirectToHome();
            });

            return () => {
                hardwareBackSub.remove();
                removeBeforeRemove();
            };
        }, [navigation]),
    );

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast.error("请填写邮箱和密码");
            return;
        }

        setIsLoading(true);
        try {
            const { data, error } = await authClient.signIn.email({
                email: email.trim(),
                password: password,
            });

            if (error) {
                toast.error(translateAuthErrorMessage(error));
            } else {
                // 检查邮箱是否已验证
                if (data?.user && !data.user.emailVerified) {
                    // 邮箱未验证，退出登录并显示验证弹窗
                    await authClient.signOut();
                    setShowVerificationModal(true);
                } else {
                    // 邮箱已验证，登录成功
                    refetch();
                    router.replace("/(tabs)");
                }
            }
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    // 验证成功后的处理
    const handleVerified = async () => {
        // 重新登录
        try {
            const { error } = await authClient.signIn.email({
                email: email.trim(),
                password: password,
            });

            if (!error) {
                refetch();
                router.replace("/(tabs)");
            }
        } catch (error) {
            console.error("重新登录失败:", error);
        }
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            setEmail("");
            setPassword("");
            setShowVerificationModal(false);
        } finally {
            setIsRefreshing(false);
        }
    }, []);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <SafeAreaView>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 1 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                    }
                >
                    <View className="flex-1 justify-center px-6 py-12 bg-background">
                        {/* Logo/Brand Section */}
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
                                <Text className="text-primary-foreground text-2xl font-bold">
                                    H
                                </Text>
                            </View>
                            <Text className="text-2xl font-bold text-foreground">叮咚上门</Text>
                            <Text className="text-sm text-muted-foreground mt-1">
                                专业便民，服务到家
                            </Text>
                        </View>

                        {/* Login Form */}
                        <Card className="w-full max-w-sm mx-auto">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl text-center">登录</CardTitle>
                                <CardDescription className="text-center">
                                    输入您的邮箱和密码来登录账户
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <View className="space-y-2">
                                    <Label>邮箱</Label>
                                    <Input
                                        placeholder="输入您的邮箱"
                                        value={email}
                                        onChangeText={setEmail}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        className="w-full"
                                    />
                                </View>

                                <View className="space-y-2">
                                    <View className="flex-row justify-between items-center">
                                        <Label>密码</Label>
                                        <Button
                                            variant="link"
                                            className="p-0 h-auto"
                                            onPress={() => router.push("/auth/forgot-password" as any)}
                                        >
                                            <Text className="text-xs text-primary">忘记密码?</Text>
                                        </Button>
                                    </View>
                                    <Input
                                        placeholder="输入您的密码"
                                        value={password}
                                        onChangeText={setPassword}
                                        secureTextEntry
                                        autoComplete="password"
                                        className="w-full"
                                    />
                                </View>

                                <Button
                                    className="w-full mt-6"
                                    onPress={handleLogin}
                                    disabled={isLoading}
                                >
                                    <Text className={isLoading ? "opacity-50" : ""}>
                                        {isLoading ? "登录中..." : "登录"}
                                    </Text>
                                </Button>

                                {/* Divider */}
                                <View className="flex-row items-center my-4">
                                    <View className="flex-1 h-px bg-border" />
                                    <Text className="px-3 text-muted-foreground text-sm">或</Text>
                                    <View className="flex-1 h-px bg-border" />
                                </View>

                                {/* Register Link */}
                                <View className="flex-row justify-center items-center space-x-1">
                                    <Text className="text-muted-foreground">还没有账户？</Text>
                                    <Button
                                        variant="link"
                                        className="p-0"
                                        onPress={() => router.push("/auth/register" as any)}
                                    >
                                        <Text className="text-primary">立即注册</Text>
                                    </Button>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Footer */}
                        <View className="mt-8 items-center">
                            <Text className="text-xs text-muted-foreground text-center">
                                登录即表示您同意我们的
                                <Text className="text-primary text-xs">服务条款</Text>和
                                <Text className="text-primary text-xs">隐私政策</Text>
                            </Text>
                        </View>
                    </View>
                </ScrollView>

                {/* 邮箱验证弹窗 */}
                <EmailVerificationModal
                    visible={showVerificationModal}
                    onClose={() => setShowVerificationModal(false)}
                    email={email.trim()}
                    onVerified={handleVerified}
                />
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
