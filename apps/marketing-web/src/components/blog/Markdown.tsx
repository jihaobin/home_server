import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import { cn } from "@/lib/cn";

export function Markdown({
    content,
    className,
}: {
    content: string;
    className?: string;
}) {
    return (
        <article
            className={cn(
                "min-w-0 text-[15px] leading-7 text-foreground",
                className,
            )}
        >
            <ReactMarkdown
                remarkPlugins={[remarkGfm]}
                rehypePlugins={[
                    rehypeSlug,
                    [rehypeAutolinkHeadings, { behavior: "wrap" }],
                ]}
                components={markdownComponents}
            >
                {content}
            </ReactMarkdown>
        </article>
    );
}

const markdownComponents: Components = {
    a: ({ href, ...props }) => (
        <a
            {...props}
            href={href}
            rel={href?.startsWith("http") ? "noreferrer" : undefined}
            target={href?.startsWith("http") ? "_blank" : undefined}
            className="break-words [overflow-wrap:anywhere] text-primary underline underline-offset-4 hover:no-underline"
        />
    ),
    h2: ({ children, ...props }) => (
        <h2
            {...props}
            className="mt-10 scroll-mt-24 text-2xl font-extrabold tracking-tight"
        >
            {children}
        </h2>
    ),
    h3: ({ children, ...props }) => (
        <h3
            {...props}
            className="mt-8 scroll-mt-24 text-xl font-bold tracking-tight"
        >
            {children}
        </h3>
    ),
    p: ({ children, ...props }) => (
        <p {...props} className="mt-4 text-foreground/90">
            {children}
        </p>
    ),
    ul: ({ children, ...props }) => (
        <ul
            {...props}
            className="mt-4 list-disc space-y-2 pl-6 text-foreground/90"
        >
            {children}
        </ul>
    ),
    ol: ({ children, ...props }) => (
        <ol
            {...props}
            className="mt-4 list-decimal space-y-2 pl-6 text-foreground/90"
        >
            {children}
        </ol>
    ),
    li: ({ children, ...props }) => (
        <li {...props} className="pl-1">
            {children}
        </li>
    ),
    blockquote: ({ children, ...props }) => (
        <blockquote
            {...props}
            className="mt-6 rounded-[var(--radius)] border-l-4 border-primary bg-muted px-4 py-3 text-foreground/80"
        >
            {children}
        </blockquote>
    ),
    code: ({ children, ...props }) => (
        <code
            {...props}
            className="rounded bg-muted px-1.5 py-0.5 font-mono text-[0.9em]"
        >
            {children}
        </code>
    ),
    pre: ({ children, ...props }) => (
        <pre
            {...props}
            className="mt-6 overflow-x-auto rounded-[var(--radius)] border border-border bg-muted p-4 text-sm"
        >
            {children}
        </pre>
    ),
};
