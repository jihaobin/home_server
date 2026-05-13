export type LegalDocKey = "terms" | "privacy";

export const LEGAL_DOCUMENT_CONFIG: Record<
    LegalDocKey,
    {
        title: string;
        url: string;
    }
> = {
    terms: {
        title: "用户协议",
        url: "https://dingsm.com/terms",
    },
    privacy: {
        title: "隐私政策",
        url: "https://dingsm.com/privacy",
    },
};
