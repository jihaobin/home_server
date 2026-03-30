import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { absoluteWorkerUrl } from "@/lib/worker-site";

export const metadata: Metadata = {
    title: "支持",
    description: "查看叮咚上单的支持说明、下载帮助与平台联系入口，尽快解决安装或使用问题。",
    alternates: {
        canonical: absoluteWorkerUrl("/contact"),
    },
};

export default function WorkerContactPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                叮咚上单支持与帮助
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                无论你是刚准备安装，还是在接单过程中遇到问题，都可以从这里快速找到下载说明、FAQ 和平台支持入口。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-3">
                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        平台客服
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        微信号：jpq1199
                    </p>
                    <p className="mt-2 text-xs text-slate-500">
                        如安装、登录或使用过程中遇到问题，可通过平台客服进一步沟通，尽快恢复正常使用。
                    </p>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        下载帮助
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        如果你还没完成安装，可先进入叮咚上单下载页查看 APK 直链和安装步骤。
                    </p>
                    <div className="mt-6">
                        <ButtonLink
                            href="/worker-app/download"
                            variant="secondary"
                        >
                            查看下载页
                        </ButtonLink>
                    </div>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-black text-slate-950">
                        自助排查
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-600">
                        关于通知权限、未知来源安装、适用对象等常见问题，可先在 FAQ 中快速查找答案。
                    </p>
                    <div className="mt-6">
                        <ButtonLink href="/worker-app/faq" variant="secondary">
                            查看 FAQ
                        </ButtonLink>
                    </div>
                </Card>
            </div>
        </Container>
    );
}
