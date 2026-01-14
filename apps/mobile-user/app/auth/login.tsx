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
import { useCallback, useEffect, useState } from "react";
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
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

export default function LoginScreen() {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const { refetch } = useSession();
    const navigation = useNavigation();

    // 倒计时
    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

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

    const handleSendOtp = async () => {
        const normalizedPhone = phone.trim();
        if (!/^1\d{10}$/.test(normalizedPhone)) {
            toast.error("请输入有效的手机号");
            return;
        }
        setIsSendingOtp(true);
        try {
            const { error } = await authClient.phoneNumber.sendOtp({
                phoneNumber: normalizedPhone,
            });
            if (error) {
                toast.error(translateAuthErrorMessage(error));
                return;
            }
            toast.success("验证码已发送，请注意查收");
            setCountdown(60);
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleLogin = async () => {
        const normalizedPhone = phone.trim();
        if (!/^1\d{10}$/.test(normalizedPhone)) {
            toast.error("请输入有效的手机号");
            return;
        }
        if (!otp.trim()) {
            toast.error("请输入短信验证码");
            return;
        }

        setIsLoading(true);
        try {
            const { error } = await authClient.phoneNumber.verify({
                phoneNumber: normalizedPhone,
                code: otp.trim(),
            });
            if (error) {
                toast.error(translateAuthErrorMessage(error));
                return;
            }
            refetch();
            router.replace("/(tabs)");
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = useCallback(async () => {
        setIsRefreshing(true);
        try {
            setPhone("");
            setOtp("");
            setCountdown(0);
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
                            <View className="w-20 h-20 rounded-full border-primary  items-center justify-center mb-4">
                                <Image source={require("@/assets/images/icon-round.png")}
                                    contentFit="contain"
                                    style={{ width: 80, height: 80 }}
                                />
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
                                    使用手机号和验证码登录
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="gap-4">
                                <View className="gap-2">
                                    <Label>手机号</Label>
                                    <Input
                                        placeholder="请输入手机号"
                                        value={phone}
                                        onChangeText={setPhone}
                                        keyboardType="phone-pad"
                                        autoComplete="tel"
                                        className="w-full"
                                    />
                                </View>

                                <View className="gap-2">
                                    <View className="flex-row justify-between items-center">
                                        <Label>验证码</Label>
                                        <Button
                                            variant="ghost"
                                            className="p-0 h-auto"
                                            disabled={isSendingOtp || countdown > 0}
                                            onPress={handleSendOtp}
                                        >
                                            <Text className="text-xs text-primary">
                                                {countdown > 0
                                                    ? `${countdown}s 后重发`
                                                    : "发送验证码"}
                                            </Text>
                                        </Button>
                                    </View>
                                    <Input
                                        placeholder="请输入短信验证码"
                                        value={otp}
                                        onChangeText={setOtp}
                                        keyboardType="number-pad"
                                        autoComplete="one-time-code"
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

                                {/* Forgot Password */}
                                <View className="flex-row justify-center items-center space-x-1 mt-2">
                                    <Button
                                        variant="link"
                                        className="p-0"
                                        onPress={() => router.push("/auth/forgot-password" as any)}
                                    >
                                        <Text className="text-xs text-muted-foreground">
                                            忘记密码？
                                        </Text>
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
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
