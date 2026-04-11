import { Text } from "@repo/mobile-ui/components/ui/text";
import type { HomeSearchSuggestionResponse } from "@repo/types";
import { Pressable, View } from "react-native";

type SuggestionItem = HomeSearchSuggestionResponse["suggestions"][number];

type SearchSuggestionListProps = {
    keyword: string;
    suggestions: SuggestionItem[];
    isLoading: boolean;
    isError: boolean;
    onSelectSuggestion: (item: SuggestionItem) => void;
};

function getSuggestionTypeLabel(type: SuggestionItem["type"]) {
    return type === "personnel" ? "服务人员" : "服务";
}

export function SearchSuggestionList({
    keyword,
    suggestions,
    isLoading,
    isError,
    onSelectSuggestion,
}: SearchSuggestionListProps) {
    return (
        <View className="flex-1 px-4 py-4">
            <Text className="mb-3 text-base font-puhui-medium text-foreground">
                搜索建议
            </Text>

            <View className="overflow-hidden rounded-xl bg-card">
                {isLoading ? (
                    <View className="px-4 py-6">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            搜索中...
                        </Text>
                    </View>
                ) : isError ? (
                    <View className="px-4 py-6">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            联想加载失败，可直接搜索“{keyword}”
                        </Text>
                    </View>
                ) : suggestions.length ? (
                    suggestions.map((item, index) => (
                        <Pressable
                            key={`${item.type}-${item.personnelId ?? item.serviceId ?? item.label}`}
                            className="px-4 py-4"
                            onPress={() => onSelectSuggestion(item)}
                        >
                            <View className="flex-row items-start justify-between">
                                <View className="flex-1 pr-3">
                                    <Text className="text-sm font-puhui-medium text-foreground">
                                        {item.label}
                                    </Text>
                                    {item.subtitle ? (
                                        <Text className="mt-1 text-xs font-puhui-regular text-muted-foreground">
                                            {item.subtitle}
                                        </Text>
                                    ) : null}
                                </View>

                                <View className="rounded-full border border-border px-2 py-1">
                                    <Text className="text-xs font-puhui-regular text-muted-foreground">
                                        {getSuggestionTypeLabel(item.type)}
                                    </Text>
                                </View>
                            </View>

                            {index < suggestions.length - 1 ? (
                                <View className="absolute bottom-0 left-4 right-4 h-px bg-border" />
                            ) : null}
                        </Pressable>
                    ))
                ) : (
                    <View className="px-4 py-6">
                        <Text className="text-sm font-puhui-regular text-muted-foreground">
                            暂无相关搜索建议，可直接搜索“{keyword}”
                        </Text>
                    </View>
                )}
            </View>
        </View>
    );
}
