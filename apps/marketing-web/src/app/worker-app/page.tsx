import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { Accordion } from "@/components/ui/Accordion";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_DOWNLOAD_URL } from "@/lib/site";
import {
    WORKER_FAQ_ITEMS,
    WORKER_SITE_NAME,
    WORKER_SITE_TAGLINE,
    WORKER_STEPS,
    WORKER_SUPPORT_CARDS,
    WORKER_VALUE_CARDS,
    absoluteWorkerUrl,
} from "@/lib/worker-site";

import workerAppIcon from "../../../../mobile-worker/assets/images/icon.png";

export const metadata: Metadata = {
    title: "首页",
    alternates: {
        canonical: absoluteWorkerUrl(),
    },
};

export default function WorkerAppHomePage() {
    return (
        <>
            <div className="relative overflow-hidden bg-white text-slate-950">
                <div className="absolute inset-0 -z-10">
                    <div className="absolute left-1/2 top-0 h-[360px] w-[720px] -translate-x-1/2 rounded-full bg-sky-200/60 blur-3xl" />
                    <div className="absolute right-0 top-10 h-[280px] w-[280px] rounded-full bg-cyan-100 blur-3xl" />
                </div>

                <Container className="py-18 md:py-24">
                    <div className="grid gap-10 md:grid-cols-[1.15fr_0.85fr] md:items-center">
                        <div>
                            <div className="inline-flex items-center gap-2 rounded-full border border-sky-100 bg-sky-50 px-3 py-1 text-xs font-semibold text-sky-700">
                                <span className="h-2 w-2 rounded-full bg-sky-400" />
                                叮咚上单 · 服务人员使用
                            </div>

                            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                                {WORKER_SITE_NAME}
                            </h1>
                            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
                                {WORKER_SITE_TAGLINE}
                            </p>
                            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                                这是叮咚上门为服务人员准备的专属介绍站点。你可以在这里快速了解如何更高效地接到附近订单、稳定推进上门服务，并把每一次服务沉淀成看得见的收入。
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <ButtonLink
                                    href="/worker-app/download"
                                    size="lg"
                                    className="bg-sky-500 text-white hover:bg-sky-400"
                                >
                                    下载叮咚上单 APK
                                </ButtonLink>
                                <ButtonLink
                                    href="/worker-app/features"
                                    variant="secondary"
                                    size="lg"
                                    className="border border-slate-200 bg-white text-slate-950 hover:bg-slate-50"
                                >
                                    查看完整功能
                                </ButtonLink>
                            </div>

                            <div className="mt-6 text-xs text-slate-500">
                                APK 直链：
                                <a
                                    href={WORKER_DOWNLOAD_URL}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="underline underline-offset-4 hover:text-slate-950"
                                >
                                    {WORKER_DOWNLOAD_URL}
                                </a>
                            </div>
                        </div>

                        <Card className="overflow-hidden border-slate-200 bg-white text-slate-950 shadow-[0_24px_80px_rgba(15,23,42,0.12)]">
                            <div className="border-b border-slate-200 px-6 py-4">
                                <div className="flex items-center gap-4">
                                    <Image
                                        src={workerAppIcon}
                                        alt="服务人员端图标"
                                        width={64}
                                        height={64}
                                        className="rounded-2xl"
                                        priority
                                    />
                                    <div>
                                        <div className="text-xl font-black tracking-tight">
                                            叮咚上单工作台
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            接单、服务、沟通、结算，一站管理
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-3 p-6">
                                {[
                                    "订单管理：按待接单、待服务、服务中等状态高效处理工作",
                                    "收益中心：随时查看余额、本月收益、累计收入与提现记录",
                                    "服务展示：维护服务描述、亮点卖点与宣传图片，提升转化",
                                    "服务范围：配置服务区域、详细地址与服务时间，接单更精准",
                                ].map((item) => (
                                    <div
                                        key={item}
                                        className="rounded-[var(--radius)] border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                                    >
                                        {item}
                                    </div>
                                ))}
                            </div>
                            <div className="border-t border-slate-200 bg-slate-50 px-6 py-4 text-sm text-slate-600">
                                如你是普通用户，需要预约家庭服务，请返回
                                <Link
                                    href="/"
                                    className="ml-1 font-semibold text-sky-300 underline underline-offset-4 hover:no-underline"
                                >
                                    叮咚上门主站
                                </Link>
                                。
                            </div>
                        </Card>
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                            叮咚上单的核心价值
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                            它不是单纯的下载页，而是面向服务人员的转化入口。核心信息围绕“怎么更快上手、怎么更稳接单、怎么更清楚管理收入”来组织。
                        </p>
                    </div>
                    <ButtonLink href="/worker-app/contact" variant="secondary">
                        进入支持页
                    </ButtonLink>
                </div>

                <div className="mt-8 grid gap-4 md:grid-cols-3">
                    {WORKER_VALUE_CARDS.map((item) => (
                        <Card key={item.title} className="p-6">
                            <div className="text-lg font-black text-slate-950">
                                {item.title}
                            </div>
                            <div className="mt-3 text-sm leading-7 text-slate-600">
                                {item.desc}
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>

            <div className="border-y border-slate-200 bg-slate-50">
                <Container className="py-14">
                    <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                        三步快速上手
                    </h2>
                    <div className="mt-8 grid gap-4 md:grid-cols-3">
                        {WORKER_STEPS.map((item) => (
                            <Card key={item.step} className="p-6">
                                <div className="text-sm font-black text-sky-600">
                                    {item.step}
                                </div>
                                <div className="mt-2 text-lg font-black text-slate-950">
                                    {item.title}
                                </div>
                                <div className="mt-3 text-sm leading-7 text-slate-600">
                                    {item.desc}
                                </div>
                            </Card>
                        ))}
                    </div>
                </Container>
            </div>

            <Container className="py-14">
                <div className="grid gap-4 md:grid-cols-3">
                    {WORKER_SUPPORT_CARDS.map((item) => (
                        <Card key={item.title} className="p-6">
                            <div className="text-lg font-black text-slate-950">
                                {item.title}
                            </div>
                            <p className="mt-3 text-sm leading-7 text-slate-600">
                                {item.desc}
                            </p>
                            <div className="mt-6">
                                <ButtonLink
                                    href={item.href}
                                    variant="secondary"
                                >
                                    {item.cta}
                                </ButtonLink>
                            </div>
                        </Card>
                    ))}
                </div>
            </Container>

            <Container className="pb-20">
                <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
                    <div>
                        <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
                            常见问题
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                            如果你准备开始使用叮咚上单，先看下载说明和这些高频问题，通常就能更快完成安装并进入接单状态。
                        </p>
                    </div>
                    <ButtonLink href="/worker-app/faq" variant="secondary">
                        查看全部 FAQ
                    </ButtonLink>
                </div>

                <Accordion
                    className="mt-8"
                    items={WORKER_FAQ_ITEMS.slice(0, 3).map((item) => ({
                        title: item.title,
                        content: <p>{item.answer}</p>,
                    }))}
                    defaultIndex={0}
                />
            </Container>
        </>
    );
}
