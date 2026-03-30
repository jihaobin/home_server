import { MMKV } from "react-native-mmkv";

export type PendingWechatMerchantTransferSession = {
    withdrawalId: string;
    mchId: string;
    appId: string;
    packageInfo: string;
    requestedAt: string;
};

export type WechatMerchantTransferResultSnapshot = {
    withdrawalId: string;
    businessType?: string | null;
    extMsg?: string | null;
    result: "success" | "fail" | "cancel";
    errorCode: number;
    errorMessage?: string | null;
    transaction?: string | null;
    receivedAt: string;
};

const WECHAT_TRANSFER_STORAGE = new MMKV({
    id: "mobile-worker-wechat-merchant-transfer",
});

const PENDING_WECHAT_TRANSFER_SESSION_KEY =
    "pending-wechat-merchant-transfer-session";
const WECHAT_TRANSFER_RESULT_SNAPSHOT_KEY =
    "wechat-merchant-transfer-result-snapshot";
const WECHAT_TRANSFER_COOLDOWN_PREFIX = "wechat-merchant-transfer-cooldown:";

const SESSION_TTL_MS = 10 * 60 * 1000;
const DEFAULT_COOLDOWN_MS = 30 * 1000;

const isExpired = (timestamp: string, ttlMs = SESSION_TTL_MS) => {
    const value = new Date(timestamp).getTime();
    if (Number.isNaN(value)) {
        return true;
    }

    return Date.now() - value > ttlMs;
};

function parsePendingSession(
    raw: string,
): PendingWechatMerchantTransferSession | null {
    try {
        const parsed = JSON.parse(
            raw,
        ) as Partial<PendingWechatMerchantTransferSession>;
        if (
            !parsed ||
            typeof parsed.withdrawalId !== "string" ||
            typeof parsed.mchId !== "string" ||
            typeof parsed.appId !== "string" ||
            typeof parsed.packageInfo !== "string" ||
            typeof parsed.requestedAt !== "string"
        ) {
            return null;
        }

        return {
            withdrawalId: parsed.withdrawalId,
            mchId: parsed.mchId,
            appId: parsed.appId,
            packageInfo: parsed.packageInfo,
            requestedAt: parsed.requestedAt,
        };
    } catch {
        return null;
    }
}

function parseResultSnapshot(
    raw: string,
): WechatMerchantTransferResultSnapshot | null {
    try {
        const parsed = JSON.parse(
            raw,
        ) as Partial<WechatMerchantTransferResultSnapshot>;
        if (
            !parsed ||
            typeof parsed.withdrawalId !== "string" ||
            typeof parsed.result !== "string" ||
            typeof parsed.errorCode !== "number" ||
            typeof parsed.receivedAt !== "string"
        ) {
            return null;
        }

        return {
            withdrawalId: parsed.withdrawalId,
            result: parsed.result as WechatMerchantTransferResultSnapshot["result"],
            errorCode: parsed.errorCode,
            businessType:
                typeof parsed.businessType === "string" ||
                parsed.businessType === null
                    ? parsed.businessType
                    : undefined,
            extMsg:
                typeof parsed.extMsg === "string" || parsed.extMsg === null
                    ? parsed.extMsg
                    : undefined,
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
            receivedAt: parsed.receivedAt,
        };
    } catch {
        return null;
    }
}

export function setPendingWechatMerchantTransferSession(
    session: PendingWechatMerchantTransferSession,
) {
    WECHAT_TRANSFER_STORAGE.set(
        PENDING_WECHAT_TRANSFER_SESSION_KEY,
        JSON.stringify(session),
    );
}

export function getPendingWechatMerchantTransferSession() {
    const raw = WECHAT_TRANSFER_STORAGE.getString(
        PENDING_WECHAT_TRANSFER_SESSION_KEY,
    );
    if (!raw) {
        return null;
    }

    const parsed = parsePendingSession(raw);
    if (!parsed || isExpired(parsed.requestedAt)) {
        WECHAT_TRANSFER_STORAGE.delete(PENDING_WECHAT_TRANSFER_SESSION_KEY);
        return null;
    }

    return parsed;
}

export function clearPendingWechatMerchantTransferSession() {
    WECHAT_TRANSFER_STORAGE.delete(PENDING_WECHAT_TRANSFER_SESSION_KEY);
}

export function setWechatMerchantTransferResultSnapshot(
    snapshot: WechatMerchantTransferResultSnapshot,
) {
    WECHAT_TRANSFER_STORAGE.set(
        WECHAT_TRANSFER_RESULT_SNAPSHOT_KEY,
        JSON.stringify(snapshot),
    );
}

export function getWechatMerchantTransferResultSnapshot() {
    const raw = WECHAT_TRANSFER_STORAGE.getString(
        WECHAT_TRANSFER_RESULT_SNAPSHOT_KEY,
    );
    if (!raw) {
        return null;
    }

    const parsed = parseResultSnapshot(raw);
    if (!parsed || isExpired(parsed.receivedAt)) {
        WECHAT_TRANSFER_STORAGE.delete(WECHAT_TRANSFER_RESULT_SNAPSHOT_KEY);
        return null;
    }

    return parsed;
}

export function clearWechatMerchantTransferResultSnapshot() {
    WECHAT_TRANSFER_STORAGE.delete(WECHAT_TRANSFER_RESULT_SNAPSHOT_KEY);
}

function getCooldownKey(withdrawalId: string) {
    return `${WECHAT_TRANSFER_COOLDOWN_PREFIX}${withdrawalId}`;
}

export function markWechatMerchantTransferAttempt(
    withdrawalId: string,
    timestamp = new Date().toISOString(),
) {
    WECHAT_TRANSFER_STORAGE.set(getCooldownKey(withdrawalId), timestamp);
}

export function isWechatMerchantTransferCoolingDown(
    withdrawalId: string,
    cooldownMs = DEFAULT_COOLDOWN_MS,
) {
    const raw = WECHAT_TRANSFER_STORAGE.getString(getCooldownKey(withdrawalId));
    if (!raw) {
        return false;
    }

    if (isExpired(raw, cooldownMs)) {
        WECHAT_TRANSFER_STORAGE.delete(getCooldownKey(withdrawalId));
        return false;
    }

    return true;
}
