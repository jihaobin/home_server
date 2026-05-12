import { FontAwesome5 } from "@expo/vector-icons";
import Constants from "expo-constants";
import {
    ArrowLeft,
    ChevronRight,
    ShieldCheck,
    Smartphone,
    Zap,
} from "lucide-react-native";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import {
    BackHandler,
    KeyboardAvoidingView,
    Modal,
    Platform,
    Pressable,
    ScrollView,
    TextInput,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Checkbox } from "@repo/mobile-ui/components/ui/checkbox";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { translateAuthErrorMessage } from "@repo/lib/auth-errors";
import {
    JVerificationAuthPageClosedError,
    checkOneClickLoginAvailable,
    dismissLoginPage,
    loginWithJVerificationOneClick,
} from "@repo/lib/jverification";
import { useFocusEffect, useLocalSearchParams, router } from "expo-router";
import { toast } from "sonner-native";
import { authClient, signOutWithCleanup } from "../../lib/auth";
import { API_BASE_URL } from "../../lib/config";

const PRODUCT_NAME = "叮咚上单";
const LOGIN_SLOGAN = "高效接单，专业服务";
const MASKED_LOGIN_PHONE = "190****6306";
const CODE_LENGTH = 6;
const SOFT_SHADOW_STYLE = {
    shadowColor: "#111827",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.08,
    shadowRadius: 20,
    elevation: 3,
};
const BUTTON_SHADOW_STYLE = {
    shadowColor: "#2563eb",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.24,
    shadowRadius: 18,
    elevation: 4,
};
const UPGRADE_ENDPOINT = new URL(
    "/api/service-personnel/upgrade",
    API_BASE_URL,
).toString();
const phoneRegex = /^1[3-9]\d{9}$/;
const jverificationConfig = Constants.expoConfig?.extra?.jverification as
    | {
          appKey?: string;
          channel?: string;
          isProduction?: boolean;
      }
    | undefined;

type LoginMode = "oneClick" | "otp";

const sanitizePhone = (value: string) => value.replace(/\D/g, "").slice(0, 11);
const sanitizeCode = (value: string) =>
    value.replace(/\D/g, "").slice(0, CODE_LENGTH);

const replaceRoute = (href: string) => {
    router.replace(href as any);
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
    try {
        const text = await response.text();
        return text || "申请服务人员权限失败";
    } catch {
        return "申请服务人员权限失败";
    }
};

export default function WorkerLoginScreen() {
    const { refetch } = useSession();
    const { mode } = useLocalSearchParams<{ mode?: string }>();
    const routeLoginMode: LoginMode = mode === "otp" ? "otp" : "oneClick";
    const [loginMode, setLoginMode] = useState<LoginMode>(routeLoginMode);
    const [phone, setPhone] = useState("");
    const [code, setCode] = useState("");
    const [agreeToTerms, setAgreeToTerms] = useState(false);
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
    const [isOneClickAvailable, setIsOneClickAvailable] = useState(false);
    const [isOneClickLoggingIn, setIsOneClickLoggingIn] = useState(false);
    const [isOneClickGateActive, setIsOneClickGateActive] = useState(
        () => routeLoginMode === "oneClick",
    );
    const [isUpgradeModalVisible, setIsUpgradeModalVisible] = useState(false);
    const [isUpgradeSubmitting, setIsUpgradeSubmitting] = useState(false);
    const autoOpenAttemptedRef = useRef(false);
    const shouldReopenOnFocusRef = useRef(false);
    const isSwitchingToOtpRef = useRef(false);

    useEffect(() => {
        const handleHardwareBack = () => {
            if (routeLoginMode === "otp") {
                shouldReopenOnFocusRef.current = true;
                autoOpenAttemptedRef.current = false;
                router.back();
                return true;
            }

            replaceRoute("/(tabs)");
            return true;
        };

        const hardwareBackSub = BackHandler.addEventListener(
            "hardwareBackPress",
            handleHardwareBack,
        );

        return () => {
            hardwareBackSub.remove();
        };
    }, [routeLoginMode]);

    const normalizedPhone = phone.trim();
    const normalizedCode = code.trim();
    const canSendOtp =
        phoneRegex.test(normalizedPhone) && agreeToTerms && !isSendingOtp;
    const canOtpLogin =
        phoneRegex.test(normalizedPhone) &&
        normalizedCode.length === CODE_LENGTH &&
        agreeToTerms &&
        !isVerifyingOtp;
    const canOneClickLogin = isOneClickAvailable && !isOneClickLoggingIn;

    useEffect(() => {
        setLoginMode(routeLoginMode);
        if (routeLoginMode === "oneClick") {
            isSwitchingToOtpRef.current = false;
            autoOpenAttemptedRef.current = false;
            setIsOneClickGateActive(true);
        } else {
            setIsOneClickGateActive(false);
        }
    }, [routeLoginMode]);

    useEffect(() => {
        let cancelled = false;

        checkOneClickLoginAvailable({
            app: "mobile-worker",
            appKey: jverificationConfig?.appKey,
            channel: jverificationConfig?.channel,
            isProduction: jverificationConfig?.isProduction,
            authBaseUrl: "",
        })
            .then((available) => {
                if (!cancelled) {
                    setIsOneClickAvailable(available);
                    if (!available) {
                        setIsOneClickGateActive(false);
                    }
                }
            })
            .catch(() => {
                if (!cancelled) {
                    setIsOneClickAvailable(false);
                    setIsOneClickGateActive(false);
                }
            });

        return () => {
            cancelled = true;
        };
    }, []);

    const refreshAndEnter = useCallback(async () => {
        try {
            await refetch();
        } catch {
            // ignore session refresh error to avoid blocking navigation
        }
        replaceRoute("/(tabs)");
    }, [refetch]);

    const switchToOtpLogin = useCallback(() => {
        isSwitchingToOtpRef.current = true;
        shouldReopenOnFocusRef.current = false;
        autoOpenAttemptedRef.current = true;
        setIsOneClickGateActive(false);
        replaceRoute("/auth/login?mode=otp");
    }, []);

    const switchToOneClickLogin = useCallback(() => {
        dismissLoginPage();
        isSwitchingToOtpRef.current = false;
        shouldReopenOnFocusRef.current = true;
        autoOpenAttemptedRef.current = false;
        setIsOneClickGateActive(true);
        replaceRoute("/auth/login");
    }, []);

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
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleOtpLogin = async () => {
        if (!phoneRegex.test(normalizedPhone)) {
            toast.error("请输入 11 位大陆手机号");
            return;
        }
        if (normalizedCode.length !== CODE_LENGTH) {
            toast.error("请输入 6 位验证码");
            return;
        }
        if (!agreeToTerms) {
            toast.error("请先阅读并同意协议");
            return;
        }

        setIsVerifyingOtp(true);
        try {
            const { error } = await authClient.phoneNumber.verify({
                phoneNumber: normalizedPhone,
                code: normalizedCode,
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
                await refreshAndEnter();
                return;
            }
            setIsUpgradeModalVisible(true);
        } catch (error) {
            toast.error(translateAuthErrorMessage(error));
        } finally {
            setIsVerifyingOtp(false);
        }
    };

    const handleOneClickLogin = useCallback(async () => {
        if (!isOneClickAvailable) {
            toast.error("当前环境暂不支持一键登录，请使用验证码登录");
            setIsOneClickGateActive(false);
            return;
        }

        setIsOneClickLoggingIn(true);
        try {
            await loginWithJVerificationOneClick({
                app: "mobile-worker",
                appKey: jverificationConfig?.appKey,
                channel: jverificationConfig?.channel,
                isProduction: jverificationConfig?.isProduction,
                authBaseUrl: API_BASE_URL,
                authClient,
                pageTitle: PRODUCT_NAME,
                onSwitchToOtp: switchToOtpLogin,
            });
            await refreshAndEnter();
        } catch (error) {
            if (
                error instanceof Error &&
                error.name === "JVerificationOtpSwitchError"
            ) {
                setIsOneClickGateActive(false);
                return;
            }
            if (error instanceof JVerificationAuthPageClosedError) {
                if (isSwitchingToOtpRef.current) {
                    setIsOneClickGateActive(false);
                    return;
                }
                if (routeLoginMode !== "oneClick") {
                    setIsOneClickGateActive(false);
                    return;
                }
                setIsOneClickGateActive(false);
                return;
            }
            setIsOneClickGateActive(false);
            toast.error(
                error instanceof Error
                    ? error.message
                    : "一键登录失败，请使用验证码登录",
            );
        } finally {
            setIsOneClickLoggingIn(false);
        }
    }, [isOneClickAvailable, refreshAndEnter, routeLoginMode, switchToOtpLogin]);

    useFocusEffect(
        useCallback(() => {
            if (
                routeLoginMode === "oneClick" &&
                shouldReopenOnFocusRef.current
            ) {
                shouldReopenOnFocusRef.current = false;
                autoOpenAttemptedRef.current = false;
                if (isOneClickAvailable && !isOneClickLoggingIn) {
                    void handleOneClickLogin();
                }
            }
        }, [
            handleOneClickLogin,
            isOneClickAvailable,
            isOneClickLoggingIn,
            routeLoginMode,
        ]),
    );

    useLayoutEffect(() => {
        if (
            routeLoginMode !== "oneClick" ||
            !isOneClickAvailable ||
            isOneClickLoggingIn ||
            autoOpenAttemptedRef.current
        ) {
            return;
        }

        autoOpenAttemptedRef.current = true;
        void handleOneClickLogin();
    }, [
        handleOneClickLogin,
        isOneClickAvailable,
        isOneClickLoggingIn,
        routeLoginMode,
    ]);

    const handleUpgradeDecline = () => {
        if (isUpgradeSubmitting) {
            return;
        }
        setIsUpgradeModalVisible(false);
        void signOutWithCleanup().finally(() => {
            replaceRoute("/auth/login");
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
                    replaceRoute("/auth/login");
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
                replaceRoute("/(tabs)");
            } catch (error) {
                toast.error(translateAuthErrorMessage(error));
            } finally {
                setIsUpgradeSubmitting(false);
            }
        })();
    };

    const renderBrandMark = () => (
        <View className="h-44 w-44 items-center justify-center">
            <View className="absolute left-0 top-6 h-11 w-11 rounded-full bg-primary/10" />
            <View className="absolute right-4 top-0 h-14 w-14 rounded-full bg-primary/15" />
            <View className="absolute bottom-5 right-0 h-8 w-8 rounded-full bg-primary/10" />
            <View className="absolute h-32 w-32 rounded-full bg-primary/10" />
            <View className="absolute h-24 w-36 rounded-full bg-primary/15" />
            <View
                className="h-28 w-28 items-center justify-center rounded-[40px] bg-card/95"
                style={SOFT_SHADOW_STYLE}
            >
                <Image
                    source={require("@/assets/images/icon-round.png")}
                    contentFit="contain"
                    style={{ width: 104, height: 104 }}
                />
            </View>
        </View>
    );

    const renderAgreement = () => (
        <View className="flex-row items-start justify-center px-1">
            <Checkbox
                checked={agreeToTerms}
                onCheckedChange={(checked) => setAgreeToTerms(Boolean(checked))}
                className="mt-0.5 size-4 rounded-full border border-border bg-card"
                checkedClassName="border-primary bg-primary"
                indicatorClassName="bg-primary"
                iconClassName="text-primary-foreground"
            />
            <Pressable
                className="ml-2 flex-row flex-wrap items-center"
                onPress={() => setAgreeToTerms((prev) => !prev)}
                hitSlop={8}
            >
                <Text className="text-xs leading-5 text-muted-foreground">
                    我已阅读并同意
                </Text>
                <Text className="text-xs leading-5 text-primary">
                    《用户协议》
                </Text>
                <Text className="text-xs leading-5 text-muted-foreground">
                    和
                </Text>
                <Text className="text-xs leading-5 text-primary">
                    《隐私政策》
                </Text>
            </Pressable>
        </View>
    );

    const renderSocialLogin = () => (
        <View className="mt-7">
            <View className="flex-row items-center">
                <View className="h-px flex-1 bg-border/70" />
                <Text className="px-5 text-xs text-muted-foreground">
                    其他方式登录
                </Text>
                <View className="h-px flex-1 bg-border/70" />
            </View>
            <View className="mt-4 flex-row justify-center gap-12">
                {[
                    { name: "微信", icon: "weixin", color: "#35c759" },
                    { name: "QQ", icon: "qq", color: "#111827" },
                    { name: "Apple", icon: "apple", color: "#111827" },
                ].map((item) => (
                    <View key={item.name} className="items-center gap-2">
                        <View
                            className="h-12 w-12 items-center justify-center rounded-full bg-card"
                            style={SOFT_SHADOW_STYLE}
                        >
                            <FontAwesome5
                                name={item.icon as any}
                                size={22}
                                color={item.color}
                            />
                        </View>
                        <Text className="text-xs text-muted-foreground">
                            {item.name}
                        </Text>
                    </View>
                ))}
            </View>
        </View>
    );

    const renderFooter = () => (
        <View className="pb-3">
            {renderAgreement()}
            {renderSocialLogin()}
        </View>
    );

    const renderOneClick = () => (
        <View className="flex-1 justify-between">
            <View className="items-center pt-10">
                {renderBrandMark()}
                <Text className="mt-2 text-center text-2xl font-semibold text-foreground">
                    欢迎来到{" "}
                    <Text className="text-2xl font-semibold text-primary">
                        {PRODUCT_NAME}
                    </Text>
                </Text>
                <View className="mt-3 flex-row items-center gap-3">
                    <View className="h-px w-8 bg-border" />
                    <Text className="text-sm text-muted-foreground">
                        {LOGIN_SLOGAN}
                    </Text>
                    <View className="h-px w-8 bg-border" />
                </View>
                <Text className="mt-5 text-center text-sm text-muted-foreground">
                    当前登录手机号：
                    <Text className="text-sm font-medium text-primary">
                        {MASKED_LOGIN_PHONE}
                    </Text>
                </Text>
                <Button
                    className="mt-6 h-12 w-full rounded-2xl bg-primary"
                    onPress={handleOneClickLogin}
                    disabled={!canOneClickLogin}
                    style={BUTTON_SHADOW_STYLE}
                >
                    <View className="mr-1 h-5 w-5 items-center justify-center rounded-full bg-primary-foreground">
                        <Icon as={Zap} size={13} className="text-primary" />
                    </View>
                    <Text className="text-base font-semibold text-primary-foreground">
                        {isOneClickLoggingIn ? "登录中..." : "一键登录"}
                    </Text>
                </Button>
                <Pressable
                    className="mt-5 flex-row items-center justify-center"
                    onPress={switchToOtpLogin}
                    hitSlop={10}
                >
                    <Text className="text-sm font-medium text-primary">
                        切换手机号验证码登录
                    </Text>
                    <Icon
                        as={ChevronRight}
                        size={16}
                        className="ml-1 text-primary"
                    />
                </Pressable>
            </View>
            {renderFooter()}
        </View>
    );

    const renderOtp = () => (
        <View className="flex-1 justify-between">
            <View>
                <Pressable
                    className="mt-3 h-10 w-10 items-center justify-center rounded-full"
                    onPress={switchToOneClickLogin}
                    hitSlop={10}
                >
                    <Icon as={ArrowLeft} size={22} className="text-foreground" />
                </Pressable>
                <View className="mt-14 items-center">
                    <Text className="text-center text-2xl font-semibold text-foreground">
                        手机号验证码登录
                    </Text>
                    <Text className="mt-3 text-center text-sm text-muted-foreground">
                        未注册的手机号验证后将自动创建账号
                    </Text>
                </View>
                <View className="mt-10 gap-4">
                    <View
                        className="h-14 flex-row items-center rounded-2xl bg-card/95 px-4"
                        style={SOFT_SHADOW_STYLE}
                    >
                        <Icon
                            as={Smartphone}
                            size={18}
                            className="text-muted-foreground"
                        />
                        <TextInput
                            className="ml-3 flex-1 text-base text-foreground"
                            placeholder="请输入手机号"
                            placeholderTextColor="#9ca3af"
                            keyboardType="phone-pad"
                            autoComplete="tel"
                            value={phone}
                            onChangeText={(value) => setPhone(sanitizePhone(value))}
                        />
                    </View>
                    <View
                        className="h-14 flex-row items-center rounded-2xl bg-card/95 px-4"
                        style={SOFT_SHADOW_STYLE}
                    >
                        <Icon
                            as={ShieldCheck}
                            size={18}
                            className="text-muted-foreground"
                        />
                        <TextInput
                            className="ml-3 flex-1 text-base text-foreground"
                            placeholder="请输入验证码"
                            placeholderTextColor="#9ca3af"
                            keyboardType="number-pad"
                            textContentType="oneTimeCode"
                            value={code}
                            onChangeText={(value) => setCode(sanitizeCode(value))}
                            maxLength={CODE_LENGTH}
                        />
                        <View className="mx-3 h-5 w-px bg-border" />
                        <Pressable
                            onPress={handleSendOtp}
                            disabled={!canSendOtp}
                            hitSlop={8}
                        >
                            <Text
                                className={
                                    canSendOtp
                                        ? "text-sm font-medium text-primary"
                                        : "text-sm font-medium text-muted-foreground"
                                }
                            >
                                {isSendingOtp ? "发送中..." : "获取验证码"}
                            </Text>
                        </Pressable>
                    </View>
                    <Button
                        className="mt-2 h-12 rounded-2xl bg-primary"
                        onPress={handleOtpLogin}
                        disabled={!canOtpLogin}
                        style={BUTTON_SHADOW_STYLE}
                    >
                        <Text className="text-base font-semibold text-primary-foreground">
                            {isVerifyingOtp ? "登录中..." : "登录"}
                        </Text>
                    </Button>
                    <Pressable
                        className="mt-1 flex-row items-center justify-center"
                        onPress={switchToOneClickLogin}
                        hitSlop={10}
                    >
                        <Text className="text-sm font-medium text-primary">
                            切换一键登录
                        </Text>
                        <Icon
                            as={ChevronRight}
                            size={16}
                            className="ml-1 text-primary"
                        />
                    </Pressable>
                </View>
            </View>
            {renderFooter()}
        </View>
    );

    if (routeLoginMode === "oneClick" && isOneClickGateActive) {
        return <View className="flex-1 bg-background" />;
    }

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : undefined}
            className="flex-1 bg-background"
        >
            <SafeAreaView className="flex-1 bg-background">
                <ScrollView
                    className="flex-1"
                    contentContainerStyle={{ flexGrow: 1 }}
                    keyboardShouldPersistTaps="handled"
                    bounces={false}
                >
                    <View className="relative min-h-full flex-1 overflow-hidden px-7 pb-5">
                        <View pointerEvents="none" className="absolute inset-0">
                            <View className="absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/10" />
                            <View className="absolute left-5 top-24 h-12 w-12 rounded-full bg-primary/15" />
                            <View className="absolute right-8 top-44 h-7 w-7 rounded-full bg-primary/15" />
                            <View className="absolute -left-14 top-52 h-28 w-56 rounded-full bg-muted/70" />
                            <View className="absolute -right-20 top-56 h-32 w-64 rounded-full bg-muted/60" />
                            <View className="absolute bottom-0 left-0 right-0 h-36 bg-card/40" />
                        </View>
                        {loginMode === "oneClick" ? renderOneClick() : renderOtp()}
                    </View>
                </ScrollView>
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
                            <Pressable
                                className="flex-1 rounded-xl border border-border py-3"
                                onPress={handleUpgradeDecline}
                                disabled={isUpgradeSubmitting}
                            >
                                <Text className="text-center text-sm text-foreground">
                                    暂不
                                </Text>
                            </Pressable>
                            <Pressable
                                className={`flex-1 rounded-xl py-3 ${isUpgradeSubmitting ? "bg-primary/70" : "bg-primary"}`}
                                onPress={handleUpgradeConfirm}
                                disabled={isUpgradeSubmitting}
                            >
                                <Text className="text-center text-sm font-semibold text-primary-foreground">
                                    {isUpgradeSubmitting ? "申请中..." : "申请"}
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                </View>
            </Modal>
        </KeyboardAvoidingView>
    );
}
