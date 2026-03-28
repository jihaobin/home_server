import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { SITE_NAME } from "@/lib/site";

export function SiteFooter() {
    return (
        <footer className="mt-16 border-t border-border bg-background">
            <Container className="py-12">
                <div className="grid gap-10 md:grid-cols-3">
                    <div>
                        <div className="text-base font-extrabold tracking-tight">
                            {SITE_NAME}
                        </div>
                        <p className="mt-3 text-sm text-muted-foreground">
                            专业团队到家，30 分钟极速响应。让家庭服务更省心。
                        </p>
                    </div>

                    <div>
                        <div className="text-sm font-semibold">站点</div>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/features"
                                >
                                    功能介绍
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/worker-app"
                                >
                                    服务人员端
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/download"
                                >
                                    下载
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/blog"
                                >
                                    博客
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/faq"
                                >
                                    常见问题
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/contact"
                                >
                                    联系与支持
                                </Link>
                            </li>
                        </ul>
                    </div>

                    <div>
                        <div className="text-sm font-semibold">合规</div>
                        <ul className="mt-3 space-y-2 text-sm">
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/privacy"
                                >
                                    隐私政策
                                </Link>
                            </li>
                            <li>
                                <Link
                                    className="text-muted-foreground hover:text-foreground"
                                    href="/terms"
                                >
                                    用户协议
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground md:flex-row md:items-center md:justify-between">
                    <div>
                        © {new Date().getFullYear()} {SITE_NAME}. 保留所有权利。
                    </div>
                </div>
                <div className="mt-4 flex flex-col gap-2 text-xs text-muted-foreground md:flex-row md:items-center md:justify-center">
                    <Link href="https://www.beian.gov.cn/portal/registerSystemInfo?recordcode=42110002000301">
                        鄂公网安备42110002000301号
                    </Link>
                    <div className="hidden md:block">·</div>
                    <Link href="https://beian.miit.gov.cn/">
                        鄂ICP备2026000485号-1
                    </Link>
                </div>
            </Container>
        </footer>
    );
}
