const DEFAULT_API_BASE_URL = "http://192.168.0.110:5050";

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

    return DEFAULT_API_BASE_URL;
}

// 说明：这里的 API_BASE_URL 表示“站点 Origin”（不包含 /api），用于 better-auth 与通知 WS。
export const API_BASE_URL = resolveApiOrigin();

export const NOTIFICATION_NAMESPACE = "/api/notifications";
