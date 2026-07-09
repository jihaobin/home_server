import { Ionicons } from "@expo/vector-icons";
import { useServicePersonnelProfile } from "@repo/hooks/api/service-personnel";
import { useUpsertWorkInfo } from "@repo/hooks/api/work-skill";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { DateTimePicker } from "@repo/mobile-ui/components/ui/date-time-picker";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
    ActivityIndicator,
    Alert,
    Modal,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from "react-native";

const WEEK_DAYS = ["1", "2", "3", "4", "5", "6", "7"];
const WEEKDAY_MAP: Record<string, string> = {
    "1": "一",
    "2": "二",
    "3": "三",
    "4": "四",
    "5": "五",
    "6": "六",
    "7": "日",
};

const parseTimeString = (value: string) => {
    const [hours = "0", minutes = "0", seconds = "0"] = value.split(":");
    const date = new Date();
    date.setHours(Number.parseInt(hours, 10) || 0);
    date.setMinutes(Number.parseInt(minutes, 10) || 0);
    date.setSeconds(Number.parseInt(seconds, 10) || 0);
    date.setMilliseconds(0);
    return date;
};

const formatTimeValue = (date: Date) => {
    const pad = (num: number) => num.toString().padStart(2, "0");
    return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
        date.getSeconds(),
    )}`;
};

export default function WorkTimeScreen() {
    const router = useRouter();
    const { session } = useSession();
    const userId = session?.user?.id;
    const { data: profile, isFetching, refetch } =
        useServicePersonnelProfile(userId);
    const upsertWorkInfo = useUpsertWorkInfo();

    const [workStartTime, setWorkStartTime] = useState("08:00:00");
    const [workEndTime, setWorkEndTime] = useState("18:00:00");
    const [selectedDays, setSelectedDays] = useState<string[]>([]);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (!profile) return;
        setWorkStartTime(profile.workStartTime ?? "08:00:00");
        setWorkEndTime(profile.workEndTime ?? "18:00:00");
        setSelectedDays(
            profile.workDays
                ? profile.workDays.split("")
                : ["1", "2", "3", "4", "5", "6", "7"],
        );
    }, [profile]);

    const orderedWorkDays = useMemo(
        () => selectedDays.slice().sort().join(""),
        [selectedDays],
    );

    const toggleDay = (day: string) => {
        setSelectedDays((prev) =>
            prev.includes(day)
                ? prev.filter((item) => item !== day)
                : [...prev, day],
        );
    };

    const handleSave = useCallback(async () => {
        if (!profile) return;

        if (selectedDays.length === 0) {
            Alert.alert("提示", "请至少选择一个工作日");
            return;
        }

        const location = (profile as any).location as {
            lng: number;
            lat: number;
        } | null;
        if (!location) {
            Alert.alert("提示", "请先设置工作区域");
            return;
        }

        setSaving(true);
        try {
            await upsertWorkInfo.mutateAsync({
                bio: profile.bio ?? undefined,
                yearsOfExperience: profile.yearsOfExperience ?? 0,
                province: profile.province || "未设置",
                district: profile.district ?? "",
                county: profile.county ?? "",
                detailedAddress: profile.detailedAddress ?? "",
                workStartTime,
                workEndTime,
                workDays: orderedWorkDays,
                isAvailable: profile.isAvailable,
                currentStatus: profile.currentStatus,
                location,
            });
            await refetch();
            Alert.alert("保存成功", "工作时间已更新", [
                { text: "好的", onPress: () => router.back() },
            ]);
        } catch (error) {
            console.error("[WorkTime] 保存失败", error);
            const message =
                error instanceof Error ? error.message : "请稍后重试";
            Alert.alert("保存失败", message);
        } finally {
            setSaving(false);
        }
    }, [
        orderedWorkDays,
        profile,
        refetch,
        router,
        selectedDays.length,
        upsertWorkInfo,
        workEndTime,
        workStartTime,
    ]);

    const isLoading = isFetching && !profile;

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() => router.back()}
                >
                    <Ionicons name="arrow-back" size={24} color="#333" />
                </TouchableOpacity>
                <Text style={styles.title}>工作时间</Text>
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
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>每日可接单时间</Text>
                        <TimePickerField
                            label="开始"
                            value={workStartTime}
                            onConfirm={setWorkStartTime}
                        />
                        <TimePickerField
                            label="结束"
                            value={workEndTime}
                            onConfirm={setWorkEndTime}
                        />
                        <Text style={[styles.sectionTitle, { marginTop: 12 }]}>
                            工作日
                        </Text>
                        <View style={styles.weekContainer}>
                            {WEEK_DAYS.map((day) => {
                                const active = selectedDays.includes(day);
                                return (
                                    <TouchableOpacity
                                        key={day}
                                        style={[
                                            styles.weekBadge,
                                            active && styles.weekBadgeActive,
                                        ]}
                                        onPress={() => toggleDay(day)}
                                    >
                                        <Text
                                            style={[
                                                styles.weekBadgeText,
                                                active &&
                                                styles.weekBadgeTextActive,
                                            ]}
                                        >
                                            周{WEEKDAY_MAP[day]}
                                        </Text>
                                    </TouchableOpacity>
                                );
                            })}
                        </View>
                    </View>
                )}
            </ScrollView>
        </View>
    );
}

function TimePickerField({
    label,
    value,
    onConfirm,
}: {
    label: string;
    value: string;
    onConfirm: (time: string) => void;
}) {
    const [visible, setVisible] = useState(false);
    const [previewDate, setPreviewDate] = useState(() =>
        parseTimeString(value),
    );

    useEffect(() => {
        if (!visible) {
            setPreviewDate(parseTimeString(value));
        }
    }, [value, visible]);

    const handleClose = () => setVisible(false);
    const handleConfirm = () => {
        onConfirm(formatTimeValue(previewDate));
        setVisible(false);
    };

    return (
        <>
            <TouchableOpacity
                style={styles.timeRow}
                onPress={() => setVisible(true)}
                activeOpacity={0.8}
            >
                <Text style={styles.label}>{label}</Text>
                <View style={styles.timeValueBox}>
                    <Text style={styles.timeValue}>{value}</Text>
                    <Ionicons name="time-outline" size={16} color="#555" />
                </View>
            </TouchableOpacity>
            <Modal
                visible={visible}
                transparent
                animationType="fade"
                onRequestClose={handleClose}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalCard}>
                        <Text style={styles.modalTitle}>选择{label}时间</Text>
                        <DateTimePicker
                            mode="single"
                            timePicker
                            initialView="time"
                            locale="zh-cn"
                            hideHeader
                            date={previewDate}
                            onChange={({ date }) => {
                                if (!date) return;
                                const resolved =
                                    date instanceof Date
                                        ? date
                                        : new Date(date as string);
                                setPreviewDate(resolved);
                            }}
                        />
                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalButton}
                                onPress={handleClose}
                            >
                                <Text style={styles.modalButtonText}>取消</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={[
                                    styles.modalButton,
                                    styles.modalButtonSpacing,
                                    styles.modalButtonPrimary,
                                ]}
                                onPress={handleConfirm}
                            >
                                <Text
                                    style={[
                                        styles.modalButtonText,
                                        styles.modalButtonPrimaryText,
                                    ]}
                                >
                                    确定
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </>
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
    sectionTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 16,
    },
    label: {
        width: 80,
        fontSize: 14,
        color: "#555",
    },
    weekContainer: {
        flexDirection: "row",
        flexWrap: "wrap",
        gap: 8,
    },
    weekBadge: {
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 999,
        borderWidth: 1,
        borderColor: "#d1d5db",
    },
    weekBadgeActive: {
        backgroundColor: "#e0f2fe",
        borderColor: "#38bdf8",
    },
    weekBadgeText: {
        fontSize: 13,
        color: "#555",
    },
    weekBadgeTextActive: {
        color: "#0284c7",
        fontWeight: "600",
    },
    timeRow: {
        flexDirection: "row",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: 14,
    },
    timeValueBox: {
        flexDirection: "row",
        alignItems: "center",
        backgroundColor: "#f3f4f6",
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
    },
    timeValue: {
        fontSize: 15,
        color: "#111",
        marginRight: 6,
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: "rgba(0,0,0,0.4)",
        justifyContent: "center",
        alignItems: "center",
        padding: 24,
    },
    modalCard: {
        width: "100%",
        borderRadius: 16,
        backgroundColor: "#fff",
        padding: 20,
    },
    modalTitle: {
        fontSize: 16,
        fontWeight: "600",
        color: "#111",
        marginBottom: 12,
    },
    modalActions: {
        flexDirection: "row",
        justifyContent: "flex-end",
        marginTop: 16,
    },
    modalButton: {
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 999,
        backgroundColor: "#f3f4f6",
    },
    modalButtonSpacing: {
        marginLeft: 12,
    },
    modalButtonPrimary: {
        backgroundColor: "#2196F3",
    },
    modalButtonText: {
        fontSize: 14,
        color: "#111",
    },
    modalButtonPrimaryText: {
        color: "#fff",
        fontWeight: "600",
    },
});
