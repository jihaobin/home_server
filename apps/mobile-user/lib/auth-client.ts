import { createAuthClient } from "better-auth/react";
import { expoClient } from "@better-auth/expo/client";
import * as SecureStore from "expo-secure-store";

export const authClient = createAuthClient({
    baseURL: "http://192.168.0.112:5050",
    plugins: [
        expoClient({
            scheme: "home-server-user",
            storagePrefix: "home-server-user",
            storage: SecureStore,
        })
    ]
});