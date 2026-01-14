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
import { router } from "expo-router";
import React, { useCallback, useEffect, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { authClient } from "@repo/lib/auth-client";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Image } from "expo-image";

export default function RegisterScreen() {
    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [name, setName] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

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

    const handleRegister = async () => {
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

            if (name.trim()) {
                await authClient.updateUser({
                    name: name.trim(),
                });
            }

            toast.success("注册成功，已为你自动登录");
            router.replace("/(tabs)");
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setPhone("");
        setOtp("");
        setName("");
        setCountdown(0);
        setTimeout(() => setIsRefreshing(false), 200);
    }, []);

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <SafeAreaView>
                <ScrollView
                    contentContainerStyle={{ flexGrow: 2 }}
                    refreshControl={
                        <RefreshControl refreshing={isRefreshing} onRefresh={handleRefresh} />
                    }
                >
                    <View className="flex-1 justify-center px-6 py-12 bg-background">
                        {/* Header */}
                        <View className="items-center mb-8">
                            <View className="w-20 h-20 items-center justify-center mb-4">
                                <Image source={require("@/assets/images/icon-round.png")}
                                    contentFit="contain"
                                    style={{ width: 80, height: 80 }}
                                />
                            </View>
                            <Text className="text-2xl font-bold text-foreground">创建账户</Text>
                            <Text className="text-sm text-muted-foreground mt-1">
                                输入手机号并完成验证码验证
                            </Text>
                        </View>

                        <Card className="w-full max-w-sm mx-auto">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-2xl text-center">手机号注册</CardTitle>
                                <CardDescription className="text-center">
                                    验证手机号后自动完成注册并登录
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

                                <View className="gap-2">
                                    <Label>昵称（可选）</Label>
                                    <Input
                                        placeholder="输入昵称，方便好友识别"
                                        value={name}
                                        onChangeText={setName}
                                        autoComplete="name"
                                        className="w-full"
                                    />
                                </View>

                                <Button
                                    className="w-full mt-6"
                                    onPress={handleRegister}
                                    disabled={isLoading}
                                >
                                    <Text className={isLoading ? "opacity-50" : ""}>
                                        {isLoading ? "注册中..." : "完成注册并登录"}
                                    </Text>
                                </Button>

                                <View className="flex-row justify-center items-center space-x-1 mt-3">
                                    <Text className="text-muted-foreground">已有账户？</Text>
                                    <Button
                                        variant="link"
                                        className="p-0"
                                        onPress={() => router.replace("/auth/login" as any)}
                                    >
                                        <Text className="text-primary">去登录</Text>
                                    </Button>
                                </View>
                            </CardContent>
                        </Card>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
