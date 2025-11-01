import {
	createContext,
	type ReactNode,
	use,
	useContext,
	useState,
} from "react";
import { authClient } from "@repo/lib/auth-client";

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
	sessionPromise: Promise<SessionData>;
	refetch: () => void;
	isRefetching: boolean; // 用于跟踪 refetch 状态
};

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
	children: ReactNode;
}

// 创建一个缓存的 session 获取函数
const createSessionPromise = async (): Promise<SessionData> => {
	try {
        const session = await authClient
            .getSession();
        return session.data || null;
    } catch (err) {
        console.error("获取 session 失败:", err);
        return null;
    }
};

export function SessionProvider({ children }: SessionProviderProps) {
	const [sessionPromise, setSessionPromise] = useState<Promise<SessionData>>(
		() => createSessionPromise(),
	);
	// 跟踪是否正在 refetch（可选，用于在组件中显示 inline loading）
	const [isRefetching, setIsRefetching] = useState(false);

	const refetch = () => {
		setIsRefetching(true);
		const newPromise = createSessionPromise();
		// 等待 Promise 完成后重置 refetching 状态
		newPromise.finally(() => setIsRefetching(false));
		setSessionPromise(newPromise);
	};

	const contextValue: SessionContextType = {
		sessionPromise,
		refetch,
		isRefetching, // 暴露 refetching 状态
	};

	return (
		<SessionContext.Provider value={contextValue}>
			{children}
		</SessionContext.Provider>
	);
}

/**
 * 自定义的 useSession Hook，使用 React 19 的 use hook
 * 这个实现使用 Context + Promise 来管理 session 状态，解决 monorepo 中的 Hook 调用问题
 *
 * 注意：使用此 Hook 的组件应该被 Suspense 包裹，以处理 loading 状态
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const session = useSession();
 *   // session.data 包含用户信息，如果未登录则为 null
 *   return <Text>{session.data?.user.name}</Text>;
 * }
 *
 * // 在父组件中使用 Suspense
 * <Suspense fallback={<LoadingSpinner />}>
 *   <MyComponent />
 * </Suspense>
 * ```
 */
export function useSession() {
	const context = useContext(SessionContext);

	if (context === undefined) {
		throw new Error("useSession 必须在 SessionProvider 内部使用");
	}

	// 使用 React 19 的 use hook 读取 Promise
	// 这会在 Promise pending 时触发 Suspense
	const data = use(context.sessionPromise);

	return {
		session: data,
		// isLoading: 初次加载时，代码不会执行到这里（被 Suspense 拦截）
		// 所以这里的 isLoading 实际上表示的是"是否正在 refetch"
		isLoading: context.isRefetching,
		error: null,
		refetch: context.refetch,
	};
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
