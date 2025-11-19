import { Text } from "@repo/mobile-ui/components/ui/text";
import { cn } from "@repo/mobile-ui/lib/utils";
import { Pressable, ScrollView, View } from "react-native";
import type { ServiceSpecification } from "./types";

interface ServiceSpecificationsProps {
    specifications: ServiceSpecification[];
    selectedOption: string;
    onSelect: (id: string) => void;
}

export function ServiceSpecifications({
    specifications,
    selectedOption,
    onSelect,
}: ServiceSpecificationsProps) {
    if (specifications.length === 0) {
        return (
            <View className="mx-4 my-4 rounded-xl border border-border bg-card p-6">
                <Text className="text-center text-sm text-muted-foreground">
                    暂无服务规格信息
                </Text>
            </View>
        );
    }

    return (
        <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            className="px-4 py-4"
            contentContainerStyle={{ gap: 12 }}
        >
            {specifications.map((spec) => {
                const price = Number.parseFloat(spec.price);
                return (
                    <Pressable
                        key={spec.id}
                        onPress={() => onSelect(spec.id)}
                        className={cn(
                            "rounded-2xl border-2 px-4 py-3 min-w-[160px]",
                            selectedOption === spec.id
                                ? "border-primary bg-primary/5"
                                : "border-border bg-card",
                        )}
                    >
                        <Text
                            className={cn(
                                "text-base font-semibold",
                                selectedOption === spec.id
                                    ? "text-primary"
                                    : "text-foreground",
                            )}
                        >
                            {spec.name || "标准服务"}
                        </Text>
                        <View className="mt-1 flex-row items-baseline">
                            <Text
                                className={cn(
                                    "text-xl font-bold",
                                    selectedOption === spec.id
                                        ? "text-primary"
                                        : "text-foreground",
                                )}
                            >
                                {price.toFixed(2)}
                            </Text>
                        </View>
                    </Pressable>
                );
            })}
        </ScrollView>
    );
}
