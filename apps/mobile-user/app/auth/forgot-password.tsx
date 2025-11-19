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
import { StatusBar } from "expo-status-bar";
import { useState, useEffect, useCallback } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    RefreshControl,
    ScrollView,
    View,
} from "react-native";
import { authClient } from "@repo/lib/auth-client";
import { toast } from "sonner-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function ForgotPasswordScreen() {
    const [formData, setFormData] = useState({
        email: "",
        otp: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingOTP, setIsSendingOTP] = useState(false);
    const [countdown, setCountdown] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);

    // 倒计时效果
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    // 发送验证码
    const handleSendOTP = async () => {
        // 验证邮箱格式
        if (!formData.email.trim()) {
            toast.error("请先输入邮箱地址");
            return;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("请输入有效的邮箱地址");
            return;
        }

        setIsSendingOTP(true);
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: formData.email.trim(),
                type: "forget-password",
            });

            if (error) {
                toast.error(error.message || "验证码发送失败");
            } else {
                setCountdown(60); // 60秒倒计时
                toast.success("验证码已发送到您的邮箱，请查收");
            }
        } catch (error) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsSendingOTP(false);
        }
    };

    const validateForm = () => {
        if (!formData.email.trim()) {
            toast.error("请输入邮箱地址");
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            toast.error("请输入有效的邮箱地址");
            return false;
        }
        if (!formData.otp.trim()) {
            toast.error("请输入验证码");
            return false;
        }
        if (formData.otp.length !== 6) {
            toast.error("验证码应为6位数字");
            return false;
        }
        if (!formData.newPassword.trim()) {
            toast.error("请输入新密码");
            return false;
        }
        if (formData.newPassword.length < 6) {
            toast.error("密码至少需要6位字符");
            return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
            toast.error("两次输入的密码不一致");
            return false;
        }
        return true;
    };

    const handleResetPassword = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            // 使用OTP重置密码（同时会验证邮箱）
            const resetResult = await authClient.emailOtp.resetPassword({
                email: formData.email.trim(),
                otp: formData.otp.trim(),
                password: formData.newPassword,
            });

            if (resetResult.error) {
                toast.error(resetResult.error.message || "验证码错误或已过期");
            } else {
                // 密码重置成功
                toast.success("密码已更新，邮箱已验证！请使用新密码登录。");
                router.replace("/auth/login" as any);
            }
        } catch (error) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsLoading(false);
        }
    };

    const handleRefresh = useCallback(() => {
        setIsRefreshing(true);
        setFormData({
            email: "",
            otp: "",
            newPassword: "",
            confirmPassword: "",
        });
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
                                    🔑
                                </Text>
                            </View>
                            <Text className="text-2xl font-bold text-foreground">忘记密码</Text>
                            <Text className="text-sm text-muted-foreground mt-1 text-center">
                                通过邮箱验证来重置您的密码
                            </Text>
                        </View>

                        {/* Reset Password Form */}
                        <Card className="w-full max-w-sm mx-auto">
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-xl text-center">重置密码</CardTitle>
                                <CardDescription className="text-center">
                                    输入您的邮箱地址，我们将发送验证码
                                </CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-4">
                                <View className="space-y-2">
                                    <Label>邮箱地址</Label>
                                    <Input
                                        placeholder="输入您的邮箱"
                                        value={formData.email}
                                        onChangeText={(value) => handleInputChange("email", value)}
                                        keyboardType="email-address"
                                        autoCapitalize="none"
                                        autoComplete="email"
                                        className="w-full"
                                    />
                                </View>

                                <View className="space-y-2">
                                    <Label>验证码</Label>
                                    <View className="flex-row gap-2">
                                        <Input
                                            placeholder="输入6位验证码"
                                            value={formData.otp}
                                            onChangeText={(value) => handleInputChange("otp", value)}
                                            keyboardType="number-pad"
                                            maxLength={6}
                                            className="flex-1"
                                        />
                                        <Button
                                            variant="outline"
                                            onPress={handleSendOTP}
                                            disabled={isSendingOTP || countdown > 0}
                                            className="px-4"
                                        >
                                            <Text className="text-sm">
                                                {countdown > 0
                                                    ? `${countdown}秒`
                                                    : isSendingOTP
                                                    ? "发送中..."
                                                    : "获取验证码"}
                                            </Text>
                                        </Button>
                                    </View>
                                </View>

                                <View className="space-y-2">
                                    <Label>新密码</Label>
                                    <Input
                                        placeholder="输入新密码（至少6位）"
                                        value={formData.newPassword}
                                        onChangeText={(value) =>
                                            handleInputChange("newPassword", value)
                                        }
                                        secureTextEntry
                                        autoComplete="new-password"
                                        className="w-full"
                                    />
                                </View>

                                <View className="space-y-2">
                                    <Label>确认新密码</Label>
                                    <Input
                                        placeholder="再次输入新密码"
                                        value={formData.confirmPassword}
                                        onChangeText={(value) =>
                                            handleInputChange("confirmPassword", value)
                                        }
                                        secureTextEntry
                                        autoComplete="new-password"
                                        className="w-full"
                                    />
                                </View>

                                <Button
                                    className="w-full mt-6"
                                    onPress={handleResetPassword}
                                    disabled={isLoading}
                                >
                                    <Text className={isLoading ? "opacity-50" : ""}>
                                        {isLoading ? "重置中..." : "重置密码"}
                                    </Text>
                                </Button>

                                {/* Divider */}
                                <View className="flex-row items-center my-4">
                                    <View className="flex-1 h-px bg-border" />
                                    <Text className="px-3 text-muted-foreground text-sm">或</Text>
                                    <View className="flex-1 h-px bg-border" />
                                </View>

                                {/* Back to Login Link */}
                                <View className="flex-row justify-center items-center space-x-1">
                                    <Button
                                        variant="link"
                                        className="p-0"
                                        onPress={() => router.replace("/auth/login" as any)}
                                    >
                                        <Text className="text-primary">返回登录</Text>
                                    </Button>
                                </View>
                            </CardContent>
                        </Card>

                        {/* Footer */}
                        <View className="mt-8 items-center">
                            <Text className="text-xs text-muted-foreground text-center">
                                验证码有效期为5分钟，如未收到请检查垃圾邮件箱
                            </Text>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
