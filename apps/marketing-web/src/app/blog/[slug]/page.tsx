import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Container } from "@/components/ui/Container";
import { Markdown } from "@/components/blog/Markdown";
import { getAllPostSlugs, getPostBySlug } from "@/lib/blog/posts";
import { absoluteUrl, SITE_NAME } from "@/lib/site";
import { JsonLdScript, blogPostingJsonLd } from "@/lib/seo/jsonld";

export function generateStaticParams() {
    return getAllPostSlugs().map((slug) => ({ slug }));
}

export function generateMetadata(props: {
    params: Promise<{ slug: string }>;
}): Promise<Metadata> {
    return (async () => {
        const { slug } = await props.params;
        try {
            const post = getPostBySlug(slug);
            return {
                title: post.title,
                description: post.description,
                alternates: {
                    canonical: absoluteUrl(`/blog/${slug}`),
                },
                openGraph: {
                    type: "article",
                    title: post.title,
                    description: post.description,
                    url: absoluteUrl(`/blog/${slug}`),
                    siteName: SITE_NAME,
                },
            };
        } catch {
            return {
                title: "文章不存在",
                robots: { index: false, follow: false },
            };
        }
    })();
}

export default async function BlogPostPage(props: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await props.params;

    let post;
    try {
        post = getPostBySlug(slug);
    } catch {
        notFound();
    }

    return (
        <Container className="py-14">
            <JsonLdScript
                data={blogPostingJsonLd({
                    title: post.title,
                    description: post.description,
                    slug: post.slug,
                    datePublished: post.date,
                    dateModified: post.updated,
                })}
            />

            <div className="max-w-3xl">
                <div className="text-xs text-muted-foreground">{post.date}</div>
                <h1 className="mt-3 text-3xl font-extrabold tracking-tight md:text-4xl">
                    {post.title}
                </h1>
                <p className="mt-4 text-sm leading-7 text-muted-foreground">
                    {post.description}
                </p>

                {post.tags?.length ? (
                    <div className="mt-5 flex flex-wrap gap-2">
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

                <div className="mt-10 border-t border-border pt-8">
                    <Markdown content={post.content} />
                </div>
            </div>
        </Container>
    );
}
