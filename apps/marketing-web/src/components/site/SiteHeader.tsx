"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import { Container } from "@/components/ui/Container";
import { ButtonLink } from "@/components/ui/Button";
import { DOWNLOAD_URL, SITE_NAME } from "@/lib/site";

import appIcon from "../../../../mobile-user/assets/images/icon.png";

const NAV_ITEMS: Array<{ href: string; label: string }> = [
    { href: "/features", label: "功能" },
    { href: "/worker-app", label: "服务人员端" },
    { href: "/download", label: "下载" },
    { href: "/blog", label: "博客" },
    { href: "/faq", label: "常见问题" },
    { href: "/contact", label: "支持" },
];

export function SiteHeader() {
    const pathname = usePathname();
    const [isOpen, setIsOpen] = useState(false);

    const items = useMemo(
        () =>
            NAV_ITEMS.map((item) => ({
                ...item,
                isActive:
                    item.href === "/"
                        ? pathname === "/"
                        : pathname?.startsWith(item.href),
            })),
        [pathname],
    );

    return (
        <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur">
            <Container className="flex h-16 items-center justify-between">
                <Link
                    href="/"
                    className="flex items-center gap-3 rounded-md px-2 py-1 hover:bg-muted"
                    onClick={() => setIsOpen(false)}
                >
                    <Image
                        src={appIcon}
                        alt={`${SITE_NAME} 应用图标`}
                        width={32}
                        height={32}
                        className="rounded-md"
                        priority
                    />
                    <span className="text-base font-extrabold tracking-tight">
                        {SITE_NAME}
                    </span>
                </Link>

                <nav
                    aria-label="主导航"
                    className="hidden items-center gap-1 md:flex"
                >
                    {items.map((item) => (
                        <Link
                            key={item.href}
                            href={item.href}
                            aria-current={item.isActive ? "page" : undefined}
                            className={
                                item.isActive
                                    ? "rounded-full bg-muted px-4 py-2 text-sm font-semibold text-foreground"
                                    : "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                            }
                        >
                            {item.label}
                        </Link>
                    ))}
                </nav>

                <div className="flex items-center gap-2">
                    <button
                        type="button"
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background text-sm font-semibold hover:bg-muted md:hidden"
                        aria-label={isOpen ? "关闭菜单" : "打开菜单"}
                        aria-expanded={isOpen}
                        aria-controls="mobile-site-nav"
                        onClick={() => setIsOpen((v: boolean) => !v)}
                    >
                        {isOpen ? "×" : "≡"}
                    </button>
                    <ButtonLink href={DOWNLOAD_URL} size="sm">
                        下载用户端 App
                    </ButtonLink>
                </div>
            </Container>

            {isOpen ? (
                <div className="border-t border-border bg-background md:hidden">
                    <Container className="py-3">
                        <nav
                            id="mobile-site-nav"
                            aria-label="移动端导航"
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
                                            ? "rounded-xl bg-muted px-4 py-3 text-sm font-semibold text-foreground"
                                            : "rounded-xl px-4 py-3 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground"
                                    }
                                    onClick={() => setIsOpen(false)}
                                >
                                    {item.label}
                                </Link>
                            ))}
                        </nav>
                    </Container>
                </div>
            ) : null}
        </header>
    );
}
