import type { Metadata } from "next";
import "@/app/globals.css";
import { SiteFooter } from "@/components/site/SiteFooter";
import { SiteHeader } from "@/components/site/SiteHeader";
import { SkipLink } from "@/components/a11y/SkipLink";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const viewport = {
    themeColor: "#ffb300",
};

export const metadata: Metadata = {
    metadataBase: new URL(SITE_URL),
    title: {
        default: `${SITE_NAME} - 专业团队到家，30 分钟极速响应`,
        template: `%s - ${SITE_NAME}`,
    },
    description:
        "叮咚上门为你提供便捷的家庭服务预约体验：选择服务、匹配服务人员、订单进度随时查看。立即下载体验。",
    alternates: {
        canonical: SITE_URL,
    },
    openGraph: {
        type: "website",
        url: SITE_URL,
        siteName: SITE_NAME,
        locale: "zh_CN",
        title: `${SITE_NAME} - 专业团队到家，30 分钟极速响应`,
        description:
            "便捷预约家庭服务：选择服务、匹配服务人员、订单进度随时查看。立即下载体验。",
    },
    twitter: {
        card: "summary_large_image",
        title: `${SITE_NAME} - 专业团队到家，30 分钟极速响应`,
        description:
            "便捷预约家庭服务：选择服务、匹配服务人员、订单进度随时查看。立即下载体验。",
    },
    robots: {
        index: true,
        follow: true,
    },
    manifest: "/site.webmanifest",
    applicationName: SITE_NAME,
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
        <html lang="zh-CN">
            <body>
                <SkipLink />
                <SiteHeader />
                <main id="content" className="min-h-[60vh]">
                    {children}
                </main>
                <SiteFooter />
            </body>
        </html>
    );
}
