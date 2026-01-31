import { createApiClient, type ApiClient } from "@repo/utils/api-client";

type AuthClientLike = {
    getCookie?: () => string | undefined;
} | null;

let currentAuthClient: AuthClientLike = null;

export function setApiClientAuthClient(client: AuthClientLike) {
    currentAuthClient = client;
}

export function getApiClientAuthClient() {
    return currentAuthClient;
}

type ExtraRequestOptions = {
    skipAuthCookie?: boolean;
};

const defaultClient = createApiClient({
    baseURL: process.env.EXPO_PUBLIC_API_BASE_URL,
    debug: false,
    // React Native 通过 better-auth expo 插件写入的 SecureStore，不使用原生 Cookie Jar，避免同机多 App 会话串号
    credentials: "omit",
    onRequest({ options }) {
        // ofetch 的 hook ctx 上没有直接暴露 `context` 字段；自定义透传时放在 options.context 里。
        const extra =
            (options as unknown as { context?: ExtraRequestOptions }).context ??
            {};
        if (extra.skipAuthCookie) {
            return;
        }
        const cookies = currentAuthClient?.getCookie?.();
        if (cookies) {
            const headers = new Headers(options.headers);
            headers.set("Cookie", cookies);
            options.headers = headers;
        }
    },
});

let sharedClient: ApiClient = defaultClient;

export function setSharedApiClient(client: ApiClient) {
    sharedClient = client;
}

export function getSharedApiClient() {
    return sharedClient;
}

function createClientProxy(): ApiClient {
    return {
        request: (...args) => sharedClient.request(...args),
        get: (...args) => sharedClient.get(...args),
        post: (...args) => sharedClient.post(...args),
        put: (...args) => sharedClient.put(...args),
        delete: (...args) => sharedClient.delete(...args),
        patch: (...args) => sharedClient.patch(...args),
    } as ApiClient;
}

export const apiClient = createClientProxy();
