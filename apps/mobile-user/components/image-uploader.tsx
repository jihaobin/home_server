import { cn } from "@repo/mobile-ui/lib/utils";
import { X, Image as ImageIcon } from "lucide-react-native";
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { View, Pressable, ActivityIndicator, Image } from "react-native";
import { Text } from "../../../packages/mobile-ui/src/components/ui/text";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system";
import { ImageManipulator, manipulateAsync, SaveFormat } from "expo-image-manipulator";
import { toast } from "@repo/mobile-ui/lib/toast";

export interface ImageUploaderProps {
    /** 当前图片 URI */
    value?: string | null;
    /** 当前图片 URI 列表(多图) */
    values?: string[];
    /** 图片变化回调 (表单场景) */
    onChange?: (uri: string | null) => void;
    /** 多图变化回调(仅本地 URI 列表) */
    onChangeMultiple?: (uris: string[]) => void;
    /** 上传开始回调 */
    onUploadStart?: () => void;
    /** 上传成功回调,返回服务器文件标识 */
    onUploadSuccess?: (fileIdentifier: string, fileUrl: string) => void;
    /** 上传失败回调 */
    onUploadError?: (error: Error) => void;
    /** 实际上传函数,由使用方提供(调用 useUploadFile 的 mutateAsync) */
    onUpload?: (file: {
        uri: string;
        name: string;
        type: string;
    }) => Promise<{ fileIdentifier: string; fileUrl: string }>;
    /** 多图上传函数,由使用方提供(调用 useUploadFiles 的 mutateAsync) */
    onUploadMultiple?: (
        files: { uri: string; name: string; type: string }[],
    ) => Promise<{ fileIdentifier: string; fileUrl: string }[]>;
    /** 多图上传状态变化 */
    onItemsChange?: (items: ImageUploaderItem[]) => void;
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
    /** 是否启用多图上传 */
    multiple?: boolean;
    /** 多图最大数量 */
    maxCount?: number;
}

export interface ImageUploaderItem {
    key: string;
    uri: string;
    name: string;
    type: string;
    status: "ready" | "uploading" | "error";
    fileIdentifier: string | null;
    fileUrl: string | null;
    errorMessage: string | null;
}

export function ImageUploader({
    value,
    values,
    onChange,
    onChangeMultiple,
    onUploadStart,
    onUploadSuccess,
    onUploadError,
    onUpload,
    onUploadMultiple,
    onItemsChange,
    className,
    size = 120,
    borderRadius = 8,
    circular = false,
    placeholderColor = "#94a3b8",
    maxWidth = 2048,
    maxHeight = 2048,
    maxFileSize = 2 * 1024 * 1024, // 2MB
    compressQuality = 0.7,
    aspect = [1, 1],
    disabled = false,
    multiple = false,
    maxCount = 6,
}: ImageUploaderProps) {
    const [loading, setLoading] = useState(false);
    const [localUri, setLocalUri] = useState<string | null>(value ?? null);
    const [items, setItems] = useState<ImageUploaderItem[]>([]);
    const isMountedRef = useRef(true);

    // 同步外部 value 到内部 localUri
    useEffect(() => {
        if (!multiple) {
            setLocalUri(value ?? null);
        }
    }, [value, multiple]);

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const valuesKey = useMemo(() => (values ?? []).join("|"), [values]);

    useEffect(() => {
        if (!multiple || !values) return;
        setItems((prev) => {
            const prevUris = prev.map((item) => item.uri);
            if (
                prevUris.length === values.length &&
                prevUris.every((uri, idx) => uri === values[idx])
            ) {
                return prev;
            }
            return values.map((uri, idx) => ({
                key: `value-${idx}-${uri}`,
                uri,
                name: `image_${idx + 1}.jpg`,
                type: "image/jpeg",
                status: "ready",
                fileIdentifier: null,
                fileUrl: uri,
                errorMessage: null,
            }));
        });
    }, [multiple, values, valuesKey]);

    useEffect(() => {
        if (!multiple) return;
        onItemsChange?.(items);
        onChangeMultiple?.(items.map((item) => item.uri));
    }, [items, multiple, onItemsChange, onChangeMultiple]);

    // 请求相册权限
    const requestMediaLibraryPermission = async () => {
        const { status } =
            await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (status !== "granted") {
            toast.error("需要访问相册权限才能选择照片");
            return false;
        }
        return true;
    };

    // 压缩图片
    const compressImage = useCallback(
        async (uri: string): Promise<string> => {
            try {
                // 获取文件信息
                const fileInfo = await FileSystem.getInfoAsync(uri);
                if (!fileInfo.exists) {
                    throw new Error("文件不存在");
                }

                const fileSize = "size" in fileInfo ? fileInfo.size : 0;

                // 如果文件大小在限制内,直接返回
                if (fileSize <= maxFileSize) {
                    return uri;
                }

                const result = await ImageManipulator.manipulateAsync(
                    uri,
                    [{ resize: { width: maxWidth, height: maxHeight } }],
                    {
                        compress: compressQuality,
                        format: SaveFormat.JPEG,
                    },
                );

                return result.uri;
            } catch (error) {
                return uri;
            }
        },
        [maxFileSize, maxWidth, maxHeight, compressQuality],
    );

    // 处理图片选择
    const handleImagePicked = useCallback(
        async (result: ImagePicker.ImagePickerResult) => {
            if (
                result.canceled ||
                !result.assets ||
                result.assets.length === 0
            ) {
                return;
            }

            if (!multiple) {
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
                            type: mimeType || "image/jpeg",
                        };

                        const response = await onUpload(file);
                        onUploadSuccess?.(
                            response.fileIdentifier,
                            response.fileUrl,
                        );
                    }
                } catch (error) {
                    console.error("图片上传失败:", error);
                    onUploadError?.(error as Error);
                    // 上传失败时也保留本地预览
                } finally {
                    setLoading(false);
                }
                return;
            }

            const remaining = Math.max(0, maxCount - items.length);
            const assets = result.assets.slice(0, remaining);
            if (assets.length === 0) {
                return;
            }
            let prepared: ImageUploaderItem[] = [];
            try {
                prepared = await Promise.all(
                    assets.map(async (asset) => {
                        const compressedUri = await compressImage(asset.uri);
                        return {
                            key: `${Date.now()}-${Math.random().toString(16).slice(2)}`,
                            uri: compressedUri,
                            name: asset.fileName || `image_${Date.now()}.jpg`,
                            type: asset.mimeType || "image/jpeg",
                            status: "uploading" as const,
                            fileIdentifier: null,
                            fileUrl: null,
                            errorMessage: null,
                        };
                    }),
                );

                setItems((prev) => [...prev, ...prepared]);

                if (!onUpload && !onUploadMultiple) {
                    setItems((prev) =>
                        prev.map((item) =>
                            prepared.find((target) => target.key === item.key)
                                ? { ...item, status: "ready" }
                                : item,
                        ),
                    );
                    return;
                }

                onUploadStart?.();
                const files = prepared.map((item) => ({
                    uri: item.uri,
                    name: item.name,
                    type: item.type,
                }));

                let responses: {
                    fileIdentifier: string;
                    fileUrl: string;
                }[] = [];
                if (onUploadMultiple) {
                    responses = await onUploadMultiple(files);
                } else if (onUpload) {
                    responses = await Promise.all(
                        files.map((file) => onUpload(file)),
                    );
                }

                if (!isMountedRef.current) return;

                responses.forEach((response) => {
                    if (response) {
                        onUploadSuccess?.(
                            response.fileIdentifier,
                            response.fileUrl,
                        );
                    }
                });

                setItems((prev) =>
                    prev.map((item) => {
                        const idx = prepared.findIndex(
                            (target) => target.key === item.key,
                        );
                        if (idx < 0) return item;
                        const response = responses[idx];
                        if (response) {
                            return {
                                ...item,
                                status: "ready",
                                fileIdentifier: response.fileIdentifier,
                                fileUrl: response.fileUrl,
                                errorMessage: null,
                            };
                        }
                        return {
                            ...item,
                            status: "error",
                            fileIdentifier: null,
                            fileUrl: null,
                            errorMessage: "图片上传失败",
                        };
                    }),
                );
            } catch (error) {
                if (!isMountedRef.current) return;
                onUploadError?.(error as Error);
                setItems((prev) =>
                    prev.map((item) =>
                        prepared.find((target) => target.key === item.key)
                            ? {
                                  ...item,
                                  status: "error",
                                  fileIdentifier: null,
                                  fileUrl: null,
                                  errorMessage:
                                      (error as Error).message ||
                                      "图片上传失败",
                              }
                            : item,
                    ),
                );
            }
        },
        [
            compressImage,
            items.length,
            maxCount,
            multiple,
            onChange,
            onUpload,
            onUploadError,
            onUploadMultiple,
            onUploadStart,
            onUploadSuccess,
        ],
    );

    // 从相册选择
    const handlePickImage = async () => {
        const hasPermission = await requestMediaLibraryPermission();
        if (!hasPermission) return;

        const remaining = multiple ? Math.max(0, maxCount - items.length) : 1;
        if (multiple && remaining <= 0) {
            toast.error(`最多支持上传 ${maxCount} 张图片`);
            return;
        }

        const result = await ImagePicker.launchImageLibraryAsync({
            mediaTypes: ["images"],
            allowsMultipleSelection: multiple,
            selectionLimit: multiple ? remaining : 1,
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
    const radiusStyle = circular
        ? { borderRadius: size / 2 }
        : { borderRadius };

    if (multiple) {
        return (
            <View className={cn("flex-row flex-wrap gap-3", className)}>
                {items.map((item) => (
                    <View
                        key={item.key}
                        className="relative overflow-hidden bg-muted"
                        style={[containerSize, radiusStyle]}
                    >
                        <Image
                            source={{ uri: item.uri }}
                            style={[containerSize, radiusStyle]}
                            resizeMode="cover"
                        />
                        <Pressable
                            disabled={disabled}
                            onPress={() => {
                                setItems((prev) =>
                                    prev.filter(
                                        (target) => target.key !== item.key,
                                    ),
                                );
                            }}
                            className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full"
                            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                        >
                            <X size={12} color="#fff" />
                        </Pressable>

                        {item.status === "uploading" ? (
                            <View
                                className="absolute inset-0 items-center justify-center"
                                style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                            >
                                <ActivityIndicator size="small" color="#fff" />
                                <Text className="mt-1 text-xs text-background">
                                    上传中
                                </Text>
                            </View>
                        ) : null}

                        {item.status === "error" ? (
                            <View
                                className="absolute inset-0 items-center justify-center"
                                style={{
                                    backgroundColor: "rgba(239,68,68,0.55)",
                                }}
                            >
                                <Text className="text-xs text-background">
                                    上传失败
                                </Text>
                                <Pressable
                                    disabled={disabled}
                                    onPress={async () => {
                                        if (!onUpload && !onUploadMultiple)
                                            return;
                                        setItems((prev) =>
                                            prev.map((target) =>
                                                target.key === item.key
                                                    ? {
                                                          ...target,
                                                          status: "uploading",
                                                          errorMessage: null,
                                                          fileIdentifier: null,
                                                          fileUrl: null,
                                                      }
                                                    : target,
                                            ),
                                        );
                                        try {
                                            onUploadStart?.();
                                            const file = {
                                                uri: item.uri,
                                                name: item.name,
                                                type: item.type,
                                            };
                                            let response: {
                                                fileIdentifier: string;
                                                fileUrl: string;
                                            } | null = null;
                                            if (onUploadMultiple) {
                                                const results =
                                                    await onUploadMultiple([
                                                        file,
                                                    ]);
                                                response = results[0] ?? null;
                                            } else if (onUpload) {
                                                response = await onUpload(file);
                                            }
                                            if (!isMountedRef.current) return;
                                            if (response) {
                                                onUploadSuccess?.(
                                                    response.fileIdentifier,
                                                    response.fileUrl,
                                                );
                                                setItems((prev) =>
                                                    prev.map((target) =>
                                                        target.key === item.key
                                                            ? {
                                                                  ...target,
                                                                  status: "ready",
                                                                  fileIdentifier:
                                                                      response!
                                                                          .fileIdentifier,
                                                                  fileUrl:
                                                                      response!
                                                                          .fileUrl,
                                                                  errorMessage:
                                                                      null,
                                                              }
                                                            : target,
                                                    ),
                                                );
                                            } else {
                                                setItems((prev) =>
                                                    prev.map((target) =>
                                                        target.key === item.key
                                                            ? {
                                                                  ...target,
                                                                  status: "error",
                                                                  fileIdentifier:
                                                                      null,
                                                                  fileUrl: null,
                                                                  errorMessage:
                                                                      "图片上传失败",
                                                              }
                                                            : target,
                                                    ),
                                                );
                                            }
                                        } catch (error) {
                                            if (!isMountedRef.current) return;
                                            onUploadError?.(error as Error);
                                            setItems((prev) =>
                                                prev.map((target) =>
                                                    target.key === item.key
                                                        ? {
                                                              ...target,
                                                              status: "error",
                                                              fileIdentifier:
                                                                  null,
                                                              fileUrl: null,
                                                              errorMessage:
                                                                  (
                                                                      error as Error
                                                                  ).message ||
                                                                  "图片上传失败",
                                                          }
                                                        : target,
                                                ),
                                            );
                                        }
                                    }}
                                    className="mt-2 rounded-full px-3 py-1"
                                    style={{
                                        backgroundColor: "rgba(0,0,0,0.35)",
                                    }}
                                >
                                    <Text className="text-xs text-background">
                                        重试
                                    </Text>
                                </Pressable>
                            </View>
                        ) : null}
                    </View>
                ))}

                {items.length < maxCount ? (
                    <Pressable
                        disabled={disabled}
                        onPress={showImageSourceOptions}
                        className={cn(
                            "border-border bg-muted overflow-hidden border-2 border-dashed items-center justify-center",
                            disabled && "opacity-50",
                        )}
                        style={[containerSize, radiusStyle]}
                    >
                        <ImageIcon size={size / 3} color={placeholderColor} />
                        <Text className="text-muted-foreground mt-2 text-xs">
                            添加图片
                        </Text>
                    </Pressable>
                ) : null}
            </View>
        );
    }

    return (
        <View className={cn("relative", className)}>
            <Pressable
                disabled={disabled || loading}
                onPress={showImageSourceOptions}
                className={cn(
                    "border-border bg-muted overflow-hidden border-2 border-dashed",
                    disabled && "opacity-50",
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
                        <Text className="text-muted-foreground mt-2 text-xs">
                            点击上传
                        </Text>
                    </View>
                )}

                {loading && (
                    <View className="bg-background/80 absolute inset-0 items-center justify-center">
                        <ActivityIndicator size="large" />
                        <Text className="text-muted-foreground mt-2 text-xs">
                            上传中...
                        </Text>
                    </View>
                )}
            </Pressable>
        </View>
    );
}
