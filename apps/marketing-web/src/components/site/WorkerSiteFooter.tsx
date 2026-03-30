import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { WORKER_SITE_NAME, WORKER_SITE_NAV_ITEMS } from "@/lib/worker-site";

export function WorkerSiteFooter() {
    return (
        <footer className="mt-16 border-t border-slate-200 bg-slate-950 text-white">
            <Container className="py-12">
                <div className="grid gap-10 md:grid-cols-3">
                    <div>
                        <div className="text-base font-extrabold tracking-tight">
                            {WORKER_SITE_NAME}
                        </div>
                        <p className="mt-3 text-sm text-slate-300">
                            面向平台服务人员的独立工作台站点，帮助你快速了解接单、服务推进、收益与安装方式。
                        </p>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-white">
                            站点
                        </div>
                        <ul className="mt-3 space-y-2 text-sm">
                            {WORKER_SITE_NAV_ITEMS.map((item) => (
                                <li key={item.href}>
                                    <Link
                                        className="text-slate-300 hover:text-white"
                                        href={item.href}
                                    >
                                        {item.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div>
                        <div className="text-sm font-semibold text-white">
                            平台入口
                        </div>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link
                                    className="text-slate-300 hover:text-white"
                                    href="/"
                                >
                                    返回叮咚上门主站
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-slate-300 hover:text-white"
                                    href="/download"
                                >
                                    用户端下载
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-slate-300 hover:text-white"
                                    href="/privacy"
                                >
                                    隐私政策
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-slate-300 hover:text-white"
                                    href="/terms"
                                >
                                    用户协议
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 border-t border-white/10 pt-6 text-xs text-slate-400">
                    © {new Date().getFullYear()} {WORKER_SITE_NAME}.
                    与叮咚上门主站同属平台站点。
                </div>
            </Container>
        </footer>
    );
}
