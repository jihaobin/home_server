import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Accordion } from "@/components/ui/Accordion";
import { DOWNLOAD_URL, SITE_NAME } from "@/lib/site";
import {
    JsonLdScript,
    mobileApplicationJsonLd,
    organizationJsonLd,
    websiteJsonLd,
} from "@/lib/seo/jsonld";

import appIcon from "../../../mobile-user/assets/images/icon.png";

const FAQ_ITEMS = [
    {
        title: "叮咚上门提供哪些服务？",
        content: (
            <p>
                你可以在 App
                内浏览服务分类并搜索关键词，选择适合的服务项目下单。
            </p>
        ),
    },
    {
        title: "如何选择服务人员？",
        content: (
            <p>
                在服务详情中选择服务人员，系统会展示可选人员信息与距离等参考信息。
            </p>
        ),
    },
    {
        title: "下单后如何查看进度？",
        content: (
            <p>
                订单中心提供状态筛选与进度查看，支持待付款、待服务、待验收等状态。
            </p>
        ),
    },
    {
        title: "遇到问题如何售后/投诉？",
        content: (
            <p>
                你可以在 App
                内通过“投诉/售后”入口发起反馈，我们会按流程跟进处理。
            </p>
        ),
    },
];

const VALUE_CARDS = [
    {
        title: "响应更快",
        desc: "把等待变短：更快确认需求与上门安排。",
    },
    {
        title: "进度更清晰",
        desc: "订单状态可追踪，不用反复问“到哪了”。",
    },
    {
        title: "售后有出口",
        desc: "遇到问题可以通过入口反馈，按流程处理。",
    },
];

const STEPS = [
    {
        step: "01",
        title: "选择服务",
        desc: "分类浏览或搜索关键词，找到你需要的服务。",
    },
    {
        step: "02",
        title: "选择人员",
        desc: "选择合适的服务人员，减少沟通成本。",
    },
    {
        step: "03",
        title: "查看进度",
        desc: "在订单中心跟踪状态，服务完成后可反馈。",
    },
];

export default function HomePage() {
    return (
        <>
            <JsonLdScript data={organizationJsonLd()} />
            <JsonLdScript data={websiteJsonLd()} />
            <JsonLdScript data={mobileApplicationJsonLd()} />

            <div className="relative overflow-hidden">
                <div className="absolute inset-0 -z-10">
                    <div
                        className="absolute -top-24 left-1/2 h-72 w-[900px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
                        style={{
                            background:
                                "radial-gradient(circle at 50% 50%, hsl(var(--ring)) 0%, transparent 60%)",
                        }}
                    />
                    <div className="absolute inset-0 bg-[linear-gradient(to_bottom,rgba(255,255,255,0.9),rgba(255,255,255,1))] dark:bg-[linear-gradient(to_bottom,rgba(2,6,23,0.85),rgba(2,6,23,1))]" />
                </div>

                <Container className="py-16 md:py-24">
                    <div className="grid gap-10 md:grid-cols-2 md:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                                <span
                                    className="h-2 w-2 rounded-full"
                                    style={{
                                        background: "hsl(var(--primary))",
                                    }}
                                />
                                家庭服务预约更省心
                            </div>

                            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
                                {SITE_NAME}
                                <span className="block text-foreground/80">
                                    专业团队到家，30 分钟极速响应
                                </span>
                            </h1>

                            <p className="mt-5 text-base leading-7 text-muted-foreground">
                                选服务、选人员、下单、看进度。把复杂的上门服务流程，做成你一眼就能理解的体验。
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <ButtonLink href={DOWNLOAD_URL} size="lg">
                                    立即下载 App
                                </ButtonLink>
                                <ButtonLink
                                    href="/features"
                                    variant="secondary"
                                    size="lg"
                                >
                                    查看功能
                                </ButtonLink>
                            </div>

                            <p className="mt-4 text-xs text-muted-foreground">
                                下载链接为直链 APK：{DOWNLOAD_URL}
                            </p>
                        </div>

                        <div className="relative">
                            <Card className="overflow-hidden">
                                <div className="p-6">
                                    <div className="flex items-center gap-4">
                                        <Image
                                            src={appIcon}
                                            alt="叮咚上门应用图标"
                                            width={64}
                                            height={64}
                                            className="rounded-2xl"
                                            priority
                                        />
                                        <div>
                                            <div className="text-lg font-extrabold tracking-tight">
                                                {SITE_NAME}
                                            </div>
                                            <div className="mt-1 text-sm text-muted-foreground">
                                                家庭服务预约 · 订单进度可追踪 ·
                                                售后有入口
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-6 grid gap-3">
                                        {[
                                            {
                                                title: "服务选择",
                                                desc: "分类浏览 + 关键词搜索，快速定位需求。",
                                            },
                                            {
                                                title: "服务人员",
                                                desc: "选择合适的服务人员，减少不确定性。",
                                            },
                                            {
                                                title: "订单中心",
                                                desc: "状态清晰可见，随时掌握服务进度。",
                                            },
                                            {
                                                title: "地址管理",
                                                desc: "常用服务地址管理，预约更省事。",
                                            },
                                        ].map((item) => (
                                            <div
                                                key={item.title}
                                                className="rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3"
                                            >
                                                <div className="text-sm font-semibold">
                                                    {item.title}
                                                </div>
                                                <div className="mt-1 text-sm text-muted-foreground">
                                                    {item.desc}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>

                                <div className="border-t border-border bg-muted/30 p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="text-sm font-semibold">
                                            现在就开始
                                        </div>
                                        <Link
                                            href="/download"
                                            className="text-sm font-semibold text-primary underline underline-offset-4 hover:no-underline"
                                        >
                                            查看下载与安装指引
                                        </Link>
                                    </div>
                                </div>
                            </Card>
                        </div>
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <h2 className="text-2xl font-extrabold tracking-tight">
                    为什么选择 {SITE_NAME}
                </h2>
                <p className="mt-3 text-sm text-muted-foreground">
                    我们把家庭服务的关键体验拆成可感知的指标：响应、可见、可沟通、可解决。
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {VALUE_CARDS.map((item) => (
                        <Card key={item.title} className="p-6">
                            <div className="text-base font-extrabold">
                                {item.title}
                            </div>
                            <div className="mt-2 text-sm text-muted-foreground">
                                {item.desc}
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>

            <div className="border-y border-border bg-muted/20">
                <Container className="py-14">
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        使用流程
                    </h2>
                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {STEPS.map((item) => (
                            <Card key={item.step} className="p-6">
                                <div className="text-sm font-extrabold text-primary">
                                    {item.step}
                                </div>
                                <div className="mt-2 text-lg font-extrabold">
                                    {item.title}
                                </div>
                                <div className="mt-2 text-sm text-muted-foreground">
                                    {item.desc}
                                </div>
                            </Card>
                        ))}
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-extrabold tracking-tight">
                            常见问题
                        </h2>
                        <p className="mt-3 text-sm text-muted-foreground">
                            如果你还有其它疑问，可以查看完整 FAQ 或进入 App
                            内“官方客服”。
                        </p>
                    </div>
                    <ButtonLink href="/faq" variant="secondary">
                        查看全部 FAQ
                    </ButtonLink>
                </div>

                <Accordion
                    className="mt-8"
                    items={FAQ_ITEMS}
                    defaultIndex={0}
                />
            </Container>

            <Container className="pb-20">
                <Card className="p-8 md:p-10">
                    <div className="grid gap-8 md:grid-cols-2 md:items-center">
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight">
                                现在就开始体验
                            </h2>
                            <p className="mt-3 text-sm text-muted-foreground">
                                点击下载，按照指引完成安装，即可开始预约服务。
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <ButtonLink href={DOWNLOAD_URL} size="lg">
                                下载 App
                            </ButtonLink>
                            <ButtonLink
                                href="/download"
                                variant="secondary"
                                size="lg"
                            >
                                安装指引
                            </ButtonLink>
                        </div>
                    </div>
                </Card>
            </Container>
        </>
    );
}
