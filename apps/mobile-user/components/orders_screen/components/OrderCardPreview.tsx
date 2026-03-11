import { Image } from "expo-image";
import { View } from "react-native";

import { Text } from "@repo/mobile-ui/components/ui/text";

type OrderCardPreviewProps = {
    title: string;
    subtitle?: string;
    amountText?: string;
    appointmentText?: string;
    imageUrl?: string | null;
    imageBlurhash?: string | null;
};

export function OrderCardPreview(props: OrderCardPreviewProps) {
    return (
        <View>
            <View className="flex-row items-center gap-3">
                <View className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-muted">
                    {props.imageUrl ? (
                        <Image
                            source={{ uri: props.imageUrl }}
                            placeholder={
                                props.imageBlurhash
                                    ? { blurhash: props.imageBlurhash }
                                    : undefined
                            }
                            className="h-full w-full"
                            contentFit="cover"
                        />
                    ) : (
                        <View className="h-full w-full items-center justify-center">
                            <Text className="text-xs text-muted-foreground">
                                暂无图片
                            </Text>
                        </View>
                    )}
                </View>

                <View className="flex-1">
                    <Text className="text-sm font-puhui-medium text-foreground">
                        {props.title}
                    </Text>
                    {props.subtitle ? (
                        <Text className="mt-1 text-xs text-muted-foreground">
                            {props.subtitle}
                        </Text>
                    ) : null}
                    {props.appointmentText ? (
                        <Text className="mt-1 text-xs text-muted-foreground">
                            预约时间：{props.appointmentText}
                        </Text>
                    ) : null}
                </View>

                {props.amountText ? (
                    <View className="items-end">
                        <Text className="text-base font-din-alt-bold text-foreground">
                            {props.amountText}
                        </Text>
                    </View>
                ) : null}
            </View>
        </View>
    );
}
