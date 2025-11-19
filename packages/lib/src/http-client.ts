import { createApiClient } from "@repo/utils/api-client";
import { authClient as defaultAuthClient } from "./auth-client";

let currentAuthClient = defaultAuthClient;

export function setApiClientAuthClient(client: typeof defaultAuthClient) {
    currentAuthClient = client;
}

export function getApiClientAuthClient() {
    return currentAuthClient;
}

export const apiClient = createApiClient({
    baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
    debug: false,
    // 统一依赖 better-auth expo 插件写入的 SecureStore，不使用原生 Cookie Jar，避免同机多 App 会话串号
    credentials: "omit",
    onRequest({ options }) {
        const cookies = currentAuthClient.getCookie();
        if (cookies) {
            options.headers = {
                ...options.headers,
                Cookie: cookies,
            };
        }
    },
});
