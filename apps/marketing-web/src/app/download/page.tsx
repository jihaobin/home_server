import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DOWNLOAD_URL, SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "下载",
    description: "下载叮咚上门 APK，并查看安装与常见问题指引。",
    alternates: {
        canonical: absoluteUrl("/download"),
    },
};

export default function DownloadPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                下载 {SITE_NAME}
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                你将直接下载 Android APK 文件。下载后请按照下面指引完成安装。
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
                <Card className="p-8">
                    <div className="text-lg font-extrabold">APK 直链下载</div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        点击按钮开始下载。若浏览器拦截下载，请在下载设置中允许。
                    </p>
                    <div className="mt-6">
                        <ButtonLink href={DOWNLOAD_URL} size="lg">
                            立即下载 APK
                        </ButtonLink>
                    </div>
                    <div className="mt-4 break-all rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                        {DOWNLOAD_URL}
                    </div>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-extrabold">安装指引</div>
                    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm text-muted-foreground">
                        <li>下载完成后，点击文件开始安装。</li>
                        <li>
                            若出现“禁止安装未知来源应用”，请在系统设置中为当前浏览器/文件管理器开启权限。
                        </li>
                        <li>安装完成后，打开 App 并按提示完成登录/授权。</li>
                    </ol>
                    <p className="mt-4 text-xs text-muted-foreground">
                        提示：不同品牌手机设置入口可能不同，搜索“未知来源应用安装”通常可以找到对应选项。
                    </p>
                </Card>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
                <Card className="p-8">
                    <div className="text-lg font-extrabold">常见问题</div>
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                        <li>
                            下载后无法打开：请确认下载完整，或换浏览器重试。
                        </li>
                        <li>
                            安装失败：检查存储空间与系统版本，必要时重启后再试。
                        </li>
                        <li>网络请求异常：确认网络通畅，或稍后重试。</li>
                    </ul>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-extrabold">需要帮助？</div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        你可以在 App
                        内通过“官方客服”或“投诉/售后”入口提交问题与反馈。
                    </p>
                    <div className="mt-6">
                        <ButtonLink href="/faq" variant="secondary">
                            查看 FAQ
                        </ButtonLink>
                    </div>
                </Card>
            </div>
        </Container>
    );
}
