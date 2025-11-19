import { cn } from '@repo/mobile-ui/lib/utils';
import { X, Image as ImageIcon } from 'lucide-react-native';
import { useState, useCallback, useEffect } from 'react';
import { View, Pressable, ActivityIndicator, Platform, Image } from 'react-native';
import { Text } from '../../../packages/mobile-ui/src/components/ui/text';
import * as ImagePicker from 'expo-image-picker';
import * as FileSystem from 'expo-file-system';
import { useImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { toast } from 'sonner-native';

export interface ImageUploaderProps {
    /** 当前图片 URI */
    value?: string | null;
    /** 图片变化回调 (表单场景) */
    onChange?: (uri: string | null) => void;
    /** 上传开始回调 */
    onUploadStart?: () => void;
    /** 上传成功回调,返回服务器文件标识 */
    onUploadSuccess?: (fileIdentifier: string, fileUrl: string) => void;
    /** 上传失败回调 */
    onUploadError?: (error: Error) => void;
    /** 实际上传函数,由使用方提供(调用 useUploadFile 的 mutateAsync) */
    onUpload?: (file: { uri: string; name: string; type: string }) => Promise<{ fileIdentifier: string; fileUrl: string }>;
    /** 容器自定义样式 */
    className?: string;
    /** 图片容器尺寸 */
    size?: number;
    /** 圆角大小 */
    borderRadius?: number;
    /** 是否圆形 */
    circular?: boolean;
    /** 占位图标颜色 */
    placeholderColor?: string;
    /** 最大宽度(px),超过会等比压缩 */
    maxWidth?: number;
    /** 最大高度(px),超过会等比压缩 */
    maxHeight?: number;
    /** 最大文件大小(bytes),超过会压缩 */
    maxFileSize?: number;
    /** 压缩质量 0-1 */
    compressQuality?: number;
    /** 图片纵横比(仅 allowsEditing=true 时生效) */
    aspect?: [number, number];
    /** 是否禁用 */
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
    borderRadius = 8,
    circular = false,
    placeholderColor = '#94a3b8',
    maxWidth = 2048,
    maxHeight = 2048,
    maxFileSize = 2 * 1024 * 1024, // 2MB
    compressQuality = 0.7,
    aspect = [1, 1],
    disabled = false,
}: ImageUploaderProps) {
    const [loading, setLoading] = useState(false);
    const [localUri, setLocalUri] = useState<string | null>(value ?? null);

    // 同步外部 value 到内部 localUri
    useEffect(() => {
        setLocalUri(value ?? null);
    }, [value]);

    // 请求相机权限
    const requestCameraPermission = async () => {
        const { status } = await ImagePicker.requestCameraPermissionsAsync();
        if (status !== 'granted') {
            toast.error('需要相机权限才能拍照');
            return false;
        }
        return true;
    };

    // 请求相册权限
    const requestMediaLibraryPermission = async () => {
        const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== 'granted') {
            toast.error('需要访问相册权限才能选择照片');
            return false;
        }
        return true;
    };

    // 压缩图片
    const compressImage = useCallback(async (uri: string): Promise<string> => {
        try {
            // 获取文件信息
            const fileInfo = await FileSystem.getInfoAsync(uri);
            if (!fileInfo.exists) {
                throw new Error('文件不存在');
            }

            const fileSize = 'size' in fileInfo ? fileInfo.size : 0;

            // 如果文件大小在限制内,直接返回
            if (fileSize <= maxFileSize) {
                return uri;
            }

            // 使用新的 useImageManipulator API 进行压缩
            const context = useImageManipulator(uri);
            context.resize({ width: maxWidth, height: maxHeight });
            const image = await context.renderAsync();
            const result = await image.saveAsync({
                compress: compressQuality,
                format: SaveFormat.JPEG,
            });

            return result.uri;
        } catch (error) {
            return uri;
        }
    }, [maxFileSize, maxWidth, maxHeight, compressQuality]);

    // 处理图片选择
    const handleImagePicked = useCallback(
        async (result: ImagePicker.ImagePickerResult) => {
            if (result.canceled || !result.assets || result.assets.length === 0) {
                return;
            }

            const asset = result.assets[0];
            const { uri, fileName, mimeType } = asset;

            try {
                // 压缩图片
                const compressedUri = await compressImage(uri);

                // 更新本地预览
                setLocalUri(compressedUri);
                onChange?.(compressedUri);

                // 如果提供了上传函数,执行上传
                if (onUpload) {
                    setLoading(true);
                    onUploadStart?.();

                    const file = {
                        uri: compressedUri,
                        name: fileName || `image_${Date.now()}.jpg`,
                        type: mimeType || 'image/jpeg',
                    };

                    const response = await onUpload(file);
                    onUploadSuccess?.(response.fileIdentifier, response.fileUrl);
                }
            } catch (error) {
                console.error('图片上传失败:', error);
                onUploadError?.(error as Error);
                // 上传失败时也保留本地预览
            } finally {
                setLoading(false);
            }
        },
        [onChange, onUpload, onUploadStart, onUploadSuccess, onUploadError, maxFileSize, maxWidth, maxHeight, compressQuality]
    );

    // 拍照
    const handleTakePhoto = async () => {
        const hasPermission = await requestCameraPermission();
        if (!hasPermission) return;

        const result = await ImagePicker.launchCameraAsync({
            mediaTypes: ['images'],
            aspect,
            quality: 1,
        });

        await handleImagePicked(result);
    };

    // 从相册选择
    const handlePickImage = async () => {
        const hasPermission = await requestMediaLibraryPermission();
        if (!hasPermission) return;

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ['images'],
            aspect,
            quality: 1,
        });

        await handleImagePicked(result);
    };

    // 显示选择方式
    const showImageSourceOptions = () => {
        // 直接打开相册选择
        void handlePickImage();
    };

    const containerSize = { width: size, height: size };
    const radiusStyle = circular ? { borderRadius: size / 2 } : { borderRadius };

    return (
        <View className={cn('relative', className)}>
            <Pressable
                disabled={disabled || loading}
                onPress={showImageSourceOptions}
                className={cn(
                    'border-border bg-muted overflow-hidden border-2 border-dashed',
                    disabled && 'opacity-50'
                )}
                style={[containerSize, radiusStyle]}
            >
                {localUri ? (
                    <Image
                        source={{ uri: localUri }}
                        style={[containerSize, radiusStyle]}
                        resizeMode="cover"
                    />
                ) : (
                    <View className="flex-1 items-center justify-center">
                        <ImageIcon size={size / 3} color={placeholderColor} />
                        <Text className="text-muted-foreground mt-2 text-xs">点击上传</Text>
                    </View>
                )}

                {loading && (
                    <View className="bg-background/80 absolute inset-0 items-center justify-center">
                        <ActivityIndicator size="large" />
                        <Text className="text-muted-foreground mt-2 text-xs">上传中...</Text>
                    </View>
                )}
            </Pressable>
        </View>
    );
}
