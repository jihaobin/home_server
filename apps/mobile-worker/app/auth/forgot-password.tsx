import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "sonner-native";
import { authClient } from "../../lib/auth";

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function WorkerForgotPasswordScreen() {
    const [formData, setFormData] = useState({
        email: "",
        otp: "",
        newPassword: "",
        confirmPassword: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) {
            return;
        }
        const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    const setField = (field: keyof typeof formData) => (value: string) =>
        setFormData((prev) => ({ ...prev, [field]: value }));

    const handleSendOtp = async () => {
        if (!formData.email.trim() || !emailRegex.test(formData.email)) {
            toast.error("请输入有效的邮箱地址");
            return;
        }

        setIsSendingOtp(true);
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: formData.email.trim(),
                type: "forget-password",
            });

            if (error) {
                toast.error(error.message || "验证码发送失败");
                return;
            }

            toast.success("验证码已发送至邮箱，请查收");
            setCountdown(60);
        } catch (err) {
            toast.error("网络连接失败，请稍后再试");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const validateForm = () => {
        if (!formData.email.trim() || !emailRegex.test(formData.email)) {
            toast.error("请输入正确的邮箱");
            return false;
        }
        if (!formData.otp.trim() || formData.otp.length !== 6) {
            toast.error("请输入 6 位验证码");
            return false;
        }
        if (formData.newPassword.length < 6) {
            toast.error("新密码至少 6 位");
            return false;
        }
        if (formData.newPassword !== formData.confirmPassword) {
            toast.error("两次密码输入不一致");
            return false;
        }
        return true;
    };

    const handleResetPassword = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            const result = await authClient.emailOtp.resetPassword({
                email: formData.email.trim(),
                otp: formData.otp.trim(),
                password: formData.newPassword,
            });

            if (result.error) {
                toast.error(result.error.message || "验证码错误或已过期");
                return;
            }

            toast.success("密码已更新，请使用新密码登录");
            router.replace("/auth/login" as never);
        } catch (err) {
            toast.error("网络连接失败，请稍后再试");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
            <SafeAreaView className="flex-1">
                <ScrollView
                    className="flex-1"
                    keyboardShouldPersistTaps="handled"
                    contentContainerStyle={{ flexGrow: 1 }}
                >
                    <View className="flex-1 px-6 pb-12">
                        <View className="pt-10 gap-2">
                            <Text className="text-sm uppercase tracking-[4px] text-primary">Account</Text>
                            <Text className="text-3xl font-semibold text-foreground">重置服务人员密码</Text>
                            <Text className="text-base text-muted-foreground">
                                输入绑定邮箱并完成验证码验证，即可重新设置密码。
                            </Text>
                        </View>

                        <View className="mt-8 gap-5">
                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">绑定邮箱</Label>
                                <Input
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    keyboardType="email-address"
                                    placeholder="name@company.com"
                                    value={formData.email}
                                    onChangeText={setField("email")}
                                />
                            </View>

                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">验证码</Label>
                                <View className="flex-row gap-3">
                                    <Input
                                        className="flex-1"
                                        placeholder="6 位数字"
                                        keyboardType="number-pad"
                                        maxLength={6}
                                        value={formData.otp}
                                        onChangeText={setField("otp")}
                                    />
                                    <Button
                                        variant="outline"
                                        className="px-4"
                                        disabled={isSendingOtp || countdown > 0}
                                        onPress={handleSendOtp}
                                    >
                                        <Text className="text-sm">
                                            {countdown > 0 ? `${countdown}s` : isSendingOtp ? "发送中" : "发送"}
                                        </Text>
                                    </Button>
                                </View>
                            </View>

                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">新密码</Label>
                                <Input
                                    secureTextEntry
                                    autoComplete="new-password"
                                    placeholder="至少 6 位"
                                    value={formData.newPassword}
                                    onChangeText={setField("newPassword")}
                                />
                            </View>

                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">确认新密码</Label>
                                <Input
                                    secureTextEntry
                                    autoComplete="new-password"
                                    placeholder="再次输入密码"
                                    value={formData.confirmPassword}
                                    onChangeText={setField("confirmPassword")}
                                />
                            </View>

                            <View className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                                <Text className="text-sm font-medium text-foreground">温馨提示</Text>
                                <Text className="text-xs text-muted-foreground mt-2">
                                    验证码仅对当前设备有效，为保障账户安全，重置完成后请妥善保管新密码。
                                </Text>
                            </View>
                        </View>

                        <View className="mt-8 gap-4">
                            <Button disabled={isSubmitting} onPress={handleResetPassword}>
                                <Text className={isSubmitting ? "opacity-60" : ""}>
                                    {isSubmitting ? "提交中..." : "更新密码"}
                                </Text>
                            </Button>
                            <Button variant="ghost" onPress={() => router.replace("/auth/login" as never)}>
                                <Text className="text-sm">返回登录</Text>
                            </Button>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
