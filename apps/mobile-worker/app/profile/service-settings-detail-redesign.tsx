import { Ionicons } from "@expo/vector-icons";
import { useUploadFile } from "@repo/hooks/api/files";
import { useServiceListSinglePage } from "@repo/hooks/api/service";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useUpdateServiceOfferings } from "@repo/hooks/api/work-skill";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { apiClient } from "@repo/lib/http-client";
import { KeyboardAwareScrollView } from "@repo/mobile-ui/components/app/KeyboardAwareScrollView";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Textarea } from "@repo/mobile-ui/components/ui/textarea";
import type {
    FileAccessInfo,
    FileDownloadUrlResponse,
    ServiceListResponse,
    ServicePersonnelProfile,
    UpdateServiceOfferingsRequest,
} from "@repo/types";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Pressable,
    RefreshControl,
    ScrollView,
    Switch,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { ChevronLeft } from "lucide-react-native";

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
    blurhash?: string;
};

type EditableService = {
    serviceId: string;
    name: string;
    categoryId?: string;
    categoryName?: string;
    serviceDescription?: string | null;
    description: string;
    isActive: boolean;
    specs: EditableSpecification[];
    gallery: EditableImage[];
};

type SpecSheetDraft = {
    mode: "create" | "edit";
    originalLocalId?: string;
    spec: EditableSpecification;
    isDefault: boolean;
};

type ServiceFormValues = {
    description: string;
    specs: EditableSpecification[];
    hasQualification: boolean;
};

type SpecSheetFormValues = {
    name: string;
    price: string;
    duration: string;
    isDefault: boolean;
};

type QualificationUploadKey = "merchant" | "vocational";
type ServiceOffering = ServicePersonnelProfile["services"][number];
type ServiceOption = ServiceListResponse["items"][number]["children"][number];
type PayloadService = UpdateServiceOfferingsRequest["services"][number];

const DESCRIPTION_LIMIT = 120;
const MASSAGE_KEYWORD = "按摩";
const PRICE_PATTERN = /^\d+(\.\d{1,2})?$/;
const SPEC_TEMPLATES = [
    { name: "体验版", price: "99", duration: "30" },
    { name: "标准版", price: "199", duration: "60" },
    { name: "尊享版", price: "299", duration: "90" },
];
const DEFAULT_SERVICE_FORM_VALUES: ServiceFormValues = {
    description: "",
    specs: [],
    hasQualification: false,
};

export default function ServiceSettingsDetailRedesignScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        serviceId?: string | string[];
        categoryId?: string | string[];
        categoryName?: string | string[];
        serviceName?: string | string[];
        serviceDescription?: string | string[];
    }>();
    const serviceId = getParamValue(params.serviceId);
    const routeCategoryId = getParamValue(params.categoryId);
    const routeCategoryName = getParamValue(params.categoryName);
    const routeServiceName = getParamValue(params.serviceName);
    const routeServiceDescription = getParamValue(params.serviceDescription);
    const { session } = useSession();
    const userId = session?.user?.id;
    const specIdRef = useRef(0);
    const [editableService, setEditableService] = useState<EditableService | null>(
        null,
    );
    const [loadedServiceId, setLoadedServiceId] = useState<string | null>(null);
    const [merchantQualification, setMerchantQualification] =
        useState<EditableImage | null>(null);
    const [vocationalQualification, setVocationalQualification] =
        useState<EditableImage | null>(null);
    const [uploadingServiceImage, setUploadingServiceImage] = useState(false);
    const [uploadingQualificationKey, setUploadingQualificationKey] =
        useState<QualificationUploadKey | null>(null);
    const [saving, setSaving] = useState(false);
    const [specSheetDraft, setSpecSheetDraft] = useState<SpecSheetDraft | null>(
        null,
    );
    const {
        control: serviceFormControl,
        clearErrors: clearServiceFormErrors,
        formState: { errors: serviceFormErrors },
        handleSubmit: handleServiceFormSubmit,
        register: registerServiceFormField,
        reset: resetServiceForm,
        setError: setServiceFormError,
        setValue: setServiceFormValue,
        watch: watchServiceForm,
    } = useForm<ServiceFormValues>({
        defaultValues: DEFAULT_SERVICE_FORM_VALUES,
    });

    const {
        data: profile,
        isFetching: isFetchingProfile,
        refetch: refetchProfile,
    } = useServicePersonnelProfile(userId);
    const updateOfferings = useUpdateServiceOfferings();
    const uploadFile = useUploadFile();

    const {
        data: serviceListResponse,
        isFetching: isFetchingCategories,
        refetch: refetchServiceCategories,
    } = useServiceListSinglePage({
        limit: 1000,
    });
    const serviceCategories = serviceListResponse?.items ?? [];

    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                userId ? refetchProfile() : Promise.resolve(),
                refetchServiceCategories({ throwOnError: false }),
            ]),
    });

    const selectedOffering = useMemo(() => {
        if (!serviceId) {
            return undefined;
        }
        return profile?.services.find((service) => service.serviceId === serviceId);
    }, [profile?.services, serviceId]);

    const selectedOption = useMemo(() => {
        if (!serviceId) {
            return null;
        }
        for (const category of serviceCategories) {
            const service = category.children.find((item) => item.id === serviceId);
            if (service) {
                return {
                    service,
                    categoryId: category.id,
                    categoryName: category.name,
                };
            }
        }
        return null;
    }, [serviceCategories, serviceId]);

    const buildSpec = useCallback((initial?: Partial<EditableSpecification>) => {
        return {
            id: initial?.id,
            localId: initial?.localId ?? `spec-${specIdRef.current++}`,
            name: initial?.name ?? "",
            price: initial?.price ?? "",
            duration: initial?.duration ?? "",
            currency: initial?.currency ?? "CNY",
        };
    }, []);

    const serviceDescription = watchServiceForm("description") ?? "";

    useEffect(() => {
        registerServiceFormField("specs", {
            validate: (value) =>
                validateServiceSpecifications(value, editableService?.name),
        });
        registerServiceFormField("hasQualification", {
            validate: (value) =>
                !isMassageCategory(editableService) || value
                    ? true
                    : "上门按摩服务需至少上传一种资质证书",
        });
    }, [editableService, editableService?.name, registerServiceFormField]);

    useEffect(() => {
        const hasQualification = Boolean(
            merchantQualification || vocationalQualification,
        );
        setServiceFormValue("hasQualification", hasQualification, {
            shouldValidate: isMassageCategory(editableService),
        });
    }, [
        editableService,
        merchantQualification,
        setServiceFormValue,
        vocationalQualification,
    ]);

    useEffect(() => {
        setLoadedServiceId(null);
        setEditableService(null);
        setSpecSheetDraft(null);
        resetServiceForm(DEFAULT_SERVICE_FORM_VALUES);
    }, [resetServiceForm, serviceId]);

    useEffect(() => {
        if (!profile) {
            return;
        }
        setMerchantQualification(mapEditableImage(profile.merchantQualificationImage));
        setVocationalQualification(
            mapEditableImage(profile.vocationalQualificationImage),
        );
    }, [profile]);

    useEffect(() => {
        if (!serviceId || loadedServiceId === serviceId) {
            return;
        }

        if (selectedOffering) {
            const mapped = mapOfferingToEditableService(selectedOffering, buildSpec);
            setEditableService(mapped);
            resetServiceForm({
                description: mapped.description,
                specs: mapped.specs,
                hasQualification: Boolean(
                    merchantQualification || vocationalQualification,
                ),
            });
            setLoadedServiceId(serviceId);
            return;
        }

        if (selectedOption) {
            const mapped = mapOptionToEditableService({
                service: selectedOption.service,
                categoryId: selectedOption.categoryId,
                categoryName: selectedOption.categoryName,
                buildSpec,
            });
            setEditableService(mapped);
            resetServiceForm({
                description: mapped.description,
                specs: mapped.specs,
                hasQualification: Boolean(
                    merchantQualification || vocationalQualification,
                ),
            });
            setLoadedServiceId(serviceId);
            return;
        }

        if (routeServiceName) {
            const mapped = mapRouteFallbackToEditableService({
                serviceId,
                serviceName: routeServiceName,
                serviceDescription: routeServiceDescription,
                categoryId: routeCategoryId,
                categoryName: routeCategoryName,
                buildSpec,
            });
            setEditableService(mapped);
            resetServiceForm({
                description: mapped.description,
                specs: mapped.specs,
                hasQualification: Boolean(
                    merchantQualification || vocationalQualification,
                ),
            });
            setLoadedServiceId(serviceId);
        }
    }, [
        buildSpec,
        loadedServiceId,
        resetServiceForm,
        routeCategoryId,
        routeCategoryName,
        merchantQualification,
        routeServiceDescription,
        routeServiceName,
        selectedOffering,
        selectedOption,
        serviceId,
        vocationalQualification,
    ]);

    const fetchFileUrl = useCallback(async (fileIdentifier: string) => {
        const response = await apiClient.get<FileDownloadUrlResponse>(
            `/files/${fileIdentifier}`,
        );
        return response.data.fileUrl;
    }, []);

    const addSpec = useCallback(() => {
        setSpecSheetDraft({
            mode: "create",
            spec: buildSpec(),
            isDefault: editableService?.specs.length === 0,
        });
    }, [buildSpec, editableService?.specs.length]);

    const editSpec = useCallback(
        (spec: EditableSpecification, index: number) => {
            setSpecSheetDraft({
                mode: "edit",
                originalLocalId: spec.localId,
                spec: { ...spec },
                isDefault: index === 0,
            });
        },
        [],
    );

    const saveSpecSheet = useCallback(
        (formValues: SpecSheetFormValues) => {
            if (!specSheetDraft || !editableService) {
                return;
            }

            const nextSpec = {
                ...specSheetDraft.spec,
                ...normalizeSpecificationInput(formValues),
            };
            const specsWithoutCurrent = editableService.specs.filter(
                (spec) => spec.localId !== specSheetDraft.originalLocalId,
            );
            const nextSpecs = specSheetDraft.isDefault
                ? [nextSpec, ...specsWithoutCurrent]
                : specSheetDraft.mode === "edit"
                    ? insertSpecAtOriginalPosition({
                        specs: specsWithoutCurrent,
                        nextSpec,
                        originalSpecs: editableService.specs,
                        originalLocalId: specSheetDraft.originalLocalId,
                    })
                    : [...specsWithoutCurrent, nextSpec];

            setEditableService({
                ...editableService,
                specs: nextSpecs,
            });
            setServiceFormValue("specs", nextSpecs, {
                shouldDirty: true,
                shouldValidate: true,
            });
            setSpecSheetDraft(null);
        },
        [editableService, setServiceFormValue, specSheetDraft],
    );

    const removeSpec = useCallback(
        (localId: string) => {
            if (!editableService) {
                return;
            }
            if (editableService.specs.length === 1) {
                Alert.alert("提示", "每个服务至少保留一个规格");
                return;
            }

            const nextSpecs = editableService.specs.filter(
                (spec) => spec.localId !== localId,
            );

            setEditableService({
                ...editableService,
                specs: nextSpecs,
            });
            setServiceFormValue("specs", nextSpecs, {
                shouldDirty: true,
                shouldValidate: true,
            });
            setSpecSheetDraft((current) =>
                current?.originalLocalId === localId ? null : current,
            );
        },
        [editableService, setServiceFormValue],
    );

    const addGalleryImage = useCallback(async () => {
        if (!editableService) {
            return;
        }
        if (editableService.gallery.length >= 5) {
            Alert.alert("提示", "最多上传 5 张宣传图片");
            return;
        }

        const asset = await pickImageAsset();
        if (!asset) {
            return;
        }

        setUploadingServiceImage(true);
        try {
            const response = await uploadFile.mutateAsync({
                file: {
                    uri: asset.uri,
                    name: asset.fileName ?? `service_${Date.now()}.jpg`,
                    type: asset.mimeType ?? "image/jpeg",
                },
            });
            const accessibleUrl = await fetchAccessibleFileUrl({
                fileId: response.id,
                fallbackUrl: asset.uri,
                fetchFileUrl,
            });
            setEditableService((current) => {
                if (!current) {
                    return current;
                }
                return {
                    ...current,
                    gallery: [
                        ...current.gallery,
                        { id: response.id, url: accessibleUrl },
                    ].slice(0, 5),
                };
            });
        } catch (error) {
            console.error("[ServiceSettingsDetail] 图片上传失败", error);
            Alert.alert("上传失败", "请稍后重试");
        } finally {
            setUploadingServiceImage(false);
        }
    }, [editableService, fetchFileUrl, uploadFile]);

    const removeGalleryImage = useCallback((imageId: string) => {
        setEditableService((current) => {
            if (!current) {
                return current;
            }
            return {
                ...current,
                gallery: current.gallery.filter((image) => image.id !== imageId),
            };
        });
    }, []);

    const uploadQualification = useCallback(
        async (key: QualificationUploadKey) => {
            const asset = await pickImageAsset();
            if (!asset) {
                return;
            }

            setUploadingQualificationKey(key);
            try {
                const response = await uploadFile.mutateAsync({
                    file: {
                        uri: asset.uri,
                        name:
                            asset.fileName ??
                            `${key}_qualification_${Date.now()}.jpg`,
                        type: asset.mimeType ?? "image/jpeg",
                    },
                });
                const accessibleUrl = await fetchAccessibleFileUrl({
                    fileId: response.id,
                    fallbackUrl: asset.uri,
                    fetchFileUrl,
                });
                const nextImage = { id: response.id, url: accessibleUrl };
                if (key === "merchant") {
                    setMerchantQualification(nextImage);
                    return;
                }
                setVocationalQualification(nextImage);
            } catch (error) {
                console.error("[ServiceSettingsDetail] 资质图片上传失败", error);
                Alert.alert("上传失败", "请稍后重试");
            } finally {
                setUploadingQualificationKey(null);
            }
        },
        [fetchFileUrl, uploadFile],
    );

    const submitServiceForm = useCallback(
        async (formValues: ServiceFormValues) => {
            if (!userId || !profile || !editableService) {
                Alert.alert("提示", "服务数据尚未加载完成");
                return;
            }

            clearServiceFormErrors("root");

            const nextEditableService = {
                ...editableService,
                description: formValues.description,
                specs: formValues.specs,
            };

            const existingValidation = validateExistingProfileServices({
                profile,
                editedServiceId: nextEditableService.serviceId,
            });
            if (!existingValidation.valid) {
                setServiceFormError("root", {
                    type: "manual",
                    message: existingValidation.message,
                });
                return;
            }

            const payloadServices = buildPayloadServices({
                profile,
                editableService: nextEditableService,
            });

            setSaving(true);
            try {
                await updateOfferings.mutateAsync({
                    services: payloadServices,
                    merchantQualificationFileId: merchantQualification?.id ?? null,
                    vocationalQualificationFileId: vocationalQualification?.id ?? null,
                });
                await refetchProfile();
                Alert.alert("提交成功", "已提交审核，等待管理员审核", [
                    { text: "好的", onPress: () => router.back() },
                ]);
            } catch (error) {
                console.error("[ServiceSettingsDetail] 保存失败", error);
                Alert.alert("保存失败", "请稍后重试");
            } finally {
                setSaving(false);
            }
        },
        [
            editableService,
            merchantQualification,
            profile,
            refetchProfile,
            router,
            clearServiceFormErrors,
            setServiceFormError,
            updateOfferings,
            userId,
            vocationalQualification,
        ],
    );

    const saveService = useCallback(() => {
        if (!editableService) {
            Alert.alert("提示", "服务数据尚未加载完成");
            return;
        }

        setServiceFormValue("specs", editableService.specs, {
            shouldTouch: true,
            shouldValidate: true,
        });
        setServiceFormValue(
            "hasQualification",
            Boolean(merchantQualification || vocationalQualification),
            {
                shouldTouch: true,
                shouldValidate: true,
            },
        );
        clearServiceFormErrors("root");
        void handleServiceFormSubmit(submitServiceForm)();
    }, [
        editableService,
        handleServiceFormSubmit,
        merchantQualification,
        clearServiceFormErrors,
        setServiceFormValue,
        submitServiceForm,
        vocationalQualification,
    ]);

    const deleteService = useCallback(() => {
        if (!profile || !serviceId || !selectedOffering) {
            router.back();
            return;
        }
        if (profile.services.length <= 1) {
            Alert.alert("提示", "请至少保留一个服务");
            return;
        }
        Alert.alert("删除服务", "删除后该服务将不再展示，是否继续？", [
            { text: "取消", style: "cancel" },
            {
                text: "删除",
                style: "destructive",
                onPress: () => {
                    void submitDeleteService({
                        profile,
                        serviceId,
                        merchantQualification,
                        vocationalQualification,
                        updateOfferings,
                        refetchProfile,
                        routerBack: () => router.back(),
                        setSaving,
                    });
                },
            },
        ]);
    }, [
        merchantQualification,
        profile,
        refetchProfile,
        router,
        selectedOffering,
        serviceId,
        updateOfferings,
        vocationalQualification,
    ]);

    const isLoading =
        (isFetchingProfile && !profile) ||
        (isFetchingCategories && !editableService && !selectedOffering);
    const categoryLine = buildCategoryLine(editableService);
    const shouldShowQualificationEntry = isMassageCategory(editableService);

    return (
        <SafeAreaView className="flex-1 bg-[#F5F6F8]" edges={["top", "bottom"]}>
            <View className="flex-row items-center px-5 pb-4 pt-2">
                <Pressable hitSlop={16} className="p-2" onPress={() => router.back()}>
                    <Icon as={ChevronLeft} className="text-[28px] text-black" />
                </Pressable>
                <Text className="flex-1 text-center text-[17px] leading-[26px] text-black">
                    编辑服务
                </Text>
                <Pressable
                    className="flex-row items-center gap-1 rounded-full border border-[#D7E4FF] px-3 py-2"
                    onPress={deleteService}
                    style={{ backgroundColor: "#F5F6F8" }}
                >
                    <Ionicons name="trash-outline" size={11} color="#FF5252" />
                    <Text className="text-xs leading-[18px] text-[#FF5252]">删除</Text>
                </Pressable>
            </View>

            <ScrollView
                className="flex-1"
                contentContainerClassName="gap-3 px-4 pb-4"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#2B6EF5"
                    />
                }
            >
                {isLoading ? (
                    <View className="items-center justify-center py-16">
                        <ActivityIndicator size="large" color="#2B6EF5" />
                    </View>
                ) : editableService ? (
                    <>
                        <View className="rounded-2xl bg-white p-4">
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 gap-1">
                                    <Text className="text-[13px] leading-5 text-[#6A7282]">
                                        服务名称
                                    </Text>
                                    <Text className="text-[17px] leading-[26px] text-black">
                                        {editableService.name}
                                    </Text>
                                    <Text className="pt-1 text-xs leading-[18px] text-[#99A1AF]">
                                        {categoryLine}
                                    </Text>
                                </View>
                                <Text className="text-lg leading-[27px] text-[#99A1AF]">›</Text>
                            </View>
                        </View>

                        {shouldShowQualificationEntry ? (
                            <View
                                className="gap-3 rounded-2xl border bg-white p-4"
                                style={{
                                    borderColor: serviceFormErrors.hasQualification
                                        ? "#FF5252"
                                        : "#FFFFFF",
                                }}
                            >
                                <View className="flex-row items-center gap-1">
                                    <Text
                                        className="text-sm leading-[21px]"
                                        style={{
                                            color: serviceFormErrors.hasQualification
                                                ? "#FF5252"
                                                : "#000000",
                                        }}
                                    >
                                        资质证书
                                    </Text>
                                    <View className="h-4 w-4 items-center justify-center rounded-full border border-[#D1D5DC]">
                                        <Text className="text-[10px] leading-[15px] text-[#99A1AF]">
                                            ?
                                        </Text>
                                    </View>
                                </View>
                                <QualificationCard
                                    title="商家资质"
                                    actionText="上传商家资质图片"
                                    image={merchantQualification}
                                    uploading={uploadingQualificationKey === "merchant"}
                                    onUpload={() => uploadQualification("merchant")}
                                    onRemove={() => setMerchantQualification(null)}
                                />
                                <QualificationCard
                                    title="从业资格证书"
                                    actionText="上传从业资格证书"
                                    image={vocationalQualification}
                                    uploading={uploadingQualificationKey === "vocational"}
                                    onUpload={() => uploadQualification("vocational")}
                                    onRemove={() => setVocationalQualification(null)}
                                />
                                {serviceFormErrors.hasQualification?.message ? (
                                    <Text className="text-xs leading-[18px] text-[#FF5252]">
                                        {serviceFormErrors.hasQualification.message}
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}

                        <View className="gap-2 rounded-2xl bg-white p-4">
                            <Text className="text-sm leading-[21px] text-black">服务简介</Text>
                            <Controller
                                control={serviceFormControl}
                                name="description"
                                render={({ field }) => (
                                    <Textarea
                                        className="min-h-[74px] border-0 bg-transparent px-0 py-0 text-[13px] leading-5 shadow-none"
                                        placeholder="介绍服务特色、适用场景与服务边界"
                                        placeholderTextColor="#99A1AF"
                                        maxLength={DESCRIPTION_LIMIT}
                                        value={field.value}
                                        onBlur={field.onBlur}
                                        onChangeText={field.onChange}
                                    />
                                )}
                            />
                            <Text className="self-end text-[11px] leading-[17px] text-[#99A1AF]">
                                {serviceDescription.length}/{DESCRIPTION_LIMIT}
                            </Text>
                        </View>

                        <View className="gap-3 rounded-2xl bg-white p-4">
                            <Text className="text-sm leading-[21px] text-black">服务图片</Text>
                            <View className="flex-row flex-wrap gap-3">
                                {editableService.gallery.map((image) => (
                                    <View
                                        key={image.id}
                                        className="h-16 w-16 overflow-hidden rounded-[14px] bg-[#F5F6F8]"
                                    >
                                        <Image
                                            source={{ uri: image.url }}
                                            placeholder={
                                                image.blurhash
                                                    ? { blurhash: image.blurhash }
                                                    : undefined
                                            }
                                            contentFit="cover"
                                            className="h-full w-full"
                                        />
                                        <Pressable
                                            className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full"
                                            style={{ backgroundColor: "rgba(0,0,0,0.6)" }}
                                            onPress={() => removeGalleryImage(image.id)}
                                        >
                                            <Ionicons name="close" size={12} color="#FFFFFF" />
                                        </Pressable>
                                    </View>
                                ))}
                                {editableService.gallery.length < 5 ? (
                                    <Pressable
                                        className="h-16 w-16 items-center justify-center rounded-[14px] border border-dashed border-[#D1D5DC] bg-[#F5F6F8]"
                                        onPress={addGalleryImage}
                                        disabled={uploadingServiceImage}
                                        style={
                                            uploadingServiceImage
                                                ? { backgroundColor: "#EEF1F5" }
                                                : undefined
                                        }
                                    >
                                        {uploadingServiceImage ? (
                                            <ActivityIndicator size="small" color="#2B6EF5" />
                                        ) : (
                                            <Text className="text-2xl leading-9 text-[#99A1AF]">+</Text>
                                        )}
                                    </Pressable>
                                ) : null}
                            </View>
                        </View>

                        <View
                            className="gap-3 rounded-2xl border bg-white p-4"
                            style={{
                                borderColor: serviceFormErrors.specs
                                    ? "#FF5252"
                                    : "#FFFFFF",
                            }}
                        >
                            <View className="flex-row items-center justify-between">
                                <Text
                                    className="text-sm leading-[21px]"
                                    style={{
                                        color: serviceFormErrors.specs
                                            ? "#FF5252"
                                            : "#000000",
                                    }}
                                >
                                    服务规格
                                </Text>
                                <Text className="text-[11px] leading-[17px] text-[#99A1AF]">
                                    {editableService.specs.length} 个规格
                                </Text>
                            </View>
                            <View className="gap-2.5">
                                {editableService.specs.map((spec, index) => (
                                    <SpecificationCard
                                        key={spec.localId}
                                        spec={spec}
                                        index={index}
                                        onEdit={() => editSpec(spec, index)}
                                        onRemove={() => removeSpec(spec.localId)}
                                    />
                                ))}
                            </View>
                            <Pressable
                                className="items-center justify-center rounded-[14px] border border-dashed border-[#2B6EF5] bg-[#F4F8FF] py-3"
                                onPress={addSpec}
                            >
                                <Text className="text-[13px] leading-5 text-[#2B6EF5]">
                                    + 添加规格
                                </Text>
                            </Pressable>
                            {serviceFormErrors.specs?.message ? (
                                <Text className="text-xs leading-[18px] text-[#FF5252]">
                                    {serviceFormErrors.specs.message}
                                </Text>
                            ) : null}
                        </View>
                    </>
                ) : (
                    <View className="items-center rounded-2xl bg-white px-5 py-10">
                        <View className="h-12 w-12 items-center justify-center rounded-2xl bg-[#EEF1F5]">
                            <Ionicons name="briefcase-outline" size={24} color="#99A1AF" />
                        </View>
                        <Text className="mt-3 text-[15px] leading-[23px] text-black">
                            未找到服务数据
                        </Text>
                        <Text className="mt-1 text-center text-xs leading-[18px] text-[#6A7282]">
                            请返回服务列表重新选择
                        </Text>
                    </View>
                )}
            </ScrollView>

            <View className="border-t border-[#F3F4F6] bg-white px-4 pb-6 pt-4">
                {serviceFormErrors.root?.message ? (
                    <Text className="mb-3 text-xs leading-[18px] text-[#FF5252]">
                        {serviceFormErrors.root.message}
                    </Text>
                ) : null}
                <Pressable
                    className="items-center rounded-full bg-[#2B6EF5] py-3.5"
                    onPress={saveService}
                    disabled={!editableService || saving}
                    style={
                        !editableService || saving
                            ? { backgroundColor: "#99A1AF" }
                            : undefined
                    }
                >
                    {saving ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                        <Text className="text-sm leading-[21px] text-white">提交审核</Text>
                    )}
                </Pressable>
            </View>

            <SpecificationEditSheet
                draft={specSheetDraft}
                onClose={() => setSpecSheetDraft(null)}
                onSave={saveSpecSheet}
            />
        </SafeAreaView>
    );
}

function QualificationCard(props: {
    title: string;
    actionText: string;
    image: EditableImage | null;
    uploading: boolean;
    onUpload: () => void;
    onRemove: () => void;
}) {
    return (
        <View className="gap-1 rounded-[14px] bg-[#F5F6F8] p-4">
            <View className="flex-row items-center justify-between">
                <Text className="text-[13px] leading-5 text-black">{props.title}</Text>
                {props.image ? (
                    <Pressable hitSlop={8} onPress={props.onRemove}>
                        <Text className="text-xs leading-[18px] text-[#FF5252]">删除</Text>
                    </Pressable>
                ) : null}
            </View>
            {props.image ? (
                <Pressable
                    className="mt-2 h-[98px] overflow-hidden rounded-xl bg-white"
                    onPress={props.onUpload}
                    disabled={props.uploading}
                >
                    <Image
                        source={{ uri: props.image.url }}
                        placeholder={
                            props.image.blurhash
                                ? { blurhash: props.image.blurhash }
                                : undefined
                        }
                        contentFit="cover"
                        className="h-full w-full"
                    />
                    {props.uploading ? (
                        <View
                            className="absolute inset-0 items-center justify-center"
                            style={{ backgroundColor: "rgba(0,0,0,0.35)" }}
                        >
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        </View>
                    ) : null}
                </Pressable>
            ) : (
                <Pressable
                    className="items-center justify-center pb-3 pt-5"
                    onPress={props.onUpload}
                    disabled={props.uploading}
                >
                    {props.uploading ? (
                        <ActivityIndicator size="small" color="#2B6EF5" />
                    ) : (
                        <View className="flex-row items-center gap-2">
                            <Ionicons name="image-outline" size={16} color="#2B6EF5" />
                            <Text className="text-[13px] leading-5 text-[#2B6EF5]">
                                {props.actionText}
                            </Text>
                        </View>
                    )}
                </Pressable>
            )}
            <Text className="text-center text-[11px] leading-[17px] text-[#99A1AF]">
                支持 JPG/PNG，大小不超过 5MB
            </Text>
        </View>
    );
}

function SpecificationCard(props: {
    spec: EditableSpecification;
    index: number;
    onEdit: () => void;
    onRemove: () => void;
}) {
    return (
        <View className="gap-1 rounded-[14px] border border-[#F3F4F6] bg-[#F4F8FF] p-[13px]">
            <View className="flex-row items-center justify-between">
                <View className="flex-row items-center gap-2">
                    <Text className="text-sm leading-[21px] text-black">
                        {props.spec.name.trim() || `规格 ${props.index + 1}`}
                    </Text>
                    {props.index === 0 ? (
                        <View className="rounded bg-[#EEF1F5] px-1.5 py-0.5">
                            <Text className="text-[10px] leading-[15px] text-[#2B6EF5]">默认</Text>
                        </View>
                    ) : null}
                </View>
                <View className="flex-row items-center gap-3">
                    <Pressable hitSlop={8} onPress={props.onEdit}>
                        <Text className="text-xs leading-[18px] text-[#2B6EF5]">
                            编辑
                        </Text>
                    </Pressable>
                    <Pressable hitSlop={8} onPress={props.onRemove}>
                        <Text className="text-xs leading-[18px] text-[#FF5252]">删除</Text>
                    </Pressable>
                </View>
            </View>
            <View className="flex-row items-center gap-2 pt-0.5">
                <Text className="text-base leading-6 text-[#2B6EF5]">
                    ¥{props.spec.price.trim() || "0"}
                </Text>
                <Text className="text-base leading-6 text-[#D1D5DC]">·</Text>
                <Text className="text-xs leading-[18px] text-[#4A5565]">
                    {props.spec.duration.trim() || "0"} 分钟
                </Text>
            </View>
            <Text className="text-xs leading-[18px] text-[#6A7282]">
                点击编辑可在弹层中修改名称、价格和服务时长
            </Text>
        </View>
    );
}

function SpecificationEditSheet(props: {
    draft: SpecSheetDraft | null;
    onClose: () => void;
    onSave: (values: SpecSheetFormValues) => void;
}) {
    const title = props.draft?.mode === "edit" ? "修改规格" : "添加规格";
    const { control, handleSubmit, reset, setValue, watch } = useForm<
        SpecSheetFormValues
    >({
        defaultValues: {
            name: "",
            price: "",
            duration: "",
            isDefault: false,
        },
    });
    const isDefault = watch("isDefault") ?? false;

    useEffect(() => {
        reset({
            name: props.draft?.spec.name ?? "",
            price: props.draft?.spec.price ?? "",
            duration: props.draft?.spec.duration ?? "",
            isDefault: props.draft?.isDefault ?? false,
        });
    }, [props.draft, reset]);

    return (
        <BottomSheetModal
            visible={Boolean(props.draft)}
            onClose={props.onClose}
            initialHeightRatio={0.72}
            minHeightRatio={0.55}
            maxHeightRatio={0.9}
            backdropClassName="bg-black/40"
            sheetClassName="rounded-t-[28px] bg-white"
        >
            <View className="flex-1">
                <View className="flex-row items-center justify-between px-4 pb-3">
                    <Pressable hitSlop={10} onPress={props.onClose}>
                        <Text className="text-sm leading-5 text-[#6A7282]">取消</Text>
                    </Pressable>
                    <Text className="text-base font-semibold leading-6 text-black">
                        {title}
                    </Text>
                    <Pressable
                        hitSlop={10}
                        onPress={() => void handleSubmit(props.onSave)()}
                    >
                        <Text className="text-sm font-medium leading-5 text-[#2B6EF5]">
                            保存
                        </Text>
                    </Pressable>
                </View>

                <KeyboardAwareScrollView
                    className="flex-1"
                    contentContainerClassName="gap-3 px-4 pb-6"
                    showsVerticalScrollIndicator={false}
                    nestedScrollEnabled
                >
                    <View className="gap-2">
                        <Text className="text-xs leading-[18px] text-[#6A7282]">
                            快速模板
                        </Text>
                        <View className="flex-row flex-wrap gap-2">
                            {SPEC_TEMPLATES.map((template) => (
                                <Pressable
                                    key={template.name}
                                    className="rounded-full border border-[#B8D1FF] bg-[#F4F8FF] px-3 py-1.5"
                                    onPress={() => {
                                        setValue("name", template.name, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        });
                                        setValue("price", template.price, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        });
                                        setValue("duration", template.duration, {
                                            shouldDirty: true,
                                            shouldValidate: true,
                                        });
                                    }}
                                >
                                    <Text className="text-xs leading-[18px] text-[#2B6EF5]">
                                        {template.name} ¥{template.price} · {template.duration}分钟
                                    </Text>
                                </Pressable>
                            ))}
                        </View>
                    </View>

                    <View className="gap-1.5">
                        <Controller
                            control={control}
                            name="name"
                            rules={{
                                validate: (value) => validateSpecificationName(value) ?? true,
                            }}
                            render={({ field, fieldState }) => (
                                <>
                                    <Text
                                        className="text-xs leading-[18px]"
                                        style={{
                                            color: fieldState.error
                                                ? "#FF5252"
                                                : "#6A7282",
                                        }}
                                    >
                                        规格名称
                                    </Text>
                                    <Input
                                        className="h-[45px] rounded-[14px] bg-[#F5F6F8] px-3 text-sm leading-[21px] shadow-none"
                                        placeholder="如：标准版、尊享版"
                                        placeholderTextColor="#99A1AF"
                                        value={field.value}
                                        onBlur={field.onBlur}
                                        onChangeText={field.onChange}
                                        style={{
                                            borderColor: fieldState.error
                                                ? "#FF5252"
                                                : "#F5F6F8",
                                        }}
                                    />
                                    {fieldState.error?.message ? (
                                        <Text className="text-xs leading-[18px] text-[#FF5252]">
                                            {fieldState.error.message}
                                        </Text>
                                    ) : null}
                                </>
                            )}
                        />
                    </View>

                    <View className="flex-row gap-3">
                        <View className="flex-1 gap-1.5">
                            <Controller
                                control={control}
                                name="price"
                                rules={{
                                    validate: (value) =>
                                        validateSpecificationPrice(value) ?? true,
                                }}
                                render={({ field, fieldState }) => (
                                    <>
                                        <Text
                                            className="text-xs leading-[18px]"
                                            style={{
                                                color: fieldState.error
                                                    ? "#FF5252"
                                                    : "#6A7282",
                                            }}
                                        >
                                            价格
                                        </Text>
                                        <View
                                            className="h-[45px] flex-row items-center rounded-[14px] border bg-[#F5F6F8] px-3"
                                            style={{
                                                borderColor: fieldState.error
                                                    ? "#FF5252"
                                                    : "#F5F6F8",
                                            }}
                                        >
                                            <Text className="pr-1 text-sm leading-[21px] text-[#99A1AF]">
                                                ¥
                                            </Text>
                                            <Input
                                                className="h-full flex-1 border-0 bg-transparent px-0 text-sm leading-[21px] shadow-none"
                                                placeholder="0"
                                                placeholderTextColor="#99A1AF"
                                                keyboardType="decimal-pad"
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChangeText={field.onChange}
                                            />
                                        </View>
                                        {fieldState.error?.message ? (
                                            <Text className="text-xs leading-[18px] text-[#FF5252]">
                                                {fieldState.error.message}
                                            </Text>
                                        ) : null}
                                    </>
                                )}
                            />
                        </View>
                        <View className="flex-1 gap-1.5">
                            <Controller
                                control={control}
                                name="duration"
                                rules={{
                                    validate: (value) =>
                                        validateSpecificationDuration(value) ?? true,
                                }}
                                render={({ field, fieldState }) => (
                                    <>
                                        <Text
                                            className="text-xs leading-[18px]"
                                            style={{
                                                color: fieldState.error
                                                    ? "#FF5252"
                                                    : "#6A7282",
                                            }}
                                        >
                                            时长
                                        </Text>
                                        <View
                                            className="h-[45px] flex-row items-center rounded-[14px] border bg-[#F5F6F8] px-3"
                                            style={{
                                                borderColor: fieldState.error
                                                    ? "#FF5252"
                                                    : "#F5F6F8",
                                            }}
                                        >
                                            <Input
                                                className="h-full flex-1 border-0 bg-transparent px-0 text-sm leading-[21px] shadow-none"
                                                placeholder="0"
                                                placeholderTextColor="#99A1AF"
                                                keyboardType="number-pad"
                                                value={field.value}
                                                onBlur={field.onBlur}
                                                onChangeText={field.onChange}
                                            />
                                            <Text className="pl-1 text-sm leading-[21px] text-[#99A1AF]">
                                                分钟
                                            </Text>
                                        </View>
                                        {fieldState.error?.message ? (
                                            <Text className="text-xs leading-[18px] text-[#FF5252]">
                                                {fieldState.error.message}
                                            </Text>
                                        ) : null}
                                    </>
                                )}
                            />
                        </View>
                    </View>

                    <View className="gap-1.5">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-xs leading-[18px] text-[#6A7282]">
                                规格说明
                            </Text>
                            <Text className="text-[11px] leading-[17px] text-[#99A1AF]">
                                0/60
                            </Text>
                        </View>
                        <View className="min-h-[58px] justify-center rounded-[14px] bg-[#F5F6F8] px-3 py-2">
                            <Text className="text-sm leading-5 text-[#99A1AF]">
                                当前接口暂未保存规格说明，请在服务简介中补充服务范围
                            </Text>
                        </View>
                    </View>

                    <Pressable
                        className="flex-row items-center justify-between rounded-[14px] bg-[#F5F6F8] px-3.5 py-3"
                        onPress={() =>
                            setValue("isDefault", !isDefault, {
                                shouldDirty: true,
                            })
                        }
                    >
                        <View className="gap-0.5">
                            <Text className="text-sm font-medium leading-5 text-black">
                                设为默认规格
                            </Text>
                            <Text className="text-[11px] leading-[17px] text-[#99A1AF]">
                                列表中将优先展示给用户
                            </Text>
                        </View>
                        <Controller
                            control={control}
                            name="isDefault"
                            render={({ field }) => (
                                <Switch
                                    value={field.value}
                                    onValueChange={field.onChange}
                                    trackColor={{ false: "#D1D5DC", true: "#B8D1FF" }}
                                    thumbColor="#FFFFFF"
                                />
                            )}
                        />
                    </Pressable>
                </KeyboardAwareScrollView>
            </View>
        </BottomSheetModal>
    );
}

function insertSpecAtOriginalPosition(input: {
    specs: EditableSpecification[];
    nextSpec: EditableSpecification;
    originalSpecs: EditableSpecification[];
    originalLocalId?: string;
}) {
    const originalIndex = input.originalSpecs.findIndex(
        (spec) => spec.localId === input.originalLocalId,
    );
    if (originalIndex < 0 || originalIndex >= input.specs.length) {
        return [...input.specs, input.nextSpec];
    }
    return [
        ...input.specs.slice(0, originalIndex),
        input.nextSpec,
        ...input.specs.slice(originalIndex),
    ];
}

function getParamValue(value?: string | string[]) {
    if (Array.isArray(value)) {
        return value[0];
    }
    return value;
}

function normalizeSpecificationInput(input: {
    name: string;
    price: string;
    duration: string;
}) {
    return {
        name: input.name.trim(),
        price: input.price.trim(),
        duration: input.duration.trim(),
    };
}

function getSpecificationValidationMessage(
    input: {
        name: string;
        price: string;
        duration: string;
    },
    serviceName?: string,
) {
    const normalized = normalizeSpecificationInput(input);

    if (!normalized.name) {
        return serviceName ? `${serviceName} 的规格名称不能为空` : "规格名称不能为空";
    }
    if (!normalized.price || !PRICE_PATTERN.test(normalized.price)) {
        return serviceName
            ? `${serviceName} 的规格价格格式不正确`
            : "规格价格格式不正确";
    }

    const duration = Number.parseInt(normalized.duration, 10);
    if (Number.isNaN(duration) || duration <= 0) {
        return serviceName
            ? `${serviceName} 的规格耗时必须为正整数`
            : "规格耗时必须为正整数";
    }

    return null;
}

function validateSpecificationName(value: string) {
    return getSpecificationValidationMessage({
        name: value,
        price: "1",
        duration: "1",
    });
}

function validateSpecificationPrice(value: string) {
    return getSpecificationValidationMessage({
        name: "规格",
        price: value,
        duration: "1",
    });
}

function validateSpecificationDuration(value: string) {
    return getSpecificationValidationMessage({
        name: "规格",
        price: "1",
        duration: value,
    });
}

function validateServiceSpecifications(
    specs: EditableSpecification[],
    serviceName?: string,
) {
    if (specs.length === 0) {
        return `${serviceName ?? "当前服务"} 需要至少一个服务规格`;
    }

    for (const spec of specs) {
        const message = getSpecificationValidationMessage(spec, serviceName);
        if (message) {
            return message;
        }
    }

    return true;
}

function mapEditableImage(file?: FileAccessInfo | null): EditableImage | null {
    if (!file?.fileId || !file.url) {
        return null;
    }
    return { id: file.fileId, url: file.url, blurhash: file.blurhash };
}

function mapOfferingToEditableService(
    service: ServiceOffering,
    buildSpec: (initial?: Partial<EditableSpecification>) => EditableSpecification,
): EditableService {
    return {
        serviceId: service.serviceId,
        name: service.serviceName,
        categoryId: service.categoryId ?? undefined,
        categoryName: service.categoryName ?? undefined,
        serviceDescription: service.serviceDescription,
        description: service.personnelDescription ?? "",
        isActive: service.isActive,
        gallery: service.gallery.map((image) => ({
            id: image.fileId,
            url: image.url,
            blurhash: image.blurhash,
        })),
        specs:
            service.specifications.length > 0
                ? service.specifications.map((spec) =>
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
}

function mapOptionToEditableService(input: {
    service: ServiceOption;
    categoryId?: string;
    categoryName?: string;
    buildSpec: (initial?: Partial<EditableSpecification>) => EditableSpecification;
}): EditableService {
    return {
        serviceId: input.service.id,
        name: input.service.name,
        categoryId: input.categoryId ?? input.service.categoryId,
        categoryName: input.categoryName,
        serviceDescription: input.service.description,
        description: "",
        isActive: false,
        gallery: [],
        specs: [input.buildSpec()],
    };
}

function mapRouteFallbackToEditableService(input: {
    serviceId: string;
    serviceName: string;
    serviceDescription?: string;
    categoryId?: string;
    categoryName?: string;
    buildSpec: (initial?: Partial<EditableSpecification>) => EditableSpecification;
}): EditableService {
    return {
        serviceId: input.serviceId,
        name: input.serviceName,
        categoryId: input.categoryId,
        categoryName: input.categoryName,
        serviceDescription: input.serviceDescription,
        description: "",
        isActive: false,
        gallery: [],
        specs: [input.buildSpec()],
    };
}

function buildCategoryLine(service: EditableService | null) {
    if (!service) {
        return "分类：加载中";
    }
    const parts = [service.categoryName, service.serviceDescription]
        .filter((item): item is string => Boolean(item?.trim()))
        .map((item) => item.trim());
    const prefix = parts.length > 0 ? parts.join(" · ") : "未分类";
    return `分类：${prefix} · ${service.isActive ? "已启用" : "未启用"}`;
}

function isMassageCategory(service: EditableService | null) {
    return service?.categoryName?.includes(MASSAGE_KEYWORD) ?? false;
}

async function pickImageAsset() {
    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
        Alert.alert("提示", "需要相册权限才能上传图片");
        return null;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: false,
        quality: 0.8,
    });

    if (result.canceled || !result.assets?.length) {
        return null;
    }
    return result.assets[0];
}

async function fetchAccessibleFileUrl(input: {
    fileId: string;
    fallbackUrl: string;
    fetchFileUrl: (fileIdentifier: string) => Promise<string>;
}) {
    try {
        return await input.fetchFileUrl(input.fileId);
    } catch (error) {
        console.warn("[ServiceSettingsDetail] 文件访问地址获取失败", error);
        return input.fallbackUrl;
    }
}

function buildProfileServicePayload(service: ServiceOffering): PayloadService {
    return {
        serviceId: service.serviceId,
        description: service.personnelDescription?.trim()
            ? service.personnelDescription.trim()
            : undefined,
        galleryFileIds: service.gallery.map((image) => image.fileId),
        specifications: service.specifications.map((spec) => ({
            id: spec.id,
            name: spec.name ?? "",
            price: spec.price,
            currency: spec.currency || "CNY",
            estimatedDurationMinutes: spec.estimatedDurationMinutes ?? 0,
        })),
    };
}

function validateExistingProfileServices(input: {
    profile: ServicePersonnelProfile;
    editedServiceId: string;
}): { valid: true } | { valid: false; message: string } {
    const pricePattern = /^\d+(\.\d{1,2})?$/;
    const invalidService = input.profile.services.find((service) => {
        if (service.serviceId === input.editedServiceId) {
            return false;
        }
        return service.specifications.some((spec) => {
            const duration = spec.estimatedDurationMinutes;
            return (
                !spec.name?.trim() ||
                !pricePattern.test(spec.price) ||
                !duration ||
                duration <= 0
            );
        });
    });

    if (!invalidService) {
        return { valid: true };
    }

    return {
        valid: false,
        message: `${invalidService.serviceName} 存在不完整规格，请先完善后再保存当前服务`,
    };
}

function buildEditableServicePayload(service: EditableService): PayloadService {
    return {
        serviceId: service.serviceId,
        description: service.description.trim() ? service.description.trim() : undefined,
        galleryFileIds: service.gallery.map((image) => image.id),
        specifications: service.specs.map((spec) => ({
            id: spec.id,
            name: spec.name.trim(),
            price: spec.price.trim(),
            currency: spec.currency || "CNY",
            estimatedDurationMinutes: Number.parseInt(spec.duration, 10),
        })),
    };
}

function buildPayloadServices(input: {
    profile: ServicePersonnelProfile;
    editableService: EditableService;
}) {
    const services = input.profile.services
        .filter((service) => service.serviceId !== input.editableService.serviceId)
        .map(buildProfileServicePayload);
    services.push(buildEditableServicePayload(input.editableService));
    return services;
}

async function submitDeleteService(input: {
    profile: ServicePersonnelProfile;
    serviceId: string;
    merchantQualification: EditableImage | null;
    vocationalQualification: EditableImage | null;
    updateOfferings: ReturnType<typeof useUpdateServiceOfferings>;
    refetchProfile: () => Promise<unknown>;
    routerBack: () => void;
    setSaving: (saving: boolean) => void;
}) {
    const validation = validateExistingProfileServices({
        profile: input.profile,
        editedServiceId: input.serviceId,
    });
    if (!validation.valid) {
        Alert.alert("提示", validation.message);
        return;
    }

    input.setSaving(true);
    try {
        await input.updateOfferings.mutateAsync({
            services: input.profile.services
                .filter((service) => service.serviceId !== input.serviceId)
                .map(buildProfileServicePayload),
            merchantQualificationFileId: input.merchantQualification?.id ?? null,
            vocationalQualificationFileId: input.vocationalQualification?.id ?? null,
        });
        await input.refetchProfile();
        input.routerBack();
    } catch (error) {
        console.error("[ServiceSettingsDetail] 删除失败", error);
        Alert.alert("删除失败", "请稍后重试");
    } finally {
        input.setSaving(false);
    }
}
