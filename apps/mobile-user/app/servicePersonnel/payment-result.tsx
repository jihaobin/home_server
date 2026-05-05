import { Button } from "@repo/mobile-ui/components/ui/button";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Separator } from "@repo/mobile-ui/components/ui/separator";
import { Text } from "@repo/mobile-ui/components/ui/text";
import {
    useFocusEffect,
    useLocalSearchParams,
    useNavigation,
    useRouter,
} from "expo-router";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { useCallback, useState } from "react";
import { BackHandler, RefreshControl, ScrollView, View } from "react-native";
import Animated, { FadeIn, SlideInDown } from "react-native-reanimated";
import { apiClient } from "@repo/lib/http-client";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";

const ICON_MAP = lucideIconRegistry;

const paymentMethodLabels: Record<string, string> = {
    wechat: "微信支付",
    wechat_pay: "微信支付",
    alipay: "支付宝支付",
    balance: "余额支付",
};

const ORDER_STATUS_LABELS: Record<string, string> = {
    pending_payment: "待付款",
    payment_timeout: "支付超时",
    pending_acceptance: "待接单",
    staff_rejected: "服务人员拒单",
    paid: "待服务",
    completed: "已完成",
    cancelled: "已取消",
    refunded: "已退款",
};

export default function PaymentResultScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{
        success: string;
        orderId: string;
        amount: string;
        paymentMethod: string;
    }>();
    const navigation = useNavigation();
    const [orderStatusText, setOrderStatusText] = useState<string | null>(null);
    const { refreshing, showPageLoading, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: async () => {
            if (!params.orderId) {
                setOrderStatusText("缺少订单号，无法刷新状态");
                return;
            }

            try {
                const response = await apiClient.get<{ status: string }>(
                    `/order/${params.orderId}`,
                );
                if (response?.data?.status) {
                    const statusLabel =
                        ORDER_STATUS_LABELS[response.data.status] ??
                        response.data.status;
                    setOrderStatusText(statusLabel);
                }
            } catch {
                setOrderStatusText("获取订单状态失败");
            }
        },
    });

    // 拦截返回操作，统一返回首页(防止用户重复下单)
    useFocusEffect(
        useCallback(() => {
            const redirectToHome = () => {
                router.replace("/(tabs)");
                return true;
            };

            const hardwareBackSub = BackHandler.addEventListener(
                "hardwareBackPress",
                redirectToHome,
            );

            const removeBeforeRemove = navigation.addListener(
                "beforeRemove",
                (event) => {
                    if (event.data.action?.type !== "GO_BACK") {
                        return;
                    }

                    event.preventDefault();
                    redirectToHome();
                },
            );

            return () => {
                hardwareBackSub.remove();
                removeBeforeRemove();
            };
        }, [navigation]),
    );

    const isSuccess = params.success === "true";
    const amount = Number.parseFloat(params.amount || "0");

    return (
        <View className="flex-1 bg-background">
            {/* 主内容区域 */}
            <ScrollView
                className="flex-1"
                contentContainerStyle={{
                    flexGrow: 1,
                    justifyContent: "center",
                }}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                    />
                }
            >
                <View className="flex-1 items-center justify-center px-6">
                    {showPageLoading ? (
                        <View className="items-center">
                            <Text className="text-sm font-puhui-regular text-muted-foreground">
                                正在刷新支付结果...
                            </Text>
                        </View>
                    ) : (
                        <>
                            {/* 成功/失败图标 */}
                            <Animated.View
                                entering={FadeIn.duration(500)}
                                className={`mb-6 h-24 w-24 items-center justify-center rounded-full ${
                                    isSuccess
                                        ? "bg-primary/10"
                                        : "bg-destructive/10"
                                }`}
                            >
                                <Icon
                                    as={isSuccess ? ICON_MAP.Check : ICON_MAP.X}
                                    size={48}
                                    className={
                                        isSuccess
                                            ? "text-primary"
                                            : "text-destructive"
                                    }
                                />
                            </Animated.View>

                            {/* 标题 */}
                            <Animated.View
                                entering={SlideInDown.delay(100).duration(400)}
                            >
                                <Text className="text-2xl font-bold text-foreground">
                                    {isSuccess ? "支付成功" : "支付失败"}
                                </Text>
                            </Animated.View>

                            {/* 金额 */}
                            {isSuccess && (
                                <Animated.View
                                    entering={SlideInDown.delay(200).duration(
                                        400,
                                    )}
                                    className="mt-4"
                                >
                                    <View className="flex-row items-baseline">
                                        <Text className="text-lg text-muted-foreground">
                                            ¥
                                        </Text>
                                        <Text className="text-4xl font-bold text-foreground">
                                            {amount.toFixed(2)}
                                        </Text>
                                    </View>
                                </Animated.View>
                            )}

                            {/* 详细信息卡片 */}
                            <Animated.View
                                entering={SlideInDown.delay(300).duration(400)}
                                className="mt-8 w-full rounded-2xl border border-border bg-card p-6"
                            >
                                <View className="space-y-4">
                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm text-muted-foreground">
                                            订单编号
                                        </Text>
                                        <Text className="text-sm font-medium text-foreground">
                                            {params.orderId}
                                        </Text>
                                    </View>

                                    <Separator className="bg-border" />

                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm text-muted-foreground">
                                            支付方式
                                        </Text>
                                        <Text className="text-sm font-medium text-foreground">
                                            {paymentMethodLabels[
                                                params.paymentMethod
                                            ] || "未知"}
                                        </Text>
                                    </View>

                                    <Separator className="bg-border" />

                                    <View className="flex-row items-center justify-between">
                                        <Text className="text-sm text-muted-foreground">
                                            支付时间
                                        </Text>
                                        <Text className="text-sm font-medium text-foreground">
                                            {new Date().toLocaleString(
                                                "zh-CN",
                                                {
                                                    year: "numeric",
                                                    month: "2-digit",
                                                    day: "2-digit",
                                                    hour: "2-digit",
                                                    minute: "2-digit",
                                                },
                                            )}
                                        </Text>
                                    </View>
                                </View>
                            </Animated.View>

                            {/* 提示信息 */}
                            {isSuccess && (
                                <Animated.View
                                    entering={SlideInDown.delay(400).duration(
                                        400,
                                    )}
                                    className="mt-6 rounded-xl border border-primary/20 bg-primary/5 p-4"
                                >
                                    <View className="flex-row items-start gap-1">
                                        <Icon
                                            as={ICON_MAP.Info}
                                            size={15}
                                            className="mt-0.5 text-primary"
                                        />
                                        <Text className="ml-2text-sm leading-5 text-foreground">
                                            师傅已收到订单通知,将在预约时间准时上门服务,请保持手机畅通。
                                        </Text>
                                    </View>
                                </Animated.View>
                            )}
                            {orderStatusText ? (
                                <View className="mt-4 rounded-lg bg-muted/40 px-3 py-2">
                                    <Text className="text-xs text-muted-foreground">
                                        最新订单状态：{orderStatusText}
                                    </Text>
                                </View>
                            ) : null}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* 底部按钮 */}
            <Animated.View
                entering={SlideInDown.delay(500).duration(400)}
                className="border-t border-border bg-background px-6 pb-8 pt-4"
            >
                <View className="flex flex-col gap-4">
                    {isSuccess ? (
                        <>
                            <Button
                                onPress={() =>
                                    router.push({
                                        pathname: "/(tabs)/orders",
                                        params: {
                                            requestId: String(Date.now()),
                                        },
                                    })
                                }
                                className="h-12 w-full rounded-full bg-primary"
                            >
                                <Text className="text-base font-semibold text-primary-foreground">
                                    查看订单
                                </Text>
                            </Button>
                            <Button
                                onPress={() => router.push("/(tabs)")}
                                className="h-12 w-full rounded-full border-2 border-border bg-transparent"
                            >
                                <Text className="text-base font-semibold text-foreground">
                                    返回首页
                                </Text>
                            </Button>
                        </>
                    ) : (
                        <>
                            <Button
                                onPress={() => router.back()}
                                className="h-12 w-full rounded-full bg-primary"
                            >
                                <Text className="text-base font-semibold text-primary-foreground">
                                    重新支付
                                </Text>
                            </Button>
                            <Button
                                onPress={() => router.push("/(tabs)")}
                                className="h-12 w-full rounded-full border-2 border-border bg-transparent"
                            >
                                <Text className="text-base font-semibold text-foreground">
                                    返回首页
                                </Text>
                            </Button>
                        </>
                    )}
                </View>
            </Animated.View>
        </View>
    );
}
