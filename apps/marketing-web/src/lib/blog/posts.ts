import type { Post, PostListItem } from "@/lib/blog/types";
import { postList, postsBySlug } from "@/lib/blog/generated";

export function getAllPostSlugs() {
    return postList.map((p) => p.slug);
}

export function getPostBySlug(slug: string): Post {
    const post = postsBySlug[slug];
    if (!post) {
        throw new Error(`Blog post not found: ${slug}`);
    }
    return post;
}

export function getAllPosts(): PostListItem[] {
    return postList;
}
