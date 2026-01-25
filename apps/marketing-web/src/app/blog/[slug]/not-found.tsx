import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";

export default function BlogNotFound() {
    return (
        <Container className="py-14">
            <Card className="p-10">
                <h1 className="text-2xl font-extrabold tracking-tight">
                    文章不存在
                </h1>
                <p className="mt-3 text-sm text-muted-foreground">
                    你访问的文章可能已被删除或链接有误。
                </p>
                <div className="mt-6">
                    <Link
                        href="/blog"
                        className="text-sm font-semibold text-primary underline underline-offset-4 hover:no-underline"
                    >
                        返回博客列表
                    </Link>
                </div>
            </Card>
        </Container>
    );
}
