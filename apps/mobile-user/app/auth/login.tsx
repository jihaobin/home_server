import { Ionicons } from "@expo/vector-icons";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useState } from "react";
import {
    BackHandler,
    GestureResponderEvent,
    KeyboardAvoidingView,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Checkbox } from "@repo/mobile-ui/components/ui/checkbox";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "@repo/mobile-ui/lib/toast";
import { authClient } from "@repo/lib/auth-client";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { LoginLegalGuideDialog } from "@/components/login-legal-guide-dialog";
import type { LegalDocKey } from "@/lib/legal-documents";
import {
    hasSeenLoginLegalGuide,
    markLoginLegalGuideSeen,
} from "@/lib/login-legal-guide";
import { LegalWebModal } from "@/components/legal-web-modal";
import { LEGAL_DOCUMENT_CONFIG } from "@/lib/legal-documents";

const phoneRegex = /^1[3-9]\d{9}$/;

export default function LoginScreen() {
    const navigation = useNavigation();
    const [phone, setPhone] = useState("");
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isLegalGuideOpen, setIsLegalGuideOpen] = useState(
        () => !hasSeenLoginLegalGuide(),
    );
    const [activeLegalDoc, setActiveLegalDoc] = useState<LegalDocKey | null>(
        null,
    );

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

            const removeBeforeRemove = navigation.addListener(
                "beforeRemove",
                (event) => {
                    if (event.data.action?.type !== "GO_BACK") {
                        return;
                    }
                    event.preventDefault();
                    redirectToHome();
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

    const toggleAgreeToTerms = useCallback(() => {
        setAgreeToTerms((prev) => !prev);
    }, []);

    const handleOpenLegalDoc = useCallback((doc: LegalDocKey) => {
        setActiveLegalDoc(doc);
    }, []);

    const handleConfirmLegalGuide = useCallback(() => {
        markLoginLegalGuideSeen();
        setIsLegalGuideOpen(false);
    }, []);

    const handleOpenLegalDocFromPressable = useCallback(
        (doc: LegalDocKey) => (event: GestureResponderEvent) => {
            event.stopPropagation();
            handleOpenLegalDoc(doc);
        },
        [handleOpenLegalDoc],
    );

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
                `/auth/verify?phone=${encodeURIComponent(normalizedPhone)}` as any,
            );
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsSendingOtp(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 bg-background"
        >
            <SafeAreaView className="flex-1">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
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
                                欢迎登录叮咚上门
                            </Text>
                        </View>

                        <View className="mt-6 rounded-full bg-muted px-4 py-3 flex-row items-center">
                            <TextInput
                                className="flex-1 text-base text-foreground"
                                placeholder="请输入手机号"
                                placeholderTextColor="#9ca3af"
                                keyboardType="phone-pad"
                                autoComplete="tel"
                                value={phone}
                                onChangeText={(value) =>
                                    setPhone(
                                        value.replace(/\D/g, "").slice(0, 11),
                                    )
                                }
                            />
                        </View>

                        <Text className="mt-3 text-xs text-muted-foreground">
                            未注册手机号验证后将自动创建账户
                        </Text>

                        <View className="mt-6 flex-row items-start">
                            <Checkbox
                                checked={agreeToTerms}
                                onCheckedChange={(checked) =>
                                    setAgreeToTerms(Boolean(checked))
                                }
                                className="mt-0.5 size-5 rounded-md border-2 border-primary bg-card"
                                checkedClassName="border-primary bg-primary"
                                indicatorClassName="bg-primary"
                                iconClassName="text-primary-foreground"
                            />
                            <Pressable
                                className="ml-3 flex-1 flex-row flex-wrap items-center"
                                onPress={toggleAgreeToTerms}
                                hitSlop={8}
                            >
                                <Text className="text-xs leading-5 text-muted-foreground">
                                    我已阅读并同意
                                </Text>
                                <Pressable
                                    onPress={handleOpenLegalDocFromPressable(
                                        "terms",
                                    )}
                                    hitSlop={6}
                                >
                                    <Text className="text-xs leading-5 text-primary">
                                        《用户协议》
                                    </Text>
                                </Pressable>
                                <Text className="text-xs leading-5 text-muted-foreground">
                                    和
                                </Text>
                                <Pressable
                                    onPress={handleOpenLegalDocFromPressable(
                                        "privacy",
                                    )}
                                    hitSlop={6}
                                >
                                    <Text className="text-xs leading-5 text-primary">
                                        《隐私政策》
                                    </Text>
                                </Pressable>
                            </Pressable>
                        </View>

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

            <LegalWebModal
                visible={activeLegalDoc !== null}
                title={
                    activeLegalDoc
                        ? LEGAL_DOCUMENT_CONFIG[activeLegalDoc].title
                        : ""
                }
                url={
                    activeLegalDoc
                        ? LEGAL_DOCUMENT_CONFIG[activeLegalDoc].url
                        : ""
                }
                onClose={() => setActiveLegalDoc(null)}
            />
            <LoginLegalGuideDialog
                open={isLegalGuideOpen}
                onConfirm={handleConfirmLegalGuide}
                onOpenLegalDoc={handleOpenLegalDoc}
            />
        </KeyboardAvoidingView>
    );
}
