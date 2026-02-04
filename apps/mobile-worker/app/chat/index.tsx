import * as React from "react";
import { router } from "expo-router";
import { View } from "react-native";

import { useChatConversations } from "@repo/hooks/api/chat";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";

import { ChatConversationListView } from "../../components/chat/ChatConversationListView";

export default function ChatConversationListScreen() {
    const { data } = useChatConversations({ limit: 50 });

    return (
        <RequireAuth>
            <View className="flex-1 bg-background">
                <ChatConversationListView
                    items={data.items}
                    onPressConversation={(conversationId) =>
                        router.push(`/chat/${conversationId}` as any)
                    }
                />
            </View>
        </RequireAuth>
    );
}
