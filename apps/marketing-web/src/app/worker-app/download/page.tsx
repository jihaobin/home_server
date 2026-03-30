import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_DOWNLOAD_URL } from "@/lib/site";
import { absoluteWorkerUrl } from "@/lib/worker-site";

export const metadata: Metadata = {
    title: "下载",
    description: "下载叮咚上单 APK，并查看安装、通知权限与常见处理方式。",
    alternates: {
        canonical: absoluteWorkerUrl("/download"),
    },
};

export default function WorkerDownloadPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                下载叮咚上单 APK
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                这里是叮咚上单独立站点的下载页。你将直接获取 Android
                APK，并按下方指引完成安装与初始设置。
            </p>

            <div className="mt-8 grid gap-6 md:grid-cols-2">
                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        APK 直链下载
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        点击下方按钮开始下载。如浏览器拦截下载，请在系统或浏览器设置里允许当前文件下载。
                    </p>
                    <div className="mt-6">
                        <ButtonLink
                            href={WORKER_DOWNLOAD_URL}
                            size="lg"
                            className="bg-sky-500 text-white hover:bg-sky-400"
                        >
                            立即下载 APK
                        </ButtonLink>
                    </div>
                    <div className="mt-4 break-all rounded-(--radius) border border-border bg-slate-50 px-4 py-3 text-xs text-slate-500">
                        {WORKER_DOWNLOAD_URL}
                    </div>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        安装与首次使用
                    </div>
                    <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-7 text-slate-600">
                        <li>下载完成后，点击 APK 文件开始安装。</li>
                        <li>
                            如出现“禁止安装未知来源应用”，请为当前浏览器或文件管理器开启安装权限。
                        </li>
                        <li>
                            安装完成并登录后，建议开启通知、后台运行等必要权限，以便正常接收接单提醒。
                        </li>
                    </ol>
                    <p className="mt-4 text-xs text-slate-500">
                        提示：不同品牌手机的入口位置可能不同，搜索“未知来源应用安装”通常可以更快找到对应设置。
                    </p>
                </Card>
            </div>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        推荐安装后检查
                    </div>
                    <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
                        <li>通知权限是否开启</li>
                        <li>是否允许后台运行，避免错过接单提醒</li>
                        <li>登录状态是否正常，可否进入订单与收益页面</li>
                    </ul>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        需要更多帮助？
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        如果你在安装或登录过程中遇到问题，可以继续查看
                        FAQ，或前往支持页获取帮助入口。
                    </p>
                    <div className="mt-6 flex flex-col gap-3 sm:flex-row">
                        <ButtonLink href="/worker-app/faq" variant="secondary">
                            查看 FAQ
                        </ButtonLink>
                        <ButtonLink
                            href="/worker-app/contact"
                            variant="secondary"
                        >
                            支持页
                        </ButtonLink>
                    </div>
                </Card>
            </div>
        </Container>
    );
}
