import { NextResponse } from "next/server";
import { getAllPosts } from "@/lib/blog/posts";
import { SITE_NAME, SITE_URL } from "@/lib/site";

export const runtime = "nodejs";

function escapeXml(input: string) {
    return input
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&apos;");
}

export async function GET() {
    const posts = getAllPosts();
    const items = posts
        .slice(0, 20)
        .map((post) => {
            const url = `${SITE_URL}/blog/${post.slug}`;
            return `\n<item>\n  <title>${escapeXml(post.title)}</title>\n  <link>${url}</link>\n  <guid>${url}</guid>\n  <pubDate>${new Date(post.date).toUTCString()}</pubDate>\n  <description>${escapeXml(post.description)}</description>\n</item>`;
        })
        .join("");

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${escapeXml(`${SITE_NAME} 博客`)}</title>
  <link>${SITE_URL}/blog</link>
  <description>${escapeXml(`来自 ${SITE_NAME} 的使用指南与服务体验分享。`)}</description>
  <language>zh-CN</language>
  <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>
  ${items}
</channel>
</rss>`;

    return new NextResponse(xml, {
        headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control":
                "public, s-maxage=3600, stale-while-revalidate=86400",
        },
    });
}
