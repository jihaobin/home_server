import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DOWNLOAD_URL, SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "常见问题",
    description: "关于叮咚上门的下载、下单、订单进度、售后等常见问题解答。",
    alternates: {
        canonical: absoluteUrl("/faq"),
    },
};

const FAQ_ITEMS = [
    {
        title: "叮咚上门主要解决什么问题？",
        content: (
            <p>
                我们希望把家庭服务预约做得更清晰：选服务、选人员、看进度、可售后。
            </p>
        ),
    },
    {
        title: "下载链接在哪里？",
        content: (
            <p>
                你可以前往下载页获取 APK 直链：<a href="/download">/download</a>
                。
            </p>
        ),
    },
    {
        title: "安装时提示“未知来源应用”，怎么办？",
        content: (
            <p>
                在系统设置中为当前浏览器/文件管理器开启“允许安装未知来源应用”权限，然后重新安装。
            </p>
        ),
    },
    {
        title: "下单后怎么查看订单状态？",
        content: (
            <p>订单中心会展示不同状态与筛选入口，帮助你随时掌握服务进度。</p>
        ),
    },
    {
        title: "如何反馈问题或申请售后？",
        content: (
            <p>
                你可以在 App
                内通过“投诉/售后”入口发起反馈，我们会按流程跟进处理。
            </p>
        ),
    },
];

export default function FaqPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                常见问题
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                以下为用户常见问题汇总。如果你需要更进一步的帮助，建议在 App
                内使用“官方客服”。
            </p>

            <div className="mt-8">
                <Accordion items={FAQ_ITEMS} defaultIndex={0} />
            </div>

            <Card className="mt-12 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xl font-extrabold">还没下载？</div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            下载 {SITE_NAME} 体验更省心的家庭服务预约。
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
