import { MMKV } from "react-native-mmkv";

export type PendingWechatBindingSession = {
    state: string;
    requestedAt: string;
    appId?: string | null;
};

export type WechatBindingAuthResultSnapshot = {
    code?: string | null;
    state?: string | null;
    openId?: string | null;
    errorCode: number;
    errorMessage?: string | null;
    receivedAt: string;
};

const WECHAT_BINDING_STORAGE = new MMKV({
    id: "mobile-worker-wechat-binding",
});

const PENDING_WECHAT_BINDING_SESSION_KEY = "pending-wechat-binding-session";
const WECHAT_BINDING_AUTH_RESULT_SNAPSHOT_KEY =
    "wechat-binding-auth-result-snapshot";
const WECHAT_BINDING_SESSION_TTL_MS = 10 * 60 * 1000;

const isExpired = (timestamp: string) => {
    const value = new Date(timestamp).getTime();
    if (Number.isNaN(value)) {
        return true;
    }

    return Date.now() - value > WECHAT_BINDING_SESSION_TTL_MS;
};

function parsePendingSession(raw: string): PendingWechatBindingSession | null {
    try {
        const parsed = JSON.parse(raw) as Partial<PendingWechatBindingSession>;
        if (
            !parsed ||
            typeof parsed.state !== "string" ||
            typeof parsed.requestedAt !== "string"
        ) {
            return null;
        }

        return {
            state: parsed.state,
            requestedAt: parsed.requestedAt,
            appId:
                typeof parsed.appId === "string" || parsed.appId === null
                    ? parsed.appId
                    : undefined,
        };
    } catch {
        return null;
    }
}

function parseAuthResultSnapshot(
    raw: string,
): WechatBindingAuthResultSnapshot | null {
    try {
        const parsed = JSON.parse(
            raw,
        ) as Partial<WechatBindingAuthResultSnapshot>;
        if (
            !parsed ||
            typeof parsed.errorCode !== "number" ||
            typeof parsed.receivedAt !== "string"
        ) {
            return null;
        }

        return {
            code:
                typeof parsed.code === "string" || parsed.code === null
                    ? parsed.code
                    : undefined,
            state:
                typeof parsed.state === "string" || parsed.state === null
                    ? parsed.state
                    : undefined,
            openId:
                typeof parsed.openId === "string" || parsed.openId === null
                    ? parsed.openId
                    : undefined,
            errorCode: parsed.errorCode,
            errorMessage:
                typeof parsed.errorMessage === "string" ||
                parsed.errorMessage === null
                    ? parsed.errorMessage
                    : undefined,
            receivedAt: parsed.receivedAt,
        };
    } catch {
        return null;
    }
}

export function setPendingWechatBindingSession(
    session: PendingWechatBindingSession,
) {
    WECHAT_BINDING_STORAGE.set(
        PENDING_WECHAT_BINDING_SESSION_KEY,
        JSON.stringify(session),
    );
}

export function getPendingWechatBindingSession() {
    const raw = WECHAT_BINDING_STORAGE.getString(
        PENDING_WECHAT_BINDING_SESSION_KEY,
    );

    if (!raw) {
        return null;
    }

    const parsed = parsePendingSession(raw);
    if (!parsed || isExpired(parsed.requestedAt)) {
        WECHAT_BINDING_STORAGE.delete(PENDING_WECHAT_BINDING_SESSION_KEY);
        return null;
    }

    return parsed;
}

export function clearPendingWechatBindingSession() {
    WECHAT_BINDING_STORAGE.delete(PENDING_WECHAT_BINDING_SESSION_KEY);
}

export function setWechatBindingAuthResultSnapshot(
    snapshot: WechatBindingAuthResultSnapshot,
) {
    WECHAT_BINDING_STORAGE.set(
        WECHAT_BINDING_AUTH_RESULT_SNAPSHOT_KEY,
        JSON.stringify(snapshot),
    );
}

export function getWechatBindingAuthResultSnapshot() {
    const raw = WECHAT_BINDING_STORAGE.getString(
        WECHAT_BINDING_AUTH_RESULT_SNAPSHOT_KEY,
    );

    if (!raw) {
        return null;
    }

    const parsed = parseAuthResultSnapshot(raw);
    if (!parsed || isExpired(parsed.receivedAt)) {
        WECHAT_BINDING_STORAGE.delete(WECHAT_BINDING_AUTH_RESULT_SNAPSHOT_KEY);
        return null;
    }

    return parsed;
}

export function clearWechatBindingAuthResultSnapshot() {
    WECHAT_BINDING_STORAGE.delete(WECHAT_BINDING_AUTH_RESULT_SNAPSHOT_KEY);
}

export function consumeWechatBindingAuthResultSnapshot() {
    const snapshot = getWechatBindingAuthResultSnapshot();
    clearWechatBindingAuthResultSnapshot();
    return snapshot;
}
