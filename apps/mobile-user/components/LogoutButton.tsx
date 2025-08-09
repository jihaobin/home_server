import React from 'react';
import { Alert } from 'react-native';
import { router } from 'expo-router';
import { Button } from '@repo/mobile-ui/components/ui/button';
import { Text } from '@repo/mobile-ui/components/ui/text';
import { authClient } from '@/lib/auth-client';

interface LogoutButtonProps {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  className?: string;
}

export function LogoutButton({
  variant = 'outline',
  size = 'default',
  className
}: LogoutButtonProps) {
  const handleLogout = async () => {
    Alert.alert(
      '确认退出',
      '您确定要退出登录吗？',
      [
        {
          text: '取消',
          style: 'cancel',
        },
        {
          text: '退出',
          style: 'destructive',
          onPress: async () => {
            try {
              await authClient.signOut();
              router.replace('/auth/login' as any);
            } catch (error) {
              Alert.alert('错误', '退出登录失败，请重试');
            }
          },
        },
      ]
    );
  };

  return (
    <Button
      variant={variant}
      size={size}
      className={className}
      onPress={handleLogout}
    >
      <Text>退出登录</Text>
    </Button>
  );
}
