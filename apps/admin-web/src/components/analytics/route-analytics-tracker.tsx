"use client"

import { useEffect } from "react"
import { usePathname, useSearchParams } from "next/navigation"
import { track } from "@vercel/analytics/react"

/**
 * 监听路由变化并发送基础埋点，方便后续扩展日志系统
 */
export function RouteAnalyticsTracker() {
    const pathname = usePathname()
    const searchParams = useSearchParams()

    useEffect(() => {
        if (!pathname) {
            return
        }

        const queryString = searchParams?.toString() ?? ""
        const payload = {
            pathname,
            search: queryString,
        }

        // 上报到 Vercel Analytics
        track("route_view", payload)

        // 本地开发环境辅助日志
        if (process.env.NODE_ENV === "development") {
            // eslint-disable-next-line no-console
            console.info("[admin-web] route change", payload)
        }
    }, [pathname, searchParams])

    return null
}
