import { Text } from "@repo/mobile-ui/components/ui/text";
import { Pressable, View } from "react-native";

type SearchHistorySectionProps = {
    history: string[];
    onPressKeyword: (keyword: string) => void;
    onDeleteKeyword: (keyword: string) => void;
    onClearAll: () => void;
};

export function SearchHistorySection({
    history,
    onPressKeyword,
    onDeleteKeyword,
    onClearAll,
}: SearchHistorySectionProps) {
    return (
        <View className="flex-1 px-4 py-4">
            <View className="mb-3 flex-row items-center justify-between">
                <Text className="text-base font-puhui-medium text-foreground">
                    搜索历史
                </Text>

                {history.length ? (
                    <Pressable onPress={onClearAll}>
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            清空全部
                        </Text>
                    </Pressable>
                ) : null}
            </View>

            {!history.length ? (
                <View className="rounded-xl bg-card px-4 py-6">
                    <Text className="text-sm font-puhui-regular text-muted-foreground">
                        暂无搜索历史，试试搜索服务或服务人员
                    </Text>
                </View>
            ) : (
                <View className="overflow-hidden rounded-xl bg-card">
                    {history.map((item, index) => (
                        <View
                            key={item}
                            className="flex-row items-center justify-between px-4 py-4"
                        >
                            <Pressable
                                className="flex-1"
                                onPress={() => onPressKeyword(item)}
                            >
                                <Text className="text-sm font-puhui-regular text-foreground">
                                    {item}
                                </Text>
                            </Pressable>

                            <Pressable
                                className="ml-3 rounded-full border border-border px-3 py-1.5"
                                onPress={() => onDeleteKeyword(item)}
                            >
                                <Text className="text-xs font-puhui-regular text-muted-foreground">
                                    删除
                                </Text>
                            </Pressable>

                            {index < history.length - 1 ? (
                                <View className="absolute bottom-0 left-4 right-4 h-px bg-border" />
                            ) : null}
                        </View>
                    ))}
                </View>
            )}
        </View>
    );
}
