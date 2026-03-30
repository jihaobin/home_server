import type { MetadataRoute } from "next";
import { WORKER_DOWNLOAD_URL, SITE_URL } from "@/lib/site";
import { WORKER_SITE_NAME, WORKER_SITE_SHORT_NAME } from "@/lib/worker-site";

export default function manifest(): MetadataRoute.Manifest {
    return {
        name: WORKER_SITE_NAME,
        short_name: WORKER_SITE_SHORT_NAME,
        description:
            "服务人员端独立站点，提供接单、服务推进、收益管理介绍与 APK 下载。",
        start_url: "/worker-app",
        display: "standalone",
        background_color: "#020617",
        theme_color: "#0f172a",
        icons: [
            {
                src: `${SITE_URL}/worker-app/icon`,
                sizes: "512x512",
                type: "image/png",
            },
        ],
        related_applications: [
            {
                platform: "webapp",
                url: WORKER_DOWNLOAD_URL,
            },
        ],
    };
}
