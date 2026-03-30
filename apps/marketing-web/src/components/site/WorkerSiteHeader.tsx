"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { WORKER_SITE_NAME, WORKER_SITE_NAV_ITEMS } from "@/lib/worker-site";

import workerAppIcon from "../../../../mobile-worker/assets/images/icon.png";

export function WorkerSiteHeader() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const items = useMemo(
        () =>
            WORKER_SITE_NAV_ITEMS.map((item) => ({
                ...item,
                isActive:
                    item.href === "/worker-app"
                        ? pathname === "/worker-app"
                        : pathname?.startsWith(item.href),
            })),
        [pathname],
    );

    return (
        <header className="sticky top-0 z-40 border-b border-slate-200 bg-slate-950/95 text-white backdrop-blur">
            <Container className="flex h-16 items-center justify-between">
                <Link
                    href="/worker-app"
                    className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-white/10"
                    onClick={() => setIsOpen(false)}
                >
                    <Image
                        src={workerAppIcon}
                        alt={`${WORKER_SITE_NAME} 图标`}
                        width={34}
                        height={34}
                        className="rounded-xl"
                        priority
                    />
                    <div>
                        <div className="text-sm font-black tracking-tight text-white">
                            {WORKER_SITE_NAME}
                        </div>
                        <div className="text-[11px] text-slate-300">
                            服务人员移动工作台
                        </div>
                    </div>
                </Link>

                <nav
                    aria-label="服务人员端主导航"
                    className="hidden items-center gap-1 md:flex"
                >
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={item.isActive ? "page" : undefined}
                            className={
                                item.isActive
                                    ? "rounded-full bg-white px-4 py-2 text-sm font-semibold text-slate-950"
                                    : "rounded-full px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                            }
                        >
                            {item.label}
                        </Link>
                    ))}
                    <Link
                        href="/"
                        className="rounded-full px-4 py-2 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                    >
                        返回主站
                    </Link>
                </nav>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-white/5 text-sm font-semibold hover:bg-white/10 md:hidden"
                        aria-label={
                            isOpen ? "关闭服务人员端菜单" : "打开服务人员端菜单"
                        }
                        aria-expanded={isOpen}
                        aria-controls="worker-site-nav"
                        onClick={() => setIsOpen((v) => !v)}
                    >
                        {isOpen ? "×" : "≡"}
                    </button>
                    <ButtonLink
                        href="/worker-app/download"
                        size="sm"
                        className="bg-sky-500 text-white hover:bg-sky-400"
                    >
                        下载 APK
                    </ButtonLink>
                </div>
            </Container>

            {isOpen ? (
                <div className="border-t border-white/10 bg-slate-950 md:hidden">
                    <Container className="py-3">
                        <nav
                            id="worker-site-nav"
                            aria-label="服务人员端移动导航"
                            className="flex flex-col gap-1"
                        >
                            {items.map((item) => (
                                <Link
                                    key={item.href}
                                    href={item.href}
                                    aria-current={
                                        item.isActive ? "page" : undefined
                                    }
                                    className={
                                        item.isActive
                                            ? "rounded-xl bg-white px-4 py-3 text-sm font-semibold text-slate-950"
                                            : "rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                                    }
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                            <Link
                                href="/"
                                className="rounded-xl px-4 py-3 text-sm font-medium text-slate-300 hover:bg-white/10 hover:text-white"
                                onClick={() => setIsOpen(false)}
                            >
                                返回主站
                            </Link>
                        </nav>
                    </Container>
                </div>
            ) : null}
        </header>
    );
}
