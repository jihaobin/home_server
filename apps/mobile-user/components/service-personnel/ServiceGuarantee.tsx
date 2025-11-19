import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { View } from "react-native";

const ICON_MAP = lucideIconRegistry;

interface GuaranteeItem {
    icon: keyof typeof ICON_MAP;
    title: string;
    description: string;
}

const guaranteeItems: GuaranteeItem[] = [
    {
        icon: "Shield",
        title: "平台保障",
        description: "所有服务人员经过实名认证",
    },
    {
        icon: "Clock",
        title: "准时到达",
        description: "承诺按时上门,超时补偿",
    },
    {
        icon: "ThumbsUp",
        title: "服务满意",
        description: "不满意可申请售后保障",
    },
    {
        icon: "BadgeCheck",
        title: "专业技能",
        description: "经过平台技能认证考核",
    },
];

export function ServiceGuarantee() {
    return (
        <View className="mx-4 mb-4">
            {/* 标题 */}
            <View className="mb-3 flex-row items-center">
                <View className="h-4 w-1 rounded-full bg-primary" />
                <Text className="ml-2 text-base font-bold text-foreground">
                    服务保障
                </Text>
            </View>

            {/* 保障项列表 */}
            <View className="gap-3">
                {guaranteeItems.map((item, index) => (
                    <View
                        key={index}
                        className="flex-row items-start rounded-xl border border-border bg-card p-4"
                    >
                        <View className="rounded-full bg-primary/10 p-2">
                            <Icon
                                as={ICON_MAP[item.icon]}
                                size={20}
                                className="text-primary"
                            />
                        </View>
                        <View className="ml-3 flex-1">
                            <Text className="text-sm font-semibold text-foreground">
                                {item.title}
                            </Text>
                            <Text className="mt-1 text-xs text-muted-foreground">
                                {item.description}
                            </Text>
                        </View>
                    </View>
                ))}
            </View>
        </View>
    );
}
