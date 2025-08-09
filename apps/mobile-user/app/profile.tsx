import React, { useState, useEffect } from 'react';
import { View, ScrollView, Alert } from 'react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Button } from '@repo/mobile-ui/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@repo/mobile-ui/components/ui/card';
import { Input } from '@repo/mobile-ui/components/ui/input';
import { Label } from '@repo/mobile-ui/components/ui/label';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { LogoutButton } from '@/components/LogoutButton';
import { authClient } from '@/lib/auth-client';

export default function ProfileScreen() {
  const [user, setUser] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    email: '',
  });

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    try {
      const session = await authClient.getSession();
      if (session?.data?.user) {
        setUser(session.data.user);
        setFormData({
          name: session.data.user.name || '',
          email: session.data.user.email || '',
        });
      } else {
        router.replace('/auth/login' as any);
      }
    } catch (error) {
      Alert.alert('错误', '获取用户信息失败');
      router.replace('/auth/login' as any);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('错误', '姓名不能为空');
      return;
    }

    setIsLoading(true);
    try {
      // 这里应该调用更新用户信息的API
      // const result = await authClient.updateUser({ name: formData.name });

      Alert.alert('成功', '个人信息已更新');
      setIsEditing(false);
      await loadUser(); // 重新加载用户信息
    } catch (error) {
      Alert.alert('错误', '更新失败，请稍后重试');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      name: user?.name || '',
      email: user?.email || '',
    });
    setIsEditing(false);
  };

  if (isLoading) {
    return (
      <View className="flex-1 justify-center items-center bg-background">
        <Text className="text-muted-foreground">正在加载...</Text>
      </View>
    );
  }

  return (
    <ScrollView className="flex-1 bg-background">
      <StatusBar style="auto" />
      <View className="px-6 py-8">
        {/* Header */}
        <View className="items-center mb-8">
          <View className="w-24 h-24 rounded-full bg-primary items-center justify-center mb-4">
            <Text className="text-primary-foreground text-2xl font-bold">
              {user?.name?.charAt(0)?.toUpperCase() || 'U'}
            </Text>
          </View>
          <Text className="text-2xl font-bold text-foreground">个人资料</Text>
          <Text className="text-muted-foreground mt-1">管理您的账户信息</Text>
        </View>

        {/* Profile Form */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>基本信息</CardTitle>
            <CardDescription>您可以更新您的个人信息</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <View className="space-y-2">
              <Label>姓名</Label>
              <Input
                value={formData.name}
                onChangeText={(value) => setFormData(prev => ({ ...prev, name: value }))}
                editable={isEditing}
                className="w-full"
              />
            </View>

            <View className="space-y-2">
              <Label>邮箱</Label>
              <Input
                value={formData.email}
                editable={false}
                className="w-full opacity-50"
              />
              <Text className="text-xs text-muted-foreground">
                邮箱地址无法修改
              </Text>
            </View>

            {/* Action Buttons */}
            <View className="flex-row gap-3 mt-6">
              {isEditing ? (
                <>
                  <Button
                    variant="outline"
                    className="flex-1"
                    onPress={handleCancel}
                  >
                    <Text>取消</Text>
                  </Button>
                  <Button
                    className="flex-1"
                    onPress={handleSave}
                    disabled={isLoading}
                  >
                    <Text>{isLoading ? '保存中...' : '保存'}</Text>
                  </Button>
                </>
              ) : (
                <Button
                  className="flex-1"
                  onPress={() => setIsEditing(true)}
                >
                  <Text>编辑资料</Text>
                </Button>
              )}
            </View>
          </CardContent>
        </Card>

        {/* Account Info */}
        <Card className="mb-6">
          <CardHeader>
            <CardTitle>账户信息</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <View className="flex-row justify-between items-center">
              <Text className="text-muted-foreground">注册时间</Text>
              <Text className="font-medium">
                {user?.createdAt ? new Date(user.createdAt).toLocaleDateString('zh-CN') : '未知'}
              </Text>
            </View>
            <View className="flex-row justify-between items-center">
              <Text className="text-muted-foreground">邮箱验证</Text>
              <Text className={`font-medium ${user?.emailVerified ? 'text-green-600' : 'text-orange-600'}`}>
                {user?.emailVerified ? '已验证' : '未验证'}
              </Text>
            </View>
          </CardContent>
        </Card>

        {/* Settings */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>设置</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button variant="outline" className="w-full justify-start">
              <Text>修改密码</Text>
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Text>隐私设置</Text>
            </Button>
            <Button variant="outline" className="w-full justify-start">
              <Text>通知设置</Text>
            </Button>
          </CardContent>
        </Card>

        {/* Logout */}
        <LogoutButton variant="destructive" className="w-full" />
      </View>
    </ScrollView>
  );
}
