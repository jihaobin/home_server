import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import {
    BackHandler,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "sonner-native";
import { authClient } from "../../lib/auth";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { Image } from "expo-image";

const phoneRegex = /^1[3-9]\d{9}$/;

export default function WorkerLoginScreen() {
    const navigation = useNavigation();
    const [phone, setPhone] = useState("");
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);

    useFocusEffect(
        useCallback(() => {
            const redirectToTabs = () => {
                router.replace("/(tabs)");
                return true;
            };

            const hardwareBackSub = BackHandler.addEventListener(
                "hardwareBackPress",
                redirectToTabs,
            );

            const removeBeforeRemove = navigation.addListener(
                "beforeRemove",
                (event) => {
                    if (event.data.action?.type !== "GO_BACK") {
                        return;
                    }
                    event.preventDefault();
                    redirectToTabs();
                },
            );

            return () => {
                hardwareBackSub.remove();
                removeBeforeRemove();
            };
        }, [navigation]),
    );

    const normalizedPhone = phone.trim();
    const canSendOtp =
        phoneRegex.test(normalizedPhone) && agreeToTerms && !isSendingOtp;

    const handleSendOtp = async () => {
        if (!phoneRegex.test(normalizedPhone)) {
            toast.error("请输入 11 位大陆手机号");
            return;
        }
        if (!agreeToTerms) {
            toast.error("请先阅读并同意协议");
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
            router.push(
                `/auth/verify?phone=${encodeURIComponent(normalizedPhone)}` as never,
            );
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSendingOtp(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-background"
        >
            <SafeAreaView className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View className="flex-1 px-6 pt-4 pb-10">
                        <View className="mt-8 items-center">
                            <View className="h-16 w-16 rounded-2xl bg-muted items-center justify-center">
                                <Image
                                    source={require("@/assets/images/icon-round.png")}
                                    contentFit="contain"
                                    style={{ width: 64, height: 64 }}
                                />
                            </View>
                        </View>

                        <View className="mt-6 gap-3">
                            <Text className="text-2xl font-semibold text-foreground">
                                欢迎登录叮咚上单
                            </Text>
                        </View>

                        <View className="mt-6 rounded-full bg-muted px-4 py-3 flex-row items-center">
                            <View className="flex-row items-center">
                                <Text className="text-sm text-foreground">
                                    +86
                                </Text>
                                <Ionicons
                                    name="chevron-down"
                                    size={14}
                                    color="#9ca3af"
                                />
                            </View>
                            <View className="mx-3 h-4 w-px bg-border/60" />
                            <TextInput
                                className="flex-1 text-base text-foreground"
                                placeholder="请输入手机号"
                                placeholderTextColor="#9ca3af"
                                keyboardType="phone-pad"
                                autoComplete="tel"
                                value={phone}
                                onChangeText={(value) =>
                                    setPhone(value.replace(/\D/g, "").slice(0, 11))
                                }
                            />
                        </View>

                        <Text className="mt-3 text-xs text-muted-foreground">
                            未注册手机号验证后自动创建服务账号
                        </Text>

                        <TouchableOpacity
                            className="mt-6 flex-row items-center"
                            onPress={() => setAgreeToTerms((prev) => !prev)}
                        >
                            <View className="h-4 w-4 rounded-full border border-border items-center justify-center">
                                {agreeToTerms ? (
                                    <View className="h-2.5 w-2.5 rounded-full bg-primary" />
                                ) : null}
                            </View>
                            <Text className="ml-2 text-xs text-muted-foreground">
                                我已阅读并同意
                                <Text className="text-primary">
                                    《用户协议》
                                </Text>
                                和
                                <Text className="text-primary">
                                    《隐私政策》
                                </Text>
                            </Text>
                        </TouchableOpacity>

                        <Button
                            className="mt-6"
                            onPress={handleSendOtp}
                            disabled={!canSendOtp}
                        >
                            <Text className={isSendingOtp ? "opacity-60" : ""}>
                                {isSendingOtp ? "发送中..." : "获取短信验证码"}
                            </Text>
                        </Button>
                    </View>
                </ScrollView>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
