import "server-only"

import {
    dehydrate,
    type DehydratedState,
    type QueryClient,
} from "@tanstack/react-query"
import { createQueryClient } from "@repo/lib/query-client"

/**
 * 服务端辅助方法：创建独立的 QueryClient，执行预取后返回可用于 Hydration 的状态。
 */
export async function prefetchDehydratedState(
    prefetcher: (queryClient: QueryClient) => Promise<void>
): Promise<DehydratedState> {
    const queryClient = createQueryClient()

    await prefetcher(queryClient)

    const dehydratedState = dehydrate(queryClient)

    // 释放缓存，防止服务端内存泄漏
    queryClient.clear()

    return dehydratedState
}
