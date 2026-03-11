import { useCallback } from "react";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
    ChatSocketClientEventType,
    type ChatMessage,
    type ChatMessageContent,
    type ChatMessageListResponse,
} from "@repo/types";
import { useSession } from "@repo/mobile-ui/components/SessionProvider";
import { chatMessagesInfiniteQueryKey } from "@repo/hooks/api/chat";

import { sendChatClientMessage } from "../lib/chat-socket";
import { createChatClientMsgId } from "../lib/chat-utils";

export function useChatSendMessage(params: { conversationId: string }) {
    const queryClient = useQueryClient();
    const { session } = useSession();

    const send = useCallback(
        (content: ChatMessageContent) => {
            const conversationId = params.conversationId;
            const senderUserId = session?.user?.id;
            if (!conversationId || !senderUserId) {
                return;
            }
            const clientMsgId = createChatClientMsgId();
            const optimistic: ChatMessage = {
                id: `local:${clientMsgId}`,
                conversationId,
                senderUserId,
                clientMsgId,
                content,
                createdAt: new Date().toISOString(),
            };

            queryClient.setQueryData(
                chatMessagesInfiniteQueryKey({
                    conversationId,
                    clientRole: "customer",
                }),
                (current) => {
                    const data = current as
                        | InfiniteData<ChatMessageListResponse>
                        | undefined;
                    if (!data || data.pages.length === 0) {
                        return {
                            pages: [{ items: [optimistic], nextCursor: null }],
                            pageParams: [null],
                        } satisfies InfiniteData<ChatMessageListResponse>;
                    }
                    const first = data.pages[0];
                    if (first.items.some((m) => m.id === optimistic.id)) {
                        return current;
                    }
                    const nextFirst: ChatMessageListResponse = {
                        ...first,
                        items: [optimistic, ...first.items],
                    };
                    return {
                        ...data,
                        pages: [nextFirst, ...data.pages.slice(1)],
                    } satisfies InfiniteData<ChatMessageListResponse>;
                },
            );

            sendChatClientMessage({
                type: ChatSocketClientEventType.Send,
                conversationId,
                content,
                clientMsgId,
            });
        },
        [params.conversationId, queryClient, session?.user?.id],
    );

    return {
        send,
    };
}
