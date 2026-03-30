import type { Metadata } from "next";
import {
    WORKER_SITE_DESCRIPTION,
    WORKER_SITE_NAME,
    WORKER_SITE_SHORT_NAME,
    absoluteWorkerUrl,
} from "@/lib/worker-site";

export const viewport = {
    themeColor: "#0f172a",
};

export const metadata: Metadata = {
    title: {
        default: WORKER_SITE_NAME,
        template: `%s - ${WORKER_SITE_SHORT_NAME}`,
    },
    description: WORKER_SITE_DESCRIPTION,
    alternates: {
        canonical: absoluteWorkerUrl(),
    },
    icons: {
        icon: [
            {
                url: "/worker-app/icon",
                type: "image/png",
                sizes: "512x512",
            },
        ],
        shortcut: ["/worker-app/icon"],
        apple: [
            {
                url: "/worker-app/icon",
                type: "image/png",
            },
        ],
    },
    applicationName: WORKER_SITE_NAME,
    openGraph: {
        type: "website",
        url: absoluteWorkerUrl(),
        siteName: WORKER_SITE_NAME,
        locale: "zh_CN",
        title: WORKER_SITE_NAME,
        description: WORKER_SITE_DESCRIPTION,
        images: [absoluteWorkerUrl("/opengraph-image")],
    },
    twitter: {
        card: "summary_large_image",
        title: WORKER_SITE_NAME,
        description: WORKER_SITE_DESCRIPTION,
        images: [absoluteWorkerUrl("/opengraph-image")],
    },
    manifest: "/worker-app/manifest.webmanifest",
};

export default function WorkerSiteLayout({
    children,
}: Readonly<{ children: React.ReactNode }>) {
    return children;
}
