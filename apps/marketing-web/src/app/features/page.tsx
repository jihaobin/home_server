import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { DOWNLOAD_URL, SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "功能介绍",
    description:
        "了解叮咚上门的核心功能：服务选择、服务人员、订单进度、地址管理与售后入口。",
    alternates: {
        canonical: absoluteUrl("/features"),
    },
};

const FEATURE_GROUPS = [
    {
        title: "服务选择",
        items: [
            "分类浏览，快速定位服务方向",
            "关键词搜索，减少查找成本",
            "服务说明更清晰，避免误会",
        ],
    },
    {
        title: "服务人员",
        items: ["可选择服务人员，匹配更合适", "信息展示更直观，减少不确定性"],
    },
    {
        title: "订单中心",
        items: [
            "订单状态可追踪：待付款 / 待服务 / 待验收",
            "随时查看进度，沟通更省心",
        ],
    },
    {
        title: "地址管理",
        items: ["常用服务地址管理", "减少重复填写，预约更快捷"],
    },
    {
        title: "售后与反馈",
        items: ["提供投诉/售后入口", "问题有出口，处理更高效"],
    },
];

export default function FeaturesPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                {SITE_NAME} 功能介绍
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                我们把上门服务的关键体验做得更可见：选服务、选人员、看进度、好售后。
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2">
                {FEATURE_GROUPS.map((group) => (
                    <Card key={group.title} className="p-6">
                        <div className="text-lg font-extrabold">
                            {group.title}
                        </div>
                        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-muted-foreground">
                            {group.items.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </Card>
                ))}
            </div>

            <Card className="mt-12 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xl font-extrabold">
                            立即下载体验
                        </div>
                        <div className="mt-2 text-sm text-muted-foreground">
                            下载 APK，按照指引完成安装即可开始预约。
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
