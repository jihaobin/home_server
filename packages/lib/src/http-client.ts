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
    onRequest({ options, context }) {
        const extra = (context ?? {}) as ExtraRequestOptions;
        if (extra.skipAuthCookie) {
            return;
        }
        const cookies = currentAuthClient?.getCookie?.();
        if (cookies) {
            options.headers = {
                ...options.headers,
                Cookie: cookies,
            };
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
