import * as React from "react";
import {
    CameraMode,
    CameraType,
    CameraView,
    useCameraPermissions,
    useMicrophonePermissions,
} from "expo-camera";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { toast } from "sonner-native";
import {
    Camera,
    type LucideIcon,
    Mic,
    MicOff,
    RefreshCw,
    Video,
    X,
    Zap,
    ZapOff,
} from "lucide-react-native";

import { Icon } from "../ui/icon";
import { Text } from "../ui/text";

export function ChatCameraCaptureModal(props: {
    visible: boolean;
    disabled?: boolean;
    onClose: () => void;
    onCapturePhoto: (asset: {
        uri: string;
        width: number;
        height: number;
    }) => Promise<void> | void;
    onCaptureVideo: (asset: { uri: string }) => Promise<void> | void;
}) {
    const cameraRef = React.useRef<CameraView | null>(null);
    const recordingStartLockRef = React.useRef(false);
    const [cameraPermission, requestCameraPermission] = useCameraPermissions();
    const [microphonePermission, requestMicrophonePermission] =
        useMicrophonePermissions();

    const [captureMode, setCaptureMode] = React.useState<CameraMode>("picture");
    const [facing, setFacing] = React.useState<CameraType>("back");
    const [isTorchEnabled, setIsTorchEnabled] = React.useState(false);
    const [isMicrophoneEnabled, setIsMicrophoneEnabled] = React.useState(true);
    const [isRecording, setIsRecording] = React.useState(false);
    const [isSubmitting, setIsSubmitting] = React.useState(false);
    const [isCameraReady, setIsCameraReady] = React.useState(false);

    const handleClose = React.useCallback(() => {
        if (isRecording) {
            cameraRef.current?.stopRecording();
        }
        props.onClose();
    }, [isRecording, props.onClose]);

    const requestReadyPermissions = React.useCallback(async () => {
        if (!cameraPermission?.granted) {
            const next = await requestCameraPermission();
            if (!next.granted) {
                toast.error("需要相机权限才能拍摄");
                return false;
            }
        }

        if (captureMode === "video" && isMicrophoneEnabled) {
            if (!microphonePermission?.granted) {
                const micNext = await requestMicrophonePermission();
                if (!micNext.granted) {
                    toast.error("麦克风权限未开启，视频将静音");
                    setIsMicrophoneEnabled(false);
                }
            }
        }

        return true;
    }, [
        cameraPermission?.granted,
        captureMode,
        isMicrophoneEnabled,
        microphonePermission?.granted,
        requestCameraPermission,
        requestMicrophonePermission,
    ]);

    const handleCapture = React.useCallback(async () => {
        if (props.disabled || isSubmitting) {
            return;
        }

        if (!isCameraReady) {
            toast.error("相机初始化中，请稍后重试");
            return;
        }

        const ready = await requestReadyPermissions();
        if (!ready) {
            return;
        }

        const camera = cameraRef.current;
        if (!camera) {
            toast.error("相机初始化中，请稍后重试");
            return;
        }

        if (captureMode === "picture") {
            try {
                setIsSubmitting(true);
                const photo = await camera.takePictureAsync({ quality: 1 });
                if (!photo?.uri) {
                    return;
                }
                await props.onCapturePhoto({
                    uri: photo.uri,
                    width: photo.width,
                    height: photo.height,
                });
                props.onClose();
            } catch {
                toast.error("拍照失败，请重试");
            } finally {
                setIsSubmitting(false);
            }
            return;
        }

        if (isRecording) {
            camera.stopRecording();
            return;
        }

        if (recordingStartLockRef.current) {
            return;
        }

        try {
            recordingStartLockRef.current = true;
            setIsRecording(true);
            const video = await camera.recordAsync({ maxDuration: 120 });
            if (!video?.uri) {
                return;
            }

            setIsSubmitting(true);
            await props.onCaptureVideo({ uri: video.uri });
            props.onClose();
        } catch {
            toast.error("录像失败，请重试");
        } finally {
            recordingStartLockRef.current = false;
            setIsRecording(false);
            setIsSubmitting(false);
        }
    }, [
        captureMode,
        isCameraReady,
        isRecording,
        isSubmitting,
        props,
        requestReadyPermissions,
    ]);

    if (!props.visible) {
        return null;
    }

    return (
        <View style={styles.fullscreenOverlay} pointerEvents="box-none">
            <View className="flex-1 bg-black" pointerEvents="auto">
                {cameraPermission?.granted ? (
                    <CameraView
                        ref={cameraRef}
                        style={{ flex: 1 }}
                        onCameraReady={() => {
                            setIsCameraReady(true);
                        }}
                        onMountError={() => {
                            setIsCameraReady(false);
                            toast.error("相机启动失败，请重试");
                        }}
                        facing={facing}
                        mode={captureMode}
                        zoom={0}
                        videoQuality="720p"
                        responsiveOrientationWhenOrientationLocked
                        enableTorch={isTorchEnabled}
                        flash={
                            captureMode === "picture" && isTorchEnabled
                                ? "on"
                                : "off"
                        }
                        mute={!isMicrophoneEnabled}
                    />
                ) : (
                    <View className="flex-1 items-center justify-center px-6">
                        <Text className="text-center text-sm text-white">
                            需要先开启相机权限才能拍摄
                        </Text>
                        <Pressable
                            onPress={() => {
                                void requestCameraPermission();
                            }}
                            className="mt-4 rounded-full bg-white px-5 py-2"
                        >
                            <Text className="text-sm text-black">去授权</Text>
                        </Pressable>
                    </View>
                )}

                <View className="absolute left-0 right-0 top-0 flex-row items-center justify-between px-4 pt-14">
                    <Pressable
                        disabled={isSubmitting}
                        onPress={handleClose}
                        className="h-10 w-10 items-center justify-center rounded-full"
                        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
                    >
                        <Icon as={X} size={18} className="text-white" />
                    </Pressable>
                    {isSubmitting ? (
                        <View
                            className="rounded-full px-3 py-1"
                            style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
                        >
                            <Text className="text-xs text-white">
                                上传中...
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View className="absolute right-4 top-24 items-center gap-3">
                    <CaptureActionButton
                        label="闪光"
                        icon={isTorchEnabled ? Zap : ZapOff}
                        onPress={() => setIsTorchEnabled((prev) => !prev)}
                        active={isTorchEnabled}
                        disabled={isSubmitting}
                    />
                    <CaptureActionButton
                        label="翻转"
                        icon={RefreshCw}
                        onPress={() => {
                            setIsCameraReady(false);
                            setFacing((prev) =>
                                prev === "back" ? "front" : "back",
                            );
                        }}
                        disabled={isSubmitting || isRecording}
                    />
                    {captureMode === "video" ? (
                        <CaptureActionButton
                            label="麦克风"
                            icon={isMicrophoneEnabled ? Mic : MicOff}
                            onPress={() =>
                                setIsMicrophoneEnabled((prev) => !prev)
                            }
                            active={isMicrophoneEnabled}
                            disabled={isSubmitting || isRecording}
                        />
                    ) : null}
                </View>

                <View className="absolute bottom-10 left-0 right-0 items-center">
                    <View
                        className="mb-6 flex-row rounded-full px-2 py-1"
                        style={{ backgroundColor: "rgba(0, 0, 0, 0.45)" }}
                    >
                        <ModeButton
                            label="拍照"
                            icon={Camera}
                            selected={captureMode === "picture"}
                            onPress={() => {
                                if (isRecording) {
                                    return;
                                }
                                setIsCameraReady(false);
                                setCaptureMode("picture");
                            }}
                            disabled={isSubmitting}
                        />
                        <ModeButton
                            label="拍视频"
                            icon={Video}
                            selected={captureMode === "video"}
                            onPress={() => {
                                if (isRecording) {
                                    return;
                                }
                                setIsCameraReady(false);
                                setCaptureMode("video");
                            }}
                            disabled={isSubmitting}
                        />
                    </View>

                    <Pressable
                        disabled={
                            isSubmitting ||
                            !cameraPermission?.granted ||
                            !isCameraReady
                        }
                        onPress={() => {
                            void handleCapture();
                        }}
                        className="h-20 w-20 items-center justify-center rounded-full border-4 border-white"
                    >
                        <View
                            className={
                                isRecording
                                    ? "h-8 w-8 rounded-md"
                                    : "h-14 w-14 rounded-full"
                            }
                            style={{
                                backgroundColor: isRecording
                                    ? "#ef4444"
                                    : "#ffffff",
                            }}
                        />
                    </Pressable>
                    <Text className="mt-3 text-xs text-white">
                        {captureMode === "picture"
                            ? "点击拍照"
                            : isRecording
                              ? "点击结束录像"
                              : "点击开始录像"}
                    </Text>
                </View>

                {isSubmitting ? (
                    <View className="absolute inset-0 items-center justify-center">
                        <ActivityIndicator size="small" color="#ffffff" />
                    </View>
                ) : null}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    fullscreenOverlay: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 1000,
        elevation: 1000,
    },
});

function CaptureActionButton(props: {
    label: string;
    icon: LucideIcon;
    onPress: () => void;
    active?: boolean;
    disabled?: boolean;
}) {
    return (
        <Pressable
            disabled={props.disabled}
            onPress={props.onPress}
            className="items-center"
        >
            <View
                className="h-10 w-10 items-center justify-center rounded-full"
                style={{
                    backgroundColor: props.active
                        ? "rgba(248, 113, 113, 0.95)"
                        : "rgba(0, 0, 0, 0.45)",
                }}
            >
                <Icon as={props.icon} size={16} className="text-white" />
            </View>
            <Text className="mt-1 text-xs text-white">{props.label}</Text>
        </Pressable>
    );
}

function ModeButton(props: {
    label: string;
    icon: LucideIcon;
    selected: boolean;
    onPress: () => void;
    disabled?: boolean;
}) {
    return (
        <Pressable
            disabled={props.disabled}
            onPress={props.onPress}
            className="mx-1 flex-row items-center rounded-full px-4 py-2"
            style={{
                backgroundColor: props.selected
                    ? "rgba(255, 255, 255, 0.95)"
                    : "transparent",
            }}
        >
            <Icon
                as={props.icon}
                size={14}
                className={props.selected ? "text-black" : "text-white"}
            />
            <Text
                className={
                    props.selected
                        ? "ml-1 text-xs text-black"
                        : "ml-1 text-xs text-white"
                }
            >
                {props.label}
            </Text>
        </Pressable>
    );
}
