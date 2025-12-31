import { useCallback, useEffect, useState } from "react";
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { toast } from "sonner-native";
import { authClient } from "../../lib/auth";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";

export default function WorkerLoginScreen() {
    const navigation = useNavigation();
    const { refetch } = useSession();

    const [phone, setPhone] = useState("");
    const [otp, setOtp] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => setCountdown((prev) => (prev > 0 ? prev - 1 : 0)), 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    useFocusEffect(
        useCallback(() => {
            const redirectToTabs = () => {
                router.replace("/(tabs)");
                return true;
            };

            const hardwareBackSub = BackHandler.addEventListener("hardwareBackPress", redirectToTabs);

            const removeBeforeRemove = navigation.addListener("beforeRemove", (event) => {
                if (event.data.action?.type !== "GO_BACK") {
                    return;
                }
                event.preventDefault();
                redirectToTabs();
            });

            return () => {
                hardwareBackSub.remove();
                removeBeforeRemove();
            };
        }, [navigation])
    );

    const handleSendOtp = async () => {
        const normalizedPhone = phone.trim();
        if (!/^1\d{10}$/.test(normalizedPhone)) {
            toast.error("请输入 11 位大陆手机号");
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
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleLogin = async () => {
        const normalizedPhone = phone.trim();
        if (!/^1\d{10}$/.test(normalizedPhone)) {
            toast.error("请输入 11 位大陆手机号");
            return;
        }
        if (!otp.trim()) {
            toast.error("请输入短信验证码");
            return;
        }

        setIsSubmitting(true);
        try {
            const { error } = await authClient.phoneNumber.verify({
                phoneNumber: normalizedPhone,
                code: otp.trim(),
            });

            if (error) {
                toast.error(translateAuthErrorMessage(error));
                return;
            }

            toast.success("欢迎回来，已为您同步最新任务");
            refetch();
            router.replace("/(tabs)");
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} className="flex-1 bg-background">
            <SafeAreaView className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View className="flex-1 px-6 pb-10">
                        <View className="items-center gap-3 pt-10">
                            <View className="w-16 h-16 rounded-2xl bg-primary/10 items-center justify-center">
                                <Text className="text-primary text-2xl font-bold">HW</Text>
                            </View>
                            <Text className="text-3xl font-semibold text-foreground">服务人员登录</Text>
                            <Text className="text-base text-muted-foreground text-center">
                                使用手机号登录，实时跟进指派、收益与待办
                            </Text>
                        </View>

                        <View className="mt-10 gap-5">
                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">手机号</Label>
                                <Input
                                    autoCapitalize="none"
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                    placeholder="请输入 11 位手机号"
                                    value={phone}
                                    onChangeText={setPhone}
                                />
                            </View>

                            <View className="gap-2">
                                <View className="flex-row items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">短信验证码</Label>
                                    <Button
                                        variant="link"
                                        className="h-auto p-0"
                                        disabled={isSendingOtp || countdown > 0}
                                        onPress={handleSendOtp}
                                    >
                                        <Text className="text-xs text-primary">
                                            {countdown > 0 ? `${countdown}s 后重发` : "获取验证码"}
                                        </Text>
                                    </Button>
                                </View>
                                <Input
                                    keyboardType="number-pad"
                                    autoComplete="one-time-code"
                                    placeholder="请输入验证码"
                                    value={otp}
                                    onChangeText={setOtp}
                                />
                            </View>

                            <View className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                                <Text className="text-sm font-medium text-foreground">安全提醒</Text>
                                <Text className="text-xs text-muted-foreground mt-2">
                                    同一账户仅供本人使用，为避免账号被锁定，请勿将验证码与密码告知他人。
                                </Text>
                            </View>

                            <Button className="mt-2" disabled={isSubmitting} onPress={handleLogin}>
                                <Text className={isSubmitting ? "opacity-60" : ""}>
                                    {isSubmitting ? "登录中..." : "进入工作台"}
                                </Text>
                            </Button>

                            <View className="flex-row items-center justify-center gap-2">
                                <Text className="text-sm text-muted-foreground">首次加入？</Text>
                                <Button
                                    variant="link"
                                    className="p-0"
                                    onPress={() => router.push("/auth/register" as never)}
                                >
                                    <Text className="text-primary">申请服务账号</Text>
                                </Button>
                            </View>

                            <View className="flex-row items-center justify-center gap-2">
                                <Button
                                    variant="link"
                                    className="p-0"
                                    onPress={() => router.push("/auth/forgot-password" as never)}
                                >
                                    <Text className="text-xs text-muted-foreground">忘记密码？</Text>
                                </Button>
                            </View>
                        </View>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
