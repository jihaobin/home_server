import * as React from "react";
import { Pressable, View } from "react-native";
import { BottomSheetModal } from "@repo/mobile-ui/components/ui/modal/BottomSheetModal";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Check } from "@repo/mobile-ui/lib/icons/Check";
import { cn } from "@repo/mobile-ui/lib/utils";
import useServiceStore from "@/stores/service";

export type ServiceTimePickerSheetProps = {
    visible: boolean;
    onClose: () => void;
    workStartTime?: string;
    workEndTime?: string;
    workDays?: string | string[];
};

type CalendarCell = {
    key: string;
    date: Date;
};

type TimeSlot = {
    key: string;
    label: string;
    start: Date;
};

type HmsParts = {
    hours: number;
    minutes: number;
    seconds: number;
};

const SERVICE_TIME_WINDOW_MS = 2 * 60 * 60 * 1000;

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
    workStartTime?: string;
    workEndTime?: string;
}) {
    const { date, workStartTime, workEndTime } = params;
    const startParts = workStartTime ? parseHms(workStartTime) : null;
    const endParts = workEndTime ? parseHms(workEndTime) : null;
    if (!startParts || !endParts) {
        return null;
    }
    const start = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
        startParts.hours,
        startParts.minutes,
        startParts.seconds,
        0,
    );
    let end = new Date(
        date.getFullYear(),
        date.getMonth(),
        date.getDate(),
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

function formatSlotLabel(start: Date) {
    const end = new Date(start.getTime() + SERVICE_TIME_WINDOW_MS);
    const hh = String(start.getHours()).padStart(2, "0");
    const mm = String(start.getMinutes()).padStart(2, "0");
    const endHh = String(end.getHours()).padStart(2, "0");
    const endMm = String(end.getMinutes()).padStart(2, "0");
    return `${hh}:${mm}-${endHh}:${endMm}`;
}

function buildTimeSlots(params: {
    date: Date;
    workStartTime?: string;
    workEndTime?: string;
    stepMinutes: number;
    now: Date;
}): TimeSlot[] {
    const bounds = resolveWorkBoundsForDate({
        date: params.date,
        workStartTime: params.workStartTime,
        workEndTime: params.workEndTime,
    });
    if (!bounds) {
        return [];
    }
    const stepMs = params.stepMinutes * 60 * 1000;
    if (!Number.isFinite(stepMs) || stepMs <= 0) {
        return [];
    }
    const slots: TimeSlot[] = [];
    const startMs = bounds.start.getTime();
    const endMs = bounds.end.getTime();
    const nowMs = params.now.getTime();

    for (let t = startMs; t <= endMs; t += stepMs) {
        if (t < nowMs) {
            continue;
        }
        const start = new Date(t);
        slots.push({
            key: start.toISOString(),
            label: formatSlotLabel(start),
            start,
        });
    }

    return slots;
}

export function ServiceTimePickerSheet({
    visible,
    onClose,
    workStartTime,
    workEndTime,
    workDays,
}: ServiceTimePickerSheetProps) {
    const { setServiceTime } = useServiceStore();

    const [now, setNow] = React.useState<Date>(() => new Date());
    const today = React.useMemo(() => {
        const value = new Date(now);
        value.setHours(0, 0, 0, 0);
        return value;
    }, [now]);

    React.useEffect(() => {
        if (!visible) {
            return;
        }
        setNow(new Date());
        const timer = setInterval(() => {
            setNow(new Date());
        }, 30_000);
        return () => {
            clearInterval(timer);
        };
    }, [visible]);

    const workDaySet = React.useMemo(() => {
        return new Set(
            Array.isArray(workDays)
                ? workDays.map((d) => String(d).trim()).filter(Boolean)
                : typeof workDays === "string"
                  ? workDays
                        .split("")
                        .map((d) => d.trim())
                        .filter(Boolean)
                  : [],
        );
    }, [workDays]);

    const [selectedDate, setSelectedDate] = React.useState<Date>(
        () => new Date(),
    );
    const [selectedSlotKey, setSelectedSlotKey] = React.useState<string>("");

    React.useEffect(() => {
        if (!visible) {
            return;
        }
        setSelectedDate(new Date());
        setSelectedSlotKey("");
    }, [visible]);

    const stepMinutes = 120;
    const timeSlots = React.useMemo(() => {
        return buildTimeSlots({
            date: selectedDate,
            workStartTime,
            workEndTime,
            stepMinutes,
            now,
        });
    }, [now, selectedDate, workEndTime, workStartTime]);

    React.useEffect(() => {
        if (!visible) {
            return;
        }
        setSelectedSlotKey((prev) => {
            if (prev && timeSlots.some((slot) => slot.key === prev)) {
                return prev;
            }
            return timeSlots[0]?.key ?? "";
        });
    }, [timeSlots, visible]);

    const selectedSlot = React.useMemo(() => {
        return timeSlots.find((slot) => slot.key === selectedSlotKey) ?? null;
    }, [selectedSlotKey, timeSlots]);

    const monthLabel = React.useMemo(() => {
        const y = selectedDate.getFullYear();
        const m = selectedDate.getMonth() + 1;
        return `${y}年${m}月`;
    }, [selectedDate]);

    const ctaLabel = React.useMemo(() => {
        const m = selectedDate.getMonth() + 1;
        const d = selectedDate.getDate();
        return `${m}月${d}日 ${selectedSlot?.label ?? ""}`.trim();
    }, [selectedDate, selectedSlot?.label]);

    const calendarRows = React.useMemo<CalendarCell[][]>(() => {
        const cells: CalendarCell[] = [];
        for (let i = 0; i < 14; i += 1) {
            const date = new Date(today.getTime() + i * 24 * 60 * 60 * 1000);
            cells.push({
                key: `d${i}`,
                date,
            });
        }
        return [cells.slice(0, 7), cells.slice(7, 14)];
    }, [today]);

    const isSameDay = (a: Date, b: Date) =>
        a.getFullYear() === b.getFullYear() &&
        a.getMonth() === b.getMonth() &&
        a.getDate() === b.getDate();

    const isBeforeDay = (a: Date, b: Date) => {
        const aa = new Date(a.getFullYear(), a.getMonth(), a.getDate());
        const bb = new Date(b.getFullYear(), b.getMonth(), b.getDate());
        return aa.getTime() < bb.getTime();
    };

    const isWorkDay = React.useCallback(
        (date: Date) => {
            if (!workDaySet.size) {
                return true;
            }
            const raw = date.getDay();
            const weekday = raw === 0 ? 7 : raw;
            return workDaySet.has(String(weekday));
        },
        [workDaySet],
    );

    const confirmSelection = () => {
        if (!selectedSlot) {
            onClose();
            return;
        }

        setServiceTime(new Date(selectedSlot.start));
        onClose();
    };

    return (
        <BottomSheetModal
            visible={visible}
            onClose={onClose}
            showDragIndicator={false}
            initialHeightRatio={0.67}
            minHeightRatio={0.67}
            maxHeightRatio={0.67}
            sheetClassName="rounded-t-2xl bg-card"
        >
            <View className="flex-1">
                {/* Header */}
                <View className="h-11 flex-row items-center">
                    <Pressable
                        onPress={onClose}
                        className="h-11 w-[60px] items-center justify-center"
                        hitSlop={8}
                    >
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            取消
                        </Text>
                    </Pressable>

                    <View className="flex-1 items-center justify-center">
                        <Text
                            className="text-base font-puhui-medium text-foreground"
                            numberOfLines={1}
                        >
                            选择上门时间段
                        </Text>
                    </View>

                    <Pressable
                        onPress={confirmSelection}
                        className="h-11 w-[60px] items-center justify-center"
                        hitSlop={8}
                    >
                        <Text className="text-sm font-puhui-regular text-primary">
                            确定
                        </Text>
                    </Pressable>
                </View>

                {/* Body */}
                <View className="mx-4 mt-3 bg-muted/50 p-3">
                    <Text className="text-sm font-puhui-regular text-foreground">
                        {monthLabel}
                    </Text>

                    {/* Week row */}
                    <View className="relative mt-3 h-4">
                        <Text className="absolute left-0 text-xs font-puhui-regular text-muted-foreground">
                            周一
                        </Text>
                        <Text className="absolute left-12 text-xs font-puhui-regular text-muted-foreground">
                            周二
                        </Text>
                        <Text className="absolute left-24 text-xs font-puhui-regular text-muted-foreground">
                            周三
                        </Text>
                        <Text className="absolute left-36 text-xs font-puhui-regular text-muted-foreground">
                            周四
                        </Text>
                        <Text className="absolute left-48 text-xs font-puhui-regular text-muted-foreground">
                            周五
                        </Text>
                        <Text className="absolute left-60 text-xs font-puhui-regular text-muted-foreground">
                            周六
                        </Text>
                        <Text className="absolute left-72 text-xs font-puhui-regular text-muted-foreground">
                            周日
                        </Text>
                    </View>

                    {/* Date rows (mocked to match the Figma screenshot) */}
                    <View className="mt-2">
                        {calendarRows.map((row, rowIdx) => (
                            <View
                                // eslint-disable-next-line react/no-array-index-key
                                key={`calendar-row-${rowIdx}`}
                                className={
                                    rowIdx === 0 ? "flex-row" : "mt-2 flex-row"
                                }
                            >
                                {row.map((cell) => {
                                    const isToday = isSameDay(cell.date, today);
                                    const isPast = isBeforeDay(
                                        cell.date,
                                        today,
                                    );
                                    const isDisabledByWorkday = !isWorkDay(
                                        cell.date,
                                    );
                                    const isSelected = isSameDay(
                                        cell.date,
                                        selectedDate,
                                    );
                                    const label = isToday
                                        ? "今"
                                        : String(cell.date.getDate());

                                    return (
                                        <View
                                            key={cell.key}
                                            className="w-12 items-center"
                                        >
                                            <Pressable
                                                onPress={() =>
                                                    setSelectedDate(cell.date)
                                                }
                                                disabled={
                                                    isPast ||
                                                    isDisabledByWorkday
                                                }
                                                className={cn(
                                                    "h-6 w-6 items-center justify-center rounded-full",
                                                    isSelected && "bg-primary",
                                                )}
                                                hitSlop={8}
                                            >
                                                <Text
                                                    className={cn(
                                                        "text-xs font-puhui-regular",
                                                        isPast ||
                                                            isDisabledByWorkday
                                                            ? "text-muted-foreground"
                                                            : isSelected
                                                              ? "text-primary-foreground"
                                                              : "text-foreground",
                                                    )}
                                                >
                                                    {label}
                                                </Text>
                                            </Pressable>
                                        </View>
                                    );
                                })}
                            </View>
                        ))}
                    </View>

                    {/* Slots */}
                    <View className="mt-4 flex-col gap-[14px]">
                        {timeSlots.map((slot) => {
                            const isSelected = slot.key === selectedSlotKey;
                            return (
                                <Pressable
                                    key={slot.key}
                                    onPress={() => setSelectedSlotKey(slot.key)}
                                    className="flex-row items-center justify-between"
                                    hitSlop={8}
                                >
                                    <Text
                                        className={cn(
                                            "text-sm font-puhui-regular",
                                            isSelected
                                                ? "text-primary"
                                                : "text-foreground",
                                        )}
                                    >
                                        {slot.label}
                                    </Text>
                                    {isSelected ? (
                                        <View className="h-4 w-4 items-center justify-center rounded-full bg-primary">
                                            <Icon
                                                as={Check}
                                                size={12}
                                                className="text-primary-foreground"
                                            />
                                        </View>
                                    ) : (
                                        <View className="h-4 w-4 rounded-full border border-muted-foreground" />
                                    )}
                                </Pressable>
                            );
                        })}
                    </View>
                </View>

                {/* CTA */}
                <Pressable
                    onPress={confirmSelection}
                    className="mx-4 mt-4 h-10 items-center justify-center rounded-full bg-primary"
                    hitSlop={8}
                    disabled={!selectedSlot}
                >
                    <Text className="text-sm font-puhui-regular text-primary-foreground">
                        {ctaLabel}
                    </Text>
                </Pressable>
            </View>
        </BottomSheetModal>
    );
}
