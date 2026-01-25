export type PostFrontMatter = {
    title: string;
    description: string;
    date: string; // YYYY-MM-DD
    updated?: string; // YYYY-MM-DD
    tags?: string[];
    draft?: boolean;
};

export type Post = PostFrontMatter & {
    slug: string;
    content: string;
};

export type PostListItem = PostFrontMatter & {
    slug: string;
};
