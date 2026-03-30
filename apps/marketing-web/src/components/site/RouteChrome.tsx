"use client";

import { usePathname } from "next/navigation";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { WorkerSiteFooter } from "@/components/site/WorkerSiteFooter";
import { WorkerSiteHeader } from "@/components/site/WorkerSiteHeader";

export function RouteChrome({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const isWorkerSite = pathname?.startsWith("/worker-app") ?? false;

    return (
        <>
            {isWorkerSite ? <WorkerSiteHeader /> : <SiteHeader />}
            <main id="content" className="min-h-[60vh]">
                {children}
            </main>
            {isWorkerSite ? <WorkerSiteFooter /> : <SiteFooter />}
        </>
    );
}
