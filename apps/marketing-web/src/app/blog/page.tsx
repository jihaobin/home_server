import type { Metadata } from "next";
import Link from "next/link";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { getAllPosts } from "@/lib/blog/posts";
import { SITE_NAME, absoluteUrl } from "@/lib/site";

export const metadata: Metadata = {
    title: "博客",
    description: `来自 ${SITE_NAME} 的使用指南与服务体验分享。`,
    alternates: {
        canonical: absoluteUrl("/blog"),
    },
};

export default function BlogIndexPage() {
    const posts = getAllPosts();

    return (
        <Container className="py-14">
            <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                博客
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-muted-foreground">
                产品更新、使用指南与服务体验分享。
            </p>

            <div className="mt-10 grid gap-4">
                {posts.map((post) => (
                    <Link
                        key={post.slug}
                        href={`/blog/${post.slug}`}
                        className="block"
                    >
                        <Card className="p-6 hover:bg-muted/30">
                            <div className="flex flex-col gap-2 md:flex-row md:items-start md:justify-between">
                                <div>
                                    <div className="text-lg font-extrabold">
                                        {post.title}
                                    </div>
                                    <div className="mt-2 text-sm text-muted-foreground">
                                        {post.description}
                                    </div>
                                </div>
                                <div className="text-xs text-muted-foreground md:text-right">
                                    {post.date}
                                </div>
                            </div>

                            {post.tags?.length ? (
                                <div className="mt-4 flex flex-wrap gap-2">
                                    {post.tags.map((tag) => (
                                        <span
                                            key={tag}
                                            className="rounded-full border border-border bg-background px-3 py-1 text-xs text-muted-foreground"
                                        >
                                            {tag}
                                        </span>
                                    ))}
                                </div>
                            ) : null}
                        </Card>
                    </Link>
                ))}
            </div>
        </Container>
    );
}
