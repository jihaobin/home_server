import * as React from "react";
import { FlatList, Pressable, View } from "react-native";

import type { ChatConversation } from "@repo/types";
import { Text } from "@repo/mobile-ui/components/ui/text";

export function ChatConversationListView(props: {
    items: ChatConversation[];
    onPressConversation: (conversationId: string) => void;
}) {
    return (
        <FlatList
            data={props.items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12 }}
            renderItem={({ item }) => (
                <Pressable
                    onPress={() => props.onPressConversation(item.id)}
                    className="mb-3 rounded-lg border border-border bg-card px-3 py-3"
                >
                    <Text className="text-sm text-foreground">
                        会话：{item.id}
                    </Text>
                    <Text className="mt-1 text-xs text-muted-foreground">
                        最近消息：{item.lastMessageAt ?? "-"}
                    </Text>
                </Pressable>
            )}
            ListEmptyComponent={
                <View className="pt-10">
                    <Text className="text-center text-sm text-muted-foreground">
                        暂无会话
                    </Text>
                </View>
            }
        />
    );
}
