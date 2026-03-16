import type { Metadata } from "next";
import { Markdown } from "@/components/blog/Markdown";
import { Container } from "@/components/ui/Container";
import { Card } from "@/components/ui/Card";
import { getLegalDocumentBySlug } from "@/lib/legal/documents";
import { absoluteUrl } from "@/lib/site";

const termsDocument = getLegalDocumentBySlug("terms");

export const metadata: Metadata = {
    title: termsDocument.title,
    description: termsDocument.description,
    alternates: {
        canonical: absoluteUrl("/terms"),
    },
};

export default function TermsPage() {
    return (
        <Container className="py-14">
            <div>
                <h1 className="text-3xl font-extrabold tracking-tight md:text-4xl">
                    {termsDocument.title}
                </h1>
                {termsDocument.updated ? (
                    <p className="mt-4 text-sm text-muted-foreground">
                        更新于 {termsDocument.updated}
                    </p>
                ) : null}

                <Card className="mt-8 p-8">
                    <Markdown content={termsDocument.content} />
                </Card>
            </div>
        </Container>
    );
}
