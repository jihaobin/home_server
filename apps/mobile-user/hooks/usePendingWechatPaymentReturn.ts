import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import { AppState, type AppStateStatus } from "react-native";
import {
    clearPendingWechatPaymentSession,
    getPendingWechatPaymentSession,
} from "@/lib/wechat-payment-session";

const WECHAT_RETURN_ROUTE = "/servicePersonnel/wechat-payment-return";
const PAYMENT_RESULT_ROUTE = "/servicePersonnel/payment-result";
const REDIRECT_DEBOUNCE_MS = 1500;

const normalizePathname = (pathname: string) => pathname.replace(/\/+$/, "");

const isSessionExpired = (paymentExpiresAt?: string | null) => {
    if (!paymentExpiresAt) {
        return false;
    }

    const expiresAt = new Date(paymentExpiresAt);
    const timestamp = expiresAt.getTime();
    if (Number.isNaN(timestamp)) {
        return false;
    }

    return timestamp <= Date.now();
};

export function usePendingWechatPaymentReturn(
    pathname: string,
    isAuthenticated: boolean,
) {
    const router = useRouter();
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const lastRedirectAtRef = useRef(0);
    const lastRedirectOrderIdRef = useRef<string | null>(null);

    useEffect(() => {
        const redirectToWechatReturn = () => {
            if (!isAuthenticated) {
                return;
            }

            const pendingSession = getPendingWechatPaymentSession();
            if (!pendingSession) {
                lastRedirectOrderIdRef.current = null;
                return;
            }

            if (isSessionExpired(pendingSession.paymentExpiresAt)) {
                clearPendingWechatPaymentSession();
                lastRedirectOrderIdRef.current = null;
                return;
            }

            const currentPathname = normalizePathname(pathname);

            if (
                currentPathname === WECHAT_RETURN_ROUTE ||
                currentPathname === PAYMENT_RESULT_ROUTE
            ) {
                return;
            }

            const now = Date.now();
            if (lastRedirectOrderIdRef.current === pendingSession.orderId) {
                return;
            }

            if (now - lastRedirectAtRef.current < REDIRECT_DEBOUNCE_MS) {
                return;
            }

            lastRedirectAtRef.current = now;
            lastRedirectOrderIdRef.current = pendingSession.orderId;
            router.replace({
                pathname: WECHAT_RETURN_ROUTE,
                params: {
                    requestId: String(now),
                    orderId: pendingSession.orderId,
                },
            });
        };

        const redirectTimer = setTimeout(() => {
            redirectToWechatReturn();
        }, 150);

        const subscription = AppState.addEventListener(
            "change",
            (nextState) => {
                const isReturningToForeground =
                    appStateRef.current.match(/inactive|background/) &&
                    nextState === "active";

                appStateRef.current = nextState;

                if (!isReturningToForeground) {
                    return;
                }

                redirectToWechatReturn();
            },
        );

        return () => {
            clearTimeout(redirectTimer);
            subscription.remove();
        };
    }, [isAuthenticated, pathname, router]);
}
