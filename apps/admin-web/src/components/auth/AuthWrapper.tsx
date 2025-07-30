"use client";

import { useAuthState } from '@/hooks/useAuthState';

interface AuthWrapperProps {
  /**
   * 登录时显示的内容
   */
  children: React.ReactNode;
  /**
   * 未登录时显示的内容
   */
  fallback?: React.ReactNode;
  /**
   * 加载时显示的内容
   */
  loading?: React.ReactNode;
  /**
   * 是否反转逻辑（未登录时显示children，登录时显示fallback）
   */
  reverse?: boolean;
}

/**
 * 条件渲染组件
 * 根据用户登录状态显示不同内容
 * 
 * @example
 * ```tsx
 * // 基本用法 - 登录显示用户信息，未登录显示登录提示
 * <AuthWrapper fallback={<LoginPrompt />}>
 *   <UserProfile />
 * </AuthWrapper>
 * 
 * // 反转逻辑 - 未登录显示登录按钮，登录后隐藏
 * <AuthWrapper reverse>
 *   <LoginButton />
 * </AuthWrapper>
 * 
 * // 自定义加载状态
 * <AuthWrapper 
 *   loading={<Skeleton />}
 *   fallback={<LoginForm />}
 * >
 *   <Dashboard />
 * </AuthWrapper>
 * ```
 */
export function AuthWrapper({
  children,
  fallback = null,
  loading = <AuthWrapperLoading />,
  reverse = false,
}: AuthWrapperProps) {
  const { isLoading, isAuthenticated } = useAuthState();

  // 加载中
  if (isLoading) {
    return <>{loading}</>;
  }

  // 反转逻辑
  if (reverse) {
    return isAuthenticated ? <>{fallback}</> : <>{children}</>;
  }

  // 正常逻辑
  return isAuthenticated ? <>{children}</> : <>{fallback}</>;
}

/**
 * 默认加载组件
 */
function AuthWrapperLoading() {
  return (
    <div className="animate-pulse">
      <div className="h-4 bg-gray-200 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-200 rounded w-1/2"></div>
    </div>
  );
}

/**
 * 便捷的条件渲染组件
 */

/**
 * 仅登录用户可见
 */
export function AuthOnly({ 
  children, 
  fallback = null,
  loading,
}: Pick<AuthWrapperProps, 'children' | 'fallback' | 'loading'>) {
  return (
    <AuthWrapper fallback={fallback} loading={loading}>
      {children}
    </AuthWrapper>
  );
}

/**
 * 仅未登录用户可见
 */
export function GuestOnly({ 
  children, 
  fallback = null,
  loading,
}: Pick<AuthWrapperProps, 'children' | 'fallback' | 'loading'>) {
  return (
    <AuthWrapper reverse fallback={fallback} loading={loading}>
      {children}
    </AuthWrapper>
  );
}
