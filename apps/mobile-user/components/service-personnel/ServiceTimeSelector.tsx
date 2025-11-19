import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { Pressable, View } from "react-native";
import type { WorkSchedule } from "./types";

const ICON_MAP = lucideIconRegistry;

interface ServiceTimeSelectorProps {
    selectedTime?: Date;
    workSchedule: WorkSchedule;
    onPress: () => void;
}

export function ServiceTimeSelector({
    selectedTime,
    workSchedule,
    onPress,
}: ServiceTimeSelectorProps) {
    const formatServiceTime = (date: Date | undefined) => {
        if (!date) return "请选择时间";

        const now = new Date();
        const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
        const tomorrow = new Date(today);
        tomorrow.setDate(today.getDate() + 1);
        const targetDate = new Date(
            date.getFullYear(),
            date.getMonth(),
            date.getDate(),
        );

        let dayLabel = "";
        if (targetDate.getTime() === today.getTime()) {
            dayLabel = "今天";
        } else if (targetDate.getTime() === tomorrow.getTime()) {
            dayLabel = "明天";
        } else {
            const weekdays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
            dayLabel = weekdays[date.getDay()];
        }

        const timeLabel = `${date.getHours().toString().padStart(2, "0")}:${date.getMinutes().toString().padStart(2, "0")}`;

        return `${dayLabel} ${timeLabel}`;
    };

    const serviceTime = formatServiceTime(selectedTime);

    return (
        <Pressable
            onPress={onPress}
            className="mx-4 mb-4 flex-row items-center justify-between rounded-xl border border-border bg-card px-4 py-3 active:opacity-60"
        >
            <View className="flex-row items-center">
                <Icon as={ICON_MAP.Clock} size={18} className="text-primary" />
                <Text className="ml-2 text-sm font-medium text-foreground">
                    服务时间
                </Text>
            </View>
            <View className="flex-row items-center">
                <Text
                    className={cn(
                        "text-base font-semibold",
                        selectedTime ? "text-primary" : "text-muted-foreground",
                    )}
                >
                    {serviceTime}
                </Text>
                <Icon
                    as={ICON_MAP.ChevronRight}
                    size={18}
                    className="ml-1 text-muted-foreground"
                />
            </View>
        </Pressable>
    );
}
