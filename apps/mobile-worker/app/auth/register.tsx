import { Button } from "@repo/mobile-ui/components/ui/button";
import {
    Card,
    CardContent,
    CardDescription,
    CardHeader,
    CardTitle,
} from "@repo/mobile-ui/components/ui/card";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { Label } from "@repo/mobile-ui/components/ui/label";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { router } from "expo-router";
import { StatusBar } from "expo-status-bar";
import React, { useState } from "react";
import {
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    View,
} from "react-native";
import { authClient } from "@repo/lib/auth-client";

export default function RegisterScreen() {
    const [formData, setFormData] = useState({
        name: "",
        email: "",
        phone: "",
        password: "",
        confirmPassword: "",
    });
    const [isLoading, setIsLoading] = useState(false);

    const handleInputChange = (field: keyof typeof formData, value: string) => {
        setFormData((prev) => ({ ...prev, [field]: value }));
    };

    const validateForm = () => {
        if (!formData.name.trim()) {
            Alert.alert("错误", "请输入姓名");
            return false;
        }
        if (!formData.email.trim()) {
            Alert.alert("错误", "请输入邮箱");
            return false;
        }
        if (!formData.phone.trim()) {
            Alert.alert("错误", "请输入手机号");
            return false;
        }
        if (formData.password.length < 6) {
            Alert.alert("错误", "密码至少需要6位字符");
            return false;
        }
        if (formData.password !== formData.confirmPassword) {
            Alert.alert("错误", "两次输入的密码不一致");
            return false;
        }
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(formData.email)) {
            Alert.alert("错误", "请输入有效的邮箱地址");
            return false;
        }
        const phoneRegex = /^1[3-9]\d{9}$/;
        if (!phoneRegex.test(formData.phone)) {
            Alert.alert("错误", "请输入有效的手机号");
            return false;
        }
        return true;
    };

    const handleRegister = async () => {
        if (!validateForm()) return;

        setIsLoading(true);
        try {
            const { data, error } = await authClient.signUp.email({
                email: formData.email.trim(),
                password: formData.password,
                name: formData.name.trim(),
            });

            if (error) {
                Alert.alert("注册失败", error.message || "注册时发生错误");
            } else {
                Alert.alert("注册成功", "账户创建成功！请前往登录。", [
                    {
                        text: "确定",
                        onPress: () => router.replace("/auth/login" as any),
                    },
                ]);
            }
        } catch (error) {
            Alert.alert("错误", "网络连接失败，请稍后重试");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <KeyboardAvoidingView
            behavior={Platform.OS === "ios" ? "padding" : "height"}
            className="flex-1"
        >
            <StatusBar style="auto" />
            <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
                <View className="flex-1 justify-center px-6 py-12 bg-background">
                    {/* Logo/Brand Section */}
                    <View className="items-center mb-8">
                        <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
                            <Text className="text-primary-foreground text-2xl font-bold">
                                H
                            </Text>
                        </View>
                        <Text className="text-2xl font-bold text-foreground">叮咚上门</Text>
                        <Text className="text-sm text-muted-foreground mt-1">
                            创建账户，开始便民服务之旅
                        </Text>
                    </View>

                    {/* Register Form */}
                    <Card className="w-full max-w-sm mx-auto">
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-2xl text-center">注册账户</CardTitle>
                            <CardDescription className="text-center">
                                填写以下信息来创建您的账户
                            </CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <View className="space-y-2">
                                <Label>姓名</Label>
                                <Input
                                    placeholder="输入您的姓名"
                                    value={formData.name}
                                    onChangeText={(value) => handleInputChange("name", value)}
                                    autoComplete="name"
                                    className="w-full"
                                />
                            </View>

                            <View className="space-y-2">
                                <Label>邮箱</Label>
                                <Input
                                    placeholder="输入您的邮箱"
                                    value={formData.email}
                                    onChangeText={(value) => handleInputChange("email", value)}
                                    keyboardType="email-address"
                                    autoCapitalize="none"
                                    autoComplete="email"
                                    className="w-full"
                                />
                            </View>

                            <View className="space-y-2">
                                <Label>手机号</Label>
                                <Input
                                    placeholder="输入您的手机号"
                                    value={formData.phone}
                                    onChangeText={(value) => handleInputChange("phone", value)}
                                    keyboardType="phone-pad"
                                    autoComplete="tel"
                                    className="w-full"
                                />
                            </View>

                            <View className="space-y-2">
                                <Label>密码</Label>
                                <Input
                                    placeholder="输入密码（至少6位）"
                                    value={formData.password}
                                    onChangeText={(value) => handleInputChange("password", value)}
                                    secureTextEntry
                                    autoComplete="new-password"
                                    className="w-full"
                                />
                            </View>

                            <View className="space-y-2">
                                <Label>确认密码</Label>
                                <Input
                                    placeholder="再次输入密码"
                                    value={formData.confirmPassword}
                                    onChangeText={(value) =>
                                        handleInputChange("confirmPassword", value)
                                    }
                                    secureTextEntry
                                    autoComplete="new-password"
                                    className="w-full"
                                />
                            </View>

                            <Button
                                className="w-full mt-6"
                                onPress={handleRegister}
                                disabled={isLoading}
                            >
                                <Text className={isLoading ? "opacity-50" : ""}>
                                    {isLoading ? "注册中..." : "创建账户"}
                                </Text>
                            </Button>

                            {/* Divider */}
                            <View className="flex-row items-center my-4">
                                <View className="flex-1 h-px bg-border" />
                                <Text className="px-3 text-muted-foreground text-sm">或</Text>
                                <View className="flex-1 h-px bg-border" />
                            </View>

                            {/* Login Link */}
                            <View className="flex-row justify-center items-center space-x-1">
                                <Text className="text-muted-foreground">已有账户？</Text>
                                <Button
                                    variant="link"
                                    className="p-0"
                                    onPress={() => router.replace("/auth/login" as any)}
                                >
                                    <Text className="text-primary">立即登录</Text>
                                </Button>
                            </View>
                        </CardContent>
                    </Card>

                    {/* Footer */}
                    <View className="mt-8 items-center">
                        <Text className="text-xs text-muted-foreground text-center">
                            注册即表示您同意我们的服务条款和隐私政策
                        </Text>
                    </View>
                </View>
            </ScrollView>
        </KeyboardAvoidingView>
    );
}
