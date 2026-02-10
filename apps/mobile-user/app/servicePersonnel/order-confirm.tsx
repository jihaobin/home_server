import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Separator } from "@repo/mobile-ui/components/ui/separator";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Textarea } from "@repo/mobile-ui/components/ui/textarea";
import { ArrowLeft } from "@repo/mobile-ui/lib/icons/ArrowLeft";
import { ChevronRight } from "@repo/mobile-ui/lib/icons/ChevronRight";
import { MapPin } from "@repo/mobile-ui/lib/icons/MapPin";
import { X } from "@repo/mobile-ui/lib/icons/X";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Image, Pressable, ScrollView, View } from "react-native";
import * as React from "react";
import { toast } from "sonner-native";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { useOrderConfirmDesignatedPreview } from "@repo/hooks/api/order";
import { useAddressEditStore } from "@/stores/address-store";
import useServiceStore from "@/stores/service";
import { PaySheet } from "@/components/pay/paySheet";
import { ServiceTimePickerSheet } from "@/components/service-personnel/ServiceTimePickerSheet";

export default function OrderConfirmScreen() {
    const router = useRouter();
    const { session } = useSession();
    const customerId = session?.user?.id ?? "";

    const params = useLocalSearchParams<{
        personnelId?: string | string[];
        serviceId?: string | string[];
        serviceName?: string | string[];
        specificationId?: string | string[];
    }>();

    const personnelId = Array.isArray(params.personnelId)
        ? params.personnelId[0]
        : params.personnelId
          ? String(params.personnelId)
          : "";
    const serviceId = Array.isArray(params.serviceId)
        ? params.serviceId[0]
        : params.serviceId
          ? String(params.serviceId)
          : "";
    const serviceName = Array.isArray(params.serviceName)
        ? params.serviceName[0]
        : params.serviceName
          ? String(params.serviceName)
          : "";
    const routeSpecificationId = Array.isArray(params.specificationId)
        ? params.specificationId[0]
        : params.specificationId
          ? String(params.specificationId)
          : undefined;

    const { selectedAddress } = useAddressEditStore();
    const { selectedServiceTime } = useServiceStore();

    const [specificationId, setSpecificationId] = React.useState<
        string | undefined
    >(routeSpecificationId);
    const [isPaySheetVisible, setIsPaySheetVisible] = React.useState(false);
    const [remark, setRemark] = React.useState<string>("");
    const [isRemarkSheetVisible, setIsRemarkSheetVisible] =
        React.useState(false);
    const [remarkDraft, setRemarkDraft] = React.useState("");
    const [isServiceTimeSheetVisible, setIsServiceTimeSheetVisible] =
        React.useState(false);

    const appointmentTime = selectedServiceTime
        ? selectedServiceTime.toISOString()
        : undefined;

    const previewQuery = React.useMemo(
        () => ({
            personnelId,
            serviceId,
            specificationId,
            addressId: selectedAddress?.id ?? undefined,
            appointmentTime,
        }),
        [
            personnelId,
            serviceId,
            specificationId,
            selectedAddress?.id,
            appointmentTime,
        ],
    );

    const preview = useOrderConfirmDesignatedPreview(previewQuery, {
        enabled: Boolean(personnelId && serviceId),
    }).data;

    React.useEffect(() => {
        if (!preview?.selected?.specificationId) {
            return;
        }
        if (!specificationId) {
            setSpecificationId(preview.selected.specificationId);
        }
    }, [preview?.selected?.specificationId, specificationId]);

    const selectedSpec = React.useMemo(() => {
        const specs = preview?.specifications ?? [];
        if (!specificationId) {
            return specs[0];
        }
        return (
            specs.find((spec: { id: string }) => spec.id === specificationId) ??
            specs[0]
        );
    }, [preview?.specifications, specificationId]);

    const serviceFeeAmount = React.useMemo(() => {
        const items = preview?.pricing?.items ?? [];
        const serviceFee = items.find(
            (item: { key: string }) => item.key === "service_fee",
        );
        const amount = serviceFee?.amount;
        return typeof amount === "number" && Number.isFinite(amount)
            ? amount
            : 0;
    }, [preview?.pricing?.items]);

    const totalAmount =
        typeof preview?.pricing?.totalAmount === "number"
            ? preview.pricing.totalAmount
            : 0;

    const warmTip =
        "温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案温馨提示文案。";

    const serviceTimeLabel = React.useMemo(() => {
        if (!selectedServiceTime) {
            return "请选择时间";
        }
        const date = selectedServiceTime;
        const end = new Date(date.getTime() + 2 * 60 * 60 * 1000);
        const weekdays = [
            "周日",
            "周一",
            "周二",
            "周三",
            "周四",
            "周五",
            "周六",
        ];
        const dayLabel = weekdays[date.getDay()] ?? "";
        const month = String(date.getMonth() + 1).padStart(2, "0");
        const day = String(date.getDate()).padStart(2, "0");
        const hh = String(date.getHours());
        const mm = String(date.getMinutes()).padStart(2, "0");
        const endHh = String(end.getHours());
        const endMm = String(end.getMinutes()).padStart(2, "0");
        return `${month}月${day}日 ${dayLabel} ${hh}:${mm}~${endHh}:${endMm}`;
    }, [selectedServiceTime]);

    const openPaySheet = () => {
        if (!customerId) {
            toast.error("请先登录");
            return;
        }
        if (!preview?.address?.id) {
            toast.error("请选择服务地址");
            return;
        }
        if (!selectedServiceTime) {
            toast.error("请选择服务时间");
            return;
        }
        if (!selectedSpec?.id) {
            toast.error("请选择服务规格");
            return;
        }
        setIsPaySheetVisible(true);
    };

    const openRemarkSheet = () => {
        setRemarkDraft(remark);
        setIsRemarkSheetVisible(true);
    };

    const closeRemarkSheet = () => {
        setIsRemarkSheetVisible(false);
        setRemarkDraft(remark);
    };

    const confirmRemark = () => {
        setRemark(remarkDraft);
        setIsRemarkSheetVisible(false);
    };

    return (
        <View className="flex-1 bg-background">
            {/* 顶部导航栏（按 Figma：左右 78px，中间标题） */}
            <View className="bg-card pb-3 pt-12">
                <View className="flex-row items-center">
                    <View className="w-[78px] pl-4">
                        <Pressable
                            onPress={() => router.back()}
                            className="h-[46px] w-[46px] items-center justify-center"
                            hitSlop={8}
                        >
                            <Icon
                                as={ArrowLeft}
                                size={22}
                                className="text-foreground"
                            />
                        </Pressable>
                    </View>
                    <View className="flex-1 items-center">
                        <Text className="text-base font-puhui-medium text-foreground">
                            确认订单
                        </Text>
                    </View>
                    <View className="w-[78px]" />
                </View>
            </View>

            <ScrollView
                className="flex-1"
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: 120 }}
            >
                {/* 主卡片（地址 + 服务 + 规格 + 时间 + 备注） */}
                <View className="mx-4 mt-3 overflow-hidden rounded-xl bg-card">
                    <Pressable
                        onPress={() =>
                            router.push({
                                pathname: "/address/service-address",
                                params: { mode: "select" },
                            })
                        }
                        className="px-3 py-3"
                    >
                        <View className="flex-row items-start">
                            <View className="mt-0.5">
                                <Icon
                                    as={MapPin}
                                    size={18}
                                    className="text-primary"
                                />
                            </View>
                            <View className="ml-2 flex-1">
                                <View className="flex-row items-center">
                                    <Text
                                        className="flex-1 text-xs font-puhui-medium text-foreground"
                                        numberOfLines={1}
                                    >
                                        {preview?.address?.detailedAddress ??
                                            "请选择服务地址"}
                                    </Text>
                                    {preview?.address?.homeNumber ? (
                                        <Text className="ml-2 text-xs font-puhui-medium text-foreground">
                                            {preview.address.homeNumber}
                                        </Text>
                                    ) : null}
                                    {preview?.address?.isDefault ? (
                                        <View className="ml-2 rounded-[2px] bg-secondary px-1.5 py-[1px]">
                                            <Text className="text-xs font-puhui-regular text-primary">
                                                默认
                                            </Text>
                                        </View>
                                    ) : null}
                                </View>
                                <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                    {preview?.address
                                        ? `${preview.address.recipientName}  ${preview.address.recipientPhone}`
                                        : ""}
                                </Text>
                            </View>
                            <View className="ml-2">
                                <Icon
                                    as={ChevronRight}
                                    size={18}
                                    className="text-muted-foreground"
                                />
                            </View>
                        </View>
                    </Pressable>

                    <Separator className="bg-border" />

                    <View className="px-3 py-3">
                        <View className="flex-row items-start">
                            <View className="h-[52px] w-[52px] overflow-hidden rounded-lg bg-muted">
                                <Image
                                    source={
                                        preview?.service?.imageFileUrl
                                            ? {
                                                  uri: preview.service
                                                      .imageFileUrl,
                                              }
                                            : require("../../assets/images/promo-1.png")
                                    }
                                    resizeMode="cover"
                                    style={{ width: "100%", height: "100%" }}
                                />
                            </View>
                            <View className="ml-3 flex-1 flex-row justify-between">
                                <View>
                                    <Text className="text-sm font-puhui-regular text-foreground">
                                        {preview?.servicePersonnel?.name ?? ""}
                                    </Text>
                                    <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                        {selectedSpec?.name ?? serviceName}
                                    </Text>
                                </View>
                                <View className="items-end">
                                    <Text className="text-sm font-din-alt-bold text-foreground">
                                        ¥{serviceFeeAmount.toFixed(2)}
                                    </Text>
                                    <Text className="mt-3 text-xs font-puhui-regular text-muted-foreground">
                                        共1件
                                    </Text>
                                </View>
                            </View>
                        </View>
                    </View>

                    <Separator className="bg-border" />

                    <View className="px-3 py-3">
                        <Text className="text-sm font-puhui-regular text-foreground">
                            规格选择
                        </Text>
                        <View className="mt-3 flex-row gap-3">
                            {(preview?.specifications ?? []).map(
                                (spec: {
                                    id: string;
                                    name?: string | null;
                                }) => {
                                    const isSelected =
                                        Boolean(specificationId) &&
                                        spec.id === specificationId;
                                    return (
                                        <View
                                            key={spec.id}
                                            className={
                                                isSelected
                                                    ? "h-[26px] w-[76px] items-center justify-center rounded-[4px] border border-primary bg-secondary"
                                                    : "h-[26px] w-[76px] items-center justify-center rounded-[4px] bg-background"
                                            }
                                        >
                                            <Text
                                                onPress={() =>
                                                    setSpecificationId(spec.id)
                                                }
                                                className={
                                                    isSelected
                                                        ? "text-xs font-puhui-regular text-primary"
                                                        : "text-xs font-puhui-regular text-foreground"
                                                }
                                            >
                                                {spec.name || "标准"}
                                            </Text>
                                        </View>
                                    );
                                },
                            )}
                        </View>
                    </View>

                    <Separator className="bg-border" />

                    <Pressable
                        onPress={() => setIsServiceTimeSheetVisible(true)}
                        className="px-3 py-3"
                    >
                        <View className="flex-row items-center">
                            <View className="flex-1 flex-row items-center">
                                <Text className="text-xs font-puhui-regular text-muted-foreground">
                                    服务时间：
                                </Text>
                                <Text className="ml-2 text-xs font-puhui-regular text-foreground">
                                    {serviceTimeLabel}
                                </Text>
                            </View>
                            <Icon
                                as={ChevronRight}
                                size={18}
                                className="text-muted-foreground"
                            />
                        </View>
                    </Pressable>

                    <Separator className="bg-border" />

                    <View className="px-3 py-3">
                        <Pressable
                            onPress={openRemarkSheet}
                            className="flex-row items-center justify-between active:bg-muted/30"
                        >
                            <Text className="text-xs font-puhui-regular text-muted-foreground">
                                订单备注
                            </Text>
                            <View className="flex-row items-center">
                                <Text
                                    className={`mr-1 text-xs font-puhui-regular ${
                                        remark.trim()
                                            ? "text-foreground"
                                            : "text-muted-foreground"
                                    }`}
                                    numberOfLines={1}
                                >
                                    {remark.trim() ? remark : "无备注"}
                                </Text>
                                <Icon
                                    as={ChevronRight}
                                    size={16}
                                    className="text-muted-foreground"
                                />
                            </View>
                        </Pressable>
                    </View>
                </View>

                {/* 费用明细 */}
                <View className="mx-4 mt-3 overflow-hidden rounded-xl bg-card">
                    <View className="px-3 pb-2 pt-3">
                        <Text className="text-sm font-puhui-regular text-foreground">
                            费用明细
                        </Text>
                    </View>
                    <Separator className="bg-border" />
                    {(preview?.pricing?.items ?? []).map(
                        (item: {
                            key: string;
                            label: string;
                            amount: number;
                        }) => (
                            <View key={item.key}>
                                <View className="px-3 py-3">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-xs font-puhui-regular text-muted-foreground">
                                            {item.label}：
                                        </Text>
                                        <Text className="text-xs font-din-alt-bold text-foreground">
                                            ￥{item.amount.toFixed(2)}
                                        </Text>
                                    </View>
                                </View>
                                <Separator className="bg-border" />
                            </View>
                        ),
                    )}
                    <Separator className="bg-border" />
                    <View className="px-3 py-3">
                        <View className="flex-row items-center justify-between">
                            <Text className="text-xs font-puhui-regular text-muted-foreground">
                                合计：
                            </Text>
                            <View className="flex-row items-baseline">
                                <Text className="text-xs font-puhui-regular text-foreground">
                                    ￥
                                </Text>
                                <Text className="text-lg font-din-alt-bold text-primary">
                                    {totalAmount.toFixed(2)}
                                </Text>
                            </View>
                        </View>
                    </View>
                </View>

                {/* 温馨提示 */}
                {/* <View className="mx-4 mt-3">
                    <Text className="text-sm font-puhui-regular text-foreground">
                        温馨提示：
                    </Text>
                    <Text className="mt-2 text-xs font-puhui-regular leading-5 text-muted-foreground">
                        {warmTip}
                    </Text>
                </View> */}

                {/* 协议勾选 */}
                <View className="mx-4 mt-4 flex-row items-center">
                    <View className="h-4 w-4 items-center justify-center rounded-full bg-primary">
                        <View className="h-2 w-2 rounded-full bg-card" />
                    </View>
                    <Text className="ml-2 text-xs font-puhui-regular text-foreground">
                        同意
                        <Text className="text-xs font-puhui-regular text-primary">
                            《服务购买协议》
                        </Text>
                    </Text>
                </View>
            </ScrollView>

            {/* 底部栏 */}
            <View
                className="absolute bottom-0 left-0 right-0 bg-card px-4 py-3"
                style={{
                    shadowColor: "#000",
                    shadowOffset: { width: 0, height: -2 },
                    shadowOpacity: 0.08,
                    shadowRadius: 8,
                    elevation: 8,
                }}
            >
                <View className="flex-row items-center justify-between">
                    <View className="flex-row items-baseline">
                        <Text className="text-sm font-puhui-regular text-foreground">
                            合计：
                        </Text>
                        <Text className="ml-1 text-lg font-din-alt-bold text-primary">
                            ¥
                        </Text>
                        <Text className="text-xl font-din-alt-bold text-primary">
                            {totalAmount.toFixed(2)}
                        </Text>
                    </View>
                    <Button
                        onPress={openPaySheet}
                        className="h-10 w-[92px] rounded-full"
                    >
                        <Text className="text-sm font-puhui-medium text-primary-foreground">
                            立即支付
                        </Text>
                    </Button>
                </View>
            </View>

            <BottomSheetModal
                visible={isRemarkSheetVisible}
                onClose={closeRemarkSheet}
                initialHeightRatio={0.6}
                minHeightRatio={0.45}
                maxHeightRatio={0.8}
                backdropClassName="bg-foreground/30"
                sheetClassName="rounded-t-2xl bg-card"
            >
                <View className="flex-1 px-4 pb-6">
                    <View className="pt-3">
                        <View className="flex-row items-center justify-center">
                            <Text className="text-base font-puhui-medium text-foreground">
                                订单备注
                            </Text>
                            <Pressable
                                onPress={closeRemarkSheet}
                                className="absolute right-0 h-8 w-8 items-center justify-center"
                                hitSlop={8}
                            >
                                <Icon
                                    as={X}
                                    size={20}
                                    className="text-muted-foreground"
                                />
                            </Pressable>
                        </View>
                    </View>
                    <View className="mt-4 flex-1 rounded-xl bg-muted/30 px-3 py-3">
                        <Textarea
                            value={remarkDraft}
                            onChangeText={setRemarkDraft}
                            placeholder="选填，请先和商家协商一致，付款后商家可见"
                            maxLength={200}
                            className="flex-1 border-0 bg-transparent px-0 py-0 text-xs font-puhui-regular"
                        />
                        <Text className="mt-2 text-right text-xs font-puhui-regular text-muted-foreground">
                            {remarkDraft.length}/200
                        </Text>
                    </View>
                    <Button
                        onPress={confirmRemark}
                        className="mt-6 h-11 w-full rounded-full bg-primary"
                    >
                        <Text className="text-base font-puhui-medium text-primary-foreground">
                            确定
                        </Text>
                    </Button>
                </View>
            </BottomSheetModal>

            <ServiceTimePickerSheet
                visible={isServiceTimeSheetVisible}
                onClose={() => setIsServiceTimeSheetVisible(false)}
                workStartTime={preview?.servicePersonnel?.workStartTime}
                workEndTime={preview?.servicePersonnel?.workEndTime}
                workDays={preview?.servicePersonnel?.workDays}
            />

            {preview && selectedSpec ? (
                <PaySheet
                    visible={isPaySheetVisible}
                    onClose={() => setIsPaySheetVisible(false)}
                    totalAmount={totalAmount}
                    orderData={{
                        customerId,
                        serviceId,
                        addressId: preview.address?.id ?? "",
                        appointmentTime: appointmentTime ?? "",
                        designatedPersonnelId: personnelId,
                        specificationId: selectedSpec.id,
                        displayPrice: serviceFeeAmount,
                        remark: remark.trim() ? remark.trim() : undefined,
                        ...(preview.pricing.discountAmount > 0
                            ? { discountAmount: preview.pricing.discountAmount }
                            : {}),
                    }}
                />
            ) : null}
        </View>
    );
}
