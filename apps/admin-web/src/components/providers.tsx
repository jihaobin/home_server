"use client"

import { useEffect, useState, type ReactNode } from "react"
import { QueryClientProvider } from "@tanstack/react-query"
import { ReactQueryDevtools } from "@tanstack/react-query-devtools"
import { Analytics } from "@vercel/analytics/react"
import { ThemeProvider as NextThemesProvider } from "next-themes"
import { Toaster } from "@repo/web-ui/components/sonner"
import {
    createQueryClient,
    setQueryClientErrorNotifier,
} from "@repo/lib/query-client"
import { toast } from "sonner"
import { RouteAnalyticsTracker } from "@/components/analytics/route-analytics-tracker"
import { ensureSsrApiClient } from "@/lib/ssr-api-client"

type ProvidersProps = {
    children: ReactNode
}

export function Providers({ children }: ProvidersProps) {
    ensureSsrApiClient()
    const [queryClient] = useState(() => createQueryClient())

    useEffect(() => {
        setQueryClientErrorNotifier((message) => {
            toast.error(message)
        })

        return () => {
            setQueryClientErrorNotifier(undefined)
        }
    }, [])

    return (
        <NextThemesProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
            enableColorScheme
        >
            <QueryClientProvider client={queryClient}>
                <RouteAnalyticsTracker />
                {children}
                <Toaster position="top-center" />
                <Analytics />
                {/* {process.env.NODE_ENV === "development" ? (
                    <ReactQueryDevtools initialIsOpen={false} />
                ) : null} */}
            </QueryClientProvider>
        </NextThemesProvider>
    )
}
