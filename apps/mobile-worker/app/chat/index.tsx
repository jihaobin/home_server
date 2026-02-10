import * as React from "react";
import { router } from "expo-router";
import { FlatList, Image, Pressable, View } from "react-native";

import { Bell, MessageCircle } from "lucide-react-native";

import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { Text } from "@repo/mobile-ui/components/ui/text";

type ChatListRow =
    | {
          key: string;
          kind: "system";
          title: string;
          subtitle: string;
          time: string;
          unreadCount?: number;
          icon: "order" | "assistant";
      }
    | {
          key: string;
          kind: "divider";
      }
    | {
          key: string;
          kind: "conversation";
          conversationId: string;
          title: string;
          subtitle: string;
          time: string;
          unreadCount?: number;
      };

function ChatListRowView(props: {
    row: ChatListRow;
    onPressConversation: (conversationId: string) => void;
}) {
    const { row } = props;

    if (row.kind === "divider") {
        return <View className="h-3 bg-muted" />;
    }

    const rightBlock = (
        <View
            className={
                row.unreadCount
                    ? "h-10 items-end justify-between"
                    : "h-10 items-end justify-center"
            }
        >
            <Text className="text-xs text-muted-foreground">{row.time}</Text>
            {row.unreadCount ? (
                <View className="h-5 w-5 items-center justify-center rounded-full bg-primary">
                    <Text className="text-xs font-medium leading-4 text-primary-foreground">
                        {row.unreadCount}
                    </Text>
                </View>
            ) : null}
        </View>
    );

    const content = (
        <View className="flex-1 flex-row items-center">
            {row.kind === "system" ? (
                <View
                    className={
                        row.icon === "order"
                            ? "h-10 w-10 items-center justify-center rounded-full bg-primary"
                            : "h-10 w-10 items-center justify-center rounded-full bg-blue-400"
                    }
                >
                    {row.icon === "order" ? (
                        <Bell size={18} color="white" />
                    ) : (
                        <MessageCircle size={18} color="white" />
                    )}
                </View>
            ) : (
                <View className="h-10 w-10 overflow-hidden rounded-full bg-muted">
                    <Image
                        source={require("../../assets/images/icon-round.png")}
                        style={{ width: 40, height: 40 }}
                        resizeMode="cover"
                    />
                </View>
            )}

            <View className="ml-2 flex-1">
                <Text className="text-sm font-medium text-foreground">
                    {row.title}
                </Text>
                <Text className="mt-1 text-xs text-muted-foreground">
                    {row.subtitle}
                </Text>
            </View>
        </View>
    );

    const rowView = (
        <View className="flex-row items-center justify-between bg-card px-4 py-4">
            {content}
            {rightBlock}
        </View>
    );

    if (row.kind === "conversation") {
        return (
            <Pressable
                onPress={() => props.onPressConversation(row.conversationId)}
                className="border-b-hairline border-border"
            >
                {rowView}
            </Pressable>
        );
    }

    return <View className="border-b-hairline border-border">{rowView}</View>;
}

export default function ChatConversationListScreen() {
    const rows = React.useMemo<ChatListRow[]>(
        () => [
            {
                key: "sys-order",
                kind: "system",
                icon: "order",
                title: "订单通知",
                subtitle: "您的服务即将开始",
                time: "17:56",
                unreadCount: 2,
            },
            {
                key: "sys-assistant",
                kind: "system",
                icon: "assistant",
                title: "官方助手",
                subtitle: "您的服务即将开始",
                time: "17:56",
            },
            { key: "divider", kind: "divider" },
            {
                key: "conv-1",
                kind: "conversation",
                conversationId: "mock-1",
                title: "王师傅",
                subtitle: "好的，马上到~",
                time: "17:56",
                unreadCount: 2,
            },
            {
                key: "conv-2",
                kind: "conversation",
                conversationId: "mock-2",
                title: "王师傅",
                subtitle: "好的，马上到~",
                time: "17:56",
            },
            {
                key: "conv-3",
                kind: "conversation",
                conversationId: "mock-3",
                title: "王师傅",
                subtitle: "好的，马上到~",
                time: "17:56",
            },
        ],
        [],
    );

    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <View className="h-11 border-b-hairline border-border bg-card px-4">
                    <View className="flex-1 justify-center">
                        <Text className="text-base font-medium text-foreground">
                            消息
                        </Text>
                    </View>
                </View>

                <FlatList
                    data={rows}
                    keyExtractor={(item) => item.key}
                    renderItem={({ item }) => (
                        <ChatListRowView
                            row={item}
                            onPressConversation={(conversationId) => {
                                router.push({
                                    pathname: "/chat/[conversationId]",
                                    params: { conversationId },
                                });
                            }}
                        />
                    )}
                />
            </View>
        </RequireAuth>
    );
}
