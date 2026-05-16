import { Text } from "@repo/mobile-ui/components/ui/text";
import { View } from "react-native";

export type StatusBadgeTone = "green" | "amber" | "red" | "slate";

type StatusBadgeProps = {
    label: string;
    tone: StatusBadgeTone;
};

const TONE_CLASS_NAMES: Record<
    StatusBadgeTone,
    {
        container: string;
        text: string;
    }
> = {
    green: {
        container: "rounded-md border border-green-200 bg-green-50 px-2 py-1",
        text: "text-[12px] font-medium text-green-700",
    },
    amber: {
        container: "rounded-md border border-amber-200 bg-amber-50 px-2 py-1",
        text: "text-[12px] font-medium text-amber-700",
    },
    red: {
        container: "rounded-md border border-red-200 bg-red-50 px-2 py-1",
        text: "text-[12px] font-medium text-red-700",
    },
    slate: {
        container: "rounded-md border border-gray-300 bg-gray-100 px-2 py-1",
        text: "text-[12px] font-medium text-gray-600",
    },
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
    const toneClassNames = TONE_CLASS_NAMES[tone];

    return (
        <View className={toneClassNames.container}>
            <Text className={toneClassNames.text}>{label}</Text>
        </View>
    );
}
