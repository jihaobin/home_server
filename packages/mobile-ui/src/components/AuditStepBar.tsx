import { Text } from "@repo/mobile-ui/components/ui/text";
import { View } from "react-native";

export type AuditStep = {
    key: string;
    label: string;
    at: Date | null;
    status?: string;
};

type AuditStepBarTone = "amber" | "red" | "slate";

type AuditStepBarProps = {
    steps: AuditStep[];
    tone?: AuditStepBarTone;
};

const ACHIEVED_DOT_CLASS_NAMES: Record<AuditStepBarTone, string> = {
    amber: "bg-amber-500",
    red: "bg-red-500",
    slate: "bg-gray-400",
};

function formatStepTime(at: Date) {
    return at.toLocaleTimeString("zh-CN", {
        hour: "2-digit",
        minute: "2-digit",
    });
}

export function AuditStepBar({ steps, tone = "amber" }: AuditStepBarProps) {
    const dotActive = ACHIEVED_DOT_CLASS_NAMES[tone];

    return (
        <View className="mt-3 flex-row items-center justify-between">
            {steps.map((step) => {
                const reached = Boolean(step.at);

                return (
                    <View key={step.key} className="flex-1 items-center">
                        <View className="h-3 w-3 items-center justify-center">
                            <View
                                className={`h-2.5 w-2.5 rounded-full ${
                                    reached
                                        ? dotActive
                                        : "border border-gray-300 bg-white"
                                }`}
                            />
                        </View>
                        <Text className="mt-2 text-center text-[12px] font-medium text-gray-700">
                            {step.label}
                        </Text>
                        {step.at ? (
                            <Text className="mt-0.5 text-center text-[11px] text-gray-500">
                                {formatStepTime(step.at)}
                            </Text>
                        ) : null}
                    </View>
                );
            })}
        </View>
    );
}
