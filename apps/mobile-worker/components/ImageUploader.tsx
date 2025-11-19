import { useState, useCallback, useEffect } from "react";
import { ActivityIndicator, Image, Pressable, View } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { useImageManipulator, SaveFormat } from "expo-image-manipulator";
import { Image as ImageIcon } from "lucide-react-native";
import { toast } from "sonner-native";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Text } from "@repo/mobile-ui/components/ui/text";

export interface ImageUploaderProps {
    value?: string | null;
    onChange?: (uri: string | null) => void;
    onUploadStart?: () => void;
    onUploadSuccess?: (fileIdentifier: string, fileUrl: string) => void;
    onUploadError?: (error: Error) => void;
    onUpload?: (file: { uri: string; name: string; type: string }) => Promise<{
        fileIdentifier: string;
        fileUrl: string;
    }>;
    className?: string;
    size?: number;
    borderRadius?: number;
    circular?: boolean;
    placeholderColor?: string;
    maxWidth?: number;
    maxHeight?: number;
    maxFileSize?: number;
    compressQuality?: number;
    aspect?: [number, number];
    disabled?: boolean;
}

export function ImageUploader({
    value,
    onChange,
    onUploadStart,
    onUploadSuccess,
    onUploadError,
    onUpload,
    className,
    size = 120,
    borderRadius = 12,
    circular = true,
    placeholderColor = "#94a3b8",
    maxWidth = 1024,
    maxHeight = 1024,
    maxFileSize = 1024 * 1024 * 2,
    compressQuality = 0.7,
    aspect = [1, 1],
    disabled = false,
}: ImageUploaderProps) {
    const [loading, setLoading] = useState(false);
    const [localUri, setLocalUri] = useState<string | null>(value ?? null);

    useEffect(() => {
        setLocalUri(value ?? null);
    }, [value]);

    const requestCameraPermission = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== "granted") {
            toast.error("需要相机权限才能拍照");
            return false;
        }
        return true;
    };

    const requestMediaLibraryPermission = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            toast.error("需要访问相册权限才能选择照片");
            return false;
        }
        return true;
    };

    const compressImage = useCallback(
        async (uri: string): Promise<string> => {
            try {
                const fileInfo = await FileSystem.getInfoAsync(uri);
                if (!fileInfo.exists) {
                    throw new Error("文件不存在");
                }
                const size = "size" in fileInfo ? fileInfo.size : 0;
                if (size <= maxFileSize) {
                    return uri;
                }
                const context = useImageManipulator(uri);
                context.resize({ width: maxWidth, height: maxHeight });
                const image = await context.renderAsync();
                const result = await image.saveAsync({
                    compress: compressQuality,
                    format: SaveFormat.JPEG,
                });
                return result.uri;
            } catch {
                return uri;
            }
        },
        [compressQuality, maxFileSize, maxHeight, maxWidth],
    );

    const handleImagePicked = useCallback(
        async (result: ImagePicker.ImagePickerResult) => {
            if (result.canceled || !result.assets?.length) {
                return;
            }
            const asset = result.assets[0];
            try {
                const compressedUri = await compressImage(asset.uri);
                setLocalUri(compressedUri);
                onChange?.(compressedUri);

                if (onUpload) {
                    setLoading(true);
                    onUploadStart?.();
                    const response = await onUpload({
                        uri: compressedUri,
                        name: asset.fileName || `avatar_${Date.now()}.jpg`,
                        type: asset.mimeType || "image/jpeg",
                    });
                    onUploadSuccess?.(response.fileIdentifier, response.fileUrl);
                }
            } catch (error) {
                onUploadError?.(error as Error);
            } finally {
                setLoading(false);
            }
        },
        [compressImage, onChange, onUpload, onUploadError, onUploadStart, onUploadSuccess],
    );

    const handlePickImage = async () => {
        const granted = await requestMediaLibraryPermission();
        if (!granted) return;
        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect,
            quality: 1,
        });
        await handleImagePicked(result);
    };

    const handleTakePhoto = async () => {
        const granted = await requestCameraPermission();
        if (!granted) return;
        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            aspect,
            quality: 1,
        });
        await handleImagePicked(result);
    };

    const containerSize = { width: size, height: size };
    const radiusStyle = circular ? { borderRadius: size / 2 } : { borderRadius };

    return (
        <View className={cn("relative", className)}>
            <Pressable
                disabled={disabled || loading}
                onPress={handlePickImage}
                onLongPress={handleTakePhoto}
                className={cn(
                    "border-border bg-muted overflow-hidden border-2 border-dashed",
                    disabled && "opacity-50",
                )}
                style={[containerSize, radiusStyle]}
            >
                {localUri ? (
                    <Image source={{ uri: localUri }} style={[containerSize, radiusStyle]} resizeMode="cover" />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <ImageIcon size={size / 3} color={placeholderColor} />
                        <Text className="text-muted-foreground mt-2 text-xs">点击上传</Text>
                    </View>
                )}

                {loading && (
                    <View className="bg-background/80 absolute inset-0 items-center justify-center">
                        <ActivityIndicator size="small" />
                        <Text className="text-muted-foreground mt-2 text-xs">上传中...</Text>
                    </View>
                )}
            </Pressable>
        </View>
    );
}
