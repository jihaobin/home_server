import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DOWNLOAD_URL, SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "联系与支持",
    description: "获取叮咚上门的帮助与支持。",
    alternates: {
        canonical: absoluteUrl("/contact"),
    },
};

export default function ContactPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                联系与支持
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                如需帮助，建议优先使用 App 内的入口以便我们更准确定位问题。
            </p>

            <div className="mt-8 grid gap-4 md:grid-cols-2">
                <Card className="p-8">
                    <div className="text-lg font-extrabold">官方客服</div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        打开 App → 进入“我的/个人中心” → 点击“官方客服”。
                    </p>
                </Card>

                <Card className="p-8">
                    <div className="text-lg font-extrabold">投诉/售后</div>
                    <p className="mt-3 text-sm text-muted-foreground">
                        打开 App → 进入“我的/个人中心” →
                        点击“投诉/售后”，提交问题与相关信息。
                    </p>
                </Card>
            </div>

            <Card className="mt-10 p-8">
                <div className="text-lg font-extrabold">站点说明（占位）</div>
                <p className="mt-3 text-sm text-muted-foreground">
                    本页面为营销站点的联系入口示例。若你需要“表单提交并落到工单/邮件”，可以在后续接入后端接口或第三方表单服务。
                </p>
            </Card>

            <Card className="mt-10 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xl font-extrabold">
                            立即下载体验
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            下载 {SITE_NAME}，开始预约家庭服务。
                        </div>
                    </div>
                    <ButtonLink href={DOWNLOAD_URL} size="lg">
                        下载 App
                    </ButtonLink>
                </div>
            </Card>
        </Container>
    );
}
