import { Icon } from "@repo/mobile-ui/components/ui/icon";
import { Text } from "@repo/mobile-ui/components/ui/text";
import { Image } from "expo-image";
import { icons as lucideIconRegistry } from "lucide-react-native";
import { Pressable, View } from "react-native";
import type { SimilarService } from "./types";

const ICON_MAP = lucideIconRegistry;

interface SimilarServicesProps {
    services: SimilarService[];
    onServicePress?: (serviceId: string) => void;
    onViewMorePress?: () => void;
}

export function SimilarServices({
    services,
    onServicePress,
    onViewMorePress,
}: SimilarServicesProps) {
    if (services.length === 0) {
        return null;
    }

    return (
        <View className="px-4 mb-6">
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-lg font-bold text-foreground">
                    相似服务
                </Text>
                <Pressable className="flex-row items-center" onPress={onViewMorePress}>
                    <Text className="text-sm text-primary">查看更多</Text>
                    <Icon
                        as={ICON_MAP.ChevronRight}
                        size={16}
                        className="ml-1 text-primary"
                    />
                </Pressable>
            </View>

            <View className="flex-row flex-wrap -mx-2">
                {services.map((service) => (
                    <View key={service.id} className="w-1/3 px-2 mb-4">
                        <Pressable
                            className="rounded-xl border border-border bg-card overflow-hidden"
                            onPress={() => onServicePress?.(service.id)}
                        >
                            <Image
                                source={{ uri: service.image }}
                                style={{
                                    width: "100%",
                                    height: 100,
                                }}
                                contentFit="cover"
                            />
                            <View className="p-2">
                                <Text
                                    className="text-sm font-medium text-foreground"
                                    numberOfLines={2}
                                >
                                    {service.name}
                                </Text>
                                <View className="mt-1 flex-row items-baseline">
                                    <Text className="text-base font-bold text-primary">
                                        {service.price}
                                    </Text>
                                    <Text className="ml-1 text-xs text-muted-foreground">
                                        元/{service.unit}
                                    </Text>
                                </View>
                                {service.tag && (
                                    <View className="mt-1 self-start rounded-full bg-primary/10 px-2 py-0.5">
                                        <Text className="text-xs text-primary">
                                            {service.tag}
                                        </Text>
                                    </View>
                                )}
                            </View>
                        </Pressable>
                    </View>
                ))}
            </View>
        </View>
    );
}
