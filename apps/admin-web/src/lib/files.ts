import { adminApiBaseUrl } from "./api-client";

function normalizeBaseUrl(baseUrl?: string | null) {
    if (!baseUrl) {
        return "";
    }
    return baseUrl.endsWith("/") ? baseUrl.slice(0, -1) : baseUrl;
}

function joinWithBase(baseUrl: string, path: string) {
    return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

export function resolveFileUrl(identifier?: string | null) {
    if (!identifier) {
        return null;
    }

    const trimmed = identifier.trim();
    if (!trimmed) {
        return null;
    }

    if (
        /^(https?:)?\/\//i.test(trimmed) ||
        /^data:/i.test(trimmed) ||
        /^blob:/i.test(trimmed)
    ) {
        return trimmed;
    }

    const base = normalizeBaseUrl(adminApiBaseUrl);

    if (trimmed.startsWith("/")) {
        return base ? joinWithBase(base, trimmed) : trimmed;
    }

    if (trimmed.startsWith("files/")) {
        return base ? joinWithBase(base, trimmed) : `/${trimmed}`;
    }

    if (trimmed.includes("/")) {
        return base ? joinWithBase(base, trimmed) : `/${trimmed}`;
    }

    if (!base) {
        return `/files/${trimmed}`;
    }
    return `${base}/files/${trimmed}`;
}
