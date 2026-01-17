import { Ionicons } from "@expo/vector-icons";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useMemo, useRef, useState } from "react";
import {
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { toast } from "sonner-native";
import { authClient, signOutWithCleanup } from "../../lib/auth";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import { API_BASE_URL } from "../../lib/config";

const phoneRegex = /^1[3-9]\d{9}$/;
const CODE_LENGTH = 6;
const RESEND_SECONDS = 60;
const UPGRADE_ENDPOINT = new URL(
    "/api/service-personnel/upgrade",
    API_BASE_URL,
).toString();

const formatPhone = (value: string) => {
    if (value.length !== 11) {
        return value;
    }
    return value.replace(/(\d{3})(\d{4})(\d{4})/, "$1 $2 $3");
};

const normalizeRoles = (roles?: string | string[]) => {
    if (!roles) {
        return [];
    }
    if (Array.isArray(roles)) {
        return roles.filter(Boolean);
    }
    return roles
        .split(",")
        .map((role) => role.trim())
        .filter(Boolean);
};

const parseUpgradeError = async (response: Response) => {
    const contentType = response.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
        try {
            const payload = (await response.json()) as any;
            return (
                (payload?.error as any)?.message ||
                payload?.message ||
                "申请服务人员权限失败"
            );
        } catch {
            return "申请服务人员权限失败";
        }
    }
    return "申请服务人员权限失败";
};

export default function WorkerVerifyScreen() {
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
    const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
    const [isUpgradeSubmitting, setIsUpgradeSubmitting] = useState(false);
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
        router.replace("/auth/login" as never);
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
            router.replace("/auth/login" as never);
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
            const sessionResponse = await authClient.getSession();
            const sessionUser = sessionResponse.data?.user;
            const roles = normalizeRoles(sessionUser?.role);
            if (roles.includes("service_personnel")) {
                try {
                    refetch();
                } catch {
                    // ignore session refresh error to avoid blocking navigation
                }
                router.replace("/(tabs)");
                return;
            }
            setIsUpgradeModalVisible(true);
        } catch (err) {
            toast.error(translateAuthErrorMessage(err));
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpgradeDecline = () => {
        if (isUpgradeSubmitting) {
            return;
        }
        setIsUpgradeModalVisible(false);
        void signOutWithCleanup().finally(() => {
            router.replace("/auth/login" as never);
        });
    };

    const handleUpgradeConfirm = () => {
        if (isUpgradeSubmitting) {
            return;
        }
        void (async () => {
            setIsUpgradeSubmitting(true);
            try {
                const cookieHeader = authClient
                    .getCookie?.()
                    ?.replace(/^\s*;\s*/, "")
                    .trim();
                if (!cookieHeader) {
                    toast.error("登录状态已失效，请重新登录");
                    setIsUpgradeModalVisible(false);
                    router.replace("/auth/login" as never);
                    return;
                }
                const response = await fetch(UPGRADE_ENDPOINT, {
                    method: "POST",
                    headers: {
                        Cookie: cookieHeader,
                    },
                });
                if (!response.ok) {
                    toast.error(await parseUpgradeError(response));
                    return;
                }
                try {
                    await refetch();
                } catch {
                    // ignore session refresh error
                }
                toast.success("已申请服务人员权限");
                setIsUpgradeModalVisible(false);
                router.replace("/(tabs)");
            } catch (err) {
                toast.error(translateAuthErrorMessage(err));
            } finally {
                setIsUpgradeSubmitting(false);
            }
        })();
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
            router.replace("/auth/login" as never);
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
            behavior={Platform.OS === "ios" ? "padding" : undefined}
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
                    <Text className="text-sm text-muted-foreground">帮助</Text>
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
                                className={`h-12 w-12 rounded-xl border ${isActive
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
                    <TouchableOpacity
                        onPress={() =>
                            toast.error("请联系平台客服处理手机号停用问题")
                        }
                    >
                        <Text className="text-xs text-muted-foreground">
                            手机号已停用？
                        </Text>
                    </TouchableOpacity>
                </View>
            </SafeAreaView>
            <Modal
                visible={isUpgradeModalVisible}
                transparent
                animationType="fade"
                onRequestClose={() => {}}
            >
                <View className="flex-1 items-center justify-center bg-black/40 px-6">
                    <View className="w-full rounded-2xl bg-background p-6">
                        <Text className="text-lg font-semibold text-foreground">
                            申请服务人员权限？
                        </Text>
                        <Text className="mt-2 text-sm text-muted-foreground">
                            该手机号已注册为普通用户，是否申请服务人员权限？
                        </Text>
                        <View className="mt-6 flex-row gap-3">
                            <TouchableOpacity
                                className="flex-1 rounded-xl border border-border py-3"
                                onPress={handleUpgradeDecline}
                                disabled={isUpgradeSubmitting}
                            >
                                <Text className="text-center text-sm text-foreground">
                                    暂不
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                className={`flex-1 rounded-xl py-3 ${isUpgradeSubmitting ? "bg-primary/70" : "bg-primary"}`}
                                onPress={handleUpgradeConfirm}
                                disabled={isUpgradeSubmitting}
                            >
                                <Text className="text-center text-sm font-semibold text-primary-foreground">
                                    {isUpgradeSubmitting ? "申请中..." : "申请"}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
