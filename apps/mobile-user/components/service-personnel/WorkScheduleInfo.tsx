import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { View } from "react-native";

const ICON_MAP = lucideIconRegistry;

interface WorkScheduleInfoProps {
    workDays?: string;
    workStartTime?: string;
    workEndTime?: string;
}

export function WorkScheduleInfo({
    workDays,
    workStartTime,
    workEndTime,
}: WorkScheduleInfoProps) {
    // 将工作日数字转换为中文
    const formatWorkDays = (days?: string) => {
        if (!days) return "暂无信息";

        const dayMap: Record<string, string> = {
            "1": "周一",
            "2": "周二",
            "3": "周三",
            "4": "周四",
            "5": "周五",
            "6": "周六",
            "7": "周日",
        };

        const dayArray = days.split("").map((d) => dayMap[d] || d);

        // 如果是连续的工作日,简化显示
        if (days === "1234567") {
            return "全周";
        }
        if (days === "12345") {
            return "周一至周五";
        }
        if (days === "67") {
            return "周末";
        }

        return dayArray.join("、");
    };

    // 格式化时间
    const formatTime = (time?: string) => {
        if (!time) return "";
        // 时间格式: "08:00:00" -> "08:00"
        return time.substring(0, 5);
    };

    if (!workDays && !workStartTime && !workEndTime) {
        return null;
    }

    const formattedWorkDays = formatWorkDays(workDays);
    const formattedStartTime = formatTime(workStartTime);
    const formattedEndTime = formatTime(workEndTime);

    return (
        <View className="mx-4 mb-4">
            {/* 标题 */}
            <View className="mb-3 flex-row items-center">
                <View className="h-4 w-1 rounded-full bg-primary" />
                <Text className="ml-2 text-base font-bold text-foreground">
                    工作时间
                </Text>
            </View>

            {/* 工作时间卡片 */}
            <View className="rounded-xl border border-border bg-card p-4">
                <View className="flex-row items-start">
                    <Icon
                        as={ICON_MAP.Calendar}
                        size={20}
                        className="mt-0.5 text-primary"
                    />
                    <View className="ml-3 flex-1">
                        <View className="flex-row items-center">
                            <Text className="text-sm font-medium text-foreground">
                                工作日:
                            </Text>
                            <Text className="ml-2 text-sm text-foreground/80">
                                {formattedWorkDays}
                            </Text>
                        </View>

                        {(workStartTime || workEndTime) && (
                            <View className="mt-2 flex-row items-center">
                                <Text className="text-sm font-medium text-foreground">
                                    工作时段:
                                </Text>
                                <Text className="ml-2 text-sm text-foreground/80">
                                    {formattedStartTime} - {formattedEndTime}
                                </Text>
                            </View>
                        )}

                        <Text className="mt-2 text-xs text-muted-foreground">
                            请在工作时间内预约服务
                        </Text>
                    </View>
                </View>
            </View>
        </View>
    );
}
