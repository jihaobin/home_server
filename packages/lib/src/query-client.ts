import { ErrorCode } from "@repo/types";
import {
  QueryCache,
  QueryClient,
  type DefaultOptions,
} from "@tanstack/react-query";

type QueryClientErrorNotifier = (message: string, error: unknown) => void;

let errorNotifier: QueryClientErrorNotifier | undefined;

export function setQueryClientErrorNotifier(
  notifier?: QueryClientErrorNotifier
) {
  errorNotifier = notifier;
}

const defaultQueryOptions: DefaultOptions = {
  queries: {
    retry: (failureCount: number, error: any) => {
      if (
        error?.code === ErrorCode.UNAUTHORIZED ||
        error?.status === 401 ||
        error?.response?.status === 401
      ) {
        return false;
      }

      return failureCount < 2;
    },
    staleTime: 2 * 60 * 1000
  },

};

function createQueryCache() {
  return new QueryCache({
    onError: (error, query) => {
      const message = query.meta?.errorMessage;
      if (message && errorNotifier) {
        errorNotifier(String(message), error);
      }
    },
  });
}

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: defaultQueryOptions,
    queryCache: createQueryCache(),
  });
}

export const queryClient = createQueryClient();
