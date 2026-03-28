import type { MetadataRoute } from "next";
import { getAllPosts } from "@/lib/blog/posts";
import { SITE_URL } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
    const now = new Date();
    const pages: MetadataRoute.Sitemap = [
        {
            url: `${SITE_URL}/`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 1,
        },
        {
            url: `${SITE_URL}/features`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/download`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.9,
        },
        {
            url: `${SITE_URL}/worker-app`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.8,
        },
        {
            url: `${SITE_URL}/blog`,
            lastModified: now,
            changeFrequency: "weekly",
            priority: 0.7,
        },
        {
            url: `${SITE_URL}/faq`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.5,
        },
        {
            url: `${SITE_URL}/contact`,
            lastModified: now,
            changeFrequency: "monthly",
            priority: 0.4,
        },
        {
            url: `${SITE_URL}/privacy`,
            lastModified: now,
            changeFrequency: "yearly",
            priority: 0.3,
        },
        {
            url: `${SITE_URL}/terms`,
            lastModified: now,
            changeFrequency: "yearly",
            priority: 0.3,
        },
    ];

    const posts = getAllPosts();
    for (const post of posts) {
        pages.push({
            url: `${SITE_URL}/blog/${post.slug}`,
            lastModified: new Date(post.updated ?? post.date),
            changeFrequency: "monthly",
            priority: 0.6,
        });
    }

    return pages;
}
