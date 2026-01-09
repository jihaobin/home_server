import { ActivityIndicator, Modal, Platform, ScrollView, View } from "react-native";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { Text } from "../components/ui/text";
import { cn } from "../lib/utils";
import type { DownloadProgress, ResolvedUpdateInfo, UpdateStatus } from "./types";

type AppUpdateModalProps = {
    visible: boolean;
    info?: ResolvedUpdateInfo;
    status: UpdateStatus;
    forceUpdate?: boolean;
    progress: DownloadProgress;
    errorMessage?: string | null;
    onPrimaryAction: () => void;
    onSecondaryAction?: () => void;
    onInstall?: () => void;
    onRetry?: () => void;
};

const formatSize = (bytes?: number | null) => {
    if (!bytes || bytes <= 0) {
        return null;
    }
    if (bytes < 1024 * 1024) {
        return `${(bytes / 1024).toFixed(1)} KB`;
    }
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

export function AppUpdateModal({
    visible,
    info,
    status,
    forceUpdate,
    progress,
    errorMessage,
    onPrimaryAction,
    onSecondaryAction,
    onInstall,
    onRetry,
}: AppUpdateModalProps) {
    const isDownloading = status === "downloading";
    const isDownloaded = status === "downloaded";
    const isInstalling = status === "installing";
    const isError = status === "error";
    const primaryLabel = isDownloaded
        ? "立即安装"
        : isDownloading
            ? "下载中..."
            : isInstalling
                ? "正在准备安装..."
                : "立即更新";
    const secondaryLabel = isDownloaded ? "稍后安装" : "稍后提醒";
    const percent = Math.max(0, Math.min(100, Math.round(progress.percent ?? 0)));
    const formattedSize = formatSize(info?.size);
    const formattedDownloaded = formatSize(progress.downloadedBytes);
    const changelog = info?.changelog?.trim();
    const cardShadow =
        Platform.select({
            ios: {
                shadowColor: "#000",
                shadowOpacity: 0.2,
                shadowRadius: 5,
                shadowOffset: { width: 0, height: 8 },
            },
            android: {
                elevation: 5,
                shadowColor: "#000",
            },
            default: {},
        }) ?? {};

    return (
        <Modal
            visible={visible}
            transparent
            animationType="fade"
            onRequestClose={forceUpdate ? () => undefined : onSecondaryAction}
        >
            <View className="flex-1 bg-black/60 px-6 py-10">
                <View className="flex-1 justify-center">
                    <View
                        className="rounded-3xl bg-background p-6 shadow-2xl shadow-black/20"
                        style={cardShadow}
                    >
                        <Text className="text-lg font-semibold text-foreground">
                            发现新版本 {info?.latestVersion ? `v${info.latestVersion}` : ""}
                        </Text>
                        <Text className="mt-1 text-sm text-muted-foreground">
                            当前版本 {info?.currentVersion ? `v${info.currentVersion}` : "未知版本"}
                        </Text>
                        {info?.minSupportedVersion ? (
                            <Text className="mt-1 text-xs text-destructive/80">
                                低于 v{info.minSupportedVersion} 将被要求强制更新
                            </Text>
                        ) : null}

                        {formattedSize ? (
                            <Text className="mt-3 text-sm text-muted-foreground">
                                安装包大小 {formattedSize}
                            </Text>
                        ) : null}

                        <View className="mt-4 rounded-2xl bg-muted/50 p-4">
                            <Text className="text-sm font-semibold text-foreground">更新说明</Text>
                            <ScrollView className="mt-2 max-h-44" showsVerticalScrollIndicator={false}>
                                <Text className="text-sm leading-6 text-foreground">
                                    {changelog || "本次更新包含性能优化和问题修复。"}
                                </Text>
                            </ScrollView>
                        </View>

                        {(isDownloading || isDownloaded || isInstalling) && (
                            <View className="mt-4">
                                <View className="flex-row items-center justify-between">
                                    <Text className="text-sm text-foreground">
                                        {isDownloaded
                                            ? "下载完成"
                                            : isInstalling
                                                ? "正在准备安装"
                                                : "下载中"}
                                    </Text>
                                    <Text className="text-xs text-muted-foreground">
                                        {formattedDownloaded && info?.size
                                            ? `${formattedDownloaded} / ${formatSize(info.size)}`
                                            : `${percent}%`}
                                    </Text>
                                </View>
                                <Progress value={percent} className="mt-2" />
                            </View>
                        )}

                        {isError && errorMessage ? (
                            <View className="mt-4 rounded-xl border border-destructive/40 bg-destructive/10 p-3">
                                <Text className="text-sm font-medium text-destructive">更新失败</Text>
                                <Text className="mt-1 text-xs text-destructive/90">{errorMessage}</Text>
                            </View>
                        ) : null}

                        <View className="mt-6 flex-row gap-3">
                            {!forceUpdate && (
                                <Button
                                    className="flex-1"
                                    variant="outline"
                                    disabled={isDownloading || isInstalling}
                                    onPress={onSecondaryAction}
                                >
                                    <Text>{secondaryLabel}</Text>
                                </Button>
                            )}
                            <Button
                                className={cn("flex-1", isDownloading || isInstalling ? "opacity-80" : "")}
                                disabled={isInstalling}
                                onPress={isDownloaded && onInstall ? onInstall : onPrimaryAction}
                            >
                                <View className="flex-row items-center justify-center gap-2">
                                    {(isDownloading || isInstalling) && (
                                        <ActivityIndicator size="small" color="#fff" />
                                    )}
                                    <Text className="text-primary-foreground">{primaryLabel}</Text>
                                </View>
                            </Button>
                        </View>

                        {isError && onRetry ? (
                            <View className="mt-3">
                                <Button variant="ghost" className="w-full" onPress={onRetry}>
                                    <Text className="text-primary">重试下载</Text>
                                </Button>
                            </View>
                        ) : null}
                    </View>
                </View>
            </View>
        </Modal>
    );
}
