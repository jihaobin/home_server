import { Ionicons } from "@expo/vector-icons";
import {
    useAcceptOrder,
    useCancelOrder,
    useOrderDetail,
    useRejectOrder,
    useRescheduleOrder,
} from "@repo/hooks/api/order";
import { useChatUpsertConversation } from "@repo/hooks/api/chat";
import { useGlobalPageRefresh } from "@repo/hooks/use-global-page-refresh";
import type { AssignmentDecisionStatus } from "@repo/types";
import { OrderRescheduleSheet } from "@/components/orders/OrderRescheduleSheet";
import { useLocalSearchParams, useRouter } from "expo-router";
import React, { Suspense, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Modal,
    Platform,
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from "react-native";
import { ErrorBoundary } from "react-error-boundary";
import { SafeAreaView } from "react-native-safe-area-context";
import { executeContactCustomerAction } from "@repo/mobile-ui/lib/contact-customer-action";

const SERVICE_TIME_WINDOW_STEP_MINUTES = 120;
const SERVICE_TIME_WINDOW_MS = 2 * 60 * 60 * 1000;
const RESCHEDULE_LOOKAHEAD_DAYS = 30;

const WEEKDAY_LABELS: Record<string, string> = {
    "1": "周一",
    "2": "周二",
    "3": "周三",
    "4": "周四",
    "5": "周五",
    "6": "周六",
    "7": "周日",
};

type HmsParts = {
    hours: number;
    minutes: number;
    seconds: number;
};

type StaffScheduleShape = {
    workStartTime?: unknown;
    workEndTime?: unknown;
    workDays?: unknown;
};

type RescheduleSlot = {
    start: Date;
    label: string;
};

function parseHms(timeStr: string): HmsParts | null {
    const match = /^([01]\d|2[0-3]):([0-5]\d):([0-5]\d)$/.exec(timeStr);
    if (!match) {
        return null;
    }
    return {
        hours: Number(match[1]),
        minutes: Number(match[2]),
        seconds: Number(match[3]),
    };
}

function resolveWorkBoundsForDate(params: {
    date: Date;
    workStartTime: string;
    workEndTime: string;
}) {
    const startParts = parseHms(params.workStartTime);
    const endParts = parseHms(params.workEndTime);
    if (!startParts || !endParts) {
        return null;
    }
    const start = new Date(
        params.date.getFullYear(),
        params.date.getMonth(),
        params.date.getDate(),
        startParts.hours,
        startParts.minutes,
        startParts.seconds,
        0,
    );
    let end = new Date(
        params.date.getFullYear(),
        params.date.getMonth(),
        params.date.getDate(),
        endParts.hours,
        endParts.minutes,
        endParts.seconds,
        0,
    );
    if (end.getTime() < start.getTime()) {
        end = new Date(end.getTime() + 24 * 60 * 60 * 1000);
    }
    return { start, end };
}

function resolveWeekdayValue(date: Date): string {
    const raw = date.getDay();
    const weekday = raw === 0 ? 7 : raw;
    return String(weekday);
}

function normalizeWorkDays(workDays: unknown): Set<string> {
    if (Array.isArray(workDays)) {
        return new Set(workDays.map((d) => String(d).trim()).filter(Boolean));
    }
    if (typeof workDays === "string") {
        return new Set(
            workDays
                .split("")
                .map((d) => d.trim())
                .filter(Boolean),
        );
    }
    return new Set();
}

function formatWorkDaysLabel(workDaySet: Set<string>) {
    if (!workDaySet.size) {
        return "未配置";
    }
    return Array.from(workDaySet)
        .sort((a, b) => Number(a) - Number(b))
        .map((day) => WEEKDAY_LABELS[day] ?? `周${day}`)
        .join("、");
}

function isSameTimeValue(left?: Date | null, right?: Date | null) {
    if (!left || !right) {
        return false;
    }
    return left.getTime() === right.getTime();
}

function findFirstAvailableRescheduleSlot(params: {
    base: Date;
    workStartTime: string;
    workEndTime: string;
    workDaySet: Set<string>;
    now: Date;
}) {
    for (let offset = 0; offset < RESCHEDULE_LOOKAHEAD_DAYS; offset += 1) {
        const date = new Date(params.base);
        date.setDate(date.getDate() + offset);

        if (!params.workDaySet.has(resolveWeekdayValue(date))) {
            continue;
        }

        const slots = buildTimeWindowSlots({
            date,
            workStartTime: params.workStartTime,
            workEndTime: params.workEndTime,
            now: params.now,
        });
        if (!slots.length) {
            continue;
        }

        if (offset === 0) {
            const exactSlot = slots.find((slot) =>
                isSameTimeValue(slot.start, params.base),
            );
            if (exactSlot) {
                return exactSlot.start;
            }

            const sameDayFutureSlot = slots.find(
                (slot) => slot.start.getTime() >= params.base.getTime(),
            );
            if (sameDayFutureSlot) {
                return sameDayFutureSlot.start;
            }
        }

        return slots[0].start;
    }

    return null;
}

function resolveSlotForSelectedDate(params: {
    date: Date;
    currentSelection: Date;
    workStartTime: string;
    workEndTime: string;
    now: Date;
}) {
    const slots = buildTimeWindowSlots({
        date: params.date,
        workStartTime: params.workStartTime,
        workEndTime: params.workEndTime,
        now: params.now,
    });
    if (!slots.length) {
        return null;
    }

    const exactSlot = slots.find((slot) =>
        isSameTimeValue(slot.start, params.currentSelection),
    );
    if (exactSlot) {
        return exactSlot.start;
    }

    const sameClockSlot = slots.find(
        (slot) =>
            slot.start.getHours() === params.currentSelection.getHours() &&
            slot.start.getMinutes() === params.currentSelection.getMinutes(),
    );
    if (sameClockSlot) {
        return sameClockSlot.start;
    }

    return slots[0].start;
}

function buildTimeWindowSlots(params: {
    date: Date;
    workStartTime: string;
    workEndTime: string;
    now: Date;
}): RescheduleSlot[] {
    const bounds = resolveWorkBoundsForDate({
        date: params.date,
        workStartTime: params.workStartTime,
        workEndTime: params.workEndTime,
    });
    if (!bounds) {
        return [];
    }

    const stepMs = SERVICE_TIME_WINDOW_STEP_MINUTES * 60 * 1000;
    const nowMs = params.now.getTime();
    const slots: RescheduleSlot[] = [];

    for (
        let t = bounds.start.getTime();
        t <= bounds.end.getTime();
        t += stepMs
    ) {
        if (t < nowMs) {
            continue;
        }
        const start = new Date(t);
        const end = new Date(t + SERVICE_TIME_WINDOW_MS);
        const hh = `${start.getHours()}`.padStart(2, "0");
        const mi = `${start.getMinutes()}`.padStart(2, "0");
        const endHh = `${end.getHours()}`.padStart(2, "0");
        const endMi = `${end.getMinutes()}`.padStart(2, "0");
        slots.push({
            start,
            label: `${hh}:${mi}-${endHh}:${endMi}`,
        });
    }

    return slots;
}

const ORDER_STATUS_DISPLAY: Record<
    string,
    { label: string; color: string; description: string }
> = {
    pending_payment: {
        label: "待支付",
        color: "#FF9800",
        description: "等待客户完成支付以锁定预约档期",
    },
    payment_timeout: {
        label: "支付超时",
        color: "#9E9E9E",
        description: "支付已超时，系统自动释放预约档期",
    },
    pending_acceptance: {
        label: "待接单",
        color: "#FFB300",
        description: "等待您确认是否接单",
    },
    staff_rejected: {
        label: "已拒绝",
        color: "#9E9E9E",
        description: "您已拒绝该订单，客服将继续协助客户",
    },
    paid: {
        label: "待服务",
        color: "#FF9800",
        description: "客户已支付，等待上门服务",
    },
    in_progress: {
        label: "服务中",
        color: "#4CAF50",
        description: "服务进行中，请关注现场情况",
    },
    completed: {
        label: "已完成",
        color: "#2196F3",
        description: "订单服务完成，等待后台确认",
    },
    cancelled: {
        label: "已取消",
        color: "#9E9E9E",
        description: "订单已取消，无需处理",
    },
    refunded: {
        label: "已退款",
        color: "#9E9E9E",
        description: "订单已走退款流程，注意查收通知",
    },
};

const DECISION_STATUS_DISPLAY: Record<
    AssignmentDecisionStatus,
    { label: string; color: string; description: string }
> = {
    pending: {
        label: "待接单确认",
        color: "#FFB300",
        description: "请尽快确认是否接单，系统会在倒计时后重新派单",
    },
    accepted: {
        label: "已确认接单",
        color: "#4CAF50",
        description: "您已确认接单，记得按时到达服务地点",
    },
    rejected: {
        label: "已拒绝",
        color: "#9E9E9E",
        description: "拒绝原因已同步给客服",
    },
};

const ASSIGNMENT_TYPE_LABELS: Record<string, string> = {
    system_auto: "系统派单",
    customer_designated: "客户指定",
    grab: "抢单",
};

const DEFAULT_CANCEL_REASON = "服务人员取消：与客户协商";

const DetailSkeleton = () => (
    <View style={styles.skeletonContainer}>
        <ActivityIndicator size="large" color="#2196F3" />
        <Text style={styles.skeletonText}>加载订单详情...</Text>
    </View>
);

function DetailErrorFallback({
    error,
    resetErrorBoundary,
}: {
    error: Error;
    resetErrorBoundary: () => void;
}) {
    return (
        <View style={styles.errorContainer}>
            <Text style={styles.errorTitle}>无法加载订单</Text>
            <Text style={styles.errorMessage}>
                {error.message || "请稍后再试"}
            </Text>
            <TouchableOpacity
                style={styles.retryButton}
                onPress={resetErrorBoundary}
            >
                <Text style={styles.retryText}>重新加载</Text>
            </TouchableOpacity>
        </View>
    );
}

type InfoRowProps = {
    icon: React.ComponentProps<typeof Ionicons>["name"];
    label: string;
    value: React.ReactNode;
};

const InfoRow = ({ icon, label, value }: InfoRowProps) => (
    <View style={styles.infoRow}>
        <Ionicons name={icon} size={18} color="#666" />
        <View style={styles.infoColumn}>
            <Text style={styles.infoLabel}>{label}</Text>
            {typeof value === "string" || typeof value === "number" ? (
                <Text style={styles.infoValue}>{value}</Text>
            ) : (
                value
            )}
        </View>
    </View>
);

type TimelineItem = {
    key: string;
    label: string;
    value: string;
    note?: string;
};

export default function OrderDetailScreen() {
    const router = useRouter();
    const params = useLocalSearchParams<{ id?: string | string[] }>();
    const orderIdParam = params.id;
    const orderId = Array.isArray(orderIdParam)
        ? orderIdParam[0]
        : orderIdParam;

    if (!orderId) {
        return (
            <View style={styles.errorContainer}>
                <Text style={styles.errorTitle}>未找到订单</Text>
                <TouchableOpacity
                    style={styles.retryButton}
                    onPress={() => router.back()}
                >
                    <Text style={styles.retryText}>返回订单列表</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <ErrorBoundary FallbackComponent={DetailErrorFallback}>
            <Suspense fallback={<DetailSkeleton />}>
                <OrderDetailContent orderId={orderId} />
            </Suspense>
        </ErrorBoundary>
    );
}

function OrderDetailContent({ orderId }: { orderId: string }) {
    const router = useRouter();
    const { data: order, refetch: refetchOrderDetail } =
        useOrderDetail(orderId);
    const { refreshing, onRefresh } = useGlobalPageRefresh({
        refetchActiveQueries: false,
        extraRefresh: () =>
            refetchOrderDetail({
                throwOnError: false,
            }),
    });
    const upsertChatConversation = useChatUpsertConversation();
    const cancelOrder = useCancelOrder();
    const acceptOrder = useAcceptOrder();
    const rejectOrder = useRejectOrder();
    const rescheduleOrder = useRescheduleOrder();
    const [cancelModalVisible, setCancelModalVisible] = useState(false);
    const [cancelReason, setCancelReason] = useState(DEFAULT_CANCEL_REASON);
    const [cancelReasonError, setCancelReasonError] = useState<string | null>(
        null,
    );
    const [rejectModalVisible, setRejectModalVisible] = useState(false);
    const [rejectReason, setRejectReason] = useState("无法提供服务：行程冲突");
    const [rejectReasonError, setRejectReasonError] = useState<string | null>(
        null,
    );

    const [rescheduleModalVisible, setRescheduleModalVisible] = useState(false);
    const [rescheduleDraft, setRescheduleDraft] = useState<Date>(() => {
        const base = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        return base && !Number.isNaN(base.getTime()) ? base : new Date();
    });
    const currentAppointment = React.useMemo(() => {
        const base = order.appointmentTime
            ? new Date(order.appointmentTime)
            : null;
        return base && !Number.isNaN(base.getTime()) ? base : null;
    }, [order.appointmentTime]);
    const staffSchedule = React.useMemo(() => {
        const schedule = order.assignment?.servicePersonnel as
            | StaffScheduleShape
            | undefined;
        const workStartTime =
            typeof schedule?.workStartTime === "string"
                ? schedule.workStartTime
                : null;
        const workEndTime =
            typeof schedule?.workEndTime === "string"
                ? schedule.workEndTime
                : null;
        const workDaySet = normalizeWorkDays(schedule?.workDays);

        return {
            workStartTime,
            workEndTime,
            workDaySet,
            workDaysLabel: formatWorkDaysLabel(workDaySet),
            isConfigured:
                Boolean(workStartTime) &&
                Boolean(workEndTime) &&
                workDaySet.size > 0,
        };
    }, [order.assignment?.servicePersonnel]);

    const rescheduleAvailability = React.useMemo(() => {
        if (!staffSchedule.isConfigured) {
            return {
                canReschedule: false,
                title: "暂时无法改期",
                message:
                    "后台尚未配置完整的工作日或工作时间，当前无法生成符合规则的预约窗口。",
                workStartTime: staffSchedule.workStartTime,
                workEndTime: staffSchedule.workEndTime,
                workDaysLabel: staffSchedule.workDaysLabel,
                selectedSlot: null as RescheduleSlot | null,
                slots: [] as RescheduleSlot[],
            };
        }

        const weekday = resolveWeekdayValue(rescheduleDraft);
        const isWorkday = staffSchedule.workDaySet.has(weekday);
        if (!isWorkday) {
            return {
                canReschedule: false,
                title: "当天不可改期",
                message: `该日期不在您的工作日范围内，当前仅支持 ${staffSchedule.workDaysLabel}。`,
                workStartTime: staffSchedule.workStartTime,
                workEndTime: staffSchedule.workEndTime,
                workDaysLabel: staffSchedule.workDaysLabel,
                selectedSlot: null as RescheduleSlot | null,
                slots: [] as RescheduleSlot[],
            };
        }

        const slots = buildTimeWindowSlots({
            date: rescheduleDraft,
            workStartTime: staffSchedule.workStartTime as string,
            workEndTime: staffSchedule.workEndTime as string,
            now: new Date(),
        });
        if (!slots.length) {
            return {
                canReschedule: false,
                title: "当天无可用时间段",
                message:
                    "当前日期内已没有可选的 2 小时窗口起点（可能已过工作时间或时间段已过去）。请换一天试试。",
                workStartTime: staffSchedule.workStartTime,
                workEndTime: staffSchedule.workEndTime,
                workDaysLabel: staffSchedule.workDaysLabel,
                selectedSlot: null as RescheduleSlot | null,
                slots,
            };
        }

        const selectedSlot =
            slots.find((slot) => isSameTimeValue(slot.start, rescheduleDraft)) ??
            null;

        return {
            canReschedule: true,
            title: `当天可选时间段（${slots.length} 个）`,
            message:
                "先选择日期，再从下方时间段中选择 1 个 2 小时到达窗口；提交时只会上传窗口起点。",
            workStartTime: staffSchedule.workStartTime,
            workEndTime: staffSchedule.workEndTime,
            workDaysLabel: staffSchedule.workDaysLabel,
            selectedSlot,
            slots,
        };
    }, [rescheduleDraft, staffSchedule]);
    const selectedRescheduleTime = rescheduleAvailability.selectedSlot?.start;
    const selectedRescheduleText = formatDateTime(selectedRescheduleTime);
    const hasRescheduleChanged =
        Boolean(selectedRescheduleTime) &&
        (!currentAppointment ||
            !isSameTimeValue(currentAppointment, selectedRescheduleTime));

    const statusMeta =
        ORDER_STATUS_DISPLAY[order.status] ?? ORDER_STATUS_DISPLAY.cancelled;
    const assignmentDecision = order.assignment?.decisionStatus ?? null;
    const decisionMeta = assignmentDecision
        ? DECISION_STATUS_DISPLAY[assignmentDecision]
        : null;
    const canDecideAssignment =
        order.status === "pending_acceptance" &&
        assignmentDecision === "pending";
    // 订单是否可取消由后端统一裁决（避免端上复制状态机）。
    const canCancel =
        typeof order.canCancel === "boolean"
            ? order.canCancel
            : [
                  "pending_payment",
                  "pending_acceptance",
                  "paid",
                  "staff_rejected",
              ].includes(order.status as string);
    const canReschedule = ["pending_acceptance", "paid"].includes(
        order.status as string,
    );
    const description =
        (order as { remark?: string; note?: string; description?: string })
            .remark ??
        (order as { note?: string; description?: string }).note ??
        (order as { note?: string; description?: string }).description ??
        "暂无补充说明";
    const assignment = order.assignment;
    const summaryMetrics = [
        {
            key: "appointment",
            label: "预约时间",
            value: formatDateTime(order.appointmentTime) ?? "未排期",
        },
        {
            key: "amount",
            label: "应付金额",
            value: formatCurrency(order.totalAmount),
        },
    ];
    const couponText = order.couponCode
        ? `已使用优惠券：${order.couponCode}`
        : "未使用优惠券";
    const contactName = order.address?.recipientName ?? "未提供";
    const contactPhone = order.address?.recipientPhone ?? "未提供";
    const addressText = order.address?.detailedAddress ?? "暂未填写";
    const serviceDescription = order.service?.description ?? "暂无服务说明";
    const amountOriginalText = formatCurrency(order.originalAmount);
    const amountDiscountText = order.discountAmount
        ? `- ${formatCurrency(order.discountAmount)}`
        : "无优惠";
    const amountTotalText = formatCurrency(order.totalAmount);
    const assignmentTypeLabel = assignment?.assignmentType
        ? (ASSIGNMENT_TYPE_LABELS[assignment.assignmentType] ?? "系统派单")
        : "系统派单";
    const decisionDescription =
        decisionMeta?.description ??
        "系统正在同步派单状态，稍后刷新即可查看最新结果。";
    const assignedAtText = formatDateTime(assignment?.assignedAt);
    const acceptedAtText = formatDateTime(assignment?.acceptedAt);
    const rejectedAtText = formatDateTime(assignment?.rejectedAt);
    const timelineItems: TimelineItem[] = [];
    const appointmentText = formatDateTime(order.appointmentTime);
    if (appointmentText) {
        timelineItems.push({
            key: "appointment",
            label: "预约时间",
            value: appointmentText,
        });
    }
    if (assignedAtText) {
        timelineItems.push({
            key: "assigned",
            label: "派单时间",
            value: assignedAtText,
        });
    }
    if (acceptedAtText) {
        timelineItems.push({
            key: "accepted",
            label: "接单时间",
            value: acceptedAtText,
        });
    }
    const serviceStartText = formatDateTime(order.serviceStartedAt);
    if (serviceStartText) {
        timelineItems.push({
            key: "serviceStart",
            label: "开始服务",
            value: serviceStartText,
        });
    }
    const serviceCompleteText = formatDateTime(order.serviceCompletedAt);
    if (serviceCompleteText) {
        timelineItems.push({
            key: "serviceComplete",
            label: "完成服务",
            value: serviceCompleteText,
        });
    }
    const cancelledText = formatDateTime(order.cancelledAt);
    if (cancelledText) {
        timelineItems.push({
            key: "cancelled",
            label: "取消时间",
            value: cancelledText,
            note: order.cancelReason ?? undefined,
        });
    }

    const openCancelModal = () => {
        setCancelReason(DEFAULT_CANCEL_REASON);
        setCancelReasonError(null);
        setCancelModalVisible(true);
    };

    const closeCancelModal = () => {
        setCancelModalVisible(false);
        setCancelReasonError(null);
    };

    const handleCancelConfirm = async () => {
        const trimmed = cancelReason.trim();
        if (!trimmed) {
            setCancelReasonError("请输入取消原因");
            return;
        }

        try {
            await cancelOrder.mutateAsync({ orderId, reason: trimmed });
            Alert.alert("已取消", "订单已标记为取消");
            closeCancelModal();
            router.back();
        } catch (error) {
            Alert.alert("取消失败", (error as Error)?.message ?? "请稍后再试");
        }
    };

    const handleAccept = async () => {
        try {
            await acceptOrder.mutateAsync({ orderId });
            Alert.alert("接单成功", "已为您保留该预约");
        } catch (error) {
            Alert.alert("接单失败", (error as Error)?.message ?? "请稍后再试");
        }
    };

    const openRejectModal = () => {
        setRejectReason("无法提供服务：行程冲突");
        setRejectReasonError(null);
        setRejectModalVisible(true);
    };

    const closeRejectModal = () => {
        setRejectModalVisible(false);
        setRejectReasonError(null);
    };

    const openRescheduleModal = () => {
        const fallback = currentAppointment ?? new Date();
        const initialSlot = staffSchedule.isConfigured
            ? findFirstAvailableRescheduleSlot({
                  base: fallback,
                  workStartTime: staffSchedule.workStartTime as string,
                  workEndTime: staffSchedule.workEndTime as string,
                  workDaySet: staffSchedule.workDaySet,
                  now: new Date(),
              })
            : null;

        setRescheduleDraft(initialSlot ?? fallback);
        setRescheduleModalVisible(true);
    };

    const closeRescheduleModal = () => {
        if (rescheduleOrder.isPending) {
            return;
        }
        setRescheduleModalVisible(false);
    };

    const handleRescheduleConfirm = async () => {
        if (rescheduleOrder.isPending) {
            return;
        }
        if (!rescheduleAvailability.canReschedule) {
            Alert.alert(
                rescheduleAvailability.title,
                rescheduleAvailability.message,
            );
            return;
        }
        if (!selectedRescheduleTime) {
            Alert.alert(
                "无法提交",
                "请先从下方可用时间段中选择一个新的预约窗口。",
            );
            return;
        }
        if (!hasRescheduleChanged) {
            Alert.alert(
                "预约时间未变化",
                "当前选择与原预约窗口一致，请重新选择其他时间段。",
            );
            return;
        }
        try {
            await rescheduleOrder.mutateAsync({
                orderId,
                appointmentTime: selectedRescheduleTime.toISOString(),
            });
            setRescheduleModalVisible(false);
            Alert.alert("调整成功", "已按新的预约窗口更新时间");
        } catch (error) {
            Alert.alert("调整失败", (error as Error)?.message ?? "请稍后再试");
        }
    };

    const handleRejectConfirm = async () => {
        const trimmed = rejectReason.trim();
        if (!trimmed) {
            setRejectReasonError("请输入拒绝原因");
            return;
        }
        try {
            await rejectOrder.mutateAsync({ orderId, reason: trimmed });
            Alert.alert("已拒绝", "系统会尽快通知客服与客户");
            closeRejectModal();
            router.back();
        } catch (error) {
            Alert.alert("拒绝失败", (error as Error)?.message ?? "请稍后再试");
        }
    };

    const handleChatWithCustomer = () => {
        executeContactCustomerAction();
    };

    const handleSendOrderCardToCustomer = async () => {
        try {
            const peerUserId = (order as { customerId?: string }).customerId;
            if (!peerUserId) {
                Alert.alert("无法发送", "未找到客户账号信息");
                return;
            }
            const conversation = await upsertChatConversation.mutateAsync({
                dto: { peerUserId },
                clientRole: "service_personnel",
            });
            router.push(
                `/chat/${conversation.id}?draftOrderId=${encodeURIComponent(order.id)}` as never,
            );
        } catch (error) {
            Alert.alert("发送失败", (error as Error)?.message ?? "请稍后再试");
        }
    };
    return (
        <SafeAreaView style={styles.container}>
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={() => {
                            void onRefresh();
                        }}
                        tintColor="#2196F3"
                    />
                }
            >
                <View style={styles.card}>
                    <View style={styles.orderHeader}>
                        <View style={{ flex: 1 }}>
                            <Text style={styles.orderService}>
                                {order.service?.name ?? "未知服务"}
                            </Text>
                            <Text style={styles.orderSerial}>
                                订单号：{order.orderSerial}
                            </Text>
                        </View>
                        <View style={styles.headerBadges}>
                            <View
                                style={[
                                    styles.statusBadge,
                                    { backgroundColor: statusMeta.color },
                                ]}
                            >
                                <Text style={styles.statusText}>
                                    {statusMeta.label}
                                </Text>
                            </View>
                            {decisionMeta ? (
                                <View
                                    style={[
                                        styles.decisionBadge,
                                        { borderColor: decisionMeta.color },
                                    ]}
                                >
                                    <Text
                                        style={[
                                            styles.decisionText,
                                            { color: decisionMeta.color },
                                        ]}
                                    >
                                        {decisionMeta.label}
                                    </Text>
                                </View>
                            ) : null}
                        </View>
                    </View>
                    <Text style={styles.statusDescription}>
                        {statusMeta.description}
                    </Text>
                    <View style={styles.summaryGrid}>
                        {summaryMetrics.map((item) => (
                            <View key={item.key} style={styles.summaryTile}>
                                <Text style={styles.summaryTileLabel}>
                                    {item.label}
                                </Text>
                                <Text style={styles.summaryTileValue}>
                                    {item.value}
                                </Text>
                            </View>
                        ))}
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>金额概览</Text>
                    <View style={styles.amountRow}>
                        <View style={[styles.amountBox, styles.amountHalfBox]}>
                            <Text style={styles.amountLabel}>原价金额</Text>
                            <Text style={styles.amountValue}>
                                {amountOriginalText}
                            </Text>
                        </View>
                        <View
                            style={[
                                styles.amountBox,
                                styles.amountHalfBox,
                                styles.amountHalfBoxLast,
                            ]}
                        >
                            <Text style={styles.amountLabel}>优惠抵扣</Text>
                            <Text
                                style={[
                                    styles.amountValue,
                                    order.discountAmount
                                        ? styles.amountDiscount
                                        : styles.amountMuted,
                                ]}
                            >
                                {amountDiscountText}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.amountRow}>
                        <View style={styles.amountBox}>
                            <Text style={styles.amountLabel}>应付金额</Text>
                            <Text style={styles.amountTotal}>
                                {amountTotalText}
                            </Text>
                            <Text style={styles.amountHint}>{couponText}</Text>
                        </View>
                    </View>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>服务地点与客户信息</Text>
                    <InfoRow
                        icon="person-circle-outline"
                        label="联系人"
                        value={contactName}
                    />
                    <InfoRow
                        icon="call-outline"
                        label="联系电话"
                        value={contactPhone}
                    />
                    <InfoRow
                        icon="navigate-outline"
                        label="服务地址"
                        value={addressText}
                    />
                    <TouchableOpacity
                        style={styles.chatButton}
                        onPress={handleChatWithCustomer}
                    >
                        <Text style={styles.chatButtonText}>联系客户</Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>服务说明</Text>
                    <Text style={styles.descText}>{serviceDescription}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>备注 & 要求</Text>
                    <Text style={styles.descText}>{description}</Text>
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>服务进展</Text>
                    {timelineItems.length ? (
                        timelineItems.map((item, index) => (
                            <View key={item.key} style={styles.timelineRow}>
                                <View style={styles.timelineIndicator}>
                                    <View style={styles.timelineDot} />
                                    {index < timelineItems.length - 1 ? (
                                        <View style={styles.timelineLine} />
                                    ) : null}
                                </View>
                                <View style={styles.timelineContent}>
                                    <Text style={styles.timelineLabel}>
                                        {item.label}
                                    </Text>
                                    <Text style={styles.timelineValue}>
                                        {item.value}
                                    </Text>
                                    {item.note ? (
                                        <Text style={styles.timelineNote}>
                                            {item.note}
                                        </Text>
                                    ) : null}
                                </View>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.descText}>
                            暂无进展记录，完成接单后即可查看时间节点。
                        </Text>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>派单信息</Text>
                    {assignment ? (
                        <>
                            <InfoRow
                                icon="swap-horizontal-outline"
                                label="指派方式"
                                value={assignmentTypeLabel}
                            />
                            <InfoRow
                                icon="people-outline"
                                label="接单状态"
                                value={
                                    <Text
                                        style={[
                                            styles.assignmentStatusText,
                                            {
                                                color:
                                                    decisionMeta?.color ??
                                                    "#333",
                                            },
                                        ]}
                                    >
                                        {decisionMeta?.label ?? "未指派"}
                                    </Text>
                                }
                            />
                            <Text style={styles.decisionDescription}>
                                {decisionDescription}
                            </Text>
                            {assignedAtText ? (
                                <InfoRow
                                    icon="time-outline"
                                    label="派单时间"
                                    value={assignedAtText}
                                />
                            ) : null}
                            {acceptedAtText ? (
                                <InfoRow
                                    icon="checkmark-circle-outline"
                                    label="接单时间"
                                    value={acceptedAtText}
                                />
                            ) : null}
                            {rejectedAtText ? (
                                <InfoRow
                                    icon="close-circle-outline"
                                    label="拒绝时间"
                                    value={rejectedAtText}
                                />
                            ) : null}
                            {assignment.rejectReason ? (
                                <View style={styles.noticeBox}>
                                    <Text style={styles.noticeLabel}>
                                        拒绝原因
                                    </Text>
                                    <Text style={styles.noticeText}>
                                        {assignment.rejectReason}
                                    </Text>
                                </View>
                            ) : null}
                        </>
                    ) : (
                        <Text style={styles.descText}>
                            该订单尚未派单，等待系统调度。
                        </Text>
                    )}
                </View>

                <View style={styles.card}>
                    <Text style={styles.cardTitle}>核验二维码</Text>
                    <Text style={styles.descText}>
                        客户端会展示核验二维码，您只需在上门服务时点击下方按钮前往扫码页面完成校验。
                    </Text>
                    <TouchableOpacity
                        style={styles.scanButton}
                        onPress={() => {
                            router.push("/scan" as never);
                        }}
                    >
                        <Text style={styles.scanButtonText}>前往扫码核验</Text>
                    </TouchableOpacity>
                </View>
            </ScrollView>

            {(canDecideAssignment || canCancel || canReschedule) && (
                <View style={styles.footer}>
                    {canDecideAssignment ? (
                        <>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.rejectButton,
                                ]}
                                onPress={openRejectModal}
                                disabled={
                                    rejectOrder.isPending ||
                                    acceptOrder.isPending
                                }
                            >
                                <Text style={styles.rejectText}>
                                    {rejectOrder.isPending
                                        ? "拒绝中..."
                                        : "拒绝接单"}
                                </Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.actionButton,
                                    styles.acceptButton,
                                ]}
                                onPress={handleAccept}
                                disabled={
                                    acceptOrder.isPending ||
                                    rejectOrder.isPending
                                }
                            >
                                <Text style={styles.acceptText}>
                                    {acceptOrder.isPending
                                        ? "确认中..."
                                        : "确认接单"}
                                </Text>
                            </TouchableOpacity>
                        </>
                    ) : null}
                    {canCancel ? (
                        <TouchableOpacity
                            style={[styles.actionButton, styles.cancelButton]}
                            onPress={openCancelModal}
                            disabled={cancelOrder.isPending}
                        >
                            <Text style={styles.cancelText}>
                                {cancelOrder.isPending
                                    ? "取消中..."
                                    : "取消订单"}
                            </Text>
                        </TouchableOpacity>
                    ) : null}

                    {canReschedule ? (
                        <TouchableOpacity
                            style={[
                                styles.actionButton,
                                styles.rescheduleButton,
                            ]}
                            onPress={openRescheduleModal}
                            disabled={
                                rescheduleOrder.isPending ||
                                acceptOrder.isPending ||
                                rejectOrder.isPending ||
                                cancelOrder.isPending
                            }
                        >
                            <Text style={styles.acceptText}>
                                {rescheduleOrder.isPending
                                    ? "调整中..."
                                    : "调整预约"}
                            </Text>
                        </TouchableOpacity>
                    ) : null}
                </View>
            )}

            <Modal
                visible={cancelModalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeCancelModal}
            >
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView
                        style={styles.modalWrapper}
                        behavior={Platform.select({
                            ios: "padding",
                            android: undefined,
                        })}
                    >
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>填写取消原因</Text>
                            <Text style={styles.modalSubtitle}>
                                该原因会同步给客服与用户，便于后续跟进。
                            </Text>
                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    cancelReasonError
                                        ? styles.inputError
                                        : null,
                                ]}
                                value={cancelReason}
                                onChangeText={(value) => {
                                    setCancelReason(value);
                                    if (cancelReasonError && value.trim()) {
                                        setCancelReasonError(null);
                                    }
                                }}
                                placeholder="例如：客户临时改期或地址无法到达"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                editable={!cancelOrder.isPending}
                            />
                            {cancelReasonError ? (
                                <Text style={styles.inputErrorText}>
                                    {cancelReasonError}
                                </Text>
                            ) : null}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.modalCancelButton,
                                    ]}
                                    onPress={closeCancelModal}
                                    disabled={cancelOrder.isPending}
                                >
                                    <Text style={styles.modalCancelText}>
                                        返回
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.modalConfirmButton,
                                        cancelOrder.isPending &&
                                            styles.modalButtonDisabled,
                                    ]}
                                    onPress={handleCancelConfirm}
                                    disabled={cancelOrder.isPending}
                                >
                                    {cancelOrder.isPending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalConfirmText}>
                                            确认取消
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>

            <OrderRescheduleSheet
                visible={rescheduleModalVisible}
                isPending={rescheduleOrder.isPending}
                draft={rescheduleDraft}
                currentAppointment={currentAppointment}
                selectedRescheduleTime={selectedRescheduleTime}
                currentAppointmentText={
                    formatDateTime(currentAppointment) ?? "未排期"
                }
                selectedRescheduleText={
                    selectedRescheduleText ?? "请选择下方可用时间段"
                }
                availability={rescheduleAvailability}
                stepMinutes={SERVICE_TIME_WINDOW_STEP_MINUTES}
                canConfirm={
                    rescheduleAvailability.canReschedule && hasRescheduleChanged
                }
                onClose={closeRescheduleModal}
                onConfirm={handleRescheduleConfirm}
                onDraftChange={(resolved) => {
                    if (!staffSchedule.isConfigured) {
                        setRescheduleDraft(resolved);
                        return;
                    }

                    const nextSlot = resolveSlotForSelectedDate({
                        date: resolved,
                        currentSelection:
                            selectedRescheduleTime ?? rescheduleDraft,
                        workStartTime: staffSchedule.workStartTime as string,
                        workEndTime: staffSchedule.workEndTime as string,
                        now: new Date(),
                    });

                    setRescheduleDraft(nextSlot ?? resolved);
                }}
                onSelectSlot={(slot) => setRescheduleDraft(slot)}
            />

            <Modal
                visible={rejectModalVisible}
                animationType="slide"
                transparent
                onRequestClose={closeRejectModal}
            >
                <View style={styles.modalBackdrop}>
                    <KeyboardAvoidingView
                        style={styles.modalWrapper}
                        behavior={Platform.select({
                            ios: "padding",
                            android: undefined,
                        })}
                    >
                        <View style={styles.modalCard}>
                            <Text style={styles.modalTitle}>填写拒绝原因</Text>
                            <Text style={styles.modalSubtitle}>
                                请说明无法接单的原因，客服会同步给客户。
                            </Text>
                            <TextInput
                                style={[
                                    styles.reasonInput,
                                    rejectReasonError
                                        ? styles.inputError
                                        : null,
                                ]}
                                value={rejectReason}
                                onChangeText={(value) => {
                                    setRejectReason(value);
                                    if (rejectReasonError && value.trim()) {
                                        setRejectReasonError(null);
                                    }
                                }}
                                placeholder="例如：行程冲突，无法在预约时间内到达"
                                multiline
                                numberOfLines={4}
                                textAlignVertical="top"
                                editable={!rejectOrder.isPending}
                            />
                            {rejectReasonError ? (
                                <Text style={styles.inputErrorText}>
                                    {rejectReasonError}
                                </Text>
                            ) : null}
                            <View style={styles.modalActions}>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.modalCancelButton,
                                    ]}
                                    onPress={closeRejectModal}
                                    disabled={rejectOrder.isPending}
                                >
                                    <Text style={styles.modalCancelText}>
                                        返回
                                    </Text>
                                </TouchableOpacity>
                                <TouchableOpacity
                                    style={[
                                        styles.modalButton,
                                        styles.modalConfirmButton,
                                        rejectOrder.isPending &&
                                            styles.modalButtonDisabled,
                                    ]}
                                    onPress={handleRejectConfirm}
                                    disabled={rejectOrder.isPending}
                                >
                                    {rejectOrder.isPending ? (
                                        <ActivityIndicator color="#fff" />
                                    ) : (
                                        <Text style={styles.modalConfirmText}>
                                            确认拒绝
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    </KeyboardAvoidingView>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

function getPaymentStatusColor(status: string) {
    switch (status) {
        case "succeeded":
            return "#2E7D32";
        case "failed":
            return "#D32F2F";
        case "refunded":
            return "#0288D1";
        case "pending":
        default:
            return "#FF9800";
    }
}

function formatDateTime(value?: string | Date | null) {
    if (!value) return null;
    const date = typeof value === "string" ? new Date(value) : value;
    if (Number.isNaN(date.getTime())) return null;
    const end = new Date(date.getTime() + 2 * 60 * 60 * 1000);
    const yyyy = date.getFullYear();
    const mm = `${date.getMonth() + 1}`.padStart(2, "0");
    const dd = `${date.getDate()}`.padStart(2, "0");
    const hh = `${date.getHours()}`.padStart(2, "0");
    const mi = `${date.getMinutes()}`.padStart(2, "0");
    const endHh = `${end.getHours()}`.padStart(2, "0");
    const endMi = `${end.getMinutes()}`.padStart(2, "0");
    return `${yyyy}-${mm}-${dd} ${hh}:${mi}-${endHh}:${endMi}`;
}

function formatCurrency(value?: number | string | null) {
    const amount = typeof value === "string" ? Number(value) : (value ?? 0);
    return `¥${amount.toFixed(2)}`;
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: "#F5F5F5",
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 32,
    },
    card: {
        backgroundColor: "white",
        borderRadius: 12,
        padding: 16,
        marginBottom: 12,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.08,
        shadowRadius: 4,
        elevation: 3,
    },
    orderHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
        marginBottom: 12,
    },
    orderService: {
        fontSize: 20,
        fontWeight: "bold",
        color: "#333",
    },
    orderSerial: {
        marginTop: 4,
        fontSize: 12,
        color: "#999",
    },
    statusBadge: {
        paddingHorizontal: 12,
        paddingVertical: 4,
        borderRadius: 12,
    },
    statusText: {
        color: "white",
        fontWeight: "bold",
    },
    headerBadges: {
        alignItems: "flex-end",
    },
    decisionBadge: {
        marginTop: 6,
        paddingHorizontal: 10,
        paddingVertical: 2,
        borderRadius: 12,
        borderWidth: 1,
    },
    decisionText: {
        fontSize: 11,
        fontWeight: "bold",
    },
    statusDescription: {
        fontSize: 13,
        color: "#666",
        lineHeight: 20,
    },
    summaryGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        justifyContent: "space-between",
        marginTop: 12,
    },
    summaryTile: {
        width: "48%",
        backgroundColor: "#F7F8FA",
        borderRadius: 12,
        padding: 12,
        marginBottom: 12,
    },
    summaryTileLabel: {
        fontSize: 12,
        color: "#999",
    },
    summaryTileValue: {
        marginTop: 4,
        fontSize: 16,
        color: "#333",
        fontWeight: "600",
    },
    infoRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        marginTop: 12,
    },
    infoColumn: {
        marginLeft: 8,
        flex: 1,
    },
    infoLabel: {
        fontSize: 12,
        color: "#999",
    },
    infoValue: {
        marginTop: 2,
        fontSize: 15,
        color: "#333",
        lineHeight: 20,
    },
    cardTitle: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
        marginBottom: 8,
    },
    descText: {
        fontSize: 14,
        color: "#666",
        lineHeight: 20,
    },
    amountRow: {
        flexDirection: "row",
        justifyContent: "space-between",
        marginTop: 8,
        gap: 12,
    },
    amountBox: {
        backgroundColor: "#F7F8FA",
        borderRadius: 12,
        padding: 14,
        flex: 1,
    },
    amountHalfBox: {
        flex: 1,
    },
    amountHalfBoxLast: {
        flex: 1,
    },
    amountLabel: {
        fontSize: 12,
        color: "#999",
    },
    amountValue: {
        marginTop: 6,
        fontSize: 18,
        color: "#333",
        fontWeight: "600",
    },
    amountMuted: {
        color: "#999",
    },
    amountDiscount: {
        color: "#D32F2F",
    },
    amountTotal: {
        marginTop: 8,
        fontSize: 24,
        color: "#2196F3",
        fontWeight: "700",
    },
    amountHint: {
        marginTop: 6,
        fontSize: 12,
        color: "#888",
    },
    timelineRow: {
        flexDirection: "row",
        marginBottom: 12,
    },
    timelineIndicator: {
        width: 24,
        alignItems: "center",
    },
    timelineDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: "#2196F3",
        marginTop: 4,
    },
    timelineLine: {
        width: 2,
        flex: 1,
        backgroundColor: "#E0E0E0",
        marginTop: 4,
    },
    timelineContent: {
        flex: 1,
        paddingLeft: 8,
    },
    timelineLabel: {
        fontSize: 13,
        color: "#999",
    },
    timelineValue: {
        marginTop: 2,
        fontSize: 15,
        color: "#333",
        fontWeight: "500",
    },
    timelineNote: {
        marginTop: 4,
        fontSize: 13,
        color: "#D32F2F",
        lineHeight: 18,
    },
    scanButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#2196F3",
        alignItems: "center",
    },
    chatButton: {
        marginTop: 12,
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: "#4CAF50",
        alignItems: "center",
    },
    scanButtonText: {
        color: "white",
        fontWeight: "bold",
    },
    chatButtonText: {
        color: "white",
        fontWeight: "bold",
    },
    assignmentStatusText: {
        fontSize: 15,
        fontWeight: "600",
    },
    decisionDescription: {
        fontSize: 13,
        color: "#777",
        marginTop: 6,
        lineHeight: 18,
    },
    noticeBox: {
        marginTop: 12,
        padding: 12,
        borderRadius: 10,
        backgroundColor: "#FFF5F5",
    },
    noticeLabel: {
        fontSize: 12,
        color: "#D32F2F",
        fontWeight: "600",
    },
    noticeText: {
        marginTop: 4,
        fontSize: 13,
        color: "#D32F2F",
        lineHeight: 18,
    },
    paymentItem: {
        paddingVertical: 12,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderBottomColor: "#eee",
    },
    paymentHeader: {
        flexDirection: "row",
        justifyContent: "space-between",
        alignItems: "center",
    },
    paymentMethod: {
        fontSize: 14,
        color: "#333",
        fontWeight: "500",
    },
    paymentAmount: {
        fontSize: 16,
        fontWeight: "bold",
        color: "#333",
    },
    paymentStatus: {
        marginTop: 6,
        fontSize: 13,
        fontWeight: "500",
    },
    paymentTime: {
        marginTop: 4,
        fontSize: 13,
        color: "#777",
    },
    paymentTransaction: {
        marginTop: 2,
        fontSize: 12,
        color: "#999",
    },
    footer: {
        flexDirection: "row",
        padding: 16,
        backgroundColor: "white",
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#eee",
    },
    actionButton: {
        flex: 1,
        height: 48,
        borderRadius: 24,
        justifyContent: "center",
        alignItems: "center",
        marginHorizontal: 4,
    },
    acceptButton: {
        backgroundColor: "#4CAF50",
    },
    rescheduleButton: {
        backgroundColor: "#0F766E",
    },
    rejectButton: {
        borderWidth: 1,
        borderColor: "#F57C00",
        backgroundColor: "white",
    },
    cancelButton: {
        borderWidth: 1,
        borderColor: "#FF7043",
        backgroundColor: "white",
    },
    completeButton: {
        backgroundColor: "#4CAF50",
    },
    cancelText: {
        color: "#FF7043",
        fontWeight: "bold",
    },
    acceptText: {
        color: "white",
        fontWeight: "bold",
    },
    rejectText: {
        color: "#F57C00",
        fontWeight: "bold",
    },
    completeText: {
        color: "white",
        fontWeight: "bold",
    },
    skeletonContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
    },
    skeletonText: {
        marginTop: 12,
        color: "#666",
    },
    errorContainer: {
        flex: 1,
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
    },
    errorTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#d32f2f",
    },
    errorMessage: {
        marginTop: 8,
        color: "#666",
        textAlign: "center",
    },
    retryButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 10,
        borderRadius: 20,
        backgroundColor: "#2196F3",
    },
    retryText: {
        color: "white",
        fontWeight: "bold",
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.6)",
        justifyContent: "center",
        padding: 24,
    },
    modalWrapper: {
        flex: 1,
        justifyContent: "center",
    },
    modalCard: {
        backgroundColor: "white",
        borderRadius: 20,
        padding: 20,
    },
    modalTitle: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    modalSubtitle: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
        marginBottom: 12,
    },
    reasonInput: {
        borderWidth: 1,
        borderColor: "#ddd",
        borderRadius: 12,
        padding: 12,
        minHeight: 100,
        fontSize: 15,
        color: "#333",
        backgroundColor: "#fafafa",
    },
    inputError: {
        borderColor: "#d32f2f",
    },
    inputErrorText: {
        color: "#d32f2f",
        fontSize: 13,
        marginTop: 6,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 20,
        gap: 12,
    },
    modalButton: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    modalCancelButton: {
        borderWidth: 1,
        borderColor: "#ccc",
        backgroundColor: "white",
    },
    modalConfirmButton: {
        backgroundColor: "#d32f2f",
    },
    modalButtonDisabled: {
        opacity: 0.6,
    },
    modalCancelText: {
        color: "#666",
        fontWeight: "bold",
    },
    modalConfirmText: {
        color: "white",
        fontWeight: "bold",
    },
});
