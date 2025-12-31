import { expoClient } from "@better-auth/expo/client";
import { phoneNumberClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";
import * as SecureStore from "expo-secure-store";
import { roleFieldClientPlugin } from "./auth-schema";

export const authClient = createAuthClient({
    baseURL: "http://192.168.0.110:5050",
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
