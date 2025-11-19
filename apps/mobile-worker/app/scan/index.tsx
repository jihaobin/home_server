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

export default function ScanQRScreen() {
    const [facing, setFacing] = useState<"front" | "back">("back");
    const [permission, requestPermission] = useCameraPermissions();
    const router = useRouter();
    const [hasScanned, setHasScanned] = useState(false);

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

    const handleBarCodeScanned = useCallback(
        ({ data }: { data: string }) => {
            if (!data) {
                Alert.alert("无法识别二维码", "请重新尝试扫描");
                return;
            }

            if (hasScanned) {
                return;
            }
            setHasScanned(true);

            let params: Record<string, string>;
            try {
                const parsed = JSON.parse(data);
                if (parsed?.orderId && parsed?.token) {
                    params = {
                        orderId: String(parsed.orderId),
                        token: String(parsed.token),
                    };
                } else {
                    params = { qrData: data };
                }
            } catch {
                params = { qrData: data };
            }

            router.push({ pathname: "/scan/explore", params } as never);
        },
        [hasScanned, router],
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
                    {hasScanned ? (
                        <View style={styles.processing}>
                            <ActivityIndicator color="#fff" size="small" />
                            <Text style={styles.processingText}>解析二维码中...</Text>
                        </View>
                    ) : null}
                </View>

                <View style={styles.controls}>
                    <Text style={styles.instruction}>将二维码置于框内，系统会自动核验</Text>
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
