"use client"

import type { ReactNode } from "react"
import {
    HydrationBoundary,
    type DehydratedState,
} from "@tanstack/react-query"

type HydrateClientProps = {
    children: ReactNode
    state?: DehydratedState
}

/**
 * 仅在客户端包裹 HydrationBoundary，允许服务端预取的 TanStack Query 数据完成水合。
 */
export function HydrateClient({ children, state }: HydrateClientProps) {
    return (
        <HydrationBoundary state={state}>
            {children}
        </HydrationBoundary>
    )
}
