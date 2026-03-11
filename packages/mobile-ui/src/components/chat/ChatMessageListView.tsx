import * as React from "react";
import { FlatList, View } from "react-native";

import type { ChatMessage } from "@repo/types";

import { Text } from "../ui/text";
import { ChatMessageRow } from "./ChatMessageRow";

type ChatTimelineRow =
    | {
          id: string;
          type: "message";
          message: ChatMessage;
      }
    | {
          id: string;
          type: "date_separator";
          text: string;
      };

export function ChatMessageListView(props: {
    items: ChatMessage[];
    currentUserId?: string;
    hasMore: boolean;
    isLoadingMore: boolean;
    onLoadMore: () => void;
    onOpenOrder: (orderId: string) => void;
    onOpenMedia?: (messageId: string) => void;
}) {
    const { items, hasMore, isLoadingMore } = props;
    const loadMoreLockedRef = React.useRef(false);
    const timelineRows = React.useMemo(() => buildTimelineRows(items), [items]);

    React.useEffect(() => {
        if (!isLoadingMore) {
            loadMoreLockedRef.current = false;
        }
    }, [isLoadingMore]);

    return (
        <FlatList
            inverted
            data={timelineRows}
            keyExtractor={(item) => item.id}
            contentContainerStyle={{
                paddingHorizontal: 12,
                paddingTop: 10,
                paddingBottom: 16,
            }}
            onEndReached={() => {
                if (hasMore && !isLoadingMore && !loadMoreLockedRef.current) {
                    loadMoreLockedRef.current = true;
                    props.onLoadMore();
                }
            }}
            onEndReachedThreshold={0.2}
            renderItem={({ item }) => {
                if (item.type === "date_separator") {
                    return (
                        <View className="my-1 items-center">
                            <Text className="rounded-full bg-muted px-3 py-1 text-xs text-muted-foreground">
                                {item.text}
                            </Text>
                        </View>
                    );
                }

                const isOwn =
                    Boolean(props.currentUserId) &&
                    item.message.senderUserId === props.currentUserId;
                return (
                    <View
                        style={{
                            marginBottom: 10,
                            alignItems: isOwn ? "flex-end" : "flex-start",
                        }}
                    >
                        <ChatMessageRow
                            message={item.message}
                            isOwn={isOwn}
                            onOpenOrder={props.onOpenOrder}
                            onOpenMedia={props.onOpenMedia}
                        />
                    </View>
                );
            }}
            ListFooterComponent={
                hasMore ? (
                    <View className="py-3">
                        <Text className="text-center text-xs text-muted-foreground">
                            {isLoadingMore ? "加载中..." : "加载更多历史消息"}
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

function buildTimelineRows(items: ChatMessage[]) {
    const rows: ChatTimelineRow[] = [];

    for (let index = 0; index < items.length; index += 1) {
        const current = items[index];
        rows.push({
            id: current.id,
            type: "message",
            message: current,
        });

        const currentDayKey = formatDayKey(current.createdAt);
        const next = items[index + 1];
        const nextDayKey = next ? formatDayKey(next.createdAt) : null;
        if (currentDayKey && currentDayKey !== nextDayKey) {
            rows.push({
                id: `date-${currentDayKey}-${current.id}`,
                type: "date_separator",
                text: formatDayLabel(current.createdAt),
            });
        }
    }

    return rows;
}

function formatDayKey(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return null;
    }
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}-${month}-${day}`;
}

function formatDayLabel(value: string) {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return value;
    }
    const year = `${date.getFullYear()}`;
    const month = `${date.getMonth() + 1}`.padStart(2, "0");
    const day = `${date.getDate()}`.padStart(2, "0");
    return `${year}年${month}月${day}日`;
}
