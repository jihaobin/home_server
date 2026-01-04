import {
    AdminLoginRequestSchema,
    AdminLogoutResponseSchema,
    AdminProfileSchema,
    type AdminLoginRequest,
    type AdminProfile,
} from "@repo/types";
import { apiClient } from "@/lib/api-client";
import { authClient } from "./auth-cient";

export type AdminLoginInput = AdminLoginRequest;

const webHost = (process.env.NEXT_PUBLIC_WEB_HOST ?? "http://localhost:3000").replace(/\/$/, "");

export async function adminLogin(values: AdminLoginInput) {
    const payload = AdminLoginRequestSchema.parse({
        ...values,
        rememberMe: values.rememberMe ?? false,
    });

    const response = await apiClient.post<AdminProfile>("/admin/login", payload, {
        schema: AdminProfileSchema,
    });

    return response.data;
}

export async function adminLogout() {
    await apiClient.post("/admin/logout", undefined, {
        schema: AdminLogoutResponseSchema,
    });
}

export async function fetchAdminProfile() {
    const response = await apiClient.get<AdminProfile>("/admin/profile", {
        schema: AdminProfileSchema,
    });

    return response.data;
}

// Legacy flows that still rely on Better Auth for non管理员注册/社交登录
export async function register({
    name,
    email,
    password,
}: {
    name: string;
    email: string;
    password: string;
}) {
    return await authClient.signUp.email({
        name,
        email,
        password,
        callbackURL: `${webHost}/auth/verify-email`,
        surname: name,
        role: "customer",
    });
}

export async function socialLogin({ provider }: { provider: string }) {
    return await authClient.signIn.social({
        provider,
        callbackURL: `${webHost}/`,
    });
}

export async function wechatLogin() {
    return await authClient.signIn.oauth2({
        providerId: "wechat",
        callbackURL: `${webHost}/`,
    });
}
