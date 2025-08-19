import { createApiClient } from "@repo/utils/api-client"
import { authClient } from "./auth-client";

export const apiClient = createApiClient({
    baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
    debug: false,
    onRequest({ options }) {
        const cookies = authClient.getCookie();
        const headers = {
            "Cookie": cookies,
        };
        options.headers = {
            ...options.headers,
            ...headers,
        };
    },
});
