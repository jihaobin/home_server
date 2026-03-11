import { router } from "expo-router";
import { ActivityIndicator, Pressable, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { useChatConversationsQuery } from "@repo/hooks/api/chat";
import type { ChatConversation } from "@repo/types";
import {
    ChatConversationListView,
    type ChatConversationListItem,
} from "@repo/mobile-ui/components/chat/ChatConversationListView";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";
import { Text } from "@repo/mobile-ui/components/ui/text";

export default function ChatTabScreen() {
    const { data, isPending, isError, refetch } = useChatConversationsQuery({
        limit: 50,
        clientRole: "service_personnel",
    });

    const items = (data?.items ?? []).map((conversation: ChatConversation) => {
        return {
            id: conversation.id,
            peerUserName: conversation.peerUser?.name,
            peerUserAvatar: conversation.peerUser?.image ?? null,
            lastMessagePreview: conversation.lastMessagePreview ?? null,
            lastMessageAt: conversation.lastMessageAt ?? conversation.updatedAt,
            unreadCount: conversation.unreadCount ?? 0,
        } satisfies ChatConversationListItem;
    });

    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <SafeAreaView edges={["top"]} className="bg-card">
                    <View className="h-11 justify-center border-b-hairline border-border px-4">
                        <Text className="text-base text-foreground font-puhui-medium">
                            消息
                        </Text>
                    </View>
                </SafeAreaView>

                {isPending ? (
                    <View className="flex-1 items-center justify-center">
                        <ActivityIndicator size="small" />
                        <Text className="mt-3 text-sm text-muted-foreground font-puhui-regular">
                            正在加载会话...
                        </Text>
                    </View>
                ) : isError ? (
                    <View className="flex-1 items-center justify-center px-6">
                        <Text className="text-sm text-muted-foreground font-puhui-regular">
                            会话加载失败，请稍后重试
                        </Text>
                        <Pressable
                            className="mt-3 rounded-md bg-primary px-4 py-2"
                            onPress={() => {
                                void refetch();
                            }}
                        >
                            <Text className="text-sm text-primary-foreground font-puhui-medium">
                                重新加载
                            </Text>
                        </Pressable>
                    </View>
                ) : (
                    <ChatConversationListView
                        items={items}
                        emptyText="暂无私聊会话"
                        onPressConversation={(conversationId) => {
                            const target = items.find(
                                (x) => x.id === conversationId,
                            );
                            router.push({
                                pathname: "/chat/[conversationId]",
                                params: {
                                    conversationId,
                                    peerName:
                                        target?.peerUserName || "聊天对象",
                                },
                            });
                        }}
                    />
                )}
            </View>
        </RequireAuth>
    );
}
