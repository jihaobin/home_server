import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { roleFieldClientPlugin } from "./auth-schema";

const DEFAULT_AUTH_BASE_URL = "http://192.168.0.110:5050";

function resolveAuthBaseUrl(): string {
    const envAuthBaseUrl = process.env.EXPO_PUBLIC_AUTH_BASE_URL?.trim();
    if (envAuthBaseUrl) {
        return envAuthBaseUrl.replace(/\/$/, "");
    }

    const envApiBaseUrl = process.env.EXPO_PUBLIC_API_BASE_URL?.trim();
    if (envApiBaseUrl) {
        return envApiBaseUrl.replace(/\/api\/?$/, "").replace(/\/$/, "");
    }

    return DEFAULT_AUTH_BASE_URL;
}

export const authClient = createAuthClient({
    baseURL: resolveAuthBaseUrl(),
    plugins: [
        roleFieldClientPlugin,
        expoClient({
            scheme: "home-server-user",
            storagePrefix: "home-server-user",
            storage: SecureStore,
        }),
        phoneNumberClient(),
    ],
});
