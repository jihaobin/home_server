import { useEffect, useState } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "sonner-native";
import { authClient, signOutWithCleanup } from "../../lib/auth";
import * as SecureStore from "expo-secure-store";

const phoneRegex = /^1[3-9]\d{9}$/;

export default function WorkerRegisterScreen() {
    const [formData, setFormData] = useState({
        name: "",
        phone: "",
        otp: "",
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
        if (!formData.phone.trim() || !phoneRegex.test(formData.phone)) {
            toast.error("请输入 11 位大陆手机号");
            return;
        }

        setIsSendingOtp(true);
        try {
            const { error } = await authClient.phoneNumber.sendOtp({
                phoneNumber: formData.phone.trim(),
            });

            if (error) {
                toast.error(error.message || "验证码发送失败");
                return;
            }

            toast.success("验证码已发送，请注意查收");
            setCountdown(60);
        } catch (err) {
            toast.error("网络连接失败，请稍后再试");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            toast.error("请输入姓名");
            return false;
        }
        if (!formData.phone.trim() || !phoneRegex.test(formData.phone)) {
            toast.error("请输入 11 位大陆手机号");
            return false;
        }
        if (!formData.otp.trim() || formData.otp.length !== 6) {
            toast.error("请输入 6 位验证码");
            return false;
        }
        return true;
    };

    const handleRegister = async () => {
        if (!validateForm()) {
            return;
        }

        setIsSubmitting(true);
        try {
            // 清理旧会话，避免注册过程被已有登录干扰
            try {
                await signOutWithCleanup();
            } catch {
                // ignore
            }
            await Promise.allSettled([
                SecureStore.deleteItemAsync("mobile-worker_cookie"),
                SecureStore.deleteItemAsync("mobile-worker_session_data"),
                SecureStore.deleteItemAsync("mobile-worker:session"),
                SecureStore.deleteItemAsync("mobile-worker:refresh_token"),
                SecureStore.deleteItemAsync("mobile-worker:access_token"),
            ]);

            const { error } = await authClient.phoneNumber.verify({
                phoneNumber: formData.phone.trim(),
                code: formData.otp.trim(),
            });

            if (error) {
                toast.error(error.message || "验证码验证失败");
                return;
            }

            // 写入姓名与角色
            await authClient.updateUser({
                name: formData.name.trim(),
                role: "service_personnel",
            });

            // 为确保后续登录流程一致，可选择退出当前自动登录状态
            await signOutWithCleanup();

            toast.success("注册成功，请使用手机号登录");
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
                            <Text className="text-sm uppercase tracking-[4px] text-primary">Join Team</Text>
                            <Text className="text-3xl font-semibold text-foreground">申请成为服务人员</Text>
                            <Text className="text-base text-muted-foreground">
                                填写基础信息并完成手机号验证，即可登录工作台接收指派。
                            </Text>
                        </View>

                        <View className="mt-8 gap-5">
                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">姓名</Label>
                                <Input placeholder="请填写真实姓名" value={formData.name} onChangeText={setField("name")} />
                            </View>

                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">手机号</Label>
                                <Input
                                    autoCapitalize="none"
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                    placeholder="请输入 11 位手机号"
                                    value={formData.phone}
                                    onChangeText={setField("phone")}
                                />
                            </View>

                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">短信验证码</Label>
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
                                            {countdown > 0 ? `${countdown}s` : isSendingOtp ? "发送中..." : "获取验证码"}
                                        </Text>
                                    </Button>
                                </View>
                            </View>

                            <Button
                                className="mt-4"
                                disabled={isSubmitting}
                                onPress={handleRegister}
                            >
                                <Text className={isSubmitting ? "opacity-50" : ""}>
                                    {isSubmitting ? "提交中..." : "提交注册"}
                                </Text>
                            </Button>

                            <View className="flex-row justify-center items-center gap-1">
                                <Text className="text-muted-foreground">已有账户？</Text>
                                <Button variant="link" className="p-0" onPress={() => router.replace("/auth/login" as never)}>
                                    <Text className="text-primary">去登录</Text>
                                </Button>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
