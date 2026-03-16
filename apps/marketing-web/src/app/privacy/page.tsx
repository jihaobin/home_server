import type { Metadata } from "next";
import { Markdown } from "@/components/blog/Markdown";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { getLegalDocumentBySlug } from "@/lib/legal/documents";
import { absoluteUrl } from "@/lib/site";

const privacyDocument = getLegalDocumentBySlug("privacy");

export const metadata: Metadata = {
    title: privacyDocument.title,
    description: privacyDocument.description,
    alternates: {
        canonical: absoluteUrl("/privacy"),
    },
    robots: {
        index: true,
        follow: true,
    },
};

export default function PrivacyPage() {
    return (
        <Container className="py-14">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                    {privacyDocument.title}
                </h1>
                {privacyDocument.updated ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                        更新于 {privacyDocument.updated}
                    </p>
                ) : null}

                <Card className="mt-8 p-8">
                    <Markdown content={privacyDocument.content} />
                </Card>
            </div>
        </Container>
    );
}
