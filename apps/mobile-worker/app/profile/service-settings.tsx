import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    Image,
    View,
} from "react-native";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useUpdateServiceOfferings } from "@repo/hooks/api/work-skill";
import { useUploadFile } from "@repo/hooks/api/files";
import { useQuery } from "@tanstack/react-query";
import type { FileDownloadUrlResponse, ServiceListResponse } from "@repo/types";
import { apiClient } from "@repo/lib/http-client";
import * as ImagePicker from "expo-image-picker";

type EditableSpecification = {
    id?: string;
    localId: string;
    name: string;
    price: string;
    duration: string;
    currency: string;
};

type EditableImage = {
    id: string;
    url: string;
};

type EditableService = {
    serviceId: string;
    name: string;
    categoryName?: string;
    description: string;
    specs: EditableSpecification[];
    gallery: EditableImage[];
};

export default function ServiceSettingsScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;

    const {
        data: profile,
        isFetching,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);

    const updateOfferings = useUpdateServiceOfferings();
    const uploadFile = useUploadFile();

    const [selectedServices, setSelectedServices] = useState<EditableService[]>([]);
    const [search, setSearch] = useState("");
    const [saving, setSaving] = useState(false);
    const [uploadingServiceId, setUploadingServiceId] = useState<string | null>(null);
    const specIdRef = useRef(0);
    const fetchFileUrl = useCallback(async (fileIdentifier: string) => {
        const response = await apiClient.get<FileDownloadUrlResponse>(`/files/${fileIdentifier}`);
        return response.data.fileUrl;
    }, []);

    const buildSpec = useCallback(
        (initial?: Partial<EditableSpecification>) => {
            const localId = initial?.localId ?? `spec-${specIdRef.current++}`;
            return {
                id: initial?.id,
                localId,
                name: initial?.name ?? "",
                price: initial?.price ?? "",
                duration: initial?.duration ?? "",
                currency: initial?.currency ?? "CNY",
            };
        },
        [],
    );

    useEffect(() => {
        if (!profile) return;
        const mapped: EditableService[] = profile.services.map((service) => {
            const specs = (service as any)?.specifications ?? [];
            const galleryItems = (((service as any)?.gallery ?? []) as any[])
                .map((file) => ({
                    id: file?.fileId ?? file?.id,
                    url: file?.url ?? file?.fileUrl,
                }))
                .filter((item) => item.id && item.url);
            return {
                serviceId: service.serviceId,
                name: service.serviceName,
                categoryName: (service as any)?.categoryName ?? undefined,
                description: (service as any)?.personnelDescription ?? "",
                gallery: galleryItems,
                specs:
                    specs.length > 0
                        ? specs.map((spec: any) =>
                            buildSpec({
                                id: spec.id,
                                name: spec.name ?? "",
                                price: spec.price ?? "",
                                duration: spec.estimatedDurationMinutes
                                    ? String(spec.estimatedDurationMinutes)
                                    : "",
                                currency: spec.currency ?? "CNY",
                            }),
                        )
                        : [buildSpec()],
            };
        });
        setSelectedServices(mapped);
    }, [buildSpec, profile]);

    const {
        data: serviceCategories = [],
        isFetching: loadingOptions,
    } = useQuery({
        queryKey: ["worker-service-options", search],
        queryFn: async () => {
            const response = await apiClient.get<ServiceListResponse>("/service/services", {
                query: {
                    page: "1",
                    limit: "25",
                    ...(search ? { search } : {}),
                },
            });
            return response.data.items;
        },
    });

    const handleUpdateDescription = useCallback((serviceId: string, text: string) => {
        setSelectedServices((prev) =>
            prev.map((item) =>
                item.serviceId === serviceId ? { ...item, description: text } : item,
            ),
        );
    }, []);

    const handleUpdateSpecField = useCallback(
        (
            serviceId: string,
            localId: string,
            field: keyof Pick<EditableSpecification, "name" | "price" | "duration">,
            value: string,
        ) => {
            setSelectedServices((prev) =>
                prev.map((service) => {
                    if (service.serviceId !== serviceId) {
                        return service;
                    }
                    return {
                        ...service,
                        specs: service.specs.map((spec) =>
                            spec.localId === localId ? { ...spec, [field]: value } : spec,
                        ),
                    };
                }),
            );
        },
        [],
    );

    const handleAddSpec = useCallback(
        (serviceId: string) => {
            setSelectedServices((prev) =>
                prev.map((service) =>
                    service.serviceId === serviceId
                        ? { ...service, specs: [...service.specs, buildSpec()] }
                        : service,
                ),
            );
        },
        [buildSpec],
    );

    const handleRemoveSpec = useCallback((serviceId: string, localId: string) => {
        setSelectedServices((prev) =>
            prev.map((service) => {
                if (service.serviceId !== serviceId) {
                    return service;
                }
                if (service.specs.length === 1) {
                    Alert.alert("提示", "每个服务至少保留一个规格");
                    return service;
                }
                return {
                    ...service,
                    specs: service.specs.filter((spec) => spec.localId !== localId),
                };
            }),
        );
    }, []);

    const handleRemoveService = (serviceId: string) => {
        setSelectedServices((prev) => prev.filter((item) => item.serviceId !== serviceId));
    };

    const handleAddGalleryImage = useCallback(
        async (serviceId: string) => {
            const target = selectedServices.find((item) => item.serviceId === serviceId);
            if (!target) return;
            if (target.gallery.length >= 5) {
                Alert.alert("提示", "最多上传 5 张宣传图片");
                return;
            }

            const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
            if (!permission.granted) {
                Alert.alert("提示", "需要相册权限才能上传图片");
                return;
            }

            const result = await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ImagePicker.MediaTypeOptions.Images,
                allowsEditing: false,
                quality: 0.8,
            });

            if (result.canceled || !result.assets?.length) return;
            const asset = result.assets[0];

            setUploadingServiceId(serviceId);
            try {
                const response = await uploadFile.mutateAsync({
                    file: {
                        uri: asset.uri,
                        name: asset.fileName ?? `service_${Date.now()}.jpg`,
                        type: asset.mimeType ?? "image/jpeg",
                    },
                });

                let accessibleUrl = asset.uri;
                try {
                    accessibleUrl = await fetchFileUrl(response.id);
                } catch (err) {
                    accessibleUrl = asset.uri;
                }

                setSelectedServices((prev) =>
                    prev.map((service) =>
                        service.serviceId === serviceId
                            ? {
                                ...service,
                                gallery: [
                                    ...service.gallery,
                                    { id: response.id, url: accessibleUrl },
                                ].slice(0, 5),
                            }
                            : service,
                    ),
                );
            } catch (error) {
                console.error("[ServiceSettings] 图片上传失败", error);
                Alert.alert("上传失败", "请稍后重试");
            } finally {
                setUploadingServiceId(null);
            }
        },
        [fetchFileUrl, selectedServices, uploadFile],
    );

    const handleRemoveGalleryImage = useCallback((serviceId: string, imageId: string) => {
        setSelectedServices((prev) =>
            prev.map((service) =>
                service.serviceId === serviceId
                    ? {
                        ...service,
                        gallery: service.gallery.filter((img) => img.id !== imageId),
                    }
                    : service,
            ),
        );
    }, []);

    const handleAddService = (
        service: ServiceListResponse["items"][number]["children"][number],
        categoryName?: string,
    ) => {
        if (selectedServices.some((item) => item.serviceId === service.id)) {
            return;
        }

        setSelectedServices((prev) => [
            ...prev,
            {
                serviceId: service.id,
                name: service.name,
                categoryName,
                description: "",
                gallery: [],
                specs: [buildSpec()],
            },
        ]);
    };

    const handleSave = async () => {
        if (!userId) return;
        if (selectedServices.length === 0) {
            Alert.alert("提示", "请至少选择一个可提供的服务分类");
            return;
        }

        const pricePattern = /^\d+(\.\d{1,2})?$/;

        for (const service of selectedServices) {
            if (service.specs.length === 0) {
                Alert.alert("提示", `${service.name} 需要至少一个服务规格`);
                return;
            }
            if ((service.gallery?.length ?? 0) > 5) {
                Alert.alert("提示", `${service.name} 的宣传图片最多 5 张`);
                return;
            }
            for (const spec of service.specs) {
                if (!spec.name.trim()) {
                    Alert.alert("提示", `${service.name} 的规格名称不能为空`);
                    return;
                }
                if (!spec.price.trim() || !pricePattern.test(spec.price.trim())) {
                    Alert.alert("提示", `${service.name} 的规格价格格式不正确`);
                    return;
                }
                const duration = Number.parseInt(spec.duration, 10);
                if (Number.isNaN(duration) || duration <= 0) {
                    Alert.alert("提示", `${service.name} 的规格耗时必须为正整数`);
                    return;
                }
            }
        }

        const payload = {
            services: selectedServices.map((service) => ({
                serviceId: service.serviceId,
                description: service.description.trim()
                    ? service.description.trim()
                    : undefined,
                galleryFileIds: (service.gallery ?? []).map((item) => item.id),
                specifications: service.specs.map((spec) => ({
                    id: spec.id,
                    name: spec.name.trim(),
                    price: spec.price.trim(),
                    currency: spec.currency || "CNY",
                    estimatedDurationMinutes: Number.parseInt(spec.duration, 10),
                })),
            })),
        };

        setSaving(true);
        try {
            await updateOfferings.mutateAsync(payload);
            await refetchProfile();
            Alert.alert("保存成功", "服务设置已更新", [
                { text: "好的", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("[ServiceSettings] 保存失败", error);
            Alert.alert("保存失败", "请稍后重试");
        } finally {
            setSaving(false);
        }
    };

    const isLoading = isFetching && !profile;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>服务设置</Text>
                <TouchableOpacity
                    style={styles.saveButton}
                    disabled={saving || !profile}
                    onPress={handleSave}
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#2196F3" />
                    ) : (
                        <Text style={styles.saveText}>保存</Text>
                    )}
                </TouchableOpacity>
            </View>

            <ScrollView
                style={styles.content}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 40 }}
            >
                {isLoading ? (
                    <View style={styles.loader}>
                        <ActivityIndicator size="large" color="#2196F3" />
                    </View>
                ) : (
                    <>
                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>已提供服务</Text>
                            {selectedServices.length === 0 && (
                                <Text style={styles.helperText}>
                                    暂无选择，请在下方添加至少一个服务分类
                                </Text>
                            )}
                            {selectedServices.map((service) => (
                                <View key={service.serviceId} style={styles.serviceItem}>
                                    <View style={styles.serviceHeader}>
                                        <Text style={styles.serviceName}>{service.name}</Text>
                                        <TouchableOpacity
                                            hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                            onPress={() => handleRemoveService(service.serviceId)}
                                        >
                                            <Ionicons name="trash-outline" size={18} color="#ef4444" />
                                        </TouchableOpacity>
                                    </View>
                                    {service.categoryName ? (
                                        <Text style={styles.serviceCategory}>{service.categoryName}</Text>
                                    ) : null}
                                    <View>
                                        <Text style={styles.label}>服务描述</Text>
                                        <TextInput
                                            style={[styles.descriptionInput]}
                                            multiline
                                            value={service.description}
                                            placeholder="介绍服务优势、适用场景等，帮助用户了解您的能力"
                                            onChangeText={(text) =>
                                                handleUpdateDescription(service.serviceId, text)
                                            }
                                        />
                                    </View>
                                    <View style={styles.gallerySection}>
                                        <View style={styles.galleryHeader}>
                                            <Text style={styles.subSectionTitle}>宣传图片</Text>
                                            <Text style={styles.helperText}>
                                                {`最多 5 张，已选 ${service.gallery?.length ?? 0}`}
                                            </Text>
                                        </View>
                                        <View style={styles.galleryList}>
                                            {(service.gallery ?? []).map((image) => (
                                                <View key={image.id} style={styles.galleryItem}>
                                                    <Image
                                                        source={{ uri: image.url }}
                                                        style={styles.galleryImage}
                                                        resizeMode="cover"
                                                    />
                                                    <TouchableOpacity
                                                        style={styles.removeGalleryButton}
                                                        onPress={() =>
                                                            handleRemoveGalleryImage(service.serviceId, image.id)
                                                        }
                                                    >
                                                        <Ionicons name="close" size={14} color="#fff" />
                                                    </TouchableOpacity>
                                                </View>
                                            ))}
                                            {(service.gallery?.length ?? 0) < 5 && (
                                                <TouchableOpacity
                                                    style={[
                                                        styles.galleryItem,
                                                        styles.galleryAddButton,
                                                        uploadingServiceId === service.serviceId &&
                                                        styles.galleryAddButtonDisabled,
                                                    ]}
                                                    onPress={() => handleAddGalleryImage(service.serviceId)}
                                                    disabled={uploadingServiceId === service.serviceId}
                                                >
                                                    {uploadingServiceId === service.serviceId ? (
                                                        <ActivityIndicator size="small" color="#2563eb" />
                                                    ) : (
                                                        <>
                                                            <Ionicons name="add" size={20} color="#2563eb" />
                                                            <Text style={styles.galleryAddText}>上传</Text>
                                                        </>
                                                    )}
                                                </TouchableOpacity>
                                            )}
                                        </View>
                                    </View>
                                    <View style={styles.specHeader}>
                                        <Text style={styles.subSectionTitle}>服务规格</Text>
                                        <TouchableOpacity
                                            style={styles.addSpecButton}
                                            onPress={() => handleAddSpec(service.serviceId)}
                                        >
                                            <Ionicons name="add-circle-outline" size={16} color="#2563eb" />
                                            <Text style={styles.addSpecText}>添加规格</Text>
                                        </TouchableOpacity>
                                    </View>
                                    {service.specs.map((spec, index) => (
                                        <View key={spec.localId} style={styles.specItem}>
                                            <View style={styles.specHeaderRow}>
                                                <Text style={styles.label}>规格名称</Text>
                                                {service.specs.length > 1 && (
                                                    <TouchableOpacity
                                                        style={styles.removeSpecButton}
                                                        onPress={() =>
                                                            handleRemoveSpec(service.serviceId, spec.localId)
                                                        }
                                                    >
                                                        <Ionicons name="close-circle" size={18} color="#ef4444" />
                                                    </TouchableOpacity>
                                                )}
                                            </View>
                                            <TextInput
                                                style={styles.input}
                                                value={spec.name}
                                                placeholder={`例如：${index === 0 ? "标准版" : "豪华版"}`}
                                                onChangeText={(text) =>
                                                    handleUpdateSpecField(service.serviceId, spec.localId, "name", text)
                                                }
                                            />
                                            <View style={styles.formRow}>
                                                <View style={{ flex: 1, marginRight: 8 }}>
                                                    <Text style={styles.label}>价格(¥)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={spec.price}
                                                        keyboardType="numeric"
                                                        placeholder="例如 199"
                                                        onChangeText={(text) =>
                                                            handleUpdateSpecField(
                                                                service.serviceId,
                                                                spec.localId,
                                                                "price",
                                                                text,
                                                            )
                                                        }
                                                    />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.label}>耗时(分钟)</Text>
                                                    <TextInput
                                                        style={styles.input}
                                                        value={spec.duration}
                                                        keyboardType="numeric"
                                                        placeholder="例如 60"
                                                        onChangeText={(text) =>
                                                            handleUpdateSpecField(
                                                                service.serviceId,
                                                                spec.localId,
                                                                "duration",
                                                                text,
                                                            )
                                                        }
                                                    />
                                                </View>
                                            </View>
                                        </View>
                                    ))}
                                </View>
                            ))}
                        </View>

                        <View style={styles.card}>
                            <Text style={styles.sectionTitle}>添加服务分类</Text>
                            <TextInput
                                style={styles.searchInput}
                                placeholder="搜索服务名称"
                                value={search}
                                onChangeText={setSearch}
                            />
                            {loadingOptions ? (
                                <ActivityIndicator size="small" color="#999" style={{ marginTop: 12 }} />
                            ) : serviceCategories.length === 0 ? (
                                <Text style={styles.helperText}>暂无可选服务分类</Text>
                            ) : (
                                serviceCategories.map((category) => (
                                    <View key={category.id} style={styles.categorySection}>
                                        <Text style={styles.categoryTitle}>{category.name}</Text>
                                        {category.children.length === 0 ? (
                                            <Text style={styles.helperText}>该分类下暂无具体服务</Text>
                                        ) : (
                                            category.children.map((service) => {
                                                const isSelected = selectedServices.some(
                                                    (item) => item.serviceId === service.id,
                                                );
                                                return (
                                                    <View key={service.id} style={styles.optionItem}>
                                                        <View style={{ flex: 1 }}>
                                                            <Text style={styles.optionName}>{service.name}</Text>
                                                            <Text style={styles.optionDesc} numberOfLines={2}>
                                                                {service.description ||
                                                                    category.description ||
                                                                    "暂无描述"}
                                                            </Text>
                                                        </View>
                                                        <TouchableOpacity
                                                            style={[
                                                                styles.addButton,
                                                                isSelected && styles.addButtonDisabled,
                                                            ]}
                                                            disabled={isSelected}
                                                            onPress={() => handleAddService(service, category.name)}
                                                        >
                                                            <Text
                                                                style={[
                                                                    styles.addButtonText,
                                                                    isSelected && styles.addButtonTextDisabled,
                                                                ]}
                                                            >
                                                                {isSelected ? "已添加" : "添加"}
                                                            </Text>
                                                        </TouchableOpacity>
                                                    </View>
                                                );
                                            })
                                        )}
                                    </View>
                                ))
                            )}
                        </View>
                    </>
                )}
            </ScrollView>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#f8f9fb",
    },
    header: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        paddingHorizontal: 20,
        paddingTop: 56,
        paddingBottom: 16,
        backgroundColor: "white",
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    backButton: {
        padding: 4,
    },
    title: {
        fontSize: 18,
        fontWeight: "600",
        color: "#111",
    },
    saveButton: {
        minWidth: 60,
        alignItems: "flex-end",
        padding: 4,
    },
    saveText: {
        fontSize: 16,
        fontWeight: "600",
        color: "#2196F3",
    },
    content: {
        flex: 1,
    },
    loader: {
        paddingTop: 80,
        alignItems: "center",
    },
    card: {
        backgroundColor: "white",
        marginHorizontal: 20,
        marginTop: 16,
        borderRadius: 16,
        padding: 20,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    serviceItem: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 12,
        padding: 12,
        marginTop: 12,
    },
    serviceHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    serviceName: {
        fontSize: 15,
        fontWeight: "600",
        color: "#111",
    },
    serviceCategory: {
        fontSize: 12,
        color: "#6b7280",
        marginBottom: 8,
    },
    formRow: {
        flexDirection: "row",
        alignItems: "center",
        marginBottom: 12,
    },
    descriptionInput: {
        minHeight: 72,
    },
    specHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    gallerySection: {
        marginTop: 12,
    },
    galleryHeader: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 8,
    },
    galleryList: {
        flexDirection: "row",
        flexWrap: "wrap",
    },
    galleryItem: {
        width: 76,
        height: 76,
        borderRadius: 10,
        overflow: "hidden",
        backgroundColor: "#f3f4f6",
        marginRight: 8,
        marginBottom: 8,
        position: "relative",
        alignItems: "center",
        justifyContent: "center",
        borderWidth: 1,
        borderColor: "#e5e7eb",
    },
    galleryImage: {
        width: "100%",
        height: "100%",
    },
    removeGalleryButton: {
        position: "absolute",
        top: 4,
        right: 4,
        backgroundColor: "rgba(0,0,0,0.6)",
        borderRadius: 12,
        padding: 4,
    },
    galleryAddButton: {
        borderStyle: "dashed",
        backgroundColor: "#f8fafc",
    },
    galleryAddButtonDisabled: {
        opacity: 0.6,
    },
    galleryAddText: {
        fontSize: 12,
        color: "#2563eb",
        marginTop: 4,
    },
    subSectionTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#1f2937",
    },
    addSpecButton: {
        flexDirection: "row",
        alignItems: "center",
        gap: 4,
    },
    addSpecText: {
        fontSize: 13,
        color: "#2563eb",
    },
    specItem: {
        borderWidth: 1,
        borderColor: "#e5e7eb",
        borderRadius: 10,
        padding: 12,
        marginBottom: 12,
    },
    specHeaderRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 6,
    },
    removeSpecButton: {
        padding: 4,
    },
    label: {
        fontSize: 12,
        color: "#6b7280",
        marginBottom: 4,
    },
    input: {
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
        color: "#111",
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 12,
    },
    helperText: {
        fontSize: 13,
        color: "#9ca3af",
    },
    searchInput: {
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        fontSize: 15,
        color: "#111",
        marginBottom: 12,
    },
    optionItem: {
        flexDirection: "row",
        alignItems: "center",
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#e5e7eb",
    },
    optionName: {
        fontSize: 15,
        fontWeight: "500",
        color: "#111",
        marginBottom: 4,
    },
    optionDesc: {
        fontSize: 13,
        color: "#6b7280",
    },
    categorySection: {
        marginTop: 16,
    },
    categoryTitle: {
        fontSize: 14,
        fontWeight: "600",
        color: "#0f172a",
        marginBottom: 8,
    },
    addButton: {
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#22c55e",
        paddingHorizontal: 16,
        paddingVertical: 6,
        marginLeft: 12,
    },
    addButtonDisabled: {
        borderColor: "#d1d5db",
    },
    addButtonText: {
        color: "#16a34a",
        fontWeight: "600",
    },
    addButtonTextDisabled: {
        color: "#9ca3af",
    },
});
