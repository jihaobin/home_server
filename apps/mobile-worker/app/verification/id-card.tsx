import { Ionicons } from "@expo/vector-icons";
import { KeyboardAwareScreen } from "@repo/mobile-ui/components/app/KeyboardAwareScreen";
import { KeyboardAwareScrollView } from "@repo/mobile-ui/components/app/KeyboardAwareScrollView";
import { useRouter } from "expo-router";
import React, { useState } from "react";
import * as FileSystem from "expo-file-system/legacy";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";
import {
    ActivityIndicator,
    Alert,
    Image,
    Pressable,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { isApiClientError } from "@repo/utils/api-client";
import { useUploadFile } from "@repo/hooks/api/files";
import { useUserRealNameProfile, useVerifyAndSaveRealName } from "@repo/hooks/api/user";

const faceExampleImage = require("../../assets/images/face-example.png");

function maskIdCardNumber(value: string) {
    const normalized = value.trim();
    if (normalized.length <= 8) {
        if (normalized.length <= 2) {
            return `${normalized[0] ?? ""}${"*".repeat(Math.max(normalized.length - 1, 0))}`;
        }
        return `${normalized.slice(0, 1)}${"*".repeat(Math.max(normalized.length - 2, 0))}${normalized.slice(-1)}`;
    }
    const prefix = normalized.slice(0, 3);
    const suffix = normalized.slice(-4);
    return `${prefix}${"*".repeat(Math.max(normalized.length - 7, 0))}${suffix}`;
}

export default function IdCardVerificationScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const { data: profile } = useUserRealNameProfile(userId);
    const [realName, setRealName] = useState("");
    const [idCard, setIdCard] = useState("");
    const [faceImageUri, setFaceImageUri] = useState<string | null>(null);
    const [faceImageFileId, setFaceImageFileId] = useState<string | null>(null);
    const verifyRealNameMutation = useVerifyAndSaveRealName();
    const uploadFileMutation = useUploadFile();
    const loading = verifyRealNameMutation.isPending || uploadFileMutation.isPending;
    const maskedIdCard = profile?.idCardNumber ? maskIdCardNumber(profile.idCardNumber) : "";

    // 验证身份证号格式
    const validateIdCard = (id: string): boolean => {
        const idCardRegex =
            /^[1-9]\d{5}(18|19|20)\d{2}((0[1-9])|(1[0-2]))(([0-2][1-9])|10|20|30|31)\d{3}[0-9Xx]$/;
        return idCardRegex.test(id);
    };

    // 提交认证
    const handleSubmit = async () => {
        if (!realName.trim()) {
            Alert.alert("提示", "请输入真实姓名");
            return;
        }

        if (!idCard.trim()) {
            Alert.alert("提示", "请输入身份证号");
            return;
        }

        if (!validateIdCard(idCard)) {
            Alert.alert("提示", "身份证号格式不正确");
            return;
        }

        if (!userId) {
            Alert.alert("提示", "登录状态已失效，请重新登录后再试");
            return;
        }

        if (!faceImageFileId) {
            Alert.alert("提示", "请先拍摄或上传本人清晰正面照片，并确认授权用于实名核验");
            return;
        }

        try {
            const normalizedName = realName.trim();
            const normalizedIdCard = idCard.trim().toUpperCase();
            const verificationResult = await verifyRealNameMutation.mutateAsync({
                name: normalizedName,
                idCard: normalizedIdCard,
                userId,
                faceImageFileId,
            });

            Alert.alert("认证成功", verificationResult.description ?? "您的实名认证已通过", [
                {
                    text: "确定",
                    onPress: () => router.back(),
                },
            ]);
            setIdCard("");
            setFaceImageUri(null);
            setFaceImageFileId(null);

        } catch (error: unknown) {
            let message = "实名认证请求失败，请稍后重试";
            if (isApiClientError(error) && error.message) {
                message = error.message;
            }
            Alert.alert("认证失败", message);
        }
    };

    const handleUploadFaceImage = async (file: { uri: string; name: string; type: string }) => {
        const response = await uploadFileMutation.mutateAsync({
            file,
            fileName: file.name,
            fileType: "image",
        });
        return {
            fileIdentifier: response.id,
            fileUrl: response.fileUrl,
        };
    };

    const compressFaceImage = async (uri: string) => {
        try {
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists) {
                throw new Error("文件不存在");
            }

            const size = "size" in fileInfo ? fileInfo.size : 0;
            if (size <= 1024 * 1024 * 2) {
                return uri;
            }

            const result = await ImageManipulator.manipulateAsync(
                uri,
                [{ resize: { width: 1280, height: 1280 } }],
                {
                    compress: 0.7,
                    format: SaveFormat.JPEG,
                },
            );
            return result.uri;
        } catch {
            return uri;
        }
    };

    const handleTakeFacePhoto = async () => {
        if (loading) {
            return;
        }

        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (permission.status !== "granted") {
            Alert.alert("提示", "需要相机权限才能拍照");
            return;
        }

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect: [1, 1],
            quality: 1,
        });

        if (result.canceled || !result.assets?.length) {
            return;
        }

        const asset = result.assets[0];

        try {
            const compressedUri = await compressFaceImage(asset.uri);
            setFaceImageUri(compressedUri);
            setFaceImageFileId(null);

            const response = await handleUploadFaceImage({
                uri: compressedUri,
                name: asset.fileName || `face_${Date.now()}.jpg`,
                type: asset.mimeType || "image/jpeg",
            });

            setFaceImageFileId(response.fileIdentifier);
        } catch (error) {
            setFaceImageFileId(null);
            Alert.alert("上传失败", (error as Error).message || "人脸照片上传失败，请重试");
        }
    };

    return (
        <KeyboardAwareScreen style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>实名认证</Text>
                <View style={styles.placeholder} />
            </View>
            <KeyboardAwareScrollView
                style={styles.content}
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.formCard}>
                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>姓名</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="请填写您的姓名"
                            placeholderTextColor="#c9c9c9"
                            value={realName}
                            onChangeText={setRealName}
                            autoCapitalize="none"
                        />
                    </View>

                    <View style={styles.inputRow}>
                        <Text style={styles.inputLabel}>身份证号</Text>
                        <TextInput
                            style={styles.input}
                            placeholder="请填写您的身份证号"
                            placeholderTextColor="#c9c9c9"
                            value={idCard}
                            onChangeText={setIdCard}
                            maxLength={18}
                            autoCapitalize="none"
                        />
                    </View>
                </View>

                {profile && (
                    <Text style={styles.verifiedHint}>
                        当前已认证：{profile.realName ?? "未填写"} {maskedIdCard || "已保护"}
                    </Text>
                )}

                <View style={styles.photoSection}>
                    <Text style={styles.photoTitle}>
                        <Text style={styles.requiredMark}>* </Text>
                        请拍摄本人实拍照片
                    </Text>

                    <View style={styles.photoContent}>
                        <View style={styles.exampleWrap}>
                            <View style={styles.examplePhoto}>
                                <Image
                                    source={faceExampleImage}
                                    style={styles.exampleImage}
                                    resizeMode="cover"
                                />
                                <View style={styles.exampleBadge}>
                                    <Text style={styles.exampleBadgeText}>示例</Text>
                                </View>
                            </View>
                            <Text style={styles.requireTitle}>拍摄要求</Text>
                            <Text style={styles.requireText}>
                                正面、免冠、素颜、清晰{"\n"}光线良好、背景整洁
                            </Text>
                        </View>

                        <Pressable
                            style={[
                                styles.faceUploadButton,
                                loading && styles.faceUploadButtonDisabled,
                            ]}
                            className="flex"
                            onPress={handleTakeFacePhoto}
                            disabled={loading}
                        >
                            {faceImageUri ? (
                                <Image
                                    source={{ uri: faceImageUri }}
                                    style={styles.faceUploadPreview}
                                    resizeMode="cover"
                                />
                            ) : (
                                <View style={styles.cameraCircle}>
                                    <Ionicons name="camera" size={34} color="#fff" />
                                </View>
                            )}

                            {loading && (
                                <View style={styles.faceUploadLoadingMask}>
                                    <ActivityIndicator size="small" color="#2f7df6" />
                                    <Text style={styles.faceUploadLoadingText}>上传中...</Text>
                                </View>
                            )}
                        </Pressable>
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.submitButton, loading && styles.submitButtonDisabled]}
                    onPress={handleSubmit}
                    disabled={loading}
                >
                    <Text style={styles.submitText}>
                        {loading ? "认证中..." : "提交认证"}
                    </Text>
                </TouchableOpacity>

                <View style={styles.explainSection}>
                    <View style={styles.questionTitleRow}>
                        <Ionicons name="help-circle" size={16} color="#3b82f6" />
                        <Text style={styles.questionTitle}>什么是实名认证?</Text>
                    </View>
                    <Text style={styles.questionText}>
                        实人认证是指通过姓名、身份证号和实拍照片，核实认证人员身份真实性的一种手段。上单平台将严格保护您的隐私，您上传的身份信息仅供平台认证使用，不会泄露给任何第三方。
                    </Text>

                    <View style={styles.questionTitleRow}>
                        <Ionicons name="help-circle" size={16} color="#3b82f6" />
                        <Text style={styles.questionTitle}>为什么要进行实人认证?</Text>
                    </View>
                    <Text style={styles.questionText}>
                        叮咚上单作为叮咚上门旗下的上门服务人员就业接单平台，需要对服务人员的身份进行核实，以确保用户的安全。更重要的是，平台需要维护服务人员的权益，避免不法分子伪造、冒用他人身份信息，对其他服务人员的从业经历及名誉造成影响。
                    </Text>
                </View>
            </KeyboardAwareScrollView>
        </KeyboardAwareScreen>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f3f3f3",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 14,
        paddingTop: 44,
        height: 88,
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#d9d9d9",
    },
    backButton: {
        width: 44,
        height: 44,
        alignItems: "flex-start",
        justifyContent: "center",
    },
    title: {
        fontSize: 18,
        fontWeight: "500",
        color: "#222",
    },
    placeholder: {
        width: 44,
    },
    content: {
        flex: 1,
    },
    scrollContent: {
        paddingBottom: 40,
    },
    formCard: {
        backgroundColor: "#fff",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#ededed",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#ededed",
    },
    inputRow: {
        minHeight: 58,
        flexDirection: "row",
        alignItems: "center",
        paddingHorizontal: 16,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e6e6e6",
    },
    inputLabel: {
        width: 84,
        fontSize: 16,
        fontWeight: "600",
        color: "#222",
    },
    input: {
        flex: 1,
        minHeight: 58,
        fontSize: 16,
        color: "#222",
        paddingVertical: 0,
    },
    verifiedHint: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        fontSize: 12,
        lineHeight: 18,
        color: "#8a8a8a",
    },
    photoSection: {
        marginTop: 10,
        paddingTop: 18,
        paddingHorizontal: 16,
        paddingBottom: 12,
        backgroundColor: "#fff",
    },
    photoTitle: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "600",
        color: "#222",
        marginBottom: 18,
    },
    requiredMark: {
        color: "#ef4444",
    },
    photoContent: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 16,
    },
    exampleWrap: {
        flex: 1.2,
        minWidth: 0,
        alignItems: "center",
    },
    examplePhoto: {
        width: 94,
        height: 94,
        borderRadius: 4,
        backgroundColor: "#e8e5e0",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    exampleImage: {
        width: "100%",
        height: "100%",
    },
    exampleBadge: {
        position: "absolute",
        right: 0,
        bottom: 0,
        paddingHorizontal: 5,
        height: 18,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#ff8a3d",
        borderTopLeftRadius: 3,
    },
    exampleBadgeText: {
        fontSize: 11,
        color: "#fff",
    },
    requireTitle: {
        marginTop: 12,
        fontSize: 17,
        lineHeight: 24,
        fontWeight: "700",
        color: "#333",
    },
    requireText: {
        marginTop: 2,
        fontSize: 15,
        lineHeight: 21,
        color: "#333",
        textAlign: "center",
    },
    faceUploadButton: {
        flex: 1,
        minWidth: 0,
        aspectRatio: 1,
        borderRadius: 4,
        backgroundColor: "#f4f4f4",
        alignItems: "center",
        justifyContent: "center",
        overflow: "hidden",
    },
    faceUploadButtonDisabled: {
        opacity: 0.5,
    },
    faceUploadPreview: {
        width: "100%",
        height: "100%",
        borderRadius: 4,
    },
    cameraCircle: {
        width: 58,
        height: 58,
        borderRadius: 29,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#6ea2ff",
    },
    faceUploadLoadingMask: {
        ...StyleSheet.absoluteFillObject,
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "rgba(255,255,255,0.8)",
    },
    faceUploadLoadingText: {
        fontSize: 12,
        color: "#2f7df6",
        marginTop: 8,
    },
    submitButton: {
        height: 48,
        marginHorizontal: 16,
        marginTop: 24,
        marginBottom: 16,
        backgroundColor: "#2f7df6",
        borderRadius: 3,
        alignItems: "center",
        justifyContent: "center",
    },
    submitButtonDisabled: {
        backgroundColor: "#a8c7fb",
    },
    submitText: {
        fontSize: 16,
        fontWeight: "500",
        color: "white",
    },
    explainSection: {
        paddingHorizontal: 16,
        paddingBottom: 40,
    },
    questionTitleRow: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
        marginTop: 10,
        marginBottom: 7,
    },
    questionTitle: {
        fontSize: 16,
        lineHeight: 22,
        fontWeight: "700",
        color: "#333",
    },
    questionText: {
        fontSize: 14,
        lineHeight: 20,
        color: "#222",
    },

});
