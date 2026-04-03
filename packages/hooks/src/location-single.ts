import * as ExpoLocation from "expo-location";
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

function getErrorCode(error: unknown): string {
    return error && typeof error === "object" && "code" in error
        ? String((error as { code?: unknown }).code ?? "")
        : "";
}

function getErrorMessage(error: unknown): string {
    if (error instanceof Error && error.message) {
        return error.message;
    }

    return error && typeof error === "object" && "message" in error
        ? String((error as { message?: unknown }).message ?? "")
        : "";
}

function isLocationRequestCancelled(error: unknown): boolean {
    const code = getErrorCode(error);
    const message = getErrorMessage(error);
    return (
        code === "LOCATION_DESTROYED" ||
        message.includes("页面已离开") ||
        message.includes("cancelled") ||
        message.includes("canceled")
    );
}

function shouldFallbackToSystemLocation(error: unknown): boolean {
    const code = getErrorCode(error);
    if (code === "LOCATION_BUSY" || code === "LOCATION_DESTROYED") {
        return false;
    }

    return true;
}

async function requestPermissions(): Promise<boolean> {
    try {
        const currentPermission =
            await ExpoLocation.getForegroundPermissionsAsync();

        if (currentPermission.status !== "granted") {
            const requestedPermission =
                await ExpoLocation.requestForegroundPermissionsAsync();
            if (requestedPermission.status !== "granted") {
                return false;
            }
        }

        if (Platform.OS === "android") {
            try {
                await ExpoLocation.enableNetworkProviderAsync();
            } catch {
                // 用户可能拒绝开启高精度定位，后续继续尝试系统定位/GPS。
            }
        }

        return true;
    } catch {
        return false;
    }
}

function toLocationChangedEvent(
    location: ExpoLocation.LocationObject,
    address?: ExpoLocation.LocationGeocodedAddress | null,
): LocationChangedEvent {
    const streetParts = [address?.street, address?.streetNumber].filter(
        Boolean,
    );
    const formattedAddressParts = [
        address?.region,
        address?.city,
        address?.district,
        ...streetParts,
    ].filter(Boolean);

    return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        altitude: location.coords.altitude ?? 0,
        accuracy: location.coords.accuracy ?? 0,
        bearing: location.coords.heading ?? 0,
        speed: location.coords.speed ?? 0,
        timestamp: location.timestamp,
        nation: address?.country ?? undefined,
        province: address?.region ?? undefined,
        city: address?.city ?? undefined,
        district: address?.district ?? undefined,
        street: address?.street ?? undefined,
        streetNo: address?.streetNumber ?? undefined,
        name: address?.name ?? undefined,
        address:
            address?.formattedAddress ??
            (formattedAddressParts.length > 0
                ? formattedAddressParts.join("")
                : undefined),
    };
}

async function requestSystemSingleLocation(): Promise<LocationChangedEvent> {
    const location = await ExpoLocation.getCurrentPositionAsync({
        accuracy: ExpoLocation.LocationAccuracy.Highest,
        distanceInterval: 0,
        timeInterval: 0,
        ...(Platform.OS === "android"
            ? { mayShowUserSettingsDialog: true }
            : {}),
    });

    let address: ExpoLocation.LocationGeocodedAddress | null = null;
    try {
        const [firstAddress] = await ExpoLocation.reverseGeocodeAsync({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
        });
        address = firstAddress ?? null;
    } catch {
        address = null;
    }

    return toLocationChangedEvent(location, address);
}

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
    const code = getErrorCode(error);
    const message = getErrorMessage(error);

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
        return message || "单次定位失败，请稍后重试";
    }

    if (
        message.includes("ERROR_NOCELL&WIFI_LOCATION_SWITCHOFF") ||
        message.includes("wifi location switchoff")
    ) {
        return "系统高精度定位未开启，请打开定位服务，并开启 Wi-Fi/移动网络辅助定位后重试";
    }

    if (
        message.includes("Location provider is unavailable") ||
        message.includes("location provider is unavailable")
    ) {
        return "系统定位服务不可用，请确认系统定位开关已开启";
    }

    if (
        message.includes("Not authorized to use location services") ||
        message.includes("permission") ||
        message.includes("denied")
    ) {
        return "请在系统设置中允许应用访问位置信息";
    }

    if (message) {
        return message;
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

    const permissionGranted = await requestPermissions();
    if (!permissionGranted) {
        throw new Error("请在系统设置中允许应用访问位置信息");
    }

    setUserAgreePrivacy(true);
    const resolvedDeviceId = await resolveDeviceId(deviceId);
    setDeviceID(resolvedDeviceId);

    logSingleLocationInvocation({
        count: singleLocationInvocationCount,
        source,
        provider: "tencent",
    });

    let location: LocationChangedEvent;
    try {
        location = await requestSingleFreshLocation({
            requestLevel: RequestLevel.REQUEST_LEVEL_NAME,
            allowGPS: true,
            allowCache: true,
            locMode: LocationMode.HIGH_ACCURACY_MODE,
            ...request,
        });
    } catch (error) {
        if (isLocationRequestCancelled(error) || !shouldFallbackToSystemLocation(error)) {
            throw error;
        }

        location = await requestSystemSingleLocation();
    }

    singleLocationCache = {
        event: location,
        cachedAt: Date.now(),
    };

    return location;
}
