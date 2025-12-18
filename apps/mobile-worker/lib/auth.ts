import { expoClient } from "@better-auth/expo/client";
import { emailOTPClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import * as Linking from "expo-linking";
import { roleFieldClientPlugin } from "@repo/lib/auth-schema";
import { API_BASE_URL } from "./config";
const AUTH_BASE_PATH = "/api/auth";
const SIGN_OUT_URL = new URL(
    `${AUTH_BASE_PATH}/sign-out`,
    API_BASE_URL
).toString();
const APP_SCHEME = "mobileworker";

const authClient = createAuthClient({
    baseURL: API_BASE_URL,
    plugins: [
        roleFieldClientPlugin,
        expoClient({
            scheme: APP_SCHEME,
            storagePrefix: "mobile-worker",
            storage: SecureStore,
        }),
        emailOTPClient()
    ],
});

async function signOutViaOpenApi() {
    const cookieHeader = authClient
        .getCookie?.()
        ?.replace(/^\s*;\s*/, "")
        .trim();

    if (!cookieHeader) {
        return;
    }

    try {
        await fetch(SIGN_OUT_URL, {
            method: "POST",
            headers: {
                Cookie: cookieHeader,
                "expo-origin": Linking.createURL("", { scheme: APP_SCHEME }),
                "x-skip-oauth-proxy": "true",
            },
        });
    } catch (error) {
        console.warn("[better-auth] open-api sign-out fallback failed", error);
    }
}

export async function signOutWithCleanup(
    ...args: Parameters<typeof authClient.signOut>
) {
    await signOutViaOpenApi();
    return authClient.signOut(...args);
}

export { authClient };
