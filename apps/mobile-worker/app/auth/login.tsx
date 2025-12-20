import { useCallback, useState } from "react";
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
import { EmailVerificationSheet } from "../../components/EmailVerificationSheet";
import { authClient, signOutWithCleanup } from "../../lib/auth";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";

export default function WorkerLoginScreen() {
    const navigation = useNavigation();
    const { refetch } = useSession();

    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [showVerificationSheet, setShowVerificationSheet] = useState(false);

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

    const handleLogin = async () => {
        if (!email.trim() || !password.trim()) {
            toast.error("请填写邮箱和密码");
            return;
        }

        setIsSubmitting(true);
        try {
            const { data, error } = await authClient.signIn.email({
                email: email.trim(),
                password,
            });

            if (error) {
                toast.error(translateAuthErrorMessage(error));
                return;
            }

            if (data?.user && !data.user.emailVerified) {
                await signOutWithCleanup();
                setShowVerificationSheet(true);
                toast.info("请先完成邮箱验证");
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

    const handleVerified = async () => {
        try {
            const { error } = await authClient.signIn.email({
                email: email.trim(),
                password,
            });

            if (!error) {
                toast.success("登录成功，已解锁工作台");
                refetch();
                router.replace("/(tabs)");
            }
        } catch (err) {
            toast.error("重新登录失败，请稍后再试");
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
                                使用平台账户登录，实时跟进指派、收益与待办
                            </Text>
                        </View>

                        <View className="mt-10 gap-5">
                            <View className="gap-2">
                                <Label className="text-xs text-muted-foreground">工作邮箱</Label>
                                <Input
                                    autoCapitalize="none"
                                    keyboardType="email-address"
                                    autoComplete="email"
                                    placeholder="name@company.com"
                                    value={email}
                                    onChangeText={setEmail}
                                />
                            </View>

                            <View className="gap-2">
                                <View className="flex-row items-center justify-between">
                                    <Label className="text-xs text-muted-foreground">登录密码</Label>
                                    <Button
                                        variant="link"
                                        className="h-auto p-0"
                                        onPress={() => router.push("/auth/forgot-password" as never)}
                                    >
                                        <Text className="text-xs">忘记密码？</Text>
                                    </Button>
                                </View>
                                <Input
                                    secureTextEntry
                                    autoComplete="password"
                                    placeholder="请输入密码"
                                    value={password}
                                    onChangeText={setPassword}
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
                        </View>
                    </View>
                </ScrollView>

                <EmailVerificationSheet
                    visible={showVerificationSheet}
                    email={email.trim()}
                    onClose={() => setShowVerificationSheet(false)}
                    onVerified={handleVerified}
                />
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
