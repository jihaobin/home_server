import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, View } from "react-native";

import {
    ChatSocketClientEventType,
    type ChatMessageContent,
} from "@repo/types";
import { useChatMessagesInfinite } from "@repo/hooks/api/chat";
import { RequireAuth } from "@repo/mobile-ui/components/guards/RequireAuth";

import { ChatMessageListView } from "../../components/chat/ChatMessageListView";
import { ChatComposerView } from "../../components/chat/ChatComposerView";
import { useChatSendMessage } from "../../hooks/use-chat-send-message";
import { useChatSendAttachments } from "../../hooks/use-chat-send-attachments";

export default function ChatConversationScreen() {
    const params = useLocalSearchParams<{
        conversationId?: string;
        draftOrderId?: string;
    }>();
    const conversationId =
        typeof params.conversationId === "string" ? params.conversationId : "";
    const draftOrderId =
        typeof params.draftOrderId === "string" ? params.draftOrderId : "";
    const hasSentDraftOrderRef = React.useRef(false);

    if (!conversationId) {
        return null;
    }

    const { data, fetchNextPage, hasNextPage, isFetchingNextPage } =
        useChatMessagesInfinite({ conversationId, limit: 20 });

    const messages = React.useMemo(
        () => data.pages.flatMap((page) => page.items),
        [data.pages],
    );

    const { send } = useChatSendMessage({ conversationId });
    const { sendImageFromLibrary, sendVideoFromLibrary, isUploading } =
        useChatSendAttachments({ conversationId });

    React.useEffect(() => {
        if (!draftOrderId || hasSentDraftOrderRef.current) {
            return;
        }
        hasSentDraftOrderRef.current = true;
        send({ type: "order_card", orderId: draftOrderId });
        router.replace(`/chat/${conversationId}` as any);
    }, [conversationId, draftOrderId, send]);

    return (
        <RequireAuth>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
                <View className="flex-1 bg-background">
                    <ChatMessageListView
                        items={messages}
                        onLoadMore={() => {
                            if (hasNextPage && !isFetchingNextPage) {
                                void fetchNextPage();
                            }
                        }}
                        hasMore={!!hasNextPage}
                        isLoadingMore={isFetchingNextPage}
                        onOpenOrder={(orderId) =>
                            router.push(`/orders/${orderId}` as any)
                        }
                    />
                    <ChatComposerView
                        onSendText={(text) => send({ type: "text", text })}
                        onPickImage={() => void sendImageFromLibrary()}
                        onPickVideo={() => void sendVideoFromLibrary()}
                        disabled={isUploading}
                    />
                </View>
            </KeyboardAvoidingView>
        </RequireAuth>
    );
}
