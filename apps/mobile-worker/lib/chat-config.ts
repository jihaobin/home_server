import { API_BASE_URL } from "./config";

export const CHAT_NAMESPACE = "/api/chat";

export function resolveChatSocketEndpoint(): string | null {
    if (!API_BASE_URL) {
        return null;
    }
    const normalizedBase = API_BASE_URL.endsWith("/")
        ? API_BASE_URL.slice(0, -1)
        : API_BASE_URL;
    const namespace = CHAT_NAMESPACE.startsWith("/")
        ? CHAT_NAMESPACE
        : `/${CHAT_NAMESPACE}`;
    return `${normalizedBase}${namespace}`;
}
