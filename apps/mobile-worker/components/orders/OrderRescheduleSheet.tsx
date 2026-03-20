import { Ionicons } from "@expo/vector-icons";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { DateTimePicker } from "@repo/mobile-ui/components/ui/date-time-picker";
import React from "react";
import {
    ActivityIndicator,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

type RescheduleSlot = {
    start: Date;
    label: string;
};

type RescheduleAvailability = {
    canReschedule: boolean;
    title: string;
    message: string;
    workStartTime?: string | null;
    workEndTime?: string | null;
    workDaysLabel: string;
    slots: RescheduleSlot[];
};

export interface OrderRescheduleSheetProps {
    visible: boolean;
    isPending: boolean;
    draft: Date;
    currentAppointment: Date | null;
    selectedRescheduleTime?: Date;
    currentAppointmentText: string;
    selectedRescheduleText: string;
    availability: RescheduleAvailability;
    stepMinutes: number;
    canConfirm: boolean;
    onClose: () => void;
    onConfirm: () => void;
    onDraftChange: (date: Date) => void;
    onSelectSlot: (date: Date) => void;
}

function isSameTimeValue(left?: Date | null, right?: Date | null) {
    if (!left || !right) {
        return false;
    }
    return left.getTime() === right.getTime();
}

export function OrderRescheduleSheet(props: OrderRescheduleSheetProps) {
    const {
        visible,
        isPending,
        draft,
        currentAppointment,
        selectedRescheduleTime,
        currentAppointmentText,
        selectedRescheduleText,
        availability,
        stepMinutes,
        canConfirm,
        onClose,
        onConfirm,
        onDraftChange,
        onSelectSlot,
    } = props;

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            initialHeightRatio={0.88}
            minHeightRatio={0.6}
            maxHeightRatio={0.92}
            backdropClassName="bg-black/60"
            sheetClassName="rounded-t-[24px] bg-white"
        >
            <View style={styles.sheetContent}>
                <View style={styles.sheetHeader}>
                    <Text style={styles.title}>调整预约窗口</Text>
                    <Text style={styles.subtitle}>
                        请选择新的 2 小时到达窗口起点，提交后会直接按后台规则更新订单预约时间。
                    </Text>
                </View>
                <ScrollView
                    style={styles.sheetScroll}
                    contentContainerStyle={styles.sheetScrollContent}
                    showsVerticalScrollIndicator={false}
                    bounces={false}
                    nestedScrollEnabled
                >
                    <View style={styles.summaryCard}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>当前预约</Text>
                            <Text style={styles.summaryValue}>
                                {currentAppointmentText}
                            </Text>
                        </View>
                        <View style={styles.summaryDivider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>新的窗口</Text>
                            <Text
                                style={[
                                    styles.summaryValue,
                                    styles.summaryValueActive,
                                ]}
                            >
                                {selectedRescheduleText}
                            </Text>
                        </View>
                    </View>
                    <View style={styles.hintCard}>
                        <View style={styles.metaRow}>
                            <Ionicons
                                name="time-outline"
                                size={16}
                                color="#0F766E"
                            />
                            <Text style={styles.hintMeta}>
                                工作时间：
                                {availability.workStartTime ?? "--"}-
                                {availability.workEndTime ?? "--"}
                                {"  "}·{"  "}步长：{stepMinutes} 分钟
                            </Text>
                        </View>
                        <View style={styles.metaRow}>
                            <Ionicons
                                name="calendar-outline"
                                size={16}
                                color="#0F766E"
                            />
                            <Text style={styles.hintMeta}>
                                工作日：{availability.workDaysLabel}
                            </Text>
                        </View>
                        <Text style={styles.hintTitle}>{availability.title}</Text>
                        <Text
                            style={
                                availability.canReschedule
                                    ? styles.hintBody
                                    : styles.hintBodyWarning
                            }
                        >
                            {availability.message}
                        </Text>
                    </View>
                    <DateTimePicker
                        mode="single"
                        locale="zh-cn"
                        minDate={new Date()}
                        date={draft}
                        onChange={({ date }) => {
                            if (!date) return;
                            const resolved =
                                date instanceof Date
                                    ? date
                                    : new Date(date as string);
                            if (!Number.isNaN(resolved.getTime())) {
                                onDraftChange(resolved);
                            }
                        }}
                    />
                    {!!availability.slots.length && (
                        <View style={styles.slotsSection}>
                            <Text style={styles.sectionTitle}>可选时间段</Text>
                            <View style={styles.slotsGrid}>
                                {availability.slots.map((slot) => {
                                    const isSelected = isSameTimeValue(
                                        slot.start,
                                        selectedRescheduleTime,
                                    );
                                    const isCurrent = isSameTimeValue(
                                        slot.start,
                                        currentAppointment,
                                    );

                                    return (
                                        <TouchableOpacity
                                            key={slot.start.toISOString()}
                                            style={[
                                                styles.slotChip,
                                                isSelected &&
                                                    styles.slotChipActive,
                                                isCurrent &&
                                                    styles.slotChipCurrent,
                                            ]}
                                            onPress={() =>
                                                onSelectSlot(slot.start)
                                            }
                                            activeOpacity={0.9}
                                        >
                                            <Text
                                                style={[
                                                    styles.slotLabel,
                                                    isSelected &&
                                                        styles.slotLabelActive,
                                                ]}
                                            >
                                                {slot.label}
                                            </Text>
                                            <Text
                                                style={[
                                                    styles.slotHint,
                                                    isSelected &&
                                                        styles.slotHintActive,
                                                ]}
                                            >
                                                {isCurrent
                                                    ? "当前预约"
                                                    : isSelected
                                                      ? "已选择"
                                                      : "点击选择"}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    )}
                </ScrollView>
                <View style={styles.actions}>
                    <TouchableOpacity
                        style={[styles.button, styles.cancelButton]}
                        onPress={onClose}
                        disabled={isPending}
                    >
                        <Text style={styles.cancelText}>返回</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[
                            styles.button,
                            styles.confirmButton,
                            isPending && styles.buttonDisabled,
                        ]}
                        onPress={onConfirm}
                        disabled={isPending || !canConfirm}
                    >
                        {isPending ? (
                            <ActivityIndicator color="#fff" />
                        ) : (
                            <Text style={styles.confirmText}>确认调整</Text>
                        )}
                    </TouchableOpacity>
                </View>
            </View>
        </BottomSheetModal>
    );
}

const styles = StyleSheet.create({
    sheetContent: {
        flex: 1,
    },
    sheetHeader: {
        paddingHorizontal: 20,
        paddingTop: 8,
    },
    title: {
        fontSize: 18,
        fontWeight: "bold",
        color: "#333",
    },
    subtitle: {
        fontSize: 14,
        color: "#666",
        marginTop: 4,
        marginBottom: 12,
    },
    sheetScroll: {
        flex: 1,
    },
    sheetScrollContent: {
        paddingHorizontal: 20,
        paddingBottom: 24,
    },
    actions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        gap: 12,
        paddingHorizontal: 20,
        paddingTop: 14,
        paddingBottom: 24,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: "#E5E7EB",
        backgroundColor: "white",
    },
    button: {
        paddingVertical: 12,
        paddingHorizontal: 20,
        borderRadius: 999,
    },
    cancelButton: {
        borderWidth: 1,
        borderColor: "#ccc",
        backgroundColor: "white",
    },
    confirmButton: {
        backgroundColor: "#0F766E",
    },
    buttonDisabled: {
        opacity: 0.6,
    },
    cancelText: {
        color: "#666",
        fontWeight: "bold",
    },
    confirmText: {
        color: "white",
        fontWeight: "bold",
    },
    hintCard: {
        marginTop: 12,
        padding: 14,
        borderRadius: 16,
        backgroundColor: "#F0FDFA",
        borderWidth: StyleSheet.hairlineWidth,
        borderColor: "#99F6E4",
    },
    hintTitle: {
        marginTop: 10,
        fontSize: 13,
        fontWeight: "700",
        color: "#134E4A",
    },
    hintMeta: {
        fontSize: 12,
        color: "#115E59",
        lineHeight: 18,
        flex: 1,
        flexShrink: 1,
    },
    hintBody: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 18,
        color: "#134E4A",
    },
    hintBodyWarning: {
        marginTop: 8,
        fontSize: 12,
        lineHeight: 18,
        color: "#B45309",
    },
    metaRow: {
        flexDirection: "row",
        alignItems: "flex-start",
        gap: 6,
    },
    summaryCard: {
        marginTop: 4,
        borderRadius: 18,
        padding: 16,
        backgroundColor: "#111827",
    },
    summaryRow: {
        gap: 6,
    },
    summaryLabel: {
        fontSize: 12,
        fontWeight: "600",
        color: "#9CA3AF",
    },
    summaryValue: {
        fontSize: 15,
        fontWeight: "700",
        color: "#F9FAFB",
        lineHeight: 22,
        flexShrink: 1,
    },
    summaryValueActive: {
        color: "#5EEAD4",
    },
    summaryDivider: {
        height: StyleSheet.hairlineWidth,
        backgroundColor: "rgba(255,255,255,0.16)",
        marginVertical: 14,
    },
    slotsSection: {
        marginTop: 16,
    },
    sectionTitle: {
        fontSize: 14,
        fontWeight: "700",
        color: "#111827",
        marginBottom: 10,
    },
    slotsGrid: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 10,
    },
    slotChip: {
        width: "48%",
        minHeight: 72,
        borderRadius: 16,
        paddingHorizontal: 14,
        paddingVertical: 12,
        justifyContent: "space-between",
        backgroundColor: "#F8FAFC",
        borderWidth: 1,
        borderColor: "#E2E8F0",
    },
    slotChipActive: {
        backgroundColor: "#0F766E",
        borderColor: "#0F766E",
        shadowColor: "#0F766E",
        shadowOpacity: 0.18,
        shadowRadius: 8,
        shadowOffset: {
            width: 0,
            height: 4,
        },
        elevation: 3,
    },
    slotChipCurrent: {
        borderColor: "#F59E0B",
    },
    slotLabel: {
        fontSize: 15,
        fontWeight: "700",
        color: "#0F172A",
    },
    slotLabelActive: {
        color: "#FFFFFF",
    },
    slotHint: {
        marginTop: 6,
        fontSize: 12,
        color: "#64748B",
    },
    slotHintActive: {
        color: "#CCFBF1",
    },
});
