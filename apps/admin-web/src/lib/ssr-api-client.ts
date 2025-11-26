import { setSsrApiClient } from "@repo/hooks/api/ssr"
import { setSharedApiClient } from "@repo/lib/http-client"
import { apiClient } from "@/lib/api-client"

let initialized = false

/**
 * 确保 SSR Hook 在被调用前注入当前应用的 apiClient。
 * 避免依赖模块加载顺序导致的未初始化问题。
 */
export function ensureSsrApiClient() {
    if (initialized) {
        return
    }

    setSsrApiClient(apiClient)
    setSharedApiClient(apiClient)
    initialized = true
}
