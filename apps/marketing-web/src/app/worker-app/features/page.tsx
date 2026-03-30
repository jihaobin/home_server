import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_FEATURE_GROUPS, absoluteWorkerUrl } from "@/lib/worker-site";

export const metadata: Metadata = {
    title: "功能",
    description:
        "查看叮咚上单如何围绕接单、服务履约、消息沟通、收益结算与服务展示提升服务人员效率。",
    alternates: {
        canonical: absoluteWorkerUrl("/features"),
    },
};

export default function WorkerFeaturesPage() {
    return (
        <Container className="py-14">
            <h1 className="text-3xl font-black tracking-tight text-slate-950 md:text-4xl">
                叮咚上单功能一览
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
                每一项功能都围绕服务人员最在意的几个结果展开：更快接单、更稳履约、更顺畅沟通，以及更清楚地管理收入。
            </p>

            <div className="mt-10 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {WORKER_FEATURE_GROUPS.map((group) => (
                    <Card key={group.title} className="p-6">
                        <div className="text-lg font-black text-slate-950">
                            {group.title}
                        </div>
                        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm leading-7 text-slate-600">
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
                        <div className="text-xl font-black text-slate-950">
                            准备安装叮咚上单？
                        </div>
                        <div className="mt-2 text-sm text-slate-600">
                            进入下载页获取 APK 和安装指引，尽快完成配置，开始接单。
                        </div>
                    </div>
                    <ButtonLink
                        href="/worker-app/download"
                        size="lg"
                        className="bg-sky-500 text-white hover:bg-sky-400"
                    >
                        前往下载
                    </ButtonLink>
                </div>
            </Card>
        </Container>
    );
}
