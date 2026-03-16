export type LegalDocumentFrontMatter = {
    title: string;
    description: string;
    updated?: string; // YYYY-MM-DD
};

export type LegalDocument = LegalDocumentFrontMatter & {
    slug: string;
    content: string;
};
