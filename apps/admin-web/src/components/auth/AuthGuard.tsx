"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthState } from '@/hooks/useAuthState';

interface AuthGuardProps {
  children: React.ReactNode;
  /**
   * 未登录时重定向的路径
   * @default '/login'
   */
  redirectTo?: string;
  /**
   * 加载时显示的组件
   */
  fallback?: React.ReactNode;
}

/**
 * 页面级权限控制组件
 * 保护整个页面，未登录时重定向到登录页
 *
 * @example
 * ```tsx
 * // 基本用法 - 需要登录才能访问
 * <AuthGuard>
 *   <UserProfile />
 * </AuthGuard>
 *
 * // 自定义重定向路径
 * <AuthGuard redirectTo="/auth/login">
 *   <UserDashboard />
 * </AuthGuard>
 *
 * // 自定义加载状态
 * <AuthGuard fallback={<PageSkeleton />}>
 *   <UserSettings />
 * </AuthGuard>
 * ```
 */
export function AuthGuard({
  children,
  redirectTo = '/login',
  fallback = <AuthGuardLoading />,
}: AuthGuardProps) {
  const { isLoading, isAuthenticated } = useAuthState();
  const router = useRouter();

  useEffect(() => {
    // 加载完成且未登录，重定向到登录页
    if (!isLoading && !isAuthenticated) {
      const currentPath = window.location.pathname;
      const redirectUrl = `${redirectTo}?redirect=${encodeURIComponent(currentPath)}`;
      router.push(redirectUrl);
    }
  }, [isLoading, isAuthenticated, redirectTo, router]);

  // 加载中
  if (isLoading) {
    return <>{fallback}</>;
  }

  // 未登录
  if (!isAuthenticated) {
    return null; // 重定向中，不显示内容
  }

  return <>{children}</>;
}

/**
 * 默认加载组件
 */
function AuthGuardLoading() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <div className="flex flex-col items-center space-y-4">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <p className="text-gray-600">验证登录状态...</p>
      </div>
    </div>
  );
}

/**
 * 高阶组件版本的AuthGuard
 * 用于包装页面组件
 *
 * @example
 * ```tsx
 * const ProtectedPage = withAuthGuard(UserProfile);
 *
 * // 或者带配置
 * const UserPage = withAuthGuard(UserDashboard, {
 *   redirectTo: '/auth/login'
 * });
 * ```
 */
export function withAuthGuard<P extends object>(
  Component: React.ComponentType<P>,
  options?: Omit<AuthGuardProps, 'children'>
) {
  return function WrappedComponent(props: P) {
    return (
      <AuthGuard {...options}>
        <Component {...props} />
      </AuthGuard>
    );
  };
}
