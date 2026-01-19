import React, {
    createContext,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from "react";
import {
    AppState,
    type AppStateStatus,
    Platform,
} from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import Constants from "expo-constants";
import {
    Directory,
    File,
    Paths,
} from "expo-file-system";
import {
    createDownloadResumable,
    type DownloadProgressData,
} from "expo-file-system/legacy";
import * as IntentLauncher from "expo-intent-launcher";
import * as Linking from "expo-linking";
import { MMKV } from "react-native-mmkv";
import { toast } from "sonner-native";
import type { AppReleaseApp, AppReleasePlatform } from "@repo/types";
import {
    appUpdateCheckQueryFn,
    appUpdateCheckQueryKey,
} from "@repo/hooks/api/app-release";
import { AppUpdateModal } from "./AppUpdateModal";
import type {
    DownloadProgress,
    ResolvedUpdateInfo,
    UpdateStatus,
} from "./types";

type CheckOptions = {
    manual?: boolean;
    force?: boolean;
};

type CheckResult =
    | { status: "available"; info: ResolvedUpdateInfo }
    | { status: "up-to-date" }
    | { status: "skipped"; reason: "ignored" | "unsupported" | "missing-version" }
    | { status: "error"; message: string };

type AppUpdateContextValue = {
    status: UpdateStatus;
    info?: ResolvedUpdateInfo;
    progress: DownloadProgress;
    checkForUpdate: (options?: CheckOptions) => Promise<CheckResult>;
};

type AppUpdateProviderProps = {
    app: AppReleaseApp;
    children: React.ReactNode;
    autoCheckOnStart?: boolean;
    autoCheckOnResume?: boolean;
    optionalIgnoreDurationMs?: number;
    checkIntervalMs?: number;
    currentVersion?: string;
};

type AppUpdateState = {
    status: UpdateStatus;
    info?: ResolvedUpdateInfo;
    progress: DownloadProgress;
    modalVisible: boolean;
    errorMessage: string | null;
};

const IGNORE_DURATION_DEFAULT = 6 * 60 * 60 * 1000; // 6 hours
const AUTO_CHECK_INTERVAL_DEFAULT = 15 * 60 * 1000; // 15 minutes
const APP_UPDATE_STORAGE = new MMKV({ id: "app-update" });
const INITIAL_PROGRESS: DownloadProgress = {
    percent: 0,
    downloadedBytes: 0,
    totalBytes: 0,
    localUri: null,
};

const AppUpdateContext = createContext<AppUpdateContextValue | undefined>(
    undefined,
);

const resolvePlatform = (): AppReleasePlatform | null => {
    if (Platform.OS === "android") {
        return "android";
    }
    if (Platform.OS === "ios") {
        return "ios";
    }
    return null;
};

const resolveCurrentVersion = (override?: string): string =>
    override ||
    Constants?.expoConfig?.version ||
    Constants?.manifest2?.extra?.expoClient?.version ||
    "0.0.0";

const resolveAndroidPackage = (): string | undefined =>
    Constants?.expoConfig?.android?.package ||
    Constants?.manifest2?.extra?.expoClient?.android?.package ||
    Constants?.android?.packageName;

const buildStorageKey = (
    app: AppReleaseApp,
    platform: AppReleasePlatform | null,
    suffix: string,
) => `app-update:${app}:${platform ?? "unknown"}:${suffix}`;

const normalizeError = (error: unknown) => {
    if (!error) {
        return "发生未知错误";
    }
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === "string") {
        return error;
    }
    if (typeof error === "object" && "message" in (error as any)) {
        return String((error as any).message);
    }
    return "发生未知错误";
};

const useAppState = (onActive: () => void) => {
    useEffect(() => {
        const handler = (nextState: AppStateStatus) => {
            if (nextState === "active") {
                onActive();
            }
        };
        const subscription = AppState.addEventListener("change", handler);
        return () => subscription.remove();
    }, [onActive]);
};

export function AppUpdateProvider({
    app,
    children,
    autoCheckOnStart = true,
    autoCheckOnResume = true,
    optionalIgnoreDurationMs = IGNORE_DURATION_DEFAULT,
    checkIntervalMs = AUTO_CHECK_INTERVAL_DEFAULT,
    currentVersion: overrideVersion,
}: AppUpdateProviderProps) {
    const platform = useMemo(resolvePlatform, []);
    const currentVersion = useMemo(
        () => resolveCurrentVersion(overrideVersion),
        [overrideVersion],
    );
    const androidPackage = useMemo(resolveAndroidPackage, []);
    const queryClient = useQueryClient();
    const lastAutoCheckRef = useRef<number>(0);
    const lastProgressUpdateRef = useRef<number>(0);

    const [state, setState] = useState<AppUpdateState>({
        status: "idle",
        info: undefined,
        progress: INITIAL_PROGRESS,
        modalVisible: false,
        errorMessage: null,
    });

    const shouldSkipOptional = useCallback(
        (version: string | null | undefined) => {
            if (!version) {
                return false;
            }
            const ignoredVersion = APP_UPDATE_STORAGE.getString(
                buildStorageKey(app, platform, "ignoredVersion"),
            );
            const ignoredAt = APP_UPDATE_STORAGE.getNumber(
                buildStorageKey(app, platform, "ignoredAt"),
            );
            if (!ignoredVersion || ignoredVersion !== version) {
                return false;
            }
            if (!ignoredAt) {
                return false;
            }
            return Date.now() - ignoredAt < optionalIgnoreDurationMs;
        },
        [app, platform, optionalIgnoreDurationMs],
    );

    const markIgnoredVersion = useCallback(
        (version?: string | null) => {
            if (!version) {
                return;
            }
            APP_UPDATE_STORAGE.set(
                buildStorageKey(app, platform, "ignoredVersion"),
                version,
            );
            APP_UPDATE_STORAGE.set(
                buildStorageKey(app, platform, "ignoredAt"),
                Date.now(),
            );
        },
        [app, platform],
    );

    const checkForUpdate = useCallback(
        async (options: CheckOptions = {}): Promise<CheckResult> => {
            const { manual = false, force = false } = options;
            if (!platform) {
                if (manual) {
                    toast.info("当前平台不支持更新检查");
                }
                return { status: "skipped", reason: "unsupported" };
            }
            if (!currentVersion) {
                if (manual) {
                    toast.error("无法识别当前版本号");
                }
                return { status: "skipped", reason: "missing-version" };
            }

            const params = {
                app,
                platform,
                currentVersion,
            };

            setState((prev) => ({
                ...prev,
                status: manual ? "checking" : prev.status,
                errorMessage: null,
            }));

            try {
                const data = await queryClient.fetchQuery({
                    queryKey: appUpdateCheckQueryKey(params),
                    queryFn: () => appUpdateCheckQueryFn(params),
                    staleTime: 0,
                });
                lastAutoCheckRef.current = Date.now();

                const isSameVersion = data.latestVersion === currentVersion;
                const hasUpdate =
                    (data.requireUpdate || data.optionalUpdate) &&
                    !isSameVersion;

                if (!hasUpdate || !data.latestVersion) {
                    if (manual) {
                        toast.success("当前已是最新版本");
                    }
                    setState((prev) => ({
                        ...prev,
                        status: "idle",
                        info: undefined,
                        progress: INITIAL_PROGRESS,
                        modalVisible: false,
                        errorMessage: null,
                    }));
                    return { status: "up-to-date" };
                }

                if (
                    !data.requireUpdate &&
                    !force &&
                    shouldSkipOptional(data.latestVersion)
                ) {
                    setState((prev) => ({
                        ...prev,
                        status: "idle",
                        modalVisible: false,
                        info: undefined,
                        progress: INITIAL_PROGRESS,
                    }));
                    return { status: "skipped", reason: "ignored" };
                }

                const updateInfo: ResolvedUpdateInfo = {
                    ...data,
                    currentVersion,
                    checkedAt: Date.now(),
                };

                if (manual && !data.requireUpdate) {
                    toast.info(`发现新版本 v${data.latestVersion}`);
                }

                setState({
                    status: "available",
                    info: updateInfo,
                    progress: INITIAL_PROGRESS,
                    modalVisible: true,
                    errorMessage: null,
                });

                return { status: "available", info: updateInfo };
            } catch (error) {
                const message = normalizeError(error);
                if (manual) {
                    toast.error(`检查更新失败：${message}`);
                }
                setState((prev) => ({
                    ...prev,
                    status: "error",
                    errorMessage: message,
                }));
                return { status: "error", message };
            }
        },
        [app, platform, currentVersion, queryClient, shouldSkipOptional],
    );

    const startDownload = useCallback(async (): Promise<string | null> => {
        if (!state.info?.downloadUrl) {
            throw new Error("缺少下载链接");
        }
        if (platform === "ios") {
            await Linking.openURL(state.info.downloadUrl);
            return null;
        }
        if (platform !== "android") {
            throw new Error("当前平台暂不支持自动安装");
        }

        const fallbackTotalBytes = state.info.size ?? 0;

        lastProgressUpdateRef.current = 0;

        setState((prev) => ({
            ...prev,
            status: "downloading",
            errorMessage: null,
            progress: {
                ...prev.progress,
                percent: 0,
                downloadedBytes: 0,
                totalBytes: fallbackTotalBytes,
                localUri: null,
            },
        }));

        try {
            const targetDir = new Directory(Paths.cache, "app-updates");
            await targetDir.create({ intermediates: true, idempotent: true });
            const fileName = `${app}-${state.info.latestVersion ?? "latest"}.apk`;
            const targetFile = new File(targetDir, fileName);

            const downloadProgress = (data: DownloadProgressData) => {
                const expected =
                    data.totalBytesExpectedToWrite > 0
                        ? data.totalBytesExpectedToWrite
                        : fallbackTotalBytes;
                const totalBytes = expected > 0 ? expected : 0;
                const downloadedBytes = data.totalBytesWritten;
                const percent = totalBytes
                    ? Math.min(100, (downloadedBytes / totalBytes) * 100)
                    : 0;

                const now = Date.now();
                if (
                    now - lastProgressUpdateRef.current < 80 &&
                    percent < 100
                ) {
                    return;
                }
                lastProgressUpdateRef.current = now;

                setState((prev) => ({
                    ...prev,
                    progress: {
                        ...prev.progress,
                        percent,
                        downloadedBytes,
                        totalBytes,
                    },
                }));
            };

            const downloadTask = createDownloadResumable(
                state.info.downloadUrl,
                targetFile.uri,
                undefined,
                downloadProgress,
            );

            const downloaded = await downloadTask.downloadAsync();
            const fileInfo = targetFile.info();
            const size = fileInfo?.size ?? fallbackTotalBytes;
            setState((prev) => ({
                ...prev,
                status: "downloaded",
                progress: {
                    ...prev.progress,
                    percent: 100,
                    downloadedBytes: size,
                    totalBytes: size,
                    localUri: downloaded?.uri ?? targetFile.uri,
                },
            }));

            return downloaded?.uri ?? targetFile.uri;
        } catch (error) {
            const message = normalizeError(error);
            setState((prev) => ({
                ...prev,
                status: "error",
                errorMessage: message,
            }));
            toast.error(`下载失败：${message}`);
            return null;
        }
    }, [
        app,
        platform,
        state.info?.downloadUrl,
        state.info?.latestVersion,
        state.info?.size,
    ]);

    const openUnknownSourcesSettings = useCallback(async () => {
        if (platform !== "android") {
            return;
        }
        try {
            await IntentLauncher.startActivityAsync(
                IntentLauncher.ActivityAction.MANAGE_UNKNOWN_APP_SOURCES,
                androidPackage
                    ? { data: `package:${androidPackage}` }
                    : undefined,
            );
        } catch (error) {
            const message = normalizeError(error);
            toast.error(`无法打开权限设置：${message}`);
        }
    }, [androidPackage, platform]);

    const installUpdate = useCallback(async () => {
        if (!state.info) {
            return;
        }
        if (platform === "ios") {
            if (state.info.downloadUrl) {
                await Linking.openURL(state.info.downloadUrl);
            } else {
                toast.error("暂无可用的下载链接");
            }
            return;
        }

        if (platform !== "android") {
            toast.error("当前平台暂不支持自动安装");
            return;
        }

        const localUri = state.progress.localUri ?? (await startDownload());
        if (!localUri) {
            return;
        }

        setState((prev) => ({
            ...prev,
            status: "installing",
            errorMessage: null,
        }));

        try {
            if (!(IntentLauncher as { startActivityAsync?: unknown })
                ?.startActivityAsync) {
                throw new Error("缺少 expo-intent-launcher 依赖，请先安装");
            }

            const contentUri = new File(localUri).contentUri;
            await IntentLauncher.startActivityAsync("android.intent.action.VIEW", {
                data: contentUri,
                flags: 1,
                type: "application/vnd.android.package-archive",
            });
            toast.success("已触发安装，请在系统弹窗中完成更新");
            setState((prev) => ({
                ...prev,
                status: "downloaded",
            }));
        } catch (error) {
            const message = normalizeError(error);
            setState((prev) => ({
                ...prev,
                status: "error",
                errorMessage: message,
            }));
            toast.error(`安装失败：${message}`);
            void openUnknownSourcesSettings();
        }
    }, [openUnknownSourcesSettings, platform, startDownload, state.info, state.progress.localUri]);

    const handlePrimaryAction = useCallback(() => {
        if (!state.info) {
            return;
        }
        if (state.status === "downloaded") {
            void installUpdate();
            return;
        }
        void startDownload();
    }, [installUpdate, startDownload, state.info, state.status]);

    const handleSecondaryAction = useCallback(() => {
        if (state.info?.latestVersion) {
            markIgnoredVersion(state.info.latestVersion);
        }
        setState((prev) => ({
            ...prev,
            modalVisible: false,
            status: "idle",
            progress: INITIAL_PROGRESS,
            info: prev.info,
        }));
    }, [markIgnoredVersion, state.info?.latestVersion]);

    const handleRetry = useCallback(() => {
        if (state.info?.downloadUrl) {
            void startDownload();
        } else {
            setState((prev) => ({
                ...prev,
                modalVisible: false,
                status: "idle",
            }));
        }
    }, [startDownload, state.info?.downloadUrl]);

    useEffect(() => {
        if (!autoCheckOnStart) {
            return;
        }
        lastAutoCheckRef.current = Date.now();
        void checkForUpdate({ manual: false });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    useAppState(
        useCallback(() => {
            if (!autoCheckOnResume) {
                return;
            }
            const now = Date.now();
            if (now - lastAutoCheckRef.current < checkIntervalMs) {
                return;
            }
            lastAutoCheckRef.current = now;
            void checkForUpdate({ manual: false });
        }, [autoCheckOnResume, checkIntervalMs, checkForUpdate]),
    );

    const contextValue = useMemo<AppUpdateContextValue>(
        () => ({
            status: state.status,
            info: state.info,
            progress: state.progress,
            checkForUpdate,
        }),
        [checkForUpdate, state.info, state.progress, state.status],
    );

    return (
        <AppUpdateContext.Provider value={contextValue}>
            {children}
            <AppUpdateModal
                visible={state.modalVisible}
                info={state.info}
                status={state.status}
                forceUpdate={Boolean(state.info?.requireUpdate)}
                progress={state.progress}
                errorMessage={state.errorMessage}
                onPrimaryAction={handlePrimaryAction}
                onSecondaryAction={state.info?.requireUpdate ? undefined : handleSecondaryAction}
                onInstall={installUpdate}
                onRetry={handleRetry}
            />
        </AppUpdateContext.Provider>
    );
}

export const useAppUpdate = () => {
    const context = useContext(AppUpdateContext);
    if (!context) {
        throw new Error("useAppUpdate 需要在 AppUpdateProvider 内使用");
    }
    return context;
};
