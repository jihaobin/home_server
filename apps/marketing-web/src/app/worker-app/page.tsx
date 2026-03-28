import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Accordion } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/Button";
import { SITE_NAME, WORKER_DOWNLOAD_URL, absoluteUrl } from "@/lib/site";

import workerAppIcon from "../../../../mobile-worker/assets/images/icon.png";

export const metadata: Metadata = {
    title: "服务人员端",
    description:
        "了解叮咚上门服务人员端的接单、上门服务、订单管理与收益查看能力，并获取 APK 下载与安装指引。",
    alternates: {
        canonical: absoluteUrl("/worker-app"),
    },
};

const VALUE_CARDS = [
    {
        title: "接单更及时",
        desc: "待处理订单、服务提醒与关键节点一屏可见，减少错过订单的情况。",
    },
    {
        title: "过程更清晰",
        desc: "从接单、上门到完工都有明确流程，服务记录更完整。",
    },
    {
        title: "结算更安心",
        desc: "订单状态、收入结果与必要信息集中展示，查看更省事。",
    },
];

const FEATURE_GROUPS = [
    {
        title: "订单大厅",
        items: [
            "快速查看待接订单",
            "按服务信息判断是否适合接单",
            "减少反复切换页面的成本",
        ],
    },
    {
        title: "服务流程",
        items: [
            "按步骤推进上门服务",
            "关键状态及时更新",
            "让平台、用户与服务人员对进度更同步",
        ],
    },
    {
        title: "日程管理",
        items: ["集中查看当天安排", "减少漏单与时间冲突", "服务节奏更稳定"],
    },
    {
        title: "消息提醒",
        items: [
            "新订单与状态变化及时提醒",
            "重要节点不容易遗漏",
            "沟通反馈更及时",
        ],
    },
    {
        title: "账户与结算",
        items: ["查看收入相关信息", "掌握订单完成情况", "方便日常对账与跟进"],
    },
    {
        title: "个人资料",
        items: ["维护基础资料", "统一查看账号相关信息", "便于长期服务管理"],
    },
];

const STEPS = [
    {
        step: "01",
        title: "下载安装 APK",
        desc: "点击下方按钮下载服务人员端 APK，并按系统提示完成安装。",
    },
    {
        step: "02",
        title: "登录并开启权限",
        desc: "完成登录后，根据提示开启通知等必要权限，确保订单提醒可正常触达。",
    },
    {
        step: "03",
        title: "开始接单服务",
        desc: "进入订单相关页面查看待处理任务，按流程推进上门服务。",
    },
];

const FAQ_ITEMS = [
    {
        title: "服务人员端适合谁使用？",
        content: (
            <p>
                该页面面向平台服务人员，用于接单、查看服务进度、接收提醒以及管理与服务相关的信息。
            </p>
        ),
    },
    {
        title: "下载后提示“未知来源应用”，怎么办？",
        content: (
            <p>
                请在 Android
                系统设置中，为当前浏览器或文件管理器开启“允许安装未知来源应用”权限，再重新安装即可。
            </p>
        ),
    },
    {
        title: "安装后收不到提醒怎么办？",
        content: (
            <p>
                建议检查通知权限、后台运行限制与省电策略设置，确保服务人员端可以正常接收订单和状态提醒。
            </p>
        ),
    },
    {
        title: "需要帮助时怎么处理？",
        content: (
            <p>
                如在下载、安装或使用过程中遇到问题，可前往站点“联系与支持”页面获取帮助信息。
            </p>
        ),
    },
];

export default function WorkerAppPage() {
    return (
        <>
            <div className="relative overflow-hidden border-b border-border bg-muted/20">
                <div className="absolute inset-0 -z-10">
                    <div
                        className="absolute left-1/2 top-0 h-72 w-[860px] -translate-x-1/2 rounded-full opacity-40 blur-3xl"
                        style={{
                            background:
                                "radial-gradient(circle at 50% 50%, hsl(var(--ring)) 0%, transparent 60%)",
                        }}
                    />
                </div>

                <Container className="py-16 md:py-20">
                    <div className="grid gap-10 md:grid-cols-[1.1fr_0.9fr] md:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1 text-xs font-semibold text-muted-foreground">
                                <span
                                    className="h-2 w-2 rounded-full bg-primary"
                                    aria-hidden="true"
                                />
                                面向服务人员的移动工作台
                            </div>

                            <h1 className="mt-5 text-4xl font-extrabold tracking-tight md:text-5xl">
                                {SITE_NAME} 服务人员端
                                <span className="mt-2 block text-foreground/80">
                                    接单、服务推进、进度反馈，一端完成
                                </span>
                            </h1>

                            <p className="mt-5 max-w-2xl text-base leading-7 text-muted-foreground">
                                这是为平台服务人员准备的专属 App
                                页面。你可以在这里了解服务人员端的核心能力，并直接获取
                                Android APK 下载与安装方式。
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <ButtonLink
                                    href={WORKER_DOWNLOAD_URL}
                                    size="lg"
                                >
                                    下载服务人员端 APK
                                </ButtonLink>
                                <ButtonLink
                                    href="#download-guide"
                                    variant="secondary"
                                    size="lg"
                                >
                                    查看安装方式
                                </ButtonLink>
                            </div>

                            <p className="mt-4 break-all text-xs text-muted-foreground">
                                下载链接：{WORKER_DOWNLOAD_URL}
                            </p>
                        </div>

                        <Card className="overflow-hidden">
                            <div className="p-6 md:p-8">
                                <div className="flex items-center gap-4">
                                    <Image
                                        src={workerAppIcon}
                                        alt="服务人员端应用图标"
                                        width={72}
                                        height={72}
                                        className="rounded-2xl"
                                        priority
                                    />
                                    <div>
                                        <div className="text-xl font-extrabold tracking-tight">
                                            服务人员端 App
                                        </div>
                                        <div className="mt-1 text-sm text-muted-foreground">
                                            面向接单、上门与服务流程管理的移动端工具
                                        </div>
                                    </div>
                                </div>

                                <div className="mt-6 grid gap-3">
                                    {[
                                        "查看待处理订单与服务安排",
                                        "跟进上门服务关键流程",
                                        "接收订单与状态变化提醒",
                                        "集中查看账户与服务相关信息",
                                    ].map((item) => (
                                        <div
                                            key={item}
                                            className="rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3 text-sm text-foreground/90"
                                        >
                                            {item}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <div className="border-t border-border bg-muted/30 p-6 text-sm text-muted-foreground">
                                如你是普通用户，需要预约家庭服务，请前往用户端下载页获取对应
                                <Link
                                    href="/download"
                                    className="font-semibold text-primary underline underline-offset-4 hover:no-underline"
                                >
                                    APK
                                </Link>
                                。
                            </div>
                        </Card>
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <h2 className="text-2xl font-extrabold tracking-tight">
                    为什么要使用服务人员端
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                    我们把服务人员日常最常用的操作集中到一个移动工作台里，让接单、执行和反馈都更顺手。
                </p>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {VALUE_CARDS.map((item) => (
                        <Card key={item.title} className="p-6">
                            <div className="text-base font-extrabold">
                                {item.title}
                            </div>
                            <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                {item.desc}
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>

            <div className="border-y border-border bg-muted/20">
                <Container className="py-14">
                    <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
                        <div>
                            <h2 className="text-2xl font-extrabold tracking-tight">
                                核心能力一览
                            </h2>
                            <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                                覆盖接单、服务流程、日程提醒、账户结算等高频场景，帮助服务人员更快进入工作状态。
                            </p>
                        </div>
                    </div>

                    <div className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                        {FEATURE_GROUPS.map((group) => (
                            <Card key={group.title} className="p-6">
                                <div className="text-lg font-extrabold">
                                    {group.title}
                                </div>
                                <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                                    {group.items.map((item) => (
                                        <li key={item}>{item}</li>
                                    ))}
                                </ul>
                            </Card>
                        ))}
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <h2 className="text-2xl font-extrabold tracking-tight">
                    上手流程
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
                            <div className="mt-2 text-sm leading-6 text-muted-foreground">
                                {item.desc}
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>

            <div
                id="download-guide"
                className="border-y border-border bg-muted/20"
            >
                <Container className="py-14">
                    <h2 className="text-2xl font-extrabold tracking-tight">
                        APK 下载与安装方式
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                        服务人员端当前提供 Android APK
                        直链下载。下载完成后，请根据手机系统提示完成安装。
                    </p>

                    <div className="mt-8 grid gap-6 md:grid-cols-2">
                        <Card className="p-8">
                            <div className="text-lg font-extrabold">
                                APK 直链下载
                            </div>
                            <p className="mt-3 text-sm leading-6 text-muted-foreground">
                                点击按钮开始下载服务人员端
                                APK。若浏览器拦截下载，请在下载设置中允许当前文件下载。
                            </p>
                            <div className="mt-6">
                                <ButtonLink
                                    href={WORKER_DOWNLOAD_URL}
                                    size="lg"
                                >
                                    立即下载 APK
                                </ButtonLink>
                            </div>
                            <div className="mt-4 break-all rounded-[var(--radius)] border border-border bg-muted/40 px-4 py-3 text-xs text-muted-foreground">
                                {WORKER_DOWNLOAD_URL}
                            </div>
                        </Card>

                        <Card className="p-8">
                            <div className="text-lg font-extrabold">
                                安装指引
                            </div>
                            <ol className="mt-4 list-decimal space-y-2 pl-5 text-sm leading-6 text-muted-foreground">
                                <li>下载完成后，点击 APK 文件开始安装。</li>
                                <li>
                                    若系统提示“禁止安装未知来源应用”，请在设置中为当前浏览器或文件管理器开启安装权限。
                                </li>
                                <li>
                                    安装完成后，打开服务人员端并按提示登录，建议同时开启通知等必要权限。
                                </li>
                            </ol>
                            <p className="mt-4 text-xs text-muted-foreground">
                                提示：不同品牌手机的设置入口可能不同，搜索“未知来源应用安装”通常可以更快找到对应选项。
                            </p>
                        </Card>
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-extrabold tracking-tight">
                            常见问题
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                            如果你在下载、安装或使用服务人员端时遇到问题，可以先看下面的说明，再前往支持页面获取帮助。
                        </p>
                    </div>
                    <ButtonLink href="/contact" variant="secondary">
                        联系与支持
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
                                立即获取服务人员端
                            </h2>
                            <p className="mt-3 text-sm leading-7 text-muted-foreground">
                                如你需要在手机上接收订单、推进服务流程并查看相关信息，现在就可以下载服务人员端
                                APK 开始安装。
                            </p>
                        </div>
                        <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
                            <ButtonLink href={WORKER_DOWNLOAD_URL} size="lg">
                                下载服务人员端 APK
                            </ButtonLink>
                            <ButtonLink
                                href="/contact"
                                variant="secondary"
                                size="lg"
                            >
                                获取帮助
                            </ButtonLink>
                        </div>
                    </div>
                </Card>
            </Container>
        </>
    );
}
