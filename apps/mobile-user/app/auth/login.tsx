import React, { useState } from 'react';
import { View, ScrollView, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@repo/mobile-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/mobile-ui/components/ui/card';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { Label } from '@repo/mobile-ui/components/ui/label';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { authClient } from '@/lib/auth-client';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      Alert.alert('错误', '请填写邮箱和密码');
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await authClient.signIn.email({
        email: email.trim(),
        password: password,
      });

      if (error) {
        Alert.alert('登录失败', error.message || '登录时发生错误');
      } else {
        // 登录成功，跳转到主页
        router.replace('/(tabs)');
      }
    } catch (error) {
      Alert.alert('错误', '网络连接失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      className="flex-1"
    >
      <StatusBar style="auto" />
      <ScrollView contentContainerStyle={{ flexGrow: 1 }}>
        <View className="flex-1 justify-center px-6 py-12 bg-background">
          {/* Logo/Brand Section */}
          <View className="items-center mb-8">
            <View className="w-20 h-20 rounded-full bg-primary items-center justify-center mb-4">
              <Text className="text-primary-foreground text-2xl font-bold">H</Text>
            </View>
            <Text className="text-2xl font-bold text-foreground">上门服务</Text>
            <Text className="text-sm text-muted-foreground mt-1">
              专业便民，服务到家
            </Text>
          </View>

          {/* Login Form */}
          <Card className="w-full max-w-sm mx-auto">
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl text-center">登录</CardTitle>
              <CardDescription className="text-center">
                输入您的邮箱和密码来登录账户
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <View className="space-y-2">
                <Label>邮箱</Label>
                <Input
                  placeholder="输入您的邮箱"
                  value={email}
                  onChangeText={setEmail}
                  keyboardType="email-address"
                  autoCapitalize="none"
                  autoComplete="email"
                  className="w-full"
                />
              </View>

              <View className="space-y-2">
                <Label>密码</Label>
                <Input
                  placeholder="输入您的密码"
                  value={password}
                  onChangeText={setPassword}
                  secureTextEntry
                  autoComplete="password"
                  className="w-full"
                />
              </View>

              <Button
                className="w-full mt-6"
                onPress={handleLogin}
                disabled={isLoading}
              >
                <Text className={isLoading ? "opacity-50" : ""}>
                  {isLoading ? '登录中...' : '登录'}
                </Text>
              </Button>

              {/* Divider */}
              <View className="flex-row items-center my-4">
                <View className="flex-1 h-px bg-border" />
                <Text className="px-3 text-muted-foreground text-sm">或</Text>
                <View className="flex-1 h-px bg-border" />
              </View>

              {/* Register Link */}
              <View className="flex-row justify-center items-center space-x-1">
                <Text className="text-muted-foreground">还没有账户？</Text>
                <Button
                  variant="link"
                  className="p-0"
                  onPress={() => router.push('/auth/register' as any)}
                >
                  <Text className="text-primary">立即注册</Text>
                </Button>
              </View>
            </CardContent>
          </Card>

          {/* Footer */}
          <View className="mt-8 items-center">
            <Text className="text-xs text-muted-foreground text-center">
              登录即表示您同意我们的服务条款和隐私政策
            </Text>
          </View>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
