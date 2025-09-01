import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { authClient } from '@/lib/auth-client';

type SessionData = {
  user: {
    id: string;
    name?: string;
    email?: string;
    [key: string]: any;
  };
  session: {
    id: string;
    [key: string]: any;
  };
} | null;

type SessionContextType = {
  data: SessionData;
  isLoading: boolean;
  error: Error | null;
  refetch: () => Promise<void>;
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const [data, setData] = useState<SessionData>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchSession = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const session = await authClient.getSession();
      setData(session.data || null);
    } catch (err) {
      console.error('获取 session 失败:', err);
      setError(err as Error);
      setData(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchSession();
  }, []);

  const contextValue: SessionContextType = {
    data,
    isLoading,
    error,
    refetch: fetchSession,
  };

  return (
    <SessionContext.Provider value={contextValue}>
      {children}
    </SessionContext.Provider>
  );
}

/**
 * 自定义的 useSession Hook，避免直接使用 authClient.useSession
 * 这个实现使用 Context 来管理 session 状态，解决 monorepo 中的 Hook 调用问题
 */
export function useSession() {
  const context = useContext(SessionContext);

  if (context === undefined) {
    throw new Error('useSession 必须在 SessionProvider 内部使用');
  }

  return context;
}

/**
 * 便捷的认证相关方法
 */
export const useAuth = () => {
  const session = useSession();

  return {
    session,
    signIn: authClient.signIn,
    signUp: authClient.signUp,
    signOut: authClient.signOut,
    getCookie: authClient.getCookie,
  };
};
