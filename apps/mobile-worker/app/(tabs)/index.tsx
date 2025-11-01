import { Ionicons } from "@expo/vector-icons";
import { CameraView, useCameraPermissions } from "expo-camera";
import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
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

	// 请求相机权限
	useEffect(() => {
		if (!permission) {
			requestPermission();
		}
	}, [permission, requestPermission]);

	// 处理扫码结果
	const handleBarCodeScanned = ({ data }: { data: string }) => {
		if (!data) {
			Alert.alert("无法识别二维码", "请尝试重新扫描");
			return;
		}

		// 跳转到地图页面并传递二维码信息
		router.push({
            pathname: "/scan/explore",
			params: { qrData: data },
		});
	};

	// 切换摄像头方向
	const toggleCameraFacing = () => {
		setFacing((current) => (current === "back" ? "front" : "back"));
	};

	// 如果没有权限，显示请求权限的界面
	if (!permission) {
		return <View style={styles.container} />;
	}

	if (!permission.granted) {
		return (
			<View style={styles.container}>
				<Text style={styles.title}>需要相机权限</Text>
				<Text style={styles.message}>此应用需要相机权限才能扫描二维码</Text>
				<Button title="请求权限" onPress={requestPermission} />
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
					{/* 扫码框 */}
					<View style={styles.scanFrame} />
				</View>

				<View style={styles.controls}>
					<Text style={styles.instruction}>将二维码放入框内，自动扫描</Text>
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
	},
	scanArea: {
		flex: 1,
		justifyContent: "center",
		alignItems: "center",
	},
	scanFrame: {
		width: 250,
		height: 250,
		borderWidth: 2,
		borderColor: "#00ff00",
		borderStyle: "solid",
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
