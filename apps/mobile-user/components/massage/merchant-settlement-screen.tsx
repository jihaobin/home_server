import type React from "react";
import { Image } from "@repo/mobile-ui/components/ui/image";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { useRef } from "react";
import { Controller, useForm } from "react-hook-form";
import {
    Keyboard,
    Pressable,
    ScrollView,
    TextInput,
    View,
    useWindowDimensions,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { toast } from "sonner-native";
import { useUploadFile } from "@repo/hooks/api/files";
import { useCreateMerchantJoinRequest } from "@repo/hooks/api/massage";
import { CreateMerchantJoinRequestSchema } from "@repo/types";
import { Button } from "@repo/mobile-ui/components/ui/button";
import { ImageUploader } from "@/components/image-uploader";

type MerchantSettlementFormValues = {
    merchantName: string;
    gender: "male" | "female" | "";
    phone: string;
    age: string;
    intentCity: string;
    photoPreviewUri: string;
    photoFileId: string;
};

type TextFieldProps = {
    inputRef?: React.RefObject<TextInput | null>;
    label: string;
    placeholder: string;
    value: string;
    onChange: (value: string) => void;
    onBlur: () => void;
    onFocus?: () => void;
    error?: string;
    keyboardType?: "default" | "number-pad";
    maxLength?: number;
};

const HERO_IMAGE_SOURCE = require("@/assets/images/merchant-settlement-hero.jpg");
const DEFAULT_FORM_VALUES: MerchantSettlementFormValues = {
    merchantName: "",
    gender: "",
    phone: "",
    age: "",
    intentCity: "",
    photoPreviewUri: "",
    photoFileId: "",
};

function validatePhoneNumber(value: string) {
    const normalized = value.replace(/\s+/g, "");

    if (!normalized) {
        return "请输入手机号";
    }

    const result = CreateMerchantJoinRequestSchema.shape.phone.safeParse(normalized);
    return result.success
        ? true
        : result.error.issues[0]?.message ?? "请输入正确的手机号";
}

function MerchantTextField({
    inputRef,
    label,
    placeholder,
    value,
    onChange,
    onBlur,
    onFocus,
    error,
    keyboardType = "default",
    maxLength,
}: TextFieldProps) {
    return (
        <View className="mb-3">
            <View
                className="min-h-[68px] flex-row items-center rounded-[18px] border bg-[#FFFDF6] px-4"
                style={{
                    borderColor: error ? "#EB6E2B" : "#F1E9D7",
                }}
            >
                <Text className="text-[16px] font-puhui-medium text-[#211F1C]">
                    {label}
                </Text>
                <TextInput
                    ref={inputRef}
                    value={value}
                    onChangeText={onChange}
                    onBlur={onBlur}
                    onFocus={onFocus}
                    placeholder={undefined}
                    placeholderTextColor="#D0CBC1"
                    keyboardType={keyboardType}
                    maxLength={maxLength}
                    selectionColor="#F7951B"
                    className="ml-3 flex-1 py-0 text-right text-[15px] font-puhui-regular text-[#211F1C]"
                />
                {!value ? (
                    <Text
                        pointerEvents="none"
                        className="absolute right-4 text-right text-[15px] font-puhui-regular text-[#D0CBC1]"
                        style={{ left: 120 }}
                    >
                        {placeholder}
                    </Text>
                ) : null}
            </View>
            {error ? (
                <Text className="ml-3 mt-1 text-[12px] font-puhui-regular text-[#EB6E2B]">
                    {error}
                </Text>
            ) : null}
        </View>
    );
}

function GenderOption({
    label,
    selected,
    onPress,
}: {
    label: "男" | "女";
    selected: boolean;
    onPress: () => void;
}) {
    return (
        <Pressable className="ml-4 flex-row items-center" onPress={onPress}>
            <View
                className="h-6 w-6 items-center justify-center rounded-full border"
                style={{
                    borderColor: selected ? "#F7951B" : "#D8CCBA",
                    borderWidth: selected ? 2.5 : 2,
                }}
            >
                {selected ? (
                    <View className="h-[11px] w-[11px] rounded-full bg-[#F7951B]" />
                ) : null}
            </View>
            <Text
                className="ml-2 text-[16px]"
                style={{
                    color: selected ? "#211F1C" : "#3E3A36",
                    fontWeight: selected ? "700" : "600",
                }}
            >
                {label}
            </Text>
        </Pressable>
    );
}

export function MerchantSettlementScreen() {
    const insets = useSafeAreaInsets();
    const { width } = useWindowDimensions();
    const focusedInputRef = useRef<TextInput | null>(null);
    const merchantNameRef = useRef<TextInput | null>(null);
    const phoneRef = useRef<TextInput | null>(null);
    const ageRef = useRef<TextInput | null>(null);
    const cityRef = useRef<TextInput | null>(null);
    const pageWidth = Math.min(width - 20, 360);
    const heroHeight = Math.round(pageWidth * 0.64);
    const cardWidth = Math.max(pageWidth - 20, 0);
    const uploadFileMutation = useUploadFile();
    const createMerchantJoinRequestMutation = useCreateMerchantJoinRequest();

    const { control, handleSubmit, reset, setValue } = useForm<
        MerchantSettlementFormValues
    >({
        mode: "onBlur",
        defaultValues: DEFAULT_FORM_VALUES,
    });

    const isSubmitting =
        uploadFileMutation.isPending || createMerchantJoinRequestMutation.isPending;

    const handleUpload = async (file: {
        uri: string;
        name: string;
        type: string;
    }) => {
        const result = await uploadFileMutation.mutateAsync({
            file,
            fileName: file.name,
            fileType: file.type,
        });

        return {
            fileIdentifier: result.id,
            fileUrl: result.fileUrl,
        };
    };

    const onSubmit = async (values: MerchantSettlementFormValues) => {
        if (isSubmitting) {
            return;
        }

        const merchantName = values.merchantName.trim();
        const phone = values.phone.replace(/\s+/g, "");
        const ageText = values.age.trim();
        const intentCity = values.intentCity.trim();
        const photoFileId = values.photoFileId.trim() || null;
        const gender = values.gender;

        if (gender !== "male" && gender !== "female") {
            toast.error("请选择性别");
            return;
        }

        const phoneValidation = CreateMerchantJoinRequestSchema.shape.phone.safeParse(
            phone,
        );

        if (!phoneValidation.success) {
            toast.error(phoneValidation.error.issues[0]?.message ?? "请输入正确的手机号");
            return;
        }

        try {
            await createMerchantJoinRequestMutation.mutateAsync({
                merchantName,
                gender,
                phone,
                age: Number.parseInt(ageText, 10),
                intentCity,
                photoFileId,
            });
            reset(DEFAULT_FORM_VALUES);
            toast.success("提交成功，稍后会有工作人员联系您");
        } catch (error) {
            const message =
                error instanceof Error && error.message
                    ? error.message
                    : "提交失败，请稍后重试";
            toast.error(message);
        }
    };

    const handleScrollBeginDrag = () => {
        Keyboard.dismiss();
        focusedInputRef.current?.blur();
        focusedInputRef.current = null;
    };

    return (
        <View className="flex-1 bg-[#FFF8F0]">
            <ScrollView
                contentInsetAdjustmentBehavior="automatic"
                showsVerticalScrollIndicator={false}
                keyboardDismissMode="on-drag"
                contentContainerStyle={{
                    paddingBottom: insets.bottom + 28,
                }}
                onScrollBeginDrag={handleScrollBeginDrag}
            >
                <View className="items-center">
                    <View style={{ width: pageWidth }}>
                        <Image
                            source={HERO_IMAGE_SOURCE}
                            contentFit="cover"
                            className="w-full rounded-b-[26px]"
                            style={{ height: heroHeight }}
                        />
                    </View>

                    <View
                        className="mt-3 overflow-hidden border bg-[#FFF7EA] pb-4"
                        style={{
                            width: cardWidth,
                            borderRadius: 24,
                            borderColor: "#F1E9D7",
                            shadowColor: "#D97B0F",
                            shadowOffset: { width: 0, height: 10 },
                            shadowOpacity: 0.12,
                            shadowRadius: 18,
                            elevation: 4,
                        }}
                    >
                        <View className="absolute inset-x-0 top-0 h-[82px] rounded-t-[24px] bg-[#FFF2D5]" />

                        <View className="mx-4 mt-5 min-h-[46px] flex-row items-center justify-between">
                            <View className="h-[46px] justify-center">
                                <View className="absolute bottom-[8px] left-0 h-3 w-[78px] rounded-[6px] bg-[#F9E3C8]" />
                                <Text className="text-[21px] font-puhui-medium text-[#211F1C]">
                                    商户信息
                                </Text>
                            </View>
                            <Text className="text-[15px] font-puhui-regular text-[#8A847B]">
                                请填写真实信息
                            </Text>
                        </View>

                        <View className="mx-4 mt-4">
                            <Controller
                                control={control}
                                name="merchantName"
                                rules={{
                                    validate: (value) => {
                                        const trimmed = value.trim();
                                        if (!trimmed) {
                                            return "请输入姓名";
                                        }
                                        if (trimmed.length < 2 || trimmed.length > 20) {
                                            return "姓名长度需为 2-20 个字符";
                                        }
                                        return true;
                                    },
                                }}
                                render={({ field, fieldState }) => (
                                    <MerchantTextField
                                        inputRef={merchantNameRef}
                                        label="姓名"
                                        placeholder="请填写本人姓名"
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={() => {
                                            focusedInputRef.current = null;
                                            field.onBlur();
                                        }}
                                        onFocus={() => {
                                            focusedInputRef.current = merchantNameRef.current;
                                        }}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            <Controller
                                control={control}
                                name="gender"
                                rules={{
                                    validate: (value) =>
                                        value === "male" || value === "female"
                                            ? true
                                            : "请选择性别",
                                }}
                                render={({ field, fieldState }) => (
                                    <View className="mb-3">
                                        <View
                                            className="min-h-[68px] flex-row items-center rounded-[18px] border bg-[#FFFDF6] px-4"
                                            style={{
                                                borderColor: fieldState.error
                                                    ? "#EB6E2B"
                                                    : "#F1E9D7",
                                            }}
                                        >
                                            <Text className="text-[16px] font-puhui-medium text-[#211F1C]">
                                                性别
                                            </Text>
                                            <View className="ml-3 flex-1 flex-row justify-end">
                                                <GenderOption
                                                    label="男"
                                                    selected={field.value === "male"}
                                                    onPress={() => field.onChange("male")}
                                                />
                                                <GenderOption
                                                    label="女"
                                                    selected={field.value === "female"}
                                                    onPress={() => field.onChange("female")}
                                                />
                                            </View>
                                        </View>
                                        {fieldState.error ? (
                                            <Text className="ml-3 mt-1 text-[12px] font-puhui-regular text-[#EB6E2B]">
                                                {fieldState.error.message}
                                            </Text>
                                        ) : null}
                                    </View>
                                )}
                            />

                            <Controller
                                control={control}
                                name="phone"
                                rules={{
                                    validate: validatePhoneNumber,
                                }}
                                render={({ field, fieldState }) => (
                                    <MerchantTextField
                                        label="手机号码"
                                        placeholder="请填写本人手机号码"
                                        inputRef={phoneRef}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={() => {
                                            focusedInputRef.current = null;
                                            field.onBlur();
                                        }}
                                        onFocus={() => {
                                            focusedInputRef.current = phoneRef.current;
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={11}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            <Controller
                                control={control}
                                name="age"
                                rules={{
                                    validate: (value) => {
                                        const trimmed = value.trim();
                                        if (!trimmed) {
                                            return "请输入年龄";
                                        }
                                        if (!/^\d+$/.test(trimmed)) {
                                            return "年龄需为 18-65 岁";
                                        }
                                        const ageNumber = Number.parseInt(trimmed, 10);
                                        if (ageNumber < 18 || ageNumber > 65) {
                                            return "年龄需为 18-65 岁";
                                        }
                                        return true;
                                    },
                                }}
                                render={({ field, fieldState }) => (
                                    <MerchantTextField
                                        label="年龄"
                                        placeholder="请输入本人实际年龄，18岁以上"
                                        inputRef={ageRef}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={() => {
                                            focusedInputRef.current = null;
                                            field.onBlur();
                                        }}
                                        onFocus={() => {
                                            focusedInputRef.current = ageRef.current;
                                        }}
                                        keyboardType="number-pad"
                                        maxLength={2}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            <Controller
                                control={control}
                                name="intentCity"
                                rules={{
                                    validate: (value) =>
                                        value.trim() ? true : "请输入意向合作城市",
                                }}
                                render={({ field, fieldState }) => (
                                    <MerchantTextField
                                        label="意向合作城市"
                                        placeholder="请选择意向合作城市"
                                        inputRef={cityRef}
                                        value={field.value}
                                        onChange={field.onChange}
                                        onBlur={() => {
                                            focusedInputRef.current = null;
                                            field.onBlur();
                                        }}
                                        onFocus={() => {
                                            focusedInputRef.current = cityRef.current;
                                        }}
                                        error={fieldState.error?.message}
                                    />
                                )}
                            />

                            <Controller
                                control={control}
                                name="photoPreviewUri"
                                render={({ field }) => (
                                    <View className="rounded-[18px] border border-[#F1E9D7] bg-[#FFF9EF] px-4 pt-4">
                                        <View className="flex-row items-center justify-between">
                                            <Text className="text-[16px] font-puhui-regular text-[#211F1C]">
                                                请上传本人近期照
                                            </Text>
                                            <Text className="text-[16px] font-puhui-medium text-[#EB6E2B]">
                                                图片不得超过8M
                                            </Text>
                                        </View>

                                        <ImageUploader
                                            className="mt-5"
                                            value={field.value || null}
                                            onChange={(uri) => {
                                                field.onChange(uri ?? "");
                                                if (!uri) {
                                                    setValue("photoFileId", "");
                                                }
                                            }}
                                            onUpload={handleUpload}
                                            onUploadSuccess={(fileIdentifier) => {
                                                setValue("photoFileId", fileIdentifier);
                                            }}
                                            onUploadError={() => {
                                                setValue("photoFileId", "");
                                            }}
                                            size={108}
                                            borderRadius={14}
                                            maxFileSize={8 * 1024 * 1024}
                                            placeholderColor="#BFB6A7"
                                        />

                                        <View className="h-5" />
                                    </View>
                                )}
                            />
                        </View>
                    </View>

                    <View
                        className="items-center pt-3"
                        style={{ width: cardWidth }}
                    >
                        <Button
                            onPress={handleSubmit(onSubmit)}
                            disabled={isSubmitting}
                            className="h-20 w-full items-center justify-center rounded-full bg-[#F7951B]"
                            style={() => [
                                {
                                    shadowColor: "#C06E00",
                                    shadowOffset: { width: 0, height: 10 },
                                    shadowOpacity: 0.2,
                                    shadowRadius: 20,
                                    elevation: 6,
                                },
                            ]}
                        >
                            <Text className="text-[22px] font-puhui-medium text-white">
                                {uploadFileMutation.isPending
                                    ? "上传中..."
                                    : createMerchantJoinRequestMutation.isPending
                                      ? "提交中..."
                                      : "提交"}
                            </Text>
                        </Button>
                    </View>
                </View>
            </ScrollView>
        </View>
    );
}
