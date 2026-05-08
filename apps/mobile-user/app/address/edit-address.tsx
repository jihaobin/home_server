import { zodResolver } from "@hookform/resolvers/zod";
import { KeyboardAwareScreen } from "@repo/mobile-ui/components/app/KeyboardAwareScreen";
import { KeyboardAwareScrollView } from "@repo/mobile-ui/components/app/KeyboardAwareScrollView";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { RadioGroup } from "@repo/mobile-ui/components/ui/radio-group";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { ChevronRight } from "@repo/mobile-ui/lib/icons/ChevronRight";
import { MapPin } from "@repo/mobile-ui/lib/icons/MapPin";
import { CreateUserAddressSchema, UpdateUserAddressSchema } from "@repo/types";
import { router, useFocusEffect, useNavigation } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { Pressable, RefreshControl, View } from "react-native";
import { toast } from "sonner-native";
import { useShallow } from "zustand/react/shallow";
import {
    UseCreateAddress,
    UseUpdateAddress,
} from "@repo/hooks/api/address";
import {
    getSingleLocationErrorMessage,
    requestSingleLocation,
} from "@repo/hooks/location-single";
import type { LocationChangedEvent } from "expo-qq-location";
import {
    type SelectAddress,
    useAddressEditStore,
} from "@/stores/address-store";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";

// 性别选择组件 - 使用RadioGroup但保持原有按钮样式
function GenderSelection({
    value,
    onValueChange,
}: {
    value: boolean;
    onValueChange: (value: boolean) => void;
}) {
    return (
        <RadioGroup
            value={value ? "male" : "female"}
            onValueChange={(val) => onValueChange(val === "male")}
            className="flex-row gap-2"
        >
            <GenderButton
                value="male"
                currentValue={value ? "male" : "female"}
                onPress={() => onValueChange(true)}
            />
            <GenderButton
                value="female"
                currentValue={value ? "male" : "female"}
                onPress={() => onValueChange(false)}
            />
        </RadioGroup>
    );
}

// 性别按钮组件 - 保持原有样式
function GenderButton({
    value,
    currentValue,
    onPress,
}: {
    value: string;
    currentValue: string;
    onPress: () => void;
}) {
    const label = value === "male" ? "先生" : "女士";
    const isSelected = value === currentValue;

    return (
        <Pressable
            onPress={onPress}
            className={`px-5 py-2 rounded-full ${
                isSelected
                    ? "bg-primary shadow-sm"
                    : "border-2 border-border bg-background"
            }`}
        >
            <Text
                className={`text-sm font-medium ${isSelected ? "text-primary-foreground" : "text-muted-foreground"}`}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export default function EditAddressScreen() {
    const selectedAddress = useAddressEditStore(
        useShallow((state) => state.selectedAddress),
    );
    const isManualSelect = useAddressEditStore(
        useShallow((state) => state.isManualSelect),
    );
    const { setSelectedAddress, reset } = useAddressEditStore();
    const { session } = useSession();

    const { mutate: createAddress, isPending: createAddressLoading } =
        UseCreateAddress();
    const { mutate: updateAddress, isPending: updateAddressLoading } =
        UseUpdateAddress();

    const isEditMode = useRef<boolean>(!!selectedAddress);
    const isSavingAddress = createAddressLoading || updateAddressLoading;

    const navigation = useNavigation();
    const [location, setLocation] = useState<LocationChangedEvent | null>(null);

    const fetchSingleLocation = useCallback(async () => {
        try {
            const latestLocation = await requestSingleLocation(
                undefined,
                undefined,
                "mobile-user/edit-address",
            );
            setLocation(latestLocation);
        } catch (error) {
            const message = getSingleLocationErrorMessage(error);
            if (message.includes("页面已离开")) {
                return;
            }

            toast.error(message);
        }
    }, []);

    // 地址显示文本
    const currentAddressText =
        selectedAddress?.detailedAddress || "请选择服务地址";

    // 根据编辑模式选择不同的schema
    const formSchema = isEditMode.current
        ? UpdateUserAddressSchema
        : CreateUserAddressSchema;

    // 初始化表单默认值
    const getFormDefaults = (): Partial<SelectAddress> => {
        if (isEditMode.current) {
            return { ...selectedAddress };
        }

        // 新建模式默认值
        return {
            detailedAddress: selectedAddress?.detailedAddress || "",
            province: selectedAddress?.province || "",
            district: selectedAddress?.district || "",
            city: selectedAddress?.city || "",
            lng: selectedAddress?.lng || 0,
            lat: selectedAddress?.lat || 0,
        };
    };

    const {
        control,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm<any>({
        resolver: zodResolver(formSchema),
        defaultValues: getFormDefaults(),
    });

    // 初始化编辑数据
    useEffect(() => {
        if (!isEditMode.current) {
            // 新建模式：使用当前定位
            if (location && isManualSelect === false) {
                setSelectedAddress({
                    lng: location.longitude || 0,
                    lat: location.latitude || 0,
                    detailedAddress: location.name || "",
                    province: location.province || "",
                    city: location.city || "",
                    district: location.district || "",
                    id: "",
                    userId: "",
                    recipientName: "",
                    sex: false,
                    recipientPhone: "",
                    isDefault: false,
                });
            }
        }
    }, [location, isManualSelect]);

    // 同步store中的地址数据到表单
    useEffect(() => {
        const formData = getFormDefaults();
        Object.entries(formData).forEach(([key, value]) => {
            setValue(key as keyof SelectAddress, value);
        });
    }, [selectedAddress]);

    useEffect(() => {
        setValue("userId", session?.user.id || "");

        return () => {
            reset();
        };
    }, []);

    const handleSelectServiceAddress = () => {
        // 导航到地址选择页面
        router.push("./select-address");
    };

    const handleRefresh = useCallback(async () => {
        if (!isEditMode.current) {
            await fetchSingleLocation();
        }

        if (!isEditMode.current && location && isManualSelect === false) {
            setSelectedAddress({
                lng: location.longitude || 0,
                lat: location.latitude || 0,
                detailedAddress: location.name || "",
                province: location.province || "",
                city: location.city || "",
                district: location.district || "",
                id: "",
                userId: "",
                recipientName: "",
                sex: false,
                recipientPhone: "",
                isDefault: false,
            });
        }
        const defaults = getFormDefaults();
        Object.entries(defaults).forEach(([key, value]) => {
            setValue(key as keyof SelectAddress, value);
        });
    }, [
        fetchSingleLocation,
        getFormDefaults,
        isManualSelect,
        location,
        setSelectedAddress,
        setValue,
    ]);

    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: handleRefresh,
    });

    const onSubmit = async (data: any) => {
        try {
            if (isEditMode.current) {
                updateAddress(data, {
                    onError: (error) => {
                        console.error(error);
                        toast.error(error.message);
                    },
                    onSuccess: () => {
                        toast.success("修改地址成功");
                        reset();
                        router.back();
                    },
                });
            } else {
                createAddress(data, {
                    onError: (error) => {
                        console.error(error);
                        toast.error(error.message);
                    },
                    onSuccess: () => {
                        toast.success("创建地址成功");
                        // 清理store状态
                        reset();
                        router.back();
                    },
                });
            }
        } catch (error) {
            console.error("保存地址失败:", error);
            // 在实际应用中，可以使用toast或alert显示错误
        }
    };

    useFocusEffect(
        useCallback(() => {
            navigation.setOptions({
                title: isEditMode.current ? "编辑地址" : "添加地址",
                headerShown: true,
            });

            if (!isEditMode.current) {
                void fetchSingleLocation();
            }

            return undefined;
        }, [fetchSingleLocation, navigation]),
    );

    if (showPageLoading) {
        return (
            <View className="flex-1 bg-background items-center justify-center px-6">
                <View className="bg-primary/10 rounded-full p-4 mb-4">
                    <MapPin size={32} className="text-primary" />
                </View>
                <Text className="text-sm text-muted-foreground">
                    正在刷新地址表单...
                </Text>
            </View>
        );
    }

    return (
        <KeyboardAwareScreen className="flex-1 bg-background">
            <KeyboardAwareScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
                }
            >
                <View className="py-6 space-y-1 px-4">
                    {/* 地址信息卡片 */}
                    <View className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-4">
                        {/* 服务地址 */}
                        <Pressable onPress={handleSelectServiceAddress}>
                            <View className="flex-row items-center justify-between p-4 border-b border-border/50 bg-background/50">
                                <View className="flex-row items-center flex-1">
                                    <View className="bg-primary/10 rounded-full p-2 mr-3">
                                        <MapPin
                                            size={18}
                                            className="text-primary"
                                        />
                                    </View>
                                    <View className="flex-1">
                                        <Text className="text-xs text-muted-foreground mb-1 font-medium">
                                            服务地址
                                        </Text>
                                        <Text
                                            className={`text-sm ${
                                                currentAddressText ===
                                                "请选择服务地址"
                                                    ? "text-muted-foreground"
                                                    : "text-foreground font-medium"
                                            }`}
                                            numberOfLines={1}
                                        >
                                            {currentAddressText}
                                        </Text>
                                    </View>
                                </View>
                                <ChevronRight
                                    size={20}
                                    className="text-muted-foreground ml-2"
                                />
                            </View>
                        </Pressable>

                        {/* 门牌号 */}
                        <View className="p-4 border-b border-border/50">
                            <Text className="text-xs text-muted-foreground mb-2 font-medium">
                                门牌号
                            </Text>
                            <Controller
                                control={control}
                                name="homeNumber"
                                render={({
                                    field: { onChange, onBlur, value },
                                }) => (
                                    <Input
                                        placeholder="详细地址，例如：A座102室"
                                        value={value || ""}
                                        onChangeText={onChange}
                                        onBlur={onBlur}
                                        className="border-0 bg-background/50 px-3 rounded-xl text-foreground"
                                    />
                                )}
                            />
                            {errors.homeNumber && (
                                <Text className="text-destructive text-xs mt-1 ml-1">
                                    {typeof errors.homeNumber === "string"
                                        ? errors.homeNumber
                                        : (errors.homeNumber as any)?.message ||
                                          "输入有误"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* 联系人信息卡片 */}
                    <View className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden mb-4">
                        {/* 联系人 */}
                        <View className="p-4 border-b border-border/50">
                            <Text className="text-xs text-muted-foreground mb-2 font-medium">
                                联系人
                            </Text>
                            <View className="flex-row items-center justify-between">
                                <View className="flex-1 mr-3">
                                    <Controller
                                        control={control}
                                        name="recipientName"
                                        render={({
                                            field: { onChange, onBlur, value },
                                        }) => (
                                            <Input
                                                placeholder="收件人姓名"
                                                value={value || ""}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
                                                className="border-0 bg-background/50 px-3 rounded-xl"
                                            />
                                        )}
                                    />
                                </View>
                                <Controller
                                    control={control}
                                    name="sex"
                                    render={({
                                        field: { onChange, value },
                                    }) => (
                                        <GenderSelection
                                            value={value ?? true}
                                            onValueChange={onChange}
                                        />
                                    )}
                                />
                            </View>
                            {errors.recipientName && (
                                <Text className="text-destructive text-xs mt-1 ml-1">
                                    {typeof errors.recipientName === "string"
                                        ? errors.recipientName
                                        : (errors.recipientName as any)
                                              ?.message || "输入有误"}
                                </Text>
                            )}
                        </View>

                        {/* 联系电话 */}
                        <View className="p-4">
                            <Text className="text-xs text-muted-foreground mb-2 font-medium">
                                联系电话
                            </Text>
                            <View className="flex-row items-center">
                                <View className="flex-1 mr-3">
                                    <Controller
                                        control={control}
                                        name="recipientPhone"
                                        render={({
                                            field: { onChange, onBlur, value },
                                        }) => (
                                            <Input
                                                placeholder="手机号码"
                                                value={value || ""}
                                                onChangeText={onChange}
                                                onBlur={onBlur}
                                                keyboardType="phone-pad"
                                                className="border-0 bg-background/50 px-3 rounded-xl"
                                            />
                                        )}
                                    />
                                </View>
                                <Pressable className="px-4 py-2.5 border-2 border-border rounded-xl bg-background active:bg-muted">
                                    <Text className="text-sm font-medium text-foreground">
                                        通讯录
                                    </Text>
                                </Pressable>
                            </View>
                            {errors.recipientPhone && (
                                <Text className="text-destructive text-xs mt-1 ml-1">
                                    {typeof errors.recipientPhone === "string"
                                        ? errors.recipientPhone
                                        : (errors.recipientPhone as any)
                                              ?.message || "输入有误"}
                                </Text>
                            )}
                        </View>
                    </View>

                    {/* 设为默认地址卡片 */}
                    <View className="bg-card rounded-2xl shadow-sm border border-border/50 overflow-hidden p-4">
                        <View className="flex-row items-center justify-between">
                            <View>
                                <Text className="text-base font-semibold text-foreground mb-1">
                                    设为默认地址
                                </Text>
                                <Text className="text-xs text-muted-foreground">
                                    下次下单时自动使用此地址
                                </Text>
                            </View>
                            <Controller
                                control={control}
                                name="isDefault"
                                render={({ field: { onChange, value } }) => (
                                    <Pressable
                                        onPress={() => onChange(!value)}
                                        className={`w-14 h-8 rounded-full ${
                                            value ? "bg-primary" : "bg-muted"
                                        } flex-row items-center px-1 shadow-sm`}
                                    >
                                        <View
                                            className={`w-6 h-6 rounded-full bg-card shadow-md transition-transform ${
                                                value
                                                    ? "translate-x-6"
                                                    : "translate-x-0"
                                            }`}
                                        />
                                    </Pressable>
                                )}
                            />
                        </View>
                    </View>
                </View>

                {/* 底部安全区域 */}
                <View className="h-24" />
            </KeyboardAwareScrollView>

            {/* 底部保存按钮 - 固定在底部 */}
            <View className="p-4 bg-background/95 backdrop-blur-sm border-t border-border/50">
                <Button
                    onPress={handleSubmit(onSubmit)}
                    disabled={isSavingAddress}
                    className="h-12 rounded-xl shadow-sm"
                >
                    <Text className="text-primary-foreground text-base font-semibold">
                        {isSavingAddress ? "保存中..." : "保存"}
                    </Text>
                </Button>
            </View>
        </KeyboardAwareScreen>
    );
}
