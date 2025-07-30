"use client";

import { useEffect, useState } from 'react';
import { useSession } from './useAuth';

/**
 * 统一的认证状态管理Hook
 * 提供登录状态和用户信息
 */
export function useAuthState() {
  const [state, setState] = useState({
    user: null,
    isLoading: true,
    isAuthenticated: false,
  });

  // 使用客户端session hook
  const { data: session, isPending } = useSession();

  // 初始化和同步认证状态
  useEffect(() => {
    const initAuth = async () => {
      try {
        setState(prev => ({ ...prev, isLoading: true }));

        // 如果有session，获取完整用户信息
        if (session?.user) {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: true,
          });
        } else {
          setState({
            user: null,
            isLoading: false,
            isAuthenticated: false,
          });
        }
      } catch (error) {
        console.error('Auth initialization error:', error);
        setState({
          user: null,
          isLoading: false,
          isAuthenticated: false,
        });
      }
    };

    // 等待session加载完成
    if (!isPending) {
      initAuth();
    }
  }, [session, isPending]);

  return state;
}

/**
 * 简化版认证Hook，只返回基本信息
 */
export function useAuth() {
  const { user, isLoading, isAuthenticated } = useAuthState();
  return { user, isLoading, isAuthenticated };
}
