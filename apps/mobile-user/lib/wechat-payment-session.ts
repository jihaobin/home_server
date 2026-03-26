import { MMKV } from "react-native-mmkv";

export type PendingWechatPaymentSession = {
    orderId: string;
    amount: number;
    paymentMethod: "wechat_pay";
    createdAt: string;
    paymentExpiresAt?: string | null;
    prepayId?: string | null;
};

export type WechatPayResultSnapshot = {
    errorCode: number;
    errorMessage?: string | null;
    transaction?: string | null;
    prepayId?: string | null;
    receivedAt: string;
};

const WECHAT_PAYMENT_SESSION_STORAGE = new MMKV({
    id: "mobile-user-wechat-payment",
});

const PENDING_WECHAT_PAYMENT_SESSION_KEY = "pending-wechat-payment-session";
const WECHAT_PAY_RESULT_SNAPSHOT_KEY = "wechat-pay-result-snapshot";

function parsePendingSession(raw: string): PendingWechatPaymentSession | null {
    try {
        const parsed = JSON.parse(raw) as Partial<PendingWechatPaymentSession>;
        if (
            !parsed ||
            typeof parsed.orderId !== "string" ||
            typeof parsed.amount !== "number" ||
            parsed.paymentMethod !== "wechat_pay" ||
            typeof parsed.createdAt !== "string"
        ) {
            return null;
        }

        return {
            orderId: parsed.orderId,
            amount: parsed.amount,
            paymentMethod: "wechat_pay",
            createdAt: parsed.createdAt,
            paymentExpiresAt:
                typeof parsed.paymentExpiresAt === "string" ||
                parsed.paymentExpiresAt === null
                    ? parsed.paymentExpiresAt
                    : undefined,
            prepayId:
                typeof parsed.prepayId === "string" || parsed.prepayId === null
                    ? parsed.prepayId
                    : undefined,
        };
    } catch {
        return null;
    }
}

export function setPendingWechatPaymentSession(
    session: PendingWechatPaymentSession,
) {
    WECHAT_PAYMENT_SESSION_STORAGE.set(
        PENDING_WECHAT_PAYMENT_SESSION_KEY,
        JSON.stringify(session),
    );
}

export function getPendingWechatPaymentSession() {
    const raw = WECHAT_PAYMENT_SESSION_STORAGE.getString(
        PENDING_WECHAT_PAYMENT_SESSION_KEY,
    );

    if (!raw) {
        return null;
    }

    const parsed = parsePendingSession(raw);
    if (!parsed) {
        WECHAT_PAYMENT_SESSION_STORAGE.delete(
            PENDING_WECHAT_PAYMENT_SESSION_KEY,
        );
    }

    return parsed;
}

export function hasPendingWechatPaymentSession() {
    return Boolean(getPendingWechatPaymentSession());
}

export function clearPendingWechatPaymentSession() {
    WECHAT_PAYMENT_SESSION_STORAGE.delete(PENDING_WECHAT_PAYMENT_SESSION_KEY);
}

function parseWechatPayResultSnapshot(
    raw: string,
): WechatPayResultSnapshot | null {
    try {
        const parsed = JSON.parse(raw) as Partial<WechatPayResultSnapshot>;
        if (
            !parsed ||
            typeof parsed.errorCode !== "number" ||
            typeof parsed.receivedAt !== "string"
        ) {
            return null;
        }

        return {
            errorCode: parsed.errorCode,
            errorMessage:
                typeof parsed.errorMessage === "string" ||
                parsed.errorMessage === null
                    ? parsed.errorMessage
                    : undefined,
            transaction:
                typeof parsed.transaction === "string" ||
                parsed.transaction === null
                    ? parsed.transaction
                    : undefined,
            prepayId:
                typeof parsed.prepayId === "string" || parsed.prepayId === null
                    ? parsed.prepayId
                    : undefined,
            receivedAt: parsed.receivedAt,
        };
    } catch {
        return null;
    }
}

export function setWechatPayResultSnapshot(snapshot: WechatPayResultSnapshot) {
    WECHAT_PAYMENT_SESSION_STORAGE.set(
        WECHAT_PAY_RESULT_SNAPSHOT_KEY,
        JSON.stringify(snapshot),
    );
}

export function getWechatPayResultSnapshot() {
    const raw = WECHAT_PAYMENT_SESSION_STORAGE.getString(
        WECHAT_PAY_RESULT_SNAPSHOT_KEY,
    );

    if (!raw) {
        return null;
    }

    const parsed = parseWechatPayResultSnapshot(raw);
    if (!parsed) {
        WECHAT_PAYMENT_SESSION_STORAGE.delete(WECHAT_PAY_RESULT_SNAPSHOT_KEY);
    }

    return parsed;
}

export function clearWechatPayResultSnapshot() {
    WECHAT_PAYMENT_SESSION_STORAGE.delete(WECHAT_PAY_RESULT_SNAPSHOT_KEY);
}

export function consumeWechatPayResultSnapshot() {
    const snapshot = getWechatPayResultSnapshot();
    clearWechatPayResultSnapshot();
    return snapshot;
}
