import { hasPendingWechatPaymentSession } from "@/lib/wechat-payment-session";

const WECHAT_FALLBACK_ROUTE = "/(tabs)";
const WECHAT_PAYMENT_RETURN_ROUTE = "/servicePersonnel/wechat-payment-return";

export function redirectSystemPath({
    path,
}: {
    path: string;
    initial: boolean;
}) {
    try {
        const url = new URL(path, "home-server-user://app.home");
        const protocol = url.protocol.replace(":", "").toLowerCase();
        const normalizedPath = `${url.hostname}${url.pathname}`.toLowerCase();
        const isWechatLikeCallback =
            protocol.startsWith("wx") ||
            normalizedPath.includes("/oauth") ||
            normalizedPath.includes("wxauth") ||
            normalizedPath.includes("wxpay");

        if (isWechatLikeCallback && hasPendingWechatPaymentSession()) {
            return WECHAT_PAYMENT_RETURN_ROUTE;
        }

        if (isWechatLikeCallback) {
            return WECHAT_FALLBACK_ROUTE;
        }

        return path;
    } catch {
        if (path.toLowerCase().startsWith("wx")) {
            return WECHAT_FALLBACK_ROUTE;
        }

        return path;
    }
}
