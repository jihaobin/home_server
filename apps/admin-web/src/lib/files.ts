import { adminApiBaseUrl } from './api-client';

function normalizeBaseUrl(baseUrl?: string | null) {
    if (!baseUrl) {
        return '';
    }
    return baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
}

export function resolveFileUrl(identifier?: string | null) {
    if (!identifier) {
        return null;
    }
    const base = normalizeBaseUrl(adminApiBaseUrl);
    if (!base) {
        return `/files/${identifier}`;
    }
    return `${base}/files/${identifier}`;
}
