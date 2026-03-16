import * as Location from "expo-location";
import {
    addLocationErrorListener,
    addLocationListener,
    addStatusUpdateListener,
    getApiKey,
    type LocationChangedEvent,
    type LocationErrorEvent,
    LocationMode,
    type LocationRequest,
    type LocationStatusEvent,
    RequestLevel,
    setDeviceID,
    setUserAgreePrivacy,
    startLocationUpdates,
    stopLocationUpdates,
} from "expo-qq-location";
import { useCallback, useEffect, useMemo, useReducer, useRef } from "react";
import { AppState, type AppStateStatus, Platform } from "react-native";
import { toast } from "sonner-native";

type ExtendedLocationRequest = LocationRequest & {
    allowCache?: boolean;
};

type UseLocationOptions = ExtendedLocationRequest & {
    enabled?: boolean;
    deviceId?: string;
    source?: string;
    onSuccess?: (event: LocationChangedEvent) => void;
    onError?: (event: LocationErrorEvent) => void;
    onUpdate?: (event: LocationStatusEvent) => void;
};

interface LocationState {
    location: LocationChangedEvent | null;
    isLocating: boolean;
    locationStatus: string;
    error: string | null;
    apiKey: string;
}

type LocationAction =
    | { type: "SET_LOCATION"; payload: LocationChangedEvent | null }
    | { type: "SET_IS_LOCATING"; payload: boolean }
    | { type: "SET_LOCATION_STATUS"; payload: string }
    | { type: "SET_ERROR"; payload: string | null }
    | { type: "SET_API_KEY"; payload: string };

const initialState: LocationState = {
    location: null,
    isLocating: false,
    locationStatus: "未开始定位",
    error: null,
    apiKey: "",
};

const defaultRequestOptions: ExtendedLocationRequest = {
    interval: 10 * 1000,
    requestLevel: RequestLevel.REQUEST_LEVEL_ADMIN_AREA,
    allowGPS: true,
    allowDirection: true,
    indoorLocationMode: true,
    locMode: LocationMode.HIGH_ACCURACY_MODE,
    gpsFirst: false,
    gpsTimeOut: 8000,
    allowCache: true,
};

const DEVICE_ID_STORAGE_KEY = "repo_location_device_id_v1";
const CONTINUOUS_LOCATION_CACHE_MAX_AGE_MS = 30 * 1000;

type NativeSubscription = {
    remove: () => void;
};

interface Subscriber {
    source: string;
    onLocation: (event: LocationChangedEvent) => void;
    onError: (event: LocationErrorEvent) => void;
    onStatus: (event: LocationStatusEvent) => void;
    onStatePatch: (patch: Partial<LocationState>) => void;
}

let nextSubscriberId = 1;
const subscribers = new Map<number, Subscriber>();
const activeSubscribers = new Set<number>();

let sharedLocation: LocationChangedEvent | null = null;
let sharedLocationUpdatedAt = 0;
let sharedApiKey = "";
let sharedError: string | null = null;
let sharedStatus = "未开始定位";
let isServiceRunning = false;
let startInFlight: Promise<void> | null = null;
let latestRequestOptions: ExtendedLocationRequest = {
    ...defaultRequestOptions,
};

let nativeSubscriptions: {
    location?: NativeSubscription;
    error?: NativeSubscription;
    status?: NativeSubscription;
} = {};

let appStateListener: NativeSubscription | null = null;
let currentAppState: AppStateStatus = AppState.currentState;
let pausedByAppState = false;
let delayedRefreshTimer: ReturnType<typeof setTimeout> | null = null;

let initializationDone = false;
let lastConfiguredDeviceId: string | null = null;
let deviceIdCache: string | null = null;
let deviceIdLoadingPromise: Promise<string> | null = null;
let continuousLocationInvocationCount = 0;

function logContinuousLocationInvocation(params: {
    count: number;
    source: string;
    provider: "cache" | "tencent";
}) {
    // console.log(
    //     `[location][continuous] 第${params.count}次调用 | 来源=${params.source} | 数据来源=${params.provider === "cache" ? "缓存" : "腾讯地图"}`,
    // );
}

function clearDelayedRefreshTimer() {
    if (delayedRefreshTimer) {
        clearTimeout(delayedRefreshTimer);
        delayedRefreshTimer = null;
    }
}

function getSharedLocationAgeMs(): number {
    if (!sharedLocation || !sharedLocationUpdatedAt) {
        return Number.POSITIVE_INFINITY;
    }

    return Date.now() - sharedLocationUpdatedAt;
}

function locationReducer(
    state: LocationState,
    action: LocationAction,
): LocationState {
    switch (action.type) {
        case "SET_LOCATION":
            return { ...state, location: action.payload };
        case "SET_IS_LOCATING":
            return { ...state, isLocating: action.payload };
        case "SET_LOCATION_STATUS":
            return { ...state, locationStatus: action.payload };
        case "SET_ERROR":
            return { ...state, error: action.payload };
        case "SET_API_KEY":
            return { ...state, apiKey: action.payload };
        default:
            return state;
    }
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

function mergeRequestOptions(
    options: UseLocationOptions,
): ExtendedLocationRequest {
    return {
        ...defaultRequestOptions,
        ...(options.interval !== undefined
            ? { interval: options.interval }
            : {}),
        ...(options.requestLevel !== undefined
            ? { requestLevel: options.requestLevel }
            : {}),
        ...(options.allowGPS !== undefined
            ? { allowGPS: options.allowGPS }
            : {}),
        ...(options.allowDirection !== undefined
            ? { allowDirection: options.allowDirection }
            : {}),
        ...(options.indoorLocationMode !== undefined
            ? { indoorLocationMode: options.indoorLocationMode }
            : {}),
        ...(options.locMode !== undefined ? { locMode: options.locMode } : {}),
        ...(options.gpsFirst !== undefined
            ? { gpsFirst: options.gpsFirst }
            : {}),
        ...(options.gpsTimeOut !== undefined
            ? { gpsTimeOut: options.gpsTimeOut }
            : {}),
        ...(options.allowCache !== undefined
            ? { allowCache: options.allowCache }
            : {}),
    };
}

function broadcastStatePatch(patch: Partial<LocationState>) {
    for (const subscriber of subscribers.values()) {
        subscriber.onStatePatch(patch);
    }
}

function attachNativeListeners() {
    if (
        nativeSubscriptions.location &&
        nativeSubscriptions.error &&
        nativeSubscriptions.status
    ) {
        return;
    }

    nativeSubscriptions.location = addLocationListener((event) => {
        sharedLocation = event;
        sharedLocationUpdatedAt = Date.now();
        sharedError = null;
        sharedStatus = "定位成功";

        broadcastStatePatch({
            location: event,
            error: null,
            locationStatus: sharedStatus,
            isLocating: isServiceRunning,
        });

        for (const subscriber of subscribers.values()) {
            continuousLocationInvocationCount += 1;
            logContinuousLocationInvocation({
                count: continuousLocationInvocationCount,
                source: subscriber.source,
                provider: "tencent",
            });
            subscriber.onLocation(event);
        }
    });

    nativeSubscriptions.error = addLocationErrorListener((event) => {
        sharedError = `定位错误: ${event.reason || JSON.stringify(event)}`;
        sharedStatus = "定位失败";

        broadcastStatePatch({
            error: sharedError,
            locationStatus: sharedStatus,
            isLocating: false,
        });

        for (const subscriber of subscribers.values()) {
            subscriber.onError(event);
        }
    });

    nativeSubscriptions.status = addStatusUpdateListener((event) => {
        sharedStatus = `状态更新: ${JSON.stringify(event)}`;

        broadcastStatePatch({
            locationStatus: sharedStatus,
        });

        for (const subscriber of subscribers.values()) {
            subscriber.onStatus(event);
        }
    });
}

function detachNativeListeners() {
    nativeSubscriptions.location?.remove();
    nativeSubscriptions.error?.remove();
    nativeSubscriptions.status?.remove();
    nativeSubscriptions = {};
}

function stopSharedLocationService(status = "定位已暂停") {
    if (!isServiceRunning) {
        broadcastStatePatch({
            isLocating: false,
            locationStatus: status,
        });
        return;
    }

    try {
        stopLocationUpdates();
    } catch {}

    isServiceRunning = false;
    sharedStatus = status;

    broadcastStatePatch({
        isLocating: false,
        locationStatus: status,
    });
}

async function requestPermissions(): Promise<boolean> {
    try {
        const { status: foregroundStatus } =
            await Location.requestForegroundPermissionsAsync();

        if (foregroundStatus !== "granted") {
            return false;
        }

        if (Platform.OS === "android") {
            try {
                await Location.requestBackgroundPermissionsAsync();
            } catch {}
        }

        try {
            await Location.enableNetworkProviderAsync();
        } catch {}

        return true;
    } catch {
        return false;
    }
}

async function ensureBaseInitialization(options: UseLocationOptions) {
    if (!initializationDone) {
        setUserAgreePrivacy(true);
        sharedApiKey = getApiKey();
        initializationDone = true;
    }

    const resolvedDeviceId = await resolveDeviceId(options.deviceId);
    if (resolvedDeviceId !== lastConfiguredDeviceId) {
        setDeviceID(resolvedDeviceId);
        lastConfiguredDeviceId = resolvedDeviceId;
    }
}

async function startSharedLocationService(
    requestOptions: ExtendedLocationRequest,
) {
    clearDelayedRefreshTimer();
    latestRequestOptions = requestOptions;

    if (isServiceRunning) {
        broadcastStatePatch({
            isLocating: true,
            locationStatus: sharedStatus,
            error: sharedError,
        });
        return;
    }

    if (startInFlight) {
        await startInFlight;
        return;
    }

    startInFlight = (async () => {
        const permissionGranted = await requestPermissions();
        if (!permissionGranted) {
            sharedError = "请在设置中授予定位权限";
            sharedStatus = "权限被拒绝";
            broadcastStatePatch({
                isLocating: false,
                error: sharedError,
                locationStatus: sharedStatus,
            });
            toast.error(sharedError);
            return;
        }

        sharedError = null;
        sharedStatus = "启动定位中...";
        broadcastStatePatch({
            isLocating: true,
            error: null,
            locationStatus: sharedStatus,
        });

        if (activeSubscribers.size === 0) {
            sharedStatus = "定位已暂停";
            broadcastStatePatch({
                isLocating: false,
                locationStatus: sharedStatus,
            });
            return;
        }

        try {
            const result = await startLocationUpdates(
                requestOptions as LocationRequest,
            );
            if (result === 0) {
                if (activeSubscribers.size === 0) {
                    try {
                        stopLocationUpdates();
                    } catch {}

                    isServiceRunning = false;
                    sharedStatus = "定位已暂停";
                    broadcastStatePatch({
                        isLocating: false,
                        locationStatus: sharedStatus,
                    });
                    return;
                }

                isServiceRunning = true;
                sharedStatus = "定位已启动";
                broadcastStatePatch({
                    isLocating: true,
                    error: null,
                    locationStatus: sharedStatus,
                    apiKey: sharedApiKey,
                });
                return;
            }

            sharedError = `启动定位失败，错误码: ${result}`;
            sharedStatus = "启动失败";
            isServiceRunning = false;
            broadcastStatePatch({
                isLocating: false,
                error: sharedError,
                locationStatus: sharedStatus,
            });
            toast.error("启动定位失败");
        } catch (error) {
            sharedError = `启动定位异常: ${error instanceof Error ? error.message : "未知错误"}`;
            sharedStatus = "启动异常";
            isServiceRunning = false;
            broadcastStatePatch({
                isLocating: false,
                error: sharedError,
                locationStatus: sharedStatus,
            });
            toast.error("启动定位失败");
        }
    })();

    try {
        await startInFlight;
    } finally {
        startInFlight = null;
    }
}

function ensureAppStateListener() {
    if (appStateListener) {
        return;
    }

    appStateListener = AppState.addEventListener("change", (nextState) => {
        const wasActive = currentAppState === "active";
        currentAppState = nextState;

        if (wasActive && nextState !== "active" && isServiceRunning) {
            pausedByAppState = true;
            stopSharedLocationService("应用后台已暂停定位");
            return;
        }

        if (
            nextState === "active" &&
            pausedByAppState &&
            activeSubscribers.size > 0
        ) {
            pausedByAppState = false;
            void startSharedLocationService(latestRequestOptions);
        }
    });
}

function teardownGlobalIfIdle() {
    if (subscribers.size > 0) {
        return;
    }

    activeSubscribers.clear();
    clearDelayedRefreshTimer();
    stopSharedLocationService("定位已停止");
    detachNativeListeners();
    appStateListener?.remove();
    appStateListener = null;
    pausedByAppState = false;
}

function registerSubscriber(subscriber: Subscriber): number {
    const id = nextSubscriberId++;
    subscribers.set(id, subscriber);
    return id;
}

function unregisterSubscriber(id: number) {
    subscribers.delete(id);
    activeSubscribers.delete(id);
    if (activeSubscribers.size === 0) {
        stopSharedLocationService("定位已暂停");
    }
    teardownGlobalIfIdle();
}

async function activateSubscriber(id: number, options: UseLocationOptions) {
    activeSubscribers.add(id);
    attachNativeListeners();
    ensureAppStateListener();
    await ensureBaseInitialization(options);
    broadcastStatePatch({ apiKey: sharedApiKey });

    const sharedLocationAgeMs = getSharedLocationAgeMs();
    const canUseFreshCache =
        sharedLocation &&
        sharedLocationAgeMs <= CONTINUOUS_LOCATION_CACHE_MAX_AGE_MS;

    if (canUseFreshCache && sharedLocation) {
        const subscriber = subscribers.get(id);
        if (subscriber) {
            continuousLocationInvocationCount += 1;
            logContinuousLocationInvocation({
                count: continuousLocationInvocationCount,
                source: subscriber.source,
                provider: "cache",
            });
            subscriber.onLocation(sharedLocation);
        }

        if (!isServiceRunning) {
            clearDelayedRefreshTimer();
            delayedRefreshTimer = setTimeout(
                () => {
                    delayedRefreshTimer = null;
                    if (activeSubscribers.size > 0 && !isServiceRunning) {
                        void startSharedLocationService(latestRequestOptions);
                    }
                },
                Math.max(
                    0,
                    CONTINUOUS_LOCATION_CACHE_MAX_AGE_MS - sharedLocationAgeMs,
                ),
            );
        }

        return;
    }

    await startSharedLocationService(mergeRequestOptions(options));
}

function deactivateSubscriber(id: number, status = "定位已暂停") {
    activeSubscribers.delete(id);
    if (activeSubscribers.size === 0) {
        clearDelayedRefreshTimer();
        stopSharedLocationService(status);
    }
}

function calculateDistanceMeters(
    from: LocationChangedEvent,
    to: LocationChangedEvent,
): number {
    const toRadians = (degree: number) => (degree * Math.PI) / 180;
    const earthRadius = 6371000;

    const lat1 = toRadians(from.latitude);
    const lat2 = toRadians(to.latitude);
    const dLat = lat2 - lat1;
    const dLng = toRadians(to.longitude - from.longitude);

    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(dLng / 2) *
            Math.sin(dLng / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadius * c;
}

export default function useLocation(rawOptions?: UseLocationOptions) {
    const options = rawOptions ?? {};
    const enabled = rawOptions?.enabled ?? true;
    const [state, dispatch] = useReducer(locationReducer, {
        ...initialState,
        apiKey: sharedApiKey,
        location: sharedLocation,
        error: sharedError,
        locationStatus: sharedStatus,
        isLocating: isServiceRunning,
    });

    const isMountedRef = useRef(true);
    const subscriberIdRef = useRef<number | null>(null);
    const lastLocationRef = useRef<LocationChangedEvent | null>(sharedLocation);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const enabledRef = useRef(enabled);
    const manuallyStoppedRef = useRef(false);
    const optionsRef = useRef(options);
    optionsRef.current = options;

    const callbacksRef = useRef({
        onSuccess: options.onSuccess,
        onError: options.onError,
        onUpdate: options.onUpdate,
    });

    callbacksRef.current = {
        onSuccess: options.onSuccess,
        onError: options.onError,
        onUpdate: options.onUpdate,
    };

    const activationKey = useMemo(
        () =>
            JSON.stringify({
                enabled,
                deviceId: options.deviceId,
                source: options.source,
                interval: options.interval,
                requestLevel: options.requestLevel,
                allowGPS: options.allowGPS,
                allowDirection: options.allowDirection,
                indoorLocationMode: options.indoorLocationMode,
                locMode: options.locMode,
                gpsFirst: options.gpsFirst,
                gpsTimeOut: options.gpsTimeOut,
                allowCache: options.allowCache,
            }),
        [
            enabled,
            options.deviceId,
            options.source,
            options.interval,
            options.requestLevel,
            options.allowGPS,
            options.allowDirection,
            options.indoorLocationMode,
            options.locMode,
            options.gpsFirst,
            options.gpsTimeOut,
            options.allowCache,
        ],
    );

    const debouncedUpdateLocation = useCallback(
        (event: LocationChangedEvent) => {
            if (!enabledRef.current || !isMountedRef.current) {
                return;
            }

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
            }

            debounceTimerRef.current = setTimeout(() => {
                const lastLocation = lastLocationRef.current;
                if (lastLocation) {
                    const distance = calculateDistanceMeters(
                        lastLocation,
                        event,
                    );
                    if (distance < 10) {
                        callbacksRef.current.onSuccess?.(event);
                        return;
                    }
                }

                lastLocationRef.current = event;
                dispatch({ type: "SET_LOCATION", payload: event });
                dispatch({ type: "SET_ERROR", payload: null });
                dispatch({ type: "SET_LOCATION_STATUS", payload: "定位成功" });
                callbacksRef.current.onSuccess?.(event);
            }, 500);
        },
        [],
    );

    const handleLocationError = useCallback((event: LocationErrorEvent) => {
        if (!enabledRef.current || !isMountedRef.current) {
            return;
        }

        dispatch({
            type: "SET_ERROR",
            payload: `定位错误: ${event.reason || JSON.stringify(event)}`,
        });
        dispatch({ type: "SET_LOCATION_STATUS", payload: "定位失败" });
        dispatch({ type: "SET_IS_LOCATING", payload: false });
        callbacksRef.current.onError?.(event);
    }, []);

    const handleStatusUpdate = useCallback((event: LocationStatusEvent) => {
        if (!enabledRef.current || !isMountedRef.current) {
            return;
        }

        dispatch({
            type: "SET_LOCATION_STATUS",
            payload: `状态更新: ${JSON.stringify(event)}`,
        });
        callbacksRef.current.onUpdate?.(event);
    }, []);

    useEffect(() => {
        isMountedRef.current = true;

        const subscriberId = registerSubscriber({
            source: options.source ?? "unknown-continuous-source",
            onLocation: debouncedUpdateLocation,
            onError: handleLocationError,
            onStatus: handleStatusUpdate,
            onStatePatch: (patch) => {
                if (!isMountedRef.current) {
                    return;
                }

                if (patch.location !== undefined) {
                    dispatch({ type: "SET_LOCATION", payload: patch.location });
                }
                if (patch.error !== undefined) {
                    dispatch({
                        type: "SET_ERROR",
                        payload: patch.error ?? null,
                    });
                }
                if (patch.locationStatus !== undefined) {
                    dispatch({
                        type: "SET_LOCATION_STATUS",
                        payload: patch.locationStatus,
                    });
                }
                if (patch.isLocating !== undefined) {
                    dispatch({
                        type: "SET_IS_LOCATING",
                        payload: patch.isLocating,
                    });
                }
                if (patch.apiKey !== undefined) {
                    dispatch({ type: "SET_API_KEY", payload: patch.apiKey });
                }
            },
        });

        subscriberIdRef.current = subscriberId;

        if (sharedApiKey) {
            dispatch({ type: "SET_API_KEY", payload: sharedApiKey });
        }

        return () => {
            isMountedRef.current = false;
            const id = subscriberIdRef.current;
            if (id !== null) {
                deactivateSubscriber(id, "定位已暂停");
                unregisterSubscriber(id);
            }

            subscriberIdRef.current = null;

            if (debounceTimerRef.current) {
                clearTimeout(debounceTimerRef.current);
                debounceTimerRef.current = null;
            }
        };
    }, [debouncedUpdateLocation, handleLocationError, handleStatusUpdate]);

    useEffect(() => {
        enabledRef.current = enabled;
        const id = subscriberIdRef.current;
        if (id === null) {
            return;
        }

        if (!enabled) {
            manuallyStoppedRef.current = false;
            deactivateSubscriber(id, "定位已暂停");
            dispatch({ type: "SET_IS_LOCATING", payload: false });
            dispatch({ type: "SET_LOCATION_STATUS", payload: "定位已暂停" });
            return;
        }

        if (manuallyStoppedRef.current) {
            dispatch({ type: "SET_IS_LOCATING", payload: false });
            dispatch({
                type: "SET_LOCATION_STATUS",
                payload: "定位已手动停止",
            });
            return;
        }

        void activateSubscriber(id, optionsRef.current);
    }, [activationKey, enabled]);

    const handleStopLocation = useCallback(() => {
        const id = subscriberIdRef.current;
        if (id === null) {
            return;
        }

        manuallyStoppedRef.current = true;
        deactivateSubscriber(id, "定位已手动停止");
        dispatch({ type: "SET_IS_LOCATING", payload: false });
        dispatch({ type: "SET_LOCATION_STATUS", payload: "定位已手动停止" });
        dispatch({ type: "SET_ERROR", payload: null });
    }, []);

    const handleRestartLocation = useCallback(async () => {
        const id = subscriberIdRef.current;
        if (id === null) {
            return;
        }

        if (!enabledRef.current) {
            const errorMessage = "当前页面未激活定位，无法重新定位";
            dispatch({ type: "SET_ERROR", payload: errorMessage });
            dispatch({ type: "SET_LOCATION_STATUS", payload: "重新定位失败" });
            toast.error(errorMessage);
            return;
        }

        manuallyStoppedRef.current = false;
        dispatch({ type: "SET_ERROR", payload: null });
        dispatch({ type: "SET_LOCATION_STATUS", payload: "重新定位中..." });

        deactivateSubscriber(id, "重新定位中...");
        await activateSubscriber(id, optionsRef.current);
    }, []);

    return {
        location: state.location ?? sharedLocation,
        isLocating: state.isLocating,
        locationStatus: state.locationStatus,
        error: state.error,
        apiKey: state.apiKey,
        handleStopLocation,
        handleRestartLocation,
    };
}
