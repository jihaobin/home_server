import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Button,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";
import { useVerifyCheckIn } from "@repo/hooks/api/order";
import useLocation from "@repo/hooks/useLocation";

export default function ScanQRScreen() {
    const [facing, setFacing] = useState<"front" | "back">("back");
    const [permission, requestPermission] = useCameraPermissions();
    const router = useRouter();
    const [hasScanned, setHasScanned] = useState(false);
    const { location, isLocating, locationStatus, error: locationError } = useLocation();
    const [statusMessage, setStatusMessage] = useState<string | null>(null);
    const [statusType, setStatusType] = useState<"info" | "success" | "error">("info");
    const verifyMutation = useVerifyCheckIn();
    const isVerifying = verifyMutation.isPending;

    useEffect(() => {
        if (!permission) {
            requestPermission();
        }
    }, [permission, requestPermission]);

    useFocusEffect(
        useCallback(() => {
            setHasScanned(false);
            return () => setHasScanned(false);
        }, []),
    );

    const parsePayload = useCallback((data: string) => {
        try {
            const parsed = JSON.parse(data);
            if (parsed?.orderId && parsed?.token) {
                return {
                    orderId: String(parsed.orderId),
                    token: String(parsed.token),
                };
            }
        } catch {
            // 忽略解析错误，继续尝试其他分支
        }
        return null;
    }, []);

    const handleResetScan = useCallback(() => {
        setHasScanned(false);
        setStatusType("info");
        setStatusMessage(null);
    }, []);

    const showBlockingAlert = useCallback(
        (title: string, message: string) => {
            Alert.alert(
                title,
                message,
                [
                    {
                        text: "知道了",
                        onPress: handleResetScan,
                    },
                ],
                { cancelable: false, onDismiss: handleResetScan },
            );
        },
        [handleResetScan],
    );

    const handleBarCodeScanned = useCallback(
        async ({ data }: { data: string }) => {
            if (!data) {
                Alert.alert("无法识别二维码", "请重新尝试扫描");
                return;
            }

            if (hasScanned || isVerifying) {
                return;
            }
            setHasScanned(true);

            const payload = parsePayload(data);
            if (!payload) {
                const message = "二维码格式无效，请重新扫描";
                setStatusType("error");
                setStatusMessage(message);
                showBlockingAlert("无法识别二维码", message);
                return;
            }

            if (!location) {
                const message = locationError || (isLocating ? "定位中，请稍后再试" : "未能获取定位信息");
                setStatusType("error");
                setStatusMessage(message);
                showBlockingAlert("定位未就绪", message);
                return;
            }

            try {
                setStatusType("info");
                setStatusMessage("正在核验到场信息...");
                const response = await verifyMutation.mutateAsync({
                    orderId: payload.orderId,
                    token: payload.token,
                    latitude: location.latitude,
                    longitude: location.longitude,
                });
                const successMessage = (response as { message?: string } | undefined)?.message || "核验成功";
                setStatusType("success");
                setStatusMessage(successMessage);
                showBlockingAlert("核验成功", successMessage);
            } catch (error) {
                const message = error instanceof Error ? error.message : "核验失败，请重试";
                setStatusType("error");
                setStatusMessage(message);
                showBlockingAlert("核验失败", message);
            } finally {
                // 保持扫码锁定，直至用户关闭弹窗
            }
        },
        [hasScanned, isVerifying, parsePayload, location, locationError, isLocating, verifyMutation, showBlockingAlert],
    );

    const toggleCameraFacing = () => {
        setFacing((current) => (current === "back" ? "front" : "back"));
    };

    if (!permission) {
        return <View style={styles.container} />;
    }

    if (!permission.granted) {
        return (
            <View style={styles.container}>
                <Text style={styles.title}>需要摄像头权限</Text>
                <Text style={styles.message}>应用需要摄像头权限用于扫码核验</Text>
                <Button title="授予权限" onPress={requestPermission} />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <CameraView
                style={styles.camera}
                facing={facing}
                onBarcodeScanned={handleBarCodeScanned}
                barcodeScannerSettings={{
                    barcodeTypes: ["qr"],
                }}
            />

            <View style={styles.overlay}>
                <TouchableOpacity
                    style={styles.closeButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="close" size={30} color="white" />
                </TouchableOpacity>

                <View style={styles.scanArea}>
                    <View style={styles.scanFrame}>
                        <View style={[styles.corner, styles.cornerTopLeft]} />
                        <View style={[styles.corner, styles.cornerTopRight]} />
                        <View style={[styles.corner, styles.cornerBottomLeft]} />
                        <View style={[styles.corner, styles.cornerBottomRight]} />
                    </View>
                    {isVerifying ? (
                        <View style={styles.processing}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.processingText}>
                                核验到场中...
                            </Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.controls}>
                    <Text style={styles.instruction}>将二维码置于框内，系统会自动核验</Text>
                    {hasScanned && !isVerifying ? (
                        <TouchableOpacity
                            style={styles.rescanButton}
                            onPress={handleResetScan}
                        >
                            <Text style={styles.rescanButtonText}>继续扫码</Text>
                        </TouchableOpacity>
                    ) : null}
                    <TouchableOpacity
                        style={styles.flipButton}
                        onPress={toggleCameraFacing}
                    >
                        <Ionicons name="camera-reverse" size={30} color="white" />
                    </TouchableOpacity>
                </View>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "black",
    },
    camera: {
        flex: 1,
    },
    overlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: "space-between",
        padding: 20,
    },
    closeButton: {
        alignSelf: "flex-end",
        padding: 10,
        backgroundColor: "rgba(0,0,0,0.5)",
        borderRadius: 20,
        marginTop: 40,
    },
    scanArea: {
        flex: 1,
        justifyContent: "center",
        alignItems: "center",
    },
    scanFrame: {
        width: 250,
        height: 250,
        position: "relative",
    },
    corner: {
        position: "absolute",
        width: 30,
        height: 30,
        borderColor: "#00ff00",
    },
    cornerTopLeft: {
        top: 0,
        left: 0,
        borderTopWidth: 4,
        borderLeftWidth: 4,
    },
    cornerTopRight: {
        top: 0,
        right: 0,
        borderTopWidth: 4,
        borderRightWidth: 4,
    },
    cornerBottomLeft: {
        bottom: 0,
        left: 0,
        borderBottomWidth: 4,
        borderLeftWidth: 4,
    },
    cornerBottomRight: {
        bottom: 0,
        right: 0,
        borderBottomWidth: 4,
        borderRightWidth: 4,
    },
    processing: {
        position: "absolute",
        bottom: -50,
        backgroundColor: "rgba(0,0,0,0.7)",
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderRadius: 999,
        flexDirection: "row",
        alignItems: "center",
        gap: 8,
    },
    processingText: {
        color: "white",
        fontSize: 14,
    },
    controls: {
        alignItems: "center",
        paddingBottom: 30,
    },
    instruction: {
        color: "white",
        fontSize: 16,
        marginBottom: 20,
        textAlign: "center",
    },
    statusMessage: {
        color: "white",
        fontSize: 15,
        textAlign: "center",
    },
    statusMessageSuccess: {
        color: "#8df0a9",
    },
    statusMessageError: {
        color: "#f5a3a3",
    },
    locationText: {
        color: "#dfe6e9",
        fontSize: 12,
        textAlign: "center",
    },
    rescanButton: {
        backgroundColor: "#2d3436",
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 14,
        marginBottom: 12,
    },
    rescanButtonText: {
        color: "white",
        fontSize: 15,
        fontWeight: "600",
        textAlign: "center",
    },
    flipButton: {
        backgroundColor: "rgba(0,0,0,0.5)",
        padding: 15,
        borderRadius: 30,
    },
    title: {
        fontSize: 20,
        fontWeight: "bold",
        textAlign: "center",
        marginBottom: 10,
        color: "white",
    },
    message: {
        fontSize: 16,
        textAlign: "center",
        marginBottom: 20,
        color: "white",
    },
});
