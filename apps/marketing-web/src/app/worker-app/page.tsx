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
                                独立服务人员端站点
                            </div>

                            <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                                {WORKER_SITE_NAME}
                            </h1>
                            <p className="mt-4 max-w-2xl text-lg leading-8 text-slate-700">
                                {WORKER_SITE_TAGLINE}
                            </p>
                            <p className="mt-5 max-w-2xl text-sm leading-7 text-slate-600 md:text-base">
                                进入这里后，你看到的是一套专门为平台服务人员准备的完整站点：从接单、服务推进、通知提醒到收益与提现，都用同一套产品语言和页面结构来介绍。
                            </p>

                            <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center">
                                <ButtonLink
                                    href="/worker-app/download"
                                    size="lg"
                                    className="bg-sky-500 text-white hover:bg-sky-400"
                                >
                                    下载服务人员端 APK
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
                                            服务人员端工作台
                                        </div>
                                        <div className="mt-1 text-sm text-slate-500">
                                            首页、订单、收益、聊天、我的
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className="grid gap-3 p-6">
                                {[
                                    "我的订单：按待接单、待服务、服务中等状态管理工作",
                                    "我的收益：查看余额、本月收益、累计收益与提现记录",
                                    "服务设置：维护已提供服务、服务描述与宣传图片",
                                    "服务区域与时间：配置服务范围、详细地址与服务时间",
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
                            服务人员端的核心价值
                        </h2>
                        <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
                            这不是主站里的单个栏目，而是围绕服务人员日常工作流单独整理的一套产品入口，让信息组织和站点感知都更聚焦。
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
                            如果你第一次安装服务人员端，建议先看下载说明和下面这些高频问题，能更快完成上手。
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
