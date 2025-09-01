import React, { useEffect, useRef } from "react";
import { View, ScrollView, Pressable } from "react-native";
import { router } from "expo-router";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { Input } from "@repo/mobile-ui/components/ui/input";
import { RadioGroup } from "@repo/mobile-ui/components/ui/radio-group";
import { ArrowLeft } from "@repo/mobile-ui/lib/icons/ArrowLeft";
import { ChevronRight } from "@repo/mobile-ui/lib/icons/ChevronRight";
import { CreateUserAddressSchema, UpdateUserAddressSchema } from "@repo/types";
import { SafeAreaView } from "react-native-safe-area-context";
import useLocation from "@/hooks/useLocation";
import { SelectAddress, useAddressEditStore } from "@/stores/address-store";
import { useShallow } from "zustand/react/shallow";
import { useSession } from "@/hooks/useAuth";
import { UseCreateAddress } from "@/hooks/api/address";
import { toast } from "sonner-native";
import { is } from "zod/v4/locales";

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
            className={`px-4 py-2 rounded-full ${isSelected ? "bg-primary" : "border border-border bg-background"
                }`}
        >
            <Text
                className={`text-sm ${isSelected ? "text-white" : "text-muted-foreground"}`}
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
    const { data: session } = useSession();

    const { mutate: createAddress, isPending: createAddressLoading } =
        UseCreateAddress();

    const isEditMode = useRef<boolean>(!!selectedAddress);

    // 获取用户当前定位
    const { location, handleStopLocation } = useLocation({
        onError: (error) => {
            console.error("定位失败:", error);
        },
    });

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

    const handleGoBack = () => {
        router.back();
    };

    const handleSelectServiceAddress = () => {
        // 导航到地址选择页面
        router.push("./select-address");
    };

    const onSubmit = async (data: any) => {
        console.log("创建地址:", data);
        console.log(isEditMode)
        try {
            if (isEditMode.current) {
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

    return (
        <SafeAreaView className="flex-1 bg-background">
            {/* 头部导航 */}
            <View className="flex-row items-center px-4 py-3 border-b border-border">
                <Pressable onPress={handleGoBack} className="mr-4">
                    <ArrowLeft size={24} className="text-foreground" />
                </Pressable>
                <Text className="text-lg font-medium text-foreground">
                    {isEditMode ? "编辑地址" : "添加地址"}
                </Text>
            </View>

            <ScrollView className="flex-1 px-4">
                <View className="py-6 space-y-6">
                    {/* 服务地址 */}
                    <Pressable onPress={handleSelectServiceAddress}>
                        <View className="flex-row items-center justify-between py-4 border-b border-border">
                            <View className="flex-row items-center flex-1">
                                <Text className="text-base text-foreground mr-4">
                                    服务地址
                                </Text>
                                <Text
                                    className={`text-base flex-1 ${currentAddressText === "请选择服务地址"
                                        ? "text-muted-foreground"
                                        : "text-foreground"
                                        }`}
                                >
                                    {currentAddressText}
                                </Text>
                            </View>
                            <ChevronRight
                                size={20}
                                className="text-muted-foreground"
                            />
                        </View>
                    </Pressable>

                    {/* 门牌号 */}
                    <View>
                        <View className="flex-row items-center py-4 border-b border-border">
                            <Text className="text-base text-foreground mr-4 w-16">
                                门牌号
                            </Text>
                            <View className="flex-1">
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
                                            className="border-0 bg-transparent px-0 text-muted-foreground"
                                        />
                                    )}
                                />
                            </View>
                        </View>
                        {errors.homeNumber && (
                            <Text className="text-red-500 text-sm mt-1">
                                {typeof errors.homeNumber === "string"
                                    ? errors.homeNumber
                                    : (errors.homeNumber as any)?.message ||
                                    "输入有误"}
                            </Text>
                        )}
                    </View>

                    {/* 联系人 */}
                    <View>
                        <View className="flex-row items-center py-4 border-b border-border">
                            <Text className="text-base text-foreground mr-4 w-16">
                                联系人
                            </Text>
                            <View className="flex-1 flex-row items-center">
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
                                            className="border-0 bg-transparent px-0 flex-1 mr-4"
                                        />
                                    )}
                                />
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
                        </View>
                        {errors.recipientName && (
                            <Text className="text-red-500 text-sm mt-1">
                                {typeof errors.recipientName === "string"
                                    ? errors.recipientName
                                    : (errors.recipientName as any)?.message ||
                                    "输入有误"}
                            </Text>
                        )}
                    </View>

                    {/* 联系电话 */}
                    <View>
                        <View className="flex-row items-center py-4 border-b border-border">
                            <Text className="text-base text-foreground mr-4">
                                联系电话
                            </Text>
                            <View className="flex-1 flex-row items-center">
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
                                            className="border-0 bg-transparent px-0 flex-1 mr-4"
                                        />
                                    )}
                                />
                                <Pressable className="px-3 py-1 border border-border rounded">
                                    <Text className="text-sm text-foreground">
                                        通讯录
                                    </Text>
                                </Pressable>
                            </View>
                        </View>
                        {errors.recipientPhone && (
                            <Text className="text-red-500 text-sm mt-1">
                                {typeof errors.recipientPhone === "string"
                                    ? errors.recipientPhone
                                    : (errors.recipientPhone as any)?.message ||
                                    "输入有误"}
                            </Text>
                        )}
                    </View>

                    {/* 设为默认地址 */}
                    <View className="flex-row items-center justify-between py-4">
                        <Text className="text-base text-foreground">
                            设为默认地址
                        </Text>
                        <Controller
                            control={control}
                            name="isDefault"
                            render={({ field: { onChange, value } }) => (
                                <Pressable
                                    onPress={() => onChange(!value)}
                                    className={`w-12 h-6 rounded-full ${value ? "bg-primary" : "bg-muted"
                                        } flex-row items-center`}
                                >
                                    <View
                                        className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform ${value
                                            ? "translate-x-6"
                                            : "translate-x-0.5"
                                            }`}
                                    />
                                </Pressable>
                            )}
                        />
                    </View>
                </View>
            </ScrollView>

            {/* 底部保存按钮 */}
            <View className="p-4 bg-background">
                <Button
                    onPress={handleSubmit(onSubmit)}
                    disabled={createAddressLoading}
                    className="h-12 rounded-lg"
                >
                    <Text className="text-white text-base font-medium">
                        {createAddressLoading ? "保存中..." : "保存"}
                    </Text>
                </Button>
            </View>
            <Text>{JSON.stringify(errors)}</Text>
        </SafeAreaView>
    );
}
