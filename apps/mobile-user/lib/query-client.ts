import { ErrorCode } from "@repo/types";
import { QueryCache, QueryClient } from "@tanstack/react-query";
import { toast } from "sonner-native";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: (failureCount, error: any) => {
        // 不重试401未授权错误
        if (
          error?.code === ErrorCode.UNAUTHORIZED ||
          error?.status === 401 ||
          error?.response?.status === 401
        ) {
          return false;
        }

        // 其他错误使用默认的重试次数(2次)
        return failureCount < 2;
      },
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 30, // 30分钟
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
    if (query.meta?.errorMessage) {
        toast.error(query.meta.errorMessage as string)
      }
    }
  })
});