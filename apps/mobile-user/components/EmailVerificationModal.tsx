import React, { useState, useEffect } from "react";
import { View, ScrollView } from "react-native";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { authClient } from "@repo/lib/auth-client";
import { toast } from "sonner-native";

interface EmailVerificationModalProps {
    visible: boolean;
    onClose: () => void;
    email: string;
    onVerified: () => void;
}

export function EmailVerificationModal({
    visible,
    onClose,
    email,
    onVerified,
}: EmailVerificationModalProps) {
    const [otp, setOtp] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [isSendingOTP, setIsSendingOTP] = useState(false);
    const [countdown, setCountdown] = useState(0);

    // 倒计时效果
    useEffect(() => {
        if (countdown > 0) {
            const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
            return () => clearTimeout(timer);
        }
    }, [countdown]);

    // 重置状态
    useEffect(() => {
        if (visible) {
            setOtp("");
            setCountdown(0);
        }
    }, [visible]);

    // 发送验证码
    const handleSendOTP = async () => {
        setIsSendingOTP(true);
        try {
            const { error } = await authClient.emailOtp.sendVerificationOtp({
                email: email,
                type: "email-verification",
            });

            if (error) {
                toast.error(error.message || "验证码发送失败");
            } else {
                setCountdown(60); // 60秒倒计时
                toast.success("验证码已发送到您的邮箱，请查收");
            }
        } catch (error) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsSendingOTP(false);
        }
    };

    // 验证邮箱
    const handleVerify = async () => {
        if (!otp.trim()) {
            toast.error("请输入验证码");
            return;
        }
        if (otp.length !== 6) {
            toast.error("验证码应为6位数字");
            return;
        }

        setIsLoading(true);
        try {
            const verifyResult = await authClient.emailOtp.verifyEmail({
                email: email,
                otp: otp.trim(),
            });

            if (verifyResult.error) {
                toast.error(verifyResult.error.message || "验证码错误或已过期");
            } else {
                toast.success("邮箱验证成功！正在登录...");
                onVerified();
                onClose();
            }
        } catch (error) {
            toast.error("网络连接失败，请稍后重试");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            initialHeightRatio={0.5}
            minHeightRatio={0.4}
            maxHeightRatio={0.7}
        >
            <ScrollView className="flex-1 px-6 pb-6">
                <View className="space-y-4">
                    {/* 标题 */}
                    <View className="items-center mb-4">
                        <View className="w-16 h-16 rounded-full bg-primary/10 items-center justify-center mb-3">
                            <Text className="text-3xl">✉️</Text>
                        </View>
                        <Text className="text-xl font-bold text-foreground">验证您的邮箱</Text>
                        <Text className="text-sm text-muted-foreground mt-2 text-center">
                            您的账户需要验证邮箱后才能登录
                        </Text>
                    </View>

                    {/* 邮箱地址显示 */}
                    <View className="bg-muted/30 p-3 rounded-lg">
                        <Text className="text-xs text-muted-foreground mb-1">邮箱地址</Text>
                        <Text className="text-sm font-medium text-foreground">{email}</Text>
                    </View>

                    {/* 验证码输入 */}
                    <View className="space-y-2">
                        <Label>验证码</Label>
                        <View className="flex-row gap-2">
                            <Input
                                placeholder="输入6位验证码"
                                value={otp}
                                onChangeText={setOtp}
                                keyboardType="number-pad"
                                maxLength={6}
                                className="flex-1"
                            />
                            <Button
                                variant="outline"
                                onPress={handleSendOTP}
                                disabled={isSendingOTP || countdown > 0}
                                className="px-4"
                            >
                                <Text className="text-sm">
                                    {countdown > 0
                                        ? `${countdown}秒`
                                        : isSendingOTP
                                          ? "发送中..."
                                          : "获取"}
                                </Text>
                            </Button>
                        </View>
                    </View>

                    {/* 提示信息 */}
                    <View className="bg-primary/5 p-3 rounded-lg">
                        <Text className="text-xs text-muted-foreground">
                            💡 验证码有效期为5分钟，如未收到请检查垃圾邮件箱
                        </Text>
                    </View>

                    {/* 操作按钮 */}
                    <View className="space-y-2 mt-2">
                        <Button
                            className="w-full"
                            onPress={handleVerify}
                            disabled={isLoading}
                        >
                            <Text className={isLoading ? "opacity-50" : ""}>
                                {isLoading ? "验证中..." : "验证邮箱"}
                            </Text>
                        </Button>

                        <Button
                            variant="ghost"
                            className="w-full"
                            onPress={onClose}
                        >
                            <Text>取消</Text>
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </BottomSheetModal>
    );
}
