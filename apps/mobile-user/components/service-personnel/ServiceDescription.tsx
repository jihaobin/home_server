import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { View } from "react-native";

const ICON_MAP = lucideIconRegistry;

interface ServiceDescriptionProps {
    description?: string | null;
}

export function ServiceDescription({
    description,
}: ServiceDescriptionProps) {
    if (!description) {
        return null;
    }

    return (
        <View className="mx-4 mb-4">
            {/* 标题 */}
            <View className="mb-3 flex-row items-center">
                <View className="h-4 w-1 rounded-full bg-primary" />
                <Text className="ml-2 text-base font-bold text-foreground">
                    服务详情
                </Text>
            </View>

            {/* 描述内容 */}
            <View className="rounded-xl border border-border bg-card p-4">
                <Text className="text-sm leading-6 text-foreground/80">
                    {description}
                </Text>
            </View>
        </View>
    );
}
