const DEFAULT_API_ORIGIN = "http://192.168.0.110:5050";

function resolveApiOrigin(): string {
    const envAuthBaseUrl = process.env.EXPO_PUBLIC_AUTH_BASE_URL?.trim();
    if (envAuthBaseUrl) {
        return envAuthBaseUrl.replace(/\/$/, "");
    }

    const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (envApiBaseUrl) {
        // 兼容 EXPO_PUBLIC_API_BASE_URL 传入 ".../api" 或 "..." 两种形式
        return envApiBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
    }

    return DEFAULT_API_ORIGIN;
}

export const API_BASE_URL = resolveApiOrigin();

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
