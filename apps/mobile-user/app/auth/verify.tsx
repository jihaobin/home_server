import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Platform,
    Pressable,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { toast } from "@repo/mobile-ui/lib/toast";
import { authClient } from "@repo/lib/auth-client";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";

const phoneRegex = /^1[3-9]\d{9}$/;
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;

const formatPhone = (value: string) => {
    if (value.length !== 11) {
        return value;
    }
    return value.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
};

export default function VerifyScreen() {
    const { phone } = useLocalSearchParams<{ phone?: string }>();
    const phoneNumber = typeof phone === "string" ? phone : "";
    const displayPhone = useMemo(
        () => (phoneNumber ? `+86 ${formatPhone(phoneNumber)}` : ""),
        [phoneNumber],
    );
    const { refetch } = useSession();

    const [code, setCode] = useState("");
    const [countdown, setCountdown] = useState(RESEND_SECONDS);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const inputRef = useRef<TextInput>(null);
    const focusInput = () => {
        const input = inputRef.current;
        if (!input) {
            return;
        }
        input.blur();
        setTimeout(() => {
            input.focus();
        }, 50);
    };

    useEffect(() => {
        if (phoneNumber) {
            return;
        }
        toast.error("手机号信息缺失，请重新获取验证码");
        router.replace("/auth/login" as any);
    }, [phoneNumber]);

    useEffect(() => {
        if (countdown <= 0) return;
        const timer = setInterval(() => {
            setCountdown((prev) => (prev > 0 ? prev - 1 : 0));
        }, 1000);
        return () => clearInterval(timer);
    }, [countdown]);

    const handleVerify = async (value: string) => {
        if (isSubmitting) {
            return;
        }
        if (!phoneRegex.test(phoneNumber)) {
            toast.error("手机号信息异常，请重新登录");
            router.replace("/auth/login" as any);
            return;
        }
        setIsSubmitting(true);
        try {
            const { error } = await authClient.phoneNumber.verify({
                phoneNumber,
                code: value,
            });
            if (error) {
                toast.error(translateAuthErrorMessage(error));
                setCode("");
                return;
            }
            try {
                await refetch();
            } catch {
                // ignore session refresh error to avoid blocking navigation
            }
            router.replace("/(tabs)");
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleCodeChange = (value: string) => {
        const sanitized = value.replace(/\D/g, "").slice(0, CODE_LENGTH);
        setCode(sanitized);
        if (sanitized.length === CODE_LENGTH) {
            handleVerify(sanitized);
        }
    };

    const handleResend = async () => {
        if (countdown > 0 || isSendingOtp) {
            return;
        }
        if (!phoneRegex.test(phoneNumber)) {
            toast.error("手机号信息异常，请重新登录");
            router.replace("/auth/login" as any);
            return;
        }
        setIsSendingOtp(true);
        try {
            const { error } = await authClient.phoneNumber.sendOtp({
                phoneNumber,
            });
            if (error) {
                toast.error(translateAuthErrorMessage(error));
                return;
            }
            toast.success("验证码已发送，请注意查收");
            setCountdown(RESEND_SECONDS);
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSendingOtp(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1 bg-background"
        >
            <SafeAreaView className="flex-1 px-6 pt-4">
                <View className="flex-row items-center justify-between">
                    <TouchableOpacity
                        className="h-8 w-8 items-center justify-center"
                        onPress={() => router.back()}
                    >
                        <Ionicons name="chevron-back" size={20} color="#111" />
                    </TouchableOpacity>
                </View>

                <View className="mt-8 gap-2">
                    <Text className="text-2xl font-semibold text-foreground">
                        输入验证码
                    </Text>
                    <Text className="text-sm text-muted-foreground">
                        验证码已发送至 {displayPhone}
                    </Text>
                </View>

                <Pressable
                    className="mt-8 flex-row justify-between"
                    onPress={focusInput}
                >
                    {Array.from({ length: CODE_LENGTH }).map((_, index) => {
                        const digit = code[index] ?? "";
                        const isActive =
                            index === code.length && code.length < CODE_LENGTH;
                        return (
                            <View
                                key={`code-${index}`}
                                className={`h-12 w-12 rounded-xl border ${
                                    isActive
                                        ? "border-primary"
                                        : "border-border/60"
                                } items-center justify-center bg-muted/40`}
                            >
                                <Text className="text-lg text-foreground">
                                    {digit}
                                </Text>
                            </View>
                        );
                    })}
                </Pressable>

                <TextInput
                    ref={inputRef}
                    value={code}
                    onChangeText={handleCodeChange}
                    keyboardType="number-pad"
                    textContentType="oneTimeCode"
                    maxLength={CODE_LENGTH}
                    autoFocus
                    style={{
                        position: "absolute",
                        opacity: 0,
                        height: 1,
                        width: 1,
                    }}
                />

                <View className="mt-6 flex-row items-center justify-between">
                    <TouchableOpacity
                        onPress={handleResend}
                        disabled={countdown > 0 || isSendingOtp}
                    >
                        <Text
                            className={
                                countdown > 0 || isSendingOtp
                                    ? "text-xs text-muted-foreground"
                                    : "text-xs text-primary"
                            }
                        >
                            {countdown > 0
                                ? `重新获取(${countdown}s)`
                                : "重新获取"}
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
        </KeyboardAvoidingView>
    );
}
