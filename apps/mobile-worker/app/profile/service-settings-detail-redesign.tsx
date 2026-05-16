import { Ionicons } from "@expo/vector-icons";
import { useUploadFile } from "@repo/hooks/api/files";
import { useServiceListSinglePage } from "@repo/hooks/api/service";
import { useOwnServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import {
    useDeleteService,
    useMyWorkerServices,
    useSubmitServiceUpdate,
    useTakedownService,
    useUpdateActiveService,
    useWithdrawServiceDraft,
} from "@repo/hooks/api/work-skill";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import { apiClient } from "@repo/lib/http-client";
import { AuditStepBar } from "@repo/mobile-ui/components/AuditStepBar";
import { KeyboardAwareScrollView } from "@repo/mobile-ui/components/app/KeyboardAwareScrollView";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { StatusBadge } from "@repo/mobile-ui/components/StatusBadge";
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
    WorkerServiceCurrent,
    WorkerServiceDerivedStatus,
    WorkerServiceDraftSnapshot,
    WorkerServiceItem,
} from "@repo/types";
import * as ImagePicker from "expo-image-picker";
import {
    useFocusEffect,
    useLocalSearchParams,
    useNavigation,
    useRouter,
} from "expo-router";
import { Controller, useForm } from "react-hook-form";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    BackHandler,
    Pressable,
    RefreshControl,
    ScrollView,
    Switch,
    View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { ChevronLeft } from "lucide-react-native";
import { toast } from "sonner-native";
import {
    buildStepItems,
    getWorkerServiceReason,
    getWorkerServiceStatusLabel,
    getWorkerServiceStatusTone,
    hasPendingUpdateForTakenDownService,
    hasSensitiveServiceChanges,
} from "./service-settings-audit-model";

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
type HydratedDraftSnapshotService = WorkerServiceDraftSnapshot["services"][number] & {
    gallery?: FileAccessInfo[];
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
type NonSensitiveServicePayload = {
    serviceId: string;
    defaultSpecId?: string | null;
};
type EditMode =
    | "create"
    | "edit-active"
    | "edit-pending"
    | "edit-rejected"
    | "edit-takendown";
type LoadSource = "active" | "draft" | "create";
type ServiceAuditTone = "pending" | "rejected" | "taken_down" | "approved";
type ServiceAuditNotice = {
    title: string;
    message: string;
    tone: ServiceAuditTone;
    icon: keyof typeof Ionicons.glyphMap;
    showAppeal?: boolean;
    steps?: ReturnType<typeof buildStepItems>;
};

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
const EMPTY_SERVICE_CATEGORIES: ServiceListResponse["items"] = [];
const WORKER_SERVICE_STATUSES = new Set<WorkerServiceDerivedStatus>([
    "pending",
    "rejected",
    "active",
    "takendown",
    "active_with_pending_update",
    "active_with_rejected_update",
]);

export default function ServiceSettingsDetailRedesignScreen() {
    const router = useRouter();
    const navigation = useNavigation();
    const params = useLocalSearchParams<{
        mode?: WorkerServiceDerivedStatus | "create" | string | string[];
        serviceId?: string | string[];
        draftId?: string | string[];
        categoryId?: string | string[];
        categoryName?: string | string[];
        serviceName?: string | string[];
        serviceDescription?: string | string[];
    }>();
    const routeMode = getParamValue(params.mode);
    const serviceId = getParamValue(params.serviceId);
    const routeDraftId = getParamValue(params.draftId);
    const routeCategoryId = getParamValue(params.categoryId);
    const routeCategoryName = getParamValue(params.categoryName);
    const routeServiceName = getParamValue(params.serviceName);
    const routeServiceDescription = getParamValue(params.serviceDescription);
    const { session } = useSession();
    const userId = session?.user?.id;
    const specIdRef = useRef(0);
    const baselinePayloadRef = useRef<UpdateServiceOfferingsRequest | null>(
        null,
    );
    const activePendingPromptedRef = useRef<string | null>(null);
    const allowNavigationRef = useRef(false);
    const leaveConfirmVisibleRef = useRef(false);
    const [editableService, setEditableService] =
        useState<EditableService | null>(null);
    const [loadedServiceKey, setLoadedServiceKey] = useState<string | null>(
        null,
    );
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
    const [pendingSourceChoice, setPendingSourceChoice] =
        useState<LoadSource | null>(null);
    const [deleteConfirmVisible, setDeleteConfirmVisible] = useState(false);
    const [deleteConfirmName, setDeleteConfirmName] = useState("");
    const [baselineVersion, setBaselineVersion] = useState(0);
    const {
        control: serviceFormControl,
        clearErrors: clearServiceFormErrors,
        formState: { errors: serviceFormErrors },
        handleSubmit: handleServiceFormSubmit,
        register: registerServiceFormField,
        reset: resetServiceForm,
        setValue: setServiceFormValue,
        watch: watchServiceForm,
    } = useForm<ServiceFormValues>({
        defaultValues: DEFAULT_SERVICE_FORM_VALUES,
    });

    const {
        data: profile,
        isFetching: isFetchingProfile,
        refetch: refetchProfile,
    } = useOwnServicePersonnelProfile();
    const {
        data: workerServicesResponse,
        isFetching: isFetchingWorkerServices,
        refetch: refetchWorkerServices,
    } = useMyWorkerServices();
    const submitServiceUpdate = useSubmitServiceUpdate();
    const updateActiveService = useUpdateActiveService();
    const withdrawServiceDraft = useWithdrawServiceDraft();
    const takedownService = useTakedownService();
    const deleteServiceMutation = useDeleteService();
    const uploadFile = useUploadFile();

    const {
        data: serviceListResponse,
        isFetching: isFetchingCategories,
        refetch: refetchServiceCategories,
    } = useServiceListSinglePage({
        limit: 1000,
    });
    const serviceCategories =
        serviceListResponse?.items ?? EMPTY_SERVICE_CATEGORIES;

    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            Promise.allSettled([
                userId ? refetchProfile() : Promise.resolve(),
                refetchWorkerServices(),
                refetchServiceCategories({ throwOnError: false }),
            ]),
    });

    const selectedOffering = useMemo(() => {
        if (!serviceId) {
            return undefined;
        }
        return profile?.services.find(
            (service) => service.serviceId === serviceId,
        );
    }, [profile?.services, serviceId]);

    const currentAuditItem = useMemo(() => {
        if (!serviceId || routeMode === "create") {
            return undefined;
        }
        const items = workerServicesResponse?.services ?? [];
        const itemByServiceId = items.find((item) => item.serviceId === serviceId);
        if (itemByServiceId) {
            return itemByServiceId;
        }
        if (!routeDraftId) {
            return undefined;
        }
        return items.find((item) => item.draft?.id === routeDraftId);
    }, [routeDraftId, routeMode, serviceId, workerServicesResponse?.services]);

    const editMode = useMemo<EditMode>(() => {
        const status = normalizeWorkerServiceStatus(routeMode);
        const derivedStatus = currentAuditItem?.derivedStatus ?? status;

        if (
            routeMode === "create" ||
            (!currentAuditItem && !selectedOffering)
        ) {
            return "create";
        }
        if (
            derivedStatus === "pending" ||
            derivedStatus === "active_with_pending_update"
        ) {
            return "edit-pending";
        }
        if (
            derivedStatus === "rejected" ||
            derivedStatus === "active_with_rejected_update"
        ) {
            return "edit-rejected";
        }
        if (derivedStatus === "takendown") {
            return "edit-takendown";
        }
        return "edit-active";
    }, [currentAuditItem, routeMode, selectedOffering]);

    const isReadOnly =
        editMode === "edit-pending" &&
        currentAuditItem?.derivedStatus === "active_with_pending_update" &&
        pendingSourceChoice === "active";

    const selectedOption = useMemo(() => {
        if (!serviceId) {
            return null;
        }
        for (const category of serviceCategories) {
            const service = category.children.find(
                (item) => item.id === serviceId,
            );
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

    const buildSpec = useCallback(
        (initial?: Partial<EditableSpecification>) => {
            return {
                id: initial?.id,
                localId: initial?.localId ?? `spec-${specIdRef.current++}`,
                name: initial?.name ?? "",
                price: initial?.price ?? "",
                duration: initial?.duration ?? "",
                currency: initial?.currency ?? "CNY",
            };
        },
        [],
    );

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
        setLoadedServiceKey(null);
        setEditableService(null);
        setSpecSheetDraft(null);
        setDeleteConfirmVisible(false);
        setDeleteConfirmName("");
        baselinePayloadRef.current = null;
        setBaselineVersion((v) => v + 1);
        setPendingSourceChoice(null);
        resetServiceForm(DEFAULT_SERVICE_FORM_VALUES);
    }, [resetServiceForm, serviceId]);

    useEffect(() => {
        if (!profile) {
            return;
        }
        setMerchantQualification(
            mapEditableImage(profile.merchantQualificationImage),
        );
        setVocationalQualification(
            mapEditableImage(profile.vocationalQualificationImage),
        );
    }, [profile]);

    useEffect(() => {
        if (!serviceId) {
            return;
        }

        const loadSource = resolveServiceLoadSource({
            editMode,
            currentAuditItem,
            routeMode,
            serviceId,
            pendingSourceChoice,
        });
        const loadKey = `${serviceId}:${editMode}:${loadSource}:${
            currentAuditItem?.draft?.id ?? "no-draft"
        }:${currentAuditItem?.updatedAt?.toISOString() ?? "no-update"}`;
        if (loadedServiceKey === loadKey) {
            return;
        }

        if (
            currentAuditItem?.derivedStatus === "active_with_pending_update" &&
            routeMode === "active_with_pending_update" &&
            pendingSourceChoice === null &&
            activePendingPromptedRef.current !== serviceId
        ) {
            activePendingPromptedRef.current = serviceId;
            Alert.alert(
                "选择要编辑的版本",
                "当前服务有一版更新内容正在审核中。线上版本是用户当前看到的服务信息，待审核版本是你刚提交的更新内容。",
                [
                    {
                        text: "查看线上版本",
                        onPress: () => {
                            setPendingSourceChoice("active");
                            setLoadedServiceKey(null);
                        },
                    },
                    {
                        text: "编辑待审核版本",
                        onPress: () => {
                            setPendingSourceChoice("draft");
                            setLoadedServiceKey(null);
                        },
                    },
                ],
            );
            return;
        }

        let mapped: EditableService | null = null;
        if (loadSource === "draft" && currentAuditItem?.draft?.snapshot) {
            mapped = mapDraftSnapshotToEditableService({
                item: currentAuditItem,
                snapshot: currentAuditItem.draft.snapshot,
                buildSpec,
            });
        } else if (loadSource !== "create" && currentAuditItem?.current) {
            mapped = mapCurrentToEditableService({
                item: currentAuditItem,
                current: currentAuditItem.current,
                buildSpec,
            });
        } else if (selectedOffering && loadSource !== "create") {
            mapped = mapOfferingToEditableService(selectedOffering, buildSpec);
        }

        if (!mapped && selectedOption) {
            mapped = mapOptionToEditableService({
                service: selectedOption.service,
                categoryId: selectedOption.categoryId,
                categoryName: selectedOption.categoryName,
                buildSpec,
            });
        }

        if (!mapped && routeServiceName) {
            mapped = mapRouteFallbackToEditableService({
                serviceId,
                serviceName: routeServiceName,
                serviceDescription: routeServiceDescription,
                categoryId: routeCategoryId,
                categoryName: routeCategoryName,
                buildSpec,
            });
        }

        if (!mapped) {
            return;
        }

        setEditableService(mapped);
        resetServiceForm({
            description: mapped.description,
            specs: mapped.specs,
            hasQualification: Boolean(
                merchantQualification || vocationalQualification,
            ),
        });
        baselinePayloadRef.current = buildUpdateServiceOfferingsPayload({
            service: mapped,
            merchantQualification,
            vocationalQualification,
        });
        setBaselineVersion((v) => v + 1);
        setLoadedServiceKey(loadKey);
    }, [
        buildSpec,
        currentAuditItem,
        editMode,
        loadedServiceKey,
        pendingSourceChoice,
        resetServiceForm,
        routeCategoryId,
        routeCategoryName,
        merchantQualification,
        routeMode,
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

    const getCurrentPayload = useCallback(
        (formValues?: ServiceFormValues) => {
            if (!editableService) {
                return null;
            }
            const service = {
                ...editableService,
                description:
                    formValues?.description ??
                    watchServiceForm("description") ??
                    "",
                specs: formValues?.specs ?? editableService.specs,
            };
            return buildUpdateServiceOfferingsPayload({
                service,
                merchantQualification,
                vocationalQualification,
            });
        },
        [
            editableService,
            merchantQualification,
            vocationalQualification,
            watchServiceForm,
        ],
    );

    const hasDirtyChanges = useCallback(() => {
        const baselinePayload = baselinePayloadRef.current;
        const currentPayload = getCurrentPayload();
        if (!baselinePayload || !currentPayload) {
            return false;
        }
        return !areServicePayloadsEqual(baselinePayload, currentPayload);
    }, [getCurrentPayload]);

    const backWithDirtyGuard = useCallback(() => {
        if (hasDirtyChanges() && !isReadOnly) {
            if (leaveConfirmVisibleRef.current) {
                return;
            }
            leaveConfirmVisibleRef.current = true;
            Alert.alert(
                "放弃修改？",
                "当前服务信息还未提交，返回后修改将丢失。",
                [
                    {
                        text: "继续编辑",
                        style: "cancel",
                        onPress: () => {
                            leaveConfirmVisibleRef.current = false;
                        },
                    },
                    {
                        text: "放弃修改",
                        style: "destructive",
                        onPress: () => {
                            leaveConfirmVisibleRef.current = false;
                            allowNavigationRef.current = true;
                            router.back();
                        },
                    },
                ],
            );
            return;
        }
        allowNavigationRef.current = true;
        router.back();
    }, [hasDirtyChanges, isReadOnly, router]);

    useFocusEffect(
        useCallback(() => {
            allowNavigationRef.current = false;

            const confirmLeave = (onConfirm: () => void) => {
                if (leaveConfirmVisibleRef.current) {
                    return;
                }
                leaveConfirmVisibleRef.current = true;
                Alert.alert(
                    "放弃修改？",
                    "当前服务信息还未提交，返回后修改将丢失。",
                    [
                        {
                            text: "继续编辑",
                            style: "cancel",
                            onPress: () => {
                                leaveConfirmVisibleRef.current = false;
                            },
                        },
                        {
                            text: "放弃修改",
                            style: "destructive",
                            onPress: () => {
                                leaveConfirmVisibleRef.current = false;
                                allowNavigationRef.current = true;
                                onConfirm();
                            },
                        },
                    ],
                );
            };

            const shouldBlockNavigation = () =>
                !allowNavigationRef.current && !isReadOnly && hasDirtyChanges();

            const hardwareBackSub = BackHandler.addEventListener(
                "hardwareBackPress",
                () => {
                    if (!shouldBlockNavigation()) {
                        allowNavigationRef.current = true;
                        return false;
                    }
                    confirmLeave(() => router.back());
                    return true;
                },
            );

            const removeBeforeRemove = navigation.addListener(
                "beforeRemove",
                (event) => {
                    if (!shouldBlockNavigation()) {
                        return;
                    }
                    event.preventDefault();
                    confirmLeave(() => navigation.dispatch(event.data.action));
                },
            );

            return () => {
                hardwareBackSub.remove();
                removeBeforeRemove();
            };
        }, [hasDirtyChanges, isReadOnly, navigation, router]),
    );

    const addSpec = useCallback(() => {
        if (isReadOnly) {
            return;
        }
        setSpecSheetDraft({
            mode: "create",
            spec: buildSpec(),
            isDefault: editableService?.specs.length === 0,
        });
    }, [buildSpec, editableService?.specs.length, isReadOnly]);

    const editSpec = useCallback(
        (spec: EditableSpecification, index: number) => {
            if (isReadOnly) {
                return;
            }
            setSpecSheetDraft({
                mode: "edit",
                originalLocalId: spec.localId,
                spec: { ...spec },
                isDefault: index === 0,
            });
        },
        [isReadOnly],
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
            if (isReadOnly) {
                return;
            }
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
        [editableService, isReadOnly, setServiceFormValue],
    );

    const addGalleryImage = useCallback(async () => {
        if (isReadOnly) {
            return;
        }
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
    }, [editableService, fetchFileUrl, isReadOnly, uploadFile]);

    const removeGalleryImage = useCallback(
        (imageId: string) => {
            if (isReadOnly) {
                return;
            }
            setEditableService((current) => {
                if (!current) {
                    return current;
                }
                return {
                    ...current,
                    gallery: current.gallery.filter(
                        (image) => image.id !== imageId,
                    ),
                };
            });
        },
        [isReadOnly],
    );

    const uploadQualification = useCallback(
        async (key: QualificationUploadKey) => {
            if (isReadOnly) {
                return;
            }
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
                console.error(
                    "[ServiceSettingsDetail] 资质图片上传失败",
                    error,
                );
                Alert.alert("上传失败", "请稍后重试");
            } finally {
                setUploadingQualificationKey(null);
            }
        },
        [fetchFileUrl, isReadOnly, uploadFile],
    );

    const submitServiceForm = useCallback(
        async (
            formValues: ServiceFormValues,
            options: { mode: "submit-review" | "save-active" } = {
                mode: "submit-review",
            },
        ) => {
            if (
                saving ||
                submitServiceUpdate.isPending ||
                updateActiveService.isPending
            ) {
                return;
            }
            if (!userId || !editableService) {
                Alert.alert("提示", "服务数据尚未加载完成");
                return;
            }

            clearServiceFormErrors("root");

            const nextEditableService = {
                ...editableService,
                description: formValues.description,
                specs: formValues.specs,
            };

            const payload = buildUpdateServiceOfferingsPayload({
                service: nextEditableService,
                merchantQualification,
                vocationalQualification,
            });
            const baselinePayload = baselinePayloadRef.current;
            if (
                baselinePayload &&
                areServicePayloadsEqual(baselinePayload, payload)
            ) {
                toast.info("未检测到修改");
                return;
            }

            setSaving(true);
            try {
            if (options.mode === "save-active") {
                const nonSensitivePayload =
                    buildNonSensitiveServicePayload(nextEditableService);
                await updateActiveService.mutateAsync({
                    ...nonSensitivePayload,
                });
                    await Promise.all([
                        refetchProfile(),
                        refetchWorkerServices(),
                    ]);
                    baselinePayloadRef.current = payload;
                    setBaselineVersion((v) => v + 1);
                    toast.success("已保存");
                    router.back();
                    return;
                }

                await submitServiceUpdate.mutateAsync(payload);
                await Promise.all([refetchProfile(), refetchWorkerServices()]);
                baselinePayloadRef.current = payload;
                setBaselineVersion((v) => v + 1);
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
            refetchProfile,
            refetchWorkerServices,
            router,
            clearServiceFormErrors,
            saving,
            submitServiceUpdate,
            updateActiveService,
            userId,
            vocationalQualification,
        ],
    );

    const saveService = useCallback(
        (options: { mode: "submit-review" | "save-active" } = {
            mode: "submit-review",
        }) => {
            if (isReadOnly) {
                return;
            }
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
            void handleServiceFormSubmit((values) =>
                submitServiceForm(values, options),
            )();
        },
        [
            editableService,
            handleServiceFormSubmit,
            isReadOnly,
            merchantQualification,
            clearServiceFormErrors,
            setServiceFormValue,
            submitServiceForm,
            vocationalQualification,
        ],
    );

    const withdrawPendingDraft = useCallback(() => {
        if (saving || withdrawServiceDraft.isPending || !serviceId) {
            return;
        }
        Alert.alert("撤回提交", "撤回后可继续编辑并重新提交审核，是否继续？", [
            { text: "取消", style: "cancel" },
            {
                text: "撤回",
                style: "destructive",
                onPress: () => {
                    if (saving || withdrawServiceDraft.isPending) {
                        return;
                    }
                    void (async () => {
                        setSaving(true);
                        try {
                            await withdrawServiceDraft.mutateAsync(serviceId);
                            await refetchWorkerServices();
                            router.back();
                        } catch (error) {
                            console.error(
                                "[ServiceSettingsDetail] 撤回失败",
                                error,
                            );
                            Alert.alert("撤回失败", "请稍后重试");
                        } finally {
                            setSaving(false);
                        }
                    })();
                },
            },
        ]);
    }, [
        refetchWorkerServices,
        router,
        saving,
        serviceId,
        withdrawServiceDraft,
    ]);

    const takedownCurrentService = useCallback(() => {
        if (saving || takedownService.isPending || !serviceId) {
            return;
        }
        Alert.alert("下架服务", "下架后该服务将不再对用户展示，确认下架？", [
            { text: "取消", style: "cancel" },
            {
                text: "下架",
                style: "destructive",
                onPress: () => {
                    if (saving || takedownService.isPending) {
                        return;
                    }
                    void (async () => {
                        setSaving(true);
                        try {
                            await takedownService.mutateAsync(serviceId);
                            await refetchWorkerServices();
                            router.back();
                        } catch (error) {
                            console.error(
                                "[ServiceSettingsDetail] 下架失败",
                                error,
                            );
                            Alert.alert("下架失败", "请稍后重试");
                        } finally {
                            setSaving(false);
                        }
                    })();
                },
            },
        ]);
    }, [refetchWorkerServices, router, saving, serviceId, takedownService]);

    const openDeleteConfirm = useCallback(() => {
        setDeleteConfirmName("");
        setDeleteConfirmVisible(true);
    }, []);

    const confirmDeleteService = useCallback(() => {
        if (
            saving ||
            deleteServiceMutation.isPending ||
            !serviceId ||
            !editableService
        ) {
            return;
        }
        if (deleteConfirmName.trim() !== editableService.name) {
            toast.error("请输入完整服务名称");
            return;
        }
        void (async () => {
            setSaving(true);
            try {
                await deleteServiceMutation.mutateAsync({
                    serviceId,
                    confirmName: deleteConfirmName.trim(),
                });
                await refetchWorkerServices();
                setDeleteConfirmVisible(false);
                router.back();
            } catch (error) {
                console.error("[ServiceSettingsDetail] 删除失败", error);
                Alert.alert("删除失败", "请稍后重试");
            } finally {
                setSaving(false);
            }
        })();
    }, [
        deleteConfirmName,
        deleteServiceMutation,
        editableService,
        refetchWorkerServices,
        router,
        saving,
        serviceId,
    ]);

    const isLoading =
        (isFetchingProfile && !profile) ||
        (isFetchingWorkerServices &&
            !workerServicesResponse &&
            editMode !== "create") ||
        (isFetchingCategories && !editableService && !selectedOffering);
    const categoryLine = buildCategoryLine(editableService);
    const shouldShowQualificationEntry = isMassageCategory(editableService);
    const auditNotice = buildServiceAuditNotice(currentAuditItem);
    const canShowDangerActions =
        Boolean(editableService) &&
        (editMode === "edit-active" || editMode === "edit-rejected");

    const watchedDescription = watchServiceForm("description");
    const watchedSpecs = watchServiceForm("specs");

    const dirtyKind = useMemo<"none" | "non-sensitive" | "sensitive">(() => {
        const baseline = baselinePayloadRef.current;
        if (!editableService || !baseline) {
            return "none";
        }
        const currentPayload = buildUpdateServiceOfferingsPayload({
            service: {
                ...editableService,
                description: watchedDescription ?? editableService.description,
                specs: watchedSpecs ?? editableService.specs,
            },
            merchantQualification,
            vocationalQualification,
        });
        if (areServicePayloadsEqual(baseline, currentPayload)) {
            return "none";
        }
        return hasSensitiveServiceChanges({
            before: baseline.services[0],
            after: currentPayload.services[0],
        })
            ? "sensitive"
            : "non-sensitive";
    }, [
        editableService,
        merchantQualification,
        vocationalQualification,
        watchedDescription,
        watchedSpecs,
        // baselineVersion bumps when baselinePayloadRef rewrites
        // eslint-disable-next-line react-hooks/exhaustive-deps
        baselineVersion,
    ]);

    type SubmitButtonKind =
        | "submit-create"
        | "save-active-disabled"
        | "save-active-non-sensitive"
        | "save-active-sensitive"
        | "update-pending"
        | "withdraw-pending"
        | "resubmit-rejected"
        | "resubmit-takendown";

    const submitButton = useMemo<{
        label: string;
        kind: SubmitButtonKind;
        disabled: boolean;
    }>(() => {
        const busy =
            saving ||
            submitServiceUpdate.isPending ||
            withdrawServiceDraft.isPending ||
            updateActiveService.isPending;
        if (editMode === "edit-pending") {
            return {
                label: "更新提交审核",
                kind: "update-pending",
                disabled: !editableService || busy || isReadOnly,
            };
        }
        if (editMode === "edit-rejected") {
            return {
                label: "修改并重新提交",
                kind: "resubmit-rejected",
                disabled: !editableService || busy,
            };
        }
        if (editMode === "edit-takendown") {
            return {
                label: "修改并重新提交",
                kind: "resubmit-takendown",
                disabled: !editableService || busy,
            };
        }
        if (editMode === "edit-active") {
            if (dirtyKind === "sensitive") {
                return {
                    label: "保存并提交审核",
                    kind: "save-active-sensitive",
                    disabled: !editableService || busy,
                };
            }
            if (dirtyKind === "non-sensitive") {
                return {
                    label: "保存修改",
                    kind: "save-active-non-sensitive",
                    disabled: !editableService || busy,
                };
            }
            return {
                label: "保存修改",
                kind: "save-active-disabled",
                disabled: true,
            };
        }
        return {
            label: "提交审核",
            kind: "submit-create",
            disabled: !editableService || busy,
        };
    }, [
        dirtyKind,
        editMode,
        editableService,
        isReadOnly,
        saving,
        submitServiceUpdate.isPending,
        updateActiveService.isPending,
        withdrawServiceDraft.isPending,
    ]);

    const showSensitiveUpdateBanner =
        editMode === "edit-active" && dirtyKind === "sensitive";
    const pageTitle = editMode === "create" ? "添加服务" : "编辑服务";

    const handleSubmitPress = useCallback(() => {
        switch (submitButton.kind) {
            case "withdraw-pending":
                withdrawPendingDraft();
                return;
            case "update-pending":
                saveService({ mode: "submit-review" });
                return;
            case "save-active-non-sensitive":
                saveService({ mode: "save-active" });
                return;
            case "save-active-sensitive":
                Alert.alert(
                    "提交更新审核",
                    "该服务的更新将进入审核流程，预计 24h 内出结果。审核期间，当前线上版本（老版本）继续运营，用户下单不受影响。",
                    [
                        { text: "取消", style: "cancel" },
                        {
                            text: "确认提交",
                            onPress: () =>
                                saveService({ mode: "submit-review" }),
                        },
                    ],
                );
                return;
            case "save-active-disabled":
                return;
            case "submit-create":
            case "resubmit-rejected":
            case "resubmit-takendown":
            default:
                saveService({ mode: "submit-review" });
                return;
        }
    }, [submitButton.kind, saveService, withdrawPendingDraft]);

    return (
        <SafeAreaView className="flex-1 bg-[#F5F6F8]" edges={["top", "bottom"]}>
            <View className="flex-row items-center px-5 pb-4 pt-2">
                <Pressable
                    hitSlop={16}
                    className="p-2"
                    onPress={backWithDirtyGuard}
                >
                    <Icon as={ChevronLeft} className="text-[28px] text-black" />
                </Pressable>
                <Text className="flex-1 text-center text-[17px] leading-[26px] text-black">
                    {pageTitle}
                </Text>
                <View className="w-11" />
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
                                {currentAuditItem ? (
                                    <StatusBadge
                                        label={getWorkerServiceStatusLabel(
                                            currentAuditItem,
                                        )}
                                        tone={getWorkerServiceStatusTone(
                                            currentAuditItem,
                                        )}
                                    />
                                ) : (
                                    <Text className="text-lg leading-[27px] text-[#99A1AF]">
                                        ›
                                    </Text>
                                )}
                            </View>
                        </View>

                        {auditNotice ? (
                            <ServiceAuditNoticeCard notice={auditNotice} />
                        ) : null}

                        {showSensitiveUpdateBanner ? (
                            <View className="flex-row items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3">
                                <Ionicons
                                    name="alert-circle-outline"
                                    size={18}
                                    color="#B45309"
                                />
                                <Text className="flex-1 text-xs leading-[18px] text-[#B45309]">
                                    你修改了服务名称、简介、图片或规格等内容，提交后将进入审核。审核期间，老版本继续对外运营。
                                </Text>
                            </View>
                        ) : null}

                        {shouldShowQualificationEntry ? (
                            <View
                                className="gap-3 rounded-2xl border bg-white p-4"
                                style={{
                                    borderColor:
                                        serviceFormErrors.hasQualification
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
                                    uploading={
                                        uploadingQualificationKey === "merchant"
                                    }
                                    onUpload={() =>
                                        uploadQualification("merchant")
                                    }
                                    onRemove={() =>
                                        setMerchantQualification(null)
                                    }
                                    disabled={isReadOnly}
                                />
                                <QualificationCard
                                    title="从业资格证书"
                                    actionText="上传从业资格证书"
                                    image={vocationalQualification}
                                    uploading={
                                        uploadingQualificationKey ===
                                        "vocational"
                                    }
                                    onUpload={() =>
                                        uploadQualification("vocational")
                                    }
                                    onRemove={() =>
                                        setVocationalQualification(null)
                                    }
                                    disabled={isReadOnly}
                                />
                                {serviceFormErrors.hasQualification?.message ? (
                                    <Text className="text-xs leading-[18px] text-[#FF5252]">
                                        {
                                            serviceFormErrors.hasQualification
                                                .message
                                        }
                                    </Text>
                                ) : null}
                            </View>
                        ) : null}

                        <View className="gap-2 rounded-2xl bg-white p-4">
                            <Text className="text-sm leading-[21px] text-black">
                                服务简介
                            </Text>
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
                                        editable={!isReadOnly}
                                    />
                                )}
                            />
                            <Text className="self-end text-[11px] leading-[17px] text-[#99A1AF]">
                                {serviceDescription.length}/{DESCRIPTION_LIMIT}
                            </Text>
                        </View>

                        <View className="gap-3 rounded-2xl bg-white p-4">
                            <Text className="text-sm leading-[21px] text-black">
                                服务图片
                            </Text>
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
                                                    ? {
                                                          blurhash:
                                                              image.blurhash,
                                                      }
                                                    : undefined
                                            }
                                            contentFit="cover"
                                            className="h-full w-full"
                                        />
                                        <Pressable
                                            className="absolute right-1 top-1 h-5 w-5 items-center justify-center rounded-full"
                                            style={{
                                                backgroundColor:
                                                    "rgba(0,0,0,0.6)",
                                            }}
                                            onPress={() =>
                                                removeGalleryImage(image.id)
                                            }
                                            disabled={isReadOnly}
                                        >
                                            <Ionicons
                                                name="close"
                                                size={12}
                                                color="#FFFFFF"
                                            />
                                        </Pressable>
                                    </View>
                                ))}
                                {editableService.gallery.length < 5 ? (
                                    <Pressable
                                        className="h-16 w-16 items-center justify-center rounded-[14px] border border-dashed border-[#D1D5DC] bg-[#F5F6F8]"
                                        onPress={addGalleryImage}
                                        disabled={
                                            uploadingServiceImage || isReadOnly
                                        }
                                        style={
                                            uploadingServiceImage || isReadOnly
                                                ? { backgroundColor: "#EEF1F5" }
                                                : undefined
                                        }
                                    >
                                        {uploadingServiceImage ? (
                                            <ActivityIndicator
                                                size="small"
                                                color="#2B6EF5"
                                            />
                                        ) : (
                                            <Text className="text-2xl leading-9 text-[#99A1AF]">
                                                +
                                            </Text>
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
                                        onRemove={() =>
                                            removeSpec(spec.localId)
                                        }
                                        disabled={isReadOnly}
                                    />
                                ))}
                            </View>
                            <Pressable
                                className="items-center justify-center rounded-[14px] border border-dashed border-[#2B6EF5] bg-[#F4F8FF] py-3"
                                onPress={addSpec}
                                disabled={isReadOnly}
                                style={
                                    isReadOnly
                                        ? {
                                              borderColor: "#D1D5DC",
                                              backgroundColor: "#F5F6F8",
                                          }
                                        : undefined
                                }
                            >
                                <Text
                                    className="text-[13px] leading-5"
                                    style={{
                                        color: isReadOnly
                                            ? "#99A1AF"
                                            : "#2B6EF5",
                                    }}
                                >
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
                            <Ionicons
                                name="briefcase-outline"
                                size={24}
                                color="#99A1AF"
                            />
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
                {canShowDangerActions ? (
                    <View className="mb-4 gap-2 rounded-2xl bg-[#FFF1F1] p-3">
                        <Text className="text-[13px] leading-5 text-[#7F1D1D]">
                            危险操作
                        </Text>
                        <View className="flex-row gap-2">
                            <Pressable
                                className="flex-1 items-center rounded-full border border-[#FECACA] bg-white py-3"
                                onPress={takedownCurrentService}
                                disabled={saving || takedownService.isPending}
                            >
                                <Text className="text-xs leading-[18px] text-[#DC2626]">
                                    下架服务
                                </Text>
                            </Pressable>
                            <Pressable
                                className="flex-1 items-center rounded-full bg-[#DC2626] py-3"
                                onPress={openDeleteConfirm}
                                disabled={
                                    saving || deleteServiceMutation.isPending
                                }
                                style={
                                    saving || deleteServiceMutation.isPending
                                        ? { backgroundColor: "#FCA5A5" }
                                        : undefined
                                }
                            >
                                <Text className="text-xs leading-[18px] text-white">
                                    删除服务
                                </Text>
                            </Pressable>
                        </View>
                    </View>
                ) : null}
                {editMode === "edit-pending" ? (
                    <View className="flex-row gap-2">
                        <Pressable
                            className="flex-1 items-center rounded-full border border-[#FECACA] bg-white py-3.5"
                            onPress={withdrawPendingDraft}
                            disabled={
                                !editableService ||
                                saving ||
                                withdrawServiceDraft.isPending
                            }
                        >
                            {withdrawServiceDraft.isPending ? (
                                <ActivityIndicator size="small" color="#DC2626" />
                            ) : (
                                <Text className="text-sm leading-[21px] text-[#DC2626]">
                                    撤回提交
                                </Text>
                            )}
                        </Pressable>
                        <Pressable
                            className="flex-1 items-center rounded-full bg-[#2B6EF5] py-3.5"
                            onPress={handleSubmitPress}
                            disabled={submitButton.disabled}
                            style={
                                submitButton.disabled
                                    ? { backgroundColor: "#99A1AF" }
                                    : undefined
                            }
                        >
                            {saving && !withdrawServiceDraft.isPending ? (
                                <ActivityIndicator size="small" color="#FFFFFF" />
                            ) : (
                                <Text className="text-sm leading-[21px] text-white">
                                    {submitButton.label}
                                </Text>
                            )}
                        </Pressable>
                    </View>
                ) : (
                    <Pressable
                        className="items-center rounded-full bg-[#2B6EF5] py-3.5"
                        onPress={handleSubmitPress}
                        disabled={submitButton.disabled}
                        style={
                            submitButton.disabled
                                ? { backgroundColor: "#99A1AF" }
                                : undefined
                        }
                    >
                        {saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text className="text-sm leading-[21px] text-white">
                                {submitButton.label}
                            </Text>
                        )}
                    </Pressable>
                )}
            </View>

            <SpecificationEditSheet
                draft={specSheetDraft}
                onClose={() => setSpecSheetDraft(null)}
                onSave={saveSpecSheet}
            />
            <DeleteServiceConfirmSheet
                visible={deleteConfirmVisible}
                serviceName={editableService?.name ?? ""}
                value={deleteConfirmName}
                saving={saving || deleteServiceMutation.isPending}
                onChangeText={setDeleteConfirmName}
                onClose={() => setDeleteConfirmVisible(false)}
                onConfirm={confirmDeleteService}
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
    disabled?: boolean;
}) {
    return (
        <View className="gap-1 rounded-[14px] bg-[#F5F6F8] p-4">
            <View className="flex-row items-center justify-between">
                <Text className="text-[13px] leading-5 text-black">
                    {props.title}
                </Text>
                {props.image ? (
                    <Pressable
                        hitSlop={8}
                        onPress={props.onRemove}
                        disabled={props.disabled}
                    >
                        <Text className="text-xs leading-[18px] text-[#FF5252]">
                            删除
                        </Text>
                    </Pressable>
                ) : null}
            </View>
            {props.image ? (
                <Pressable
                    className="mt-2 h-[98px] overflow-hidden rounded-xl bg-white"
                    onPress={props.onUpload}
                    disabled={props.uploading || props.disabled}
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
                    disabled={props.uploading || props.disabled}
                >
                    {props.uploading ? (
                        <ActivityIndicator size="small" color="#2B6EF5" />
                    ) : (
                        <View className="flex-row items-center gap-2">
                            <Ionicons
                                name="image-outline"
                                size={16}
                                color="#2B6EF5"
                            />
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

function ServiceAuditNoticeCard(props: { notice: ServiceAuditNotice }) {
    const tone = getAuditNoticeToneStyle(props.notice.tone);
    return (
        <View
            className="gap-3 rounded-2xl border p-4"
            style={{
                backgroundColor: tone.background,
                borderColor: tone.border,
            }}
        >
            <View className="flex-row gap-3">
                <View
                    className="h-9 w-9 items-center justify-center rounded-full"
                    style={{ backgroundColor: tone.iconBackground }}
                >
                    <Ionicons
                        name={props.notice.icon}
                        size={18}
                        color={tone.text}
                    />
                </View>
                <View className="flex-1">
                    <Text
                        className="text-sm leading-[21px]"
                        style={{ color: tone.title }}
                    >
                        {props.notice.title}
                    </Text>
                    <Text
                        className="mt-1 text-xs leading-[18px]"
                        style={{ color: tone.text }}
                    >
                        {props.notice.message}
                    </Text>
                </View>
            </View>
            {/* TODO: 申诉功能 */}
            {/* {props.notice.showAppeal ? (
                <Pressable
                    className="items-center rounded-full bg-[#E5E7EB] py-2.5"
                    disabled
                    onPress={() => toast.info("敬请期待")}
                >
                    <Text className="text-xs leading-[18px] text-[#6A7282]">
                        申诉（敬请期待）
                    </Text>
                </Pressable>
            ) : null} */}
            {/* {props.notice.steps ? (
                <AuditStepBar
                    steps={props.notice.steps.map((step) => ({
                        key: step.key,
                        label: step.label,
                        at: step.at,
                        status: step.state,
                    }))}
                    tone={
                        props.notice.tone === "rejected" ||
                        props.notice.tone === "taken_down"
                            ? "red"
                            : "amber"
                    }
                />
            ) : null} */}
        </View>
    );
}

function buildServiceAuditNotice(
    item?: WorkerServiceItem,
): ServiceAuditNotice | null {
    if (!item) {
        return null;
    }
    const steps = buildStepItems(item.auditLogs);
    const reason = getWorkerServiceReason(item);

    if (hasPendingUpdateForTakenDownService(item)) {
        return {
            title: "下架中・已提交新审核",
            message: "整改内容正在等待管理员重新审核，通过后将恢复对外展示。",
            tone: "pending",
            icon: "time-outline",
            steps,
        };
    }

    if (item.derivedStatus === "takendown") {
        return {
            title: "服务已下架",
            message: `下架原因：${reason ?? "暂无原因"}`,
            tone: "taken_down",
            icon: "remove-circle-outline",
            showAppeal: true,
            steps,
        };
    }

    if (
        item.derivedStatus === "rejected" ||
        item.derivedStatus === "active_with_rejected_update"
    ) {
        return {
            title: "审核未通过",
            message: `驳回原因：${reason ?? "请修改服务信息后重新提交审核"}`,
            tone: "rejected",
            icon: "alert-circle-outline",
            steps,
        };
    }

    if (
        item.derivedStatus === "pending" ||
        item.derivedStatus === "active_with_pending_update"
    ) {
        return {
            title: getWorkerServiceStatusLabel(item.derivedStatus),
            message:
                item.derivedStatus === "active_with_pending_update"
                    ? "更新内容正在等待管理员审核，线上版本继续运营。"
                    : "服务正在等待管理员审核，通过后将对外展示。",
            tone: "pending",
            icon: "time-outline",
            steps,
        };
    }

    return null;
}

function getAuditNoticeToneStyle(tone: ServiceAuditTone) {
    switch (tone) {
        case "rejected":
            return {
                title: "#991B1B",
                text: "#DC2626",
                background: "#FEF2F2",
                border: "#FECACA",
                iconBackground: "#FEE2E2",
            };
        case "pending":
            return {
                title: "#92400E",
                text: "#B45309",
                background: "#FFF7ED",
                border: "#FED7AA",
                iconBackground: "#FFEDD5",
            };
        case "taken_down":
            return {
                title: "#7F1D1D",
                text: "#B91C1C",
                background: "#FFF1F1",
                border: "#FECACA",
                iconBackground: "#FEE2E2",
            };
        case "approved":
        default:
            return {
                title: "#1D4ED8",
                text: "#2B6EF5",
                background: "#EEF4FF",
                border: "#D7E4FF",
                iconBackground: "#DBEAFE",
            };
    }
}

function SpecificationCard(props: {
    spec: EditableSpecification;
    index: number;
    onEdit: () => void;
    onRemove: () => void;
    disabled?: boolean;
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
                            <Text className="text-[10px] leading-[15px] text-[#2B6EF5]">
                                默认
                            </Text>
                        </View>
                    ) : null}
                </View>
                <View className="flex-row items-center gap-3">
                    <Pressable
                        hitSlop={8}
                        onPress={props.onEdit}
                        disabled={props.disabled}
                    >
                        <Text className="text-xs leading-[18px] text-[#2B6EF5]">
                            编辑
                        </Text>
                    </Pressable>
                    <Pressable
                        hitSlop={8}
                        onPress={props.onRemove}
                        disabled={props.disabled}
                    >
                        <Text className="text-xs leading-[18px] text-[#FF5252]">
                            删除
                        </Text>
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
    const { control, handleSubmit, reset, setValue, watch } =
        useForm<SpecSheetFormValues>({
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
                        <Text className="text-sm leading-5 text-[#6A7282]">
                            取消
                        </Text>
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
                                        setValue(
                                            "duration",
                                            template.duration,
                                            {
                                                shouldDirty: true,
                                                shouldValidate: true,
                                            },
                                        );
                                    }}
                                >
                                    <Text className="text-xs leading-[18px] text-[#2B6EF5]">
                                        {template.name} ¥{template.price} ·{" "}
                                        {template.duration}分钟
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
                                validate: (value) =>
                                    validateSpecificationName(value) ?? true,
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
                                        validateSpecificationPrice(value) ??
                                        true,
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
                                        validateSpecificationDuration(value) ??
                                        true,
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
                                    trackColor={{
                                        false: "#D1D5DC",
                                        true: "#B8D1FF",
                                    }}
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

function DeleteServiceConfirmSheet(props: {
    visible: boolean;
    serviceName: string;
    value: string;
    saving: boolean;
    onChangeText: (value: string) => void;
    onClose: () => void;
    onConfirm: () => void;
}) {
    return (
        <BottomSheetModal
            visible={props.visible}
            onClose={props.onClose}
            initialHeightRatio={0.42}
            minHeightRatio={0.35}
            maxHeightRatio={0.55}
            backdropClassName="bg-black/40"
            sheetClassName="rounded-t-[28px] bg-white"
        >
            <View className="gap-4 px-4 pb-6">
                <View className="gap-1">
                    <Text className="text-base font-semibold leading-6 text-black">
                        删除服务
                    </Text>
                    <Text className="text-xs leading-[18px] text-[#6A7282]">
                        删除后该服务将不可恢复。请输入服务名称「
                        {props.serviceName}」确认。
                    </Text>
                </View>
                <Input
                    className="h-[45px] rounded-[14px] bg-[#F5F6F8] px-3 text-sm leading-[21px] shadow-none"
                    value={props.value}
                    onChangeText={props.onChangeText}
                    placeholder="请输入完整服务名称"
                    placeholderTextColor="#99A1AF"
                    editable={!props.saving}
                />
                <View className="flex-row gap-2">
                    <Pressable
                        className="flex-1 items-center rounded-full bg-[#EEF1F5] py-3"
                        onPress={props.onClose}
                        disabled={props.saving}
                    >
                        <Text className="text-sm leading-[21px] text-[#4A5565]">
                            取消
                        </Text>
                    </Pressable>
                    <Pressable
                        className="flex-1 items-center rounded-full bg-[#DC2626] py-3"
                        onPress={props.onConfirm}
                        disabled={props.saving}
                        style={
                            props.saving
                                ? { backgroundColor: "#FCA5A5" }
                                : undefined
                        }
                    >
                        {props.saving ? (
                            <ActivityIndicator size="small" color="#FFFFFF" />
                        ) : (
                            <Text className="text-sm leading-[21px] text-white">
                                确认删除
                            </Text>
                        )}
                    </Pressable>
                </View>
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

function normalizeWorkerServiceStatus(
    value?: string,
): WorkerServiceDerivedStatus | null {
    return value &&
        WORKER_SERVICE_STATUSES.has(value as WorkerServiceDerivedStatus)
        ? (value as WorkerServiceDerivedStatus)
        : null;
}

function resolveServiceLoadSource(input: {
    editMode: EditMode;
    currentAuditItem?: WorkerServiceItem;
    routeMode?: string;
    serviceId: string;
    pendingSourceChoice: LoadSource | null;
}): LoadSource {
    if (input.editMode === "create") {
        return "create";
    }
    if (
        input.currentAuditItem?.derivedStatus ===
            "active_with_pending_update" &&
        input.routeMode === "active_with_pending_update"
    ) {
        return input.pendingSourceChoice ?? "draft";
    }
    if (input.editMode === "edit-pending") {
        return "draft";
    }
    if (input.editMode === "edit-rejected") {
        return input.currentAuditItem?.derivedStatus === "rejected"
            ? "draft"
            : "active";
    }
    return "active";
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
        return serviceName
            ? `${serviceName} 的规格名称不能为空`
            : "规格名称不能为空";
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
    buildSpec: (
        initial?: Partial<EditableSpecification>,
    ) => EditableSpecification,
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

function mapCurrentToEditableService(input: {
    item: WorkerServiceItem;
    current: WorkerServiceCurrent;
    buildSpec: (
        initial?: Partial<EditableSpecification>,
    ) => EditableSpecification;
}): EditableService {
    return {
        serviceId: input.item.serviceId,
        name: input.item.serviceName,
        categoryId: input.current.categoryId ?? undefined,
        categoryName: input.current.categoryName ?? undefined,
        serviceDescription: null,
        description: input.current.description ?? "",
        isActive: input.item.derivedStatus !== "takendown",
        gallery: input.current.gallery.map((image) => ({
            id: image.fileId,
            url: image.url,
            blurhash: image.blurhash,
        })),
        specs:
            input.current.specifications.length > 0
                ? input.current.specifications.map((spec) =>
                      input.buildSpec({
                          id: spec.id,
                          name: spec.name ?? "",
                          price: spec.price ?? "",
                          duration: spec.estimatedDurationMinutes
                              ? String(spec.estimatedDurationMinutes)
                              : "",
                          currency: spec.currency ?? "CNY",
                      }),
                  )
                : [input.buildSpec()],
    };
}

function mapDraftSnapshotToEditableService(input: {
    item: WorkerServiceItem;
    snapshot: WorkerServiceDraftSnapshot;
    buildSpec: (
        initial?: Partial<EditableSpecification>,
    ) => EditableSpecification;
}): EditableService {
    const serviceSnapshot = (
        input.snapshot.services.find(
            (service) => service.serviceId === input.item.serviceId,
        ) ?? input.snapshot.services[0]
    ) as HydratedDraftSnapshotService | undefined;
    const current = input.item.current;

    return {
        serviceId: serviceSnapshot?.serviceId ?? input.item.serviceId,
        name: input.item.serviceName,
        categoryId: current?.categoryId ?? undefined,
        categoryName: current?.categoryName ?? undefined,
        serviceDescription: null,
        description: serviceSnapshot?.description ?? "",
        isActive: input.item.derivedStatus !== "takendown",
        gallery: (serviceSnapshot?.galleryFileIds ?? []).map((fileId) => {
            const draftImage = serviceSnapshot?.gallery?.find(
                (image) => image.fileId === fileId,
            );
            const currentImage = current?.gallery.find(
                (image) => image.fileId === fileId,
            );
            const image = draftImage ?? currentImage;

            return {
                id: fileId,
                url: image?.url ?? "",
                blurhash: image?.blurhash,
            };
        }),
        specs:
            serviceSnapshot?.specifications &&
            serviceSnapshot.specifications.length > 0
                ? serviceSnapshot.specifications.map((spec) =>
                      input.buildSpec({
                          id: spec.id,
                          name: spec.name ?? "",
                          price: spec.price ?? "",
                          duration: spec.estimatedDurationMinutes
                              ? String(spec.estimatedDurationMinutes)
                              : "",
                          currency: spec.currency ?? "CNY",
                      }),
                  )
                : [input.buildSpec()],
    };
}

function mapOptionToEditableService(input: {
    service: ServiceOption;
    categoryId?: string;
    categoryName?: string;
    buildSpec: (
        initial?: Partial<EditableSpecification>,
    ) => EditableSpecification;
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
    buildSpec: (
        initial?: Partial<EditableSpecification>,
    ) => EditableSpecification;
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

function buildUpdateServiceOfferingsPayload(input: {
    service: EditableService;
    merchantQualification: EditableImage | null;
    vocationalQualification: EditableImage | null;
}): UpdateServiceOfferingsRequest {
    return {
        services: [buildEditableServicePayload(input.service)],
        merchantQualificationFileId: input.merchantQualification?.id ?? null,
        vocationalQualificationFileId:
            input.vocationalQualification?.id ?? null,
    };
}

function buildNonSensitiveServicePayload(
    service: EditableService,
): NonSensitiveServicePayload {
    return {
        serviceId: service.serviceId,
        defaultSpecId: service.specs[0]?.id ?? null,
    };
}

function areServicePayloadsEqual(
    left: UpdateServiceOfferingsRequest,
    right: UpdateServiceOfferingsRequest,
) {
    return normalizeServicePayload(left) === normalizeServicePayload(right);
}

function normalizeServicePayload(payload: UpdateServiceOfferingsRequest) {
    return JSON.stringify({
        services: payload.services.map((service) => ({
            serviceId: service.serviceId,
            description: service.description?.trim() ?? null,
            galleryFileIds: [...service.galleryFileIds].sort(),
            specifications: service.specifications.map((spec) => ({
                id: spec.id ?? null,
                name: spec.name.trim(),
                price: spec.price.trim(),
                currency: spec.currency || "CNY",
                estimatedDurationMinutes: spec.estimatedDurationMinutes,
            })),
        })),
        merchantQualificationFileId:
            payload.merchantQualificationFileId ?? null,
        vocationalQualificationFileId:
            payload.vocationalQualificationFileId ?? null,
    });
}

function buildEditableServicePayload(service: EditableService): PayloadService {
    return {
        serviceId: service.serviceId,
        description: service.description.trim()
            ? service.description.trim()
            : undefined,
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
