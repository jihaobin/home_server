import {
    type LocationChangedEvent,
    LocationMode,
    type LocationRequest,
    RequestLevel,
    requestSingleFreshLocation,
    setDeviceID,
    setUserAgreePrivacy,
} from "expo-qq-location";
import { Platform } from "react-native";

const DEVICE_ID_STORAGE_KEY = "repo_location_device_id_v1";
const SINGLE_LOCATION_CACHE_MAX_AGE_MS = 15 * 1000;

let deviceIdCache: string | null = null;
let deviceIdLoadingPromise: Promise<string> | null = null;
let singleLocationInvocationCount = 0;
let singleLocationCache: {
    event: LocationChangedEvent;
    cachedAt: number;
} | null = null;

function logSingleLocationInvocation(params: {
    count: number;
    source: string;
    provider: "cache" | "tencent";
}) {
    // console.log(
    //     `[location][single] 第${params.count}次调用 | 来源=${params.source} | 数据来源=${params.provider === "cache" ? "缓存" : "腾讯地图"}`,
    // );
}

function sanitizeDeviceId(value: string): string {
    const sanitized = value.replace(/[^A-Za-z0-9_]/g, "_").slice(0, 63);
    return sanitized || `location_${Date.now()}`;
}

async function resolveDeviceId(explicitDeviceId?: string): Promise<string> {
    if (explicitDeviceId) {
        return sanitizeDeviceId(explicitDeviceId);
    }

    if (deviceIdCache) {
        return deviceIdCache;
    }

    if (deviceIdLoadingPromise) {
        return deviceIdLoadingPromise;
    }

    deviceIdLoadingPromise = (async () => {
        const fallback = sanitizeDeviceId(
            `location_${Platform.OS}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
        );

        try {
            const SecureStore = await import("expo-secure-store");
            const existing = await SecureStore.getItemAsync(
                DEVICE_ID_STORAGE_KEY,
            );
            if (existing) {
                deviceIdCache = sanitizeDeviceId(existing);
                return deviceIdCache;
            }

            await SecureStore.setItemAsync(DEVICE_ID_STORAGE_KEY, fallback);
            deviceIdCache = fallback;
            return fallback;
        } catch {
            deviceIdCache = fallback;
            return fallback;
        }
    })();

    const resolved = await deviceIdLoadingPromise;
    deviceIdLoadingPromise = null;
    return resolved;
}

export function getSingleLocationErrorMessage(error: unknown): string {
    const code =
        error && typeof error === "object" && "code" in error
            ? String((error as { code?: unknown }).code ?? "")
            : "";

    if (code === "LOCATION_BUSY") {
        return "定位请求处理中，请稍后重试";
    }

    if (code === "LOCATION_TIMEOUT") {
        return "定位超时，请检查网络或定位权限后重试";
    }

    if (code === "LOCATION_START_FAILED") {
        return "定位启动失败，请确认系统定位开关已开启";
    }

    if (code === "LOCATION_DESTROYED") {
        return "页面已离开，定位流程已取消";
    }

    if (code === "LOCATION_SINGLE_ERROR") {
        const message =
            error && typeof error === "object" && "message" in error
                ? String((error as { message?: unknown }).message ?? "")
                : "";

        return message || "单次定位失败，请稍后重试";
    }

    if (error instanceof Error && error.message) {
        return error.message;
    }

    return "定位失败，请稍后重试";
}

export async function requestSingleLocation(
    request?: LocationRequest,
    deviceId?: string,
    source = "unknown-single-source",
): Promise<LocationChangedEvent> {
    singleLocationInvocationCount += 1;

    if (
        singleLocationCache &&
        Date.now() - singleLocationCache.cachedAt <=
            SINGLE_LOCATION_CACHE_MAX_AGE_MS
    ) {
        logSingleLocationInvocation({
            count: singleLocationInvocationCount,
            source,
            provider: "cache",
        });
        return singleLocationCache.event;
    }

    setUserAgreePrivacy(true);
    const resolvedDeviceId = await resolveDeviceId(deviceId);
    setDeviceID(resolvedDeviceId);

    logSingleLocationInvocation({
        count: singleLocationInvocationCount,
        source,
        provider: "tencent",
    });

    const location = await requestSingleFreshLocation({
        requestLevel: RequestLevel.REQUEST_LEVEL_NAME,
        allowGPS: true,
        allowCache: true,
        locMode: LocationMode.HIGH_ACCURACY_MODE,
        ...request,
    });

    singleLocationCache = {
        event: location,
        cachedAt: Date.now(),
    };

    return location;
}
