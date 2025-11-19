import { useEffect, useState } from "react";
import { View } from "react-native";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { toast } from "sonner-native";
import { authClient } from "../lib/auth";

interface EmailVerificationSheetProps {
    visible: boolean;
    email: string;
    onClose: () => void;
    onVerified: () => void;
}

export function EmailVerificationSheet({ visible, email, onClose, onVerified }: EmailVerificationSheetProps) {
    const [otp, setOtp] = useState("");
    const [isSendingOtp, setIsSendingOtp] = useState(false);
    const [isVerifying, setIsVerifying] = useState(false);
    const [countdown, setCountdown] = useState(0);

    useEffect(() => {
        if (countdown <= 0) {
            return;
        }

        const timer = setTimeout(() => setCountdown((prev) => prev - 1), 1000);
        return () => clearTimeout(timer);
    }, [countdown]);

    useEffect(() => {
        if (!visible) {
            return;
        }

        setOtp("");
        setCountdown(0);
    }, [visible]);

    const handleSendOtp = async () => {
        if (!email?.trim()) {
            toast.error("请输入有效的邮箱地址");
            return;
        }

        setIsSendingOtp(true);
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: email.trim(),
                type: "email-verification",
            });

            if (error) {
                toast.error(error.message || "验证码发送失败");
                return;
            }

            toast.success("验证码已发送，60 秒内有效");
            setCountdown(60);
        } catch (err) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsSendingOtp(false);
        }
    };

    const handleVerify = async () => {
        if (!otp.trim()) {
            toast.error("请输入验证码");
            return;
        }

        if (otp.trim().length !== 6) {
            toast.error("验证码应为 6 位数字");
            return;
        }

        setIsVerifying(true);
        try {
            const result = await authClient.emailOtp.verifyEmail({
                email: email.trim(),
                otp: otp.trim(),
            });

            if (result.error) {
                toast.error(result.error.message || "验证码错误或已过期");
                return;
            }

            toast.success("邮箱验证已通过，正在尝试登录");
            onVerified();
            onClose();
        } catch (err) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsVerifying(false);
        }
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            initialHeightRatio={0.55}
            minHeightRatio={0.45}
            maxHeightRatio={0.85}
        >
            <View className="px-6 py-4 gap-5">
                <View className="gap-2">
                    <Text className="text-xs uppercase tracking-[2px] text-emerald-500">Step 02</Text>
                    <Text className="text-2xl font-semibold text-foreground">邮箱验证</Text>
                    <Text className="text-sm text-muted-foreground">
                        为了保护接单账号安全，我们需要确认该邮箱属于您。
                    </Text>
                </View>

                <View className="rounded-2xl border border-border/60 bg-muted/30 p-4">
                    <Text className="text-xs text-muted-foreground">邮箱地址</Text>
                    <Text className="text-base font-medium text-foreground mt-1">{email}</Text>
                </View>

                <View className="gap-2">
                    <Label className="text-xs text-muted-foreground">验证码</Label>
                    <View className="flex-row gap-3">
                        <Input
                            className="flex-1"
                            placeholder="输入 6 位验证码"
                            keyboardType="number-pad"
                            maxLength={6}
                            value={otp}
                            onChangeText={setOtp}
                        />
                        <Button
                            variant="outline"
                            className="px-4"
                            disabled={isSendingOtp || countdown > 0}
                            onPress={handleSendOtp}
                        >
                            <Text className="text-sm">
                                {countdown > 0 ? `${countdown}s` : isSendingOtp ? "发送中" : "获取"}
                            </Text>
                        </Button>
                    </View>
                </View>

                <View className="rounded-2xl bg-emerald-50 p-4">
                    <Text className="text-xs text-emerald-600">
                        小提示：验证码有效期 5 分钟，如未收到请检查垃圾邮件或稍后重新获取。
                    </Text>
                </View>

                <View className="gap-3">
                    <Button className="w-full" disabled={isVerifying} onPress={handleVerify}>
                        <Text className={isVerifying ? "opacity-60" : ""}>
                            {isVerifying ? "验证中..." : "确认通过"}
                        </Text>
                    </Button>
                    <Button variant="ghost" onPress={onClose}>
                        <Text className="text-sm">稍后再说</Text>
                    </Button>
                </View>
            </View>
        </BottomSheetModal>
    );
}
