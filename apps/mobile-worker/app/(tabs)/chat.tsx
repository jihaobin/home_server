import * as React from "react";
import { router } from "expo-router";
import { View } from "react-native";

import { useChatConversations } from "@repo/hooks/api/chat";

import { ChatConversationListView } from "../../components/chat/ChatConversationListView";

export default function ChatTabScreen() {
    const { data } = useChatConversations({ limit: 50 });

    return (
        <View className="flex-1 bg-background">
            <ChatConversationListView
                items={data.items}
                onPressConversation={(conversationId) =>
                    router.push(`/chat/${conversationId}` as any)
                }
            />
        </View>
    );
}
