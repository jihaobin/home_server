"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkerSiteFooter } from "@/components/site/WorkerSiteFooter";
import { WorkerSiteHeader } from "@/components/site/WorkerSiteHeader";

const CHROMELESS_PATHS = new Set(["/privacy", "/terms"]);

export function RouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isWorkerSite = pathname?.startsWith("/worker-app") ?? false;
    const isChromelessPage = pathname
        ? CHROMELESS_PATHS.has(pathname)
        : false;

    return (
        <>
            {isChromelessPage ? null : isWorkerSite ? (
                <WorkerSiteHeader />
            ) : (
                <SiteHeader />
            )}
            <main id="content" className="min-h-[60vh]">
                {children}
            </main>
            {isChromelessPage ? null : isWorkerSite ? (
                <WorkerSiteFooter />
            ) : (
                <SiteFooter />
            )}
        </>
    );
}
