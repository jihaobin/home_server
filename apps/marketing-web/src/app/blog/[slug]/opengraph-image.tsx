import { ImageResponse } from "next/og";
import { getPostBySlug } from "@/lib/blog/posts";
import { SITE_NAME } from "@/lib/site";

export const runtime = "nodejs";

export const size = {
    width: 1200,
    height: 630,
};

export const contentType = "image/png";

export default async function BlogOgImage(props: {
    params: Promise<{ slug: string }>;
}) {
    const { slug } = await props.params;
    const post = getPostBySlug(slug);

    return new ImageResponse(
        <div
            style={{
                width: "100%",
                height: "100%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                background:
                    "linear-gradient(135deg, rgba(255,255,255,1) 0%, rgba(255,247,237,1) 40%, rgba(255,255,255,1) 100%)",
            }}
        >
            <div
                style={{
                    width: 1040,
                    height: 470,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    padding: 64,
                    borderRadius: 48,
                    border: "1px solid rgba(15, 23, 42, 0.10)",
                    background:
                        "radial-gradient(circle at 20% 10%, rgba(255, 179, 0, 0.30) 0%, transparent 45%), radial-gradient(circle at 90% 80%, rgba(255, 179, 0, 0.22) 0%, transparent 50%), rgba(255,255,255,0.92)",
                }}
            >
                <div
                    style={{
                        fontSize: 44,
                        fontWeight: 800,
                        letterSpacing: -1,
                        color: "#0f172a",
                        lineHeight: 1.15,
                    }}
                >
                    {post.title}
                </div>
                <div
                    style={{
                        display: "flex",
                        flexDirection: "row",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginTop: 24,
                    }}
                >
                    <div
                        style={{
                            fontSize: 20,
                            color: "rgba(15, 23, 42, 0.65)",
                        }}
                    >
                        {SITE_NAME} · 博客
                    </div>
                    <div
                        style={{
                            fontSize: 20,
                            color: "rgba(15, 23, 42, 0.65)",
                        }}
                    >
                        {post.date}
                    </div>
                </div>
            </div>
        </div>,
        size,
    );
}
