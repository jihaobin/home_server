import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Accordion } from "@/components/ui/Accordion";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_FAQ_ITEMS, absoluteWorkerUrl } from "@/lib/worker-site";

export const metadata: Metadata = {
    title: "常见问题",
    description:
        "查看叮咚上单关于安装、接单提醒、适用人群、下载与支持方式的常见问题。",
    alternates: {
        canonical: absoluteWorkerUrl("/faq"),
    },
};

export default function WorkerFaqPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                叮咚上单常见问题
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                这里整理的是服务人员最常关心的问题，重点覆盖安装、通知、接单与使用流程，帮助你更快完成上手。
            </p>

            <div className="mt-8">
                <Accordion
                    items={WORKER_FAQ_ITEMS.map((item) => ({
                        title: item.title,
                        content: <p>{item.answer}</p>,
                    }))}
                    defaultIndex={0}
                />
            </div>

            <Card className="mt-12 p-8">
                <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
                    <div>
                        <div className="text-xl font-black text-slate-950">
                            还没安装？
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                            直接进入下载页，按安装指引完成配置后即可开始使用。
                        </div>
                    </div>
                    <ButtonLink
                        href="/worker-app/download"
                        size="lg"
                        className="bg-sky-500 text-white hover:bg-sky-400"
                    >
                        前往下载页
                    </ButtonLink>
                </div>
            </Card>
        </Container>
    );
}
