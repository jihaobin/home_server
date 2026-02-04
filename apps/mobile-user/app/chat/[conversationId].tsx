import * as React from "react";
import { router, useLocalSearchParams } from "expo-router";
import { KeyboardAvoidingView, Platform, View } from "react-native";

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
        // 清理 URL 参数，避免返回/重进导致重复发送
        router.replace(`/chat/${conversationId}` as any);
    }, [conversationId, draftOrderId, send]);

    if (!conversationId) {
        return null;
    }


    return (
        <RequireAuth>
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === "ios" ? "padding" : "height"}
            >
            </KeyboardAvoidingView>
        </RequireAuth>
    );
}
