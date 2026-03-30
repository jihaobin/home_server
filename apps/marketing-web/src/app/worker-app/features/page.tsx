import type { Metadata } from "next";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_FEATURE_GROUPS, absoluteWorkerUrl } from "@/lib/worker-site";

export const metadata: Metadata = {
    title: "功能",
    description:
        "查看叮咚上单围绕订单、服务流程、消息提醒、收益提现、服务设置与资料管理的核心功能。",
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
                当前子站围绕真实存在的移动端页面结构来介绍能力范围，帮助服务人员更快理解这款
                App 的主要使用场景。
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
                            进入下载页查看 APK 直链、安装步骤以及常见安装提醒。
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
