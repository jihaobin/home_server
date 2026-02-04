import * as React from "react";
import { FlatList, View } from "react-native";

import type { ChatMessage } from "@repo/types";
import { Text } from "@repo/mobile-ui/components/ui/text";

import { ChatMessageRow } from "./ChatMessageRow";

export function ChatMessageListView(props: {
    items: ChatMessage[];
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onOpenOrder: (orderId: string) => void;
}) {
    const { items, hasMore, isLoadingMore } = props;

    return (
        <FlatList
            data={items}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{ padding: 12 }}
            onEndReached={() => {
                if (hasMore && !isLoadingMore) {
                    props.onLoadMore();
                }
            }}
            onEndReachedThreshold={0.2}
            renderItem={({ item }) => (
                <View style={{ marginBottom: 8 }}>
                    <ChatMessageRow
                        message={item}
                        onOpenOrder={props.onOpenOrder}
                    />
                </View>
            )}
            ListFooterComponent={
                hasMore ? (
                    <View className="py-3">
                        <Text className="text-center text-xs text-muted-foreground">
                            {isLoadingMore ? "加载中..." : "上拉加载更多"}
                        </Text>
                    </View>
                ) : (
                    <View className="py-3">
                        <Text className="text-center text-xs text-muted-foreground">
                            没有更多了
                        </Text>
                    </View>
                )
            }
        />
    );
}
