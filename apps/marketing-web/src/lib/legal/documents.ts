import type { LegalDocument } from "@/lib/legal/types";
import { legalDocumentsBySlug } from "@/lib/legal/generated";

export function getLegalDocumentBySlug(slug: string): LegalDocument {
    const document = legalDocumentsBySlug[slug];

    if (!document) {
        throw new Error(`Legal document not found: ${slug}`);
    }

    return document;
}
