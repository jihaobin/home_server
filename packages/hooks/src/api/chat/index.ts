import {
    useMutation,
    useQueryClient,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import type {
    ChatConversation,
    ChatConversationListResponse,
    ChatCreateBlockDto,
    ChatCreateReportDto,
    ChatMessageListResponse,
    ChatUpsertConversationDto,
} from "@repo/types";

import { apiClient } from "@repo/lib/http-client";

export const CHAT_QUERY_KEY = {
    CONVERSATIONS: "chat-conversations",
    MESSAGES_INFINITE: "chat-messages-infinite",
} as const;

export function chatConversationsQueryKey(params?: { limit?: number }) {
    return [
        CHAT_QUERY_KEY.CONVERSATIONS,
        { limit: params?.limit ?? 50 },
    ] as const;
}

export function chatMessagesInfiniteQueryKey(params: {
    conversationId: string;
    limit?: number;
}) {
    return [
        CHAT_QUERY_KEY.MESSAGES_INFINITE,
        { conversationId: params.conversationId, limit: params.limit ?? 20 },
    ] as const;
}

export const useChatConversations = (params?: { limit?: number }) =>
    useSuspenseQuery({
        queryKey: chatConversationsQueryKey({ limit: params?.limit }),
        queryFn: async () => {
            const response = await apiClient.get<ChatConversationListResponse>(
                "/chat/conversations",
                {
                    query:
                        params?.limit !== undefined
                            ? { limit: params.limit.toString() }
                            : {},
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "会话列表获取失败",
        },
    });

export const useChatMessagesInfinite = (params: {
    conversationId: string;
    limit?: number;
}) =>
    useSuspenseInfiniteQuery({
        queryKey: chatMessagesInfiniteQueryKey({
            conversationId: params.conversationId,
            limit: params.limit,
        }),
        initialPageParam: null as string | null,
        queryFn: async ({ pageParam }) => {
            const response = await apiClient.get<ChatMessageListResponse>(
                "/chat/messages",
                {
                    query: {
                        conversationId: params.conversationId,
                        limit:
                            params.limit !== undefined
                                ? params.limit.toString()
                                : undefined,
                        cursor: pageParam ?? undefined,
                    },
                },
            );
            return response.data;
        },
        getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
        meta: {
            errorMessage: "消息列表获取失败",
        },
    });

export const useChatUpsertConversation = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: ChatUpsertConversationDto) => {
            const response = await apiClient.post<ChatConversation>(
                "/chat/conversations",
                dto,
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [CHAT_QUERY_KEY.CONVERSATIONS],
            });
        },
        scope: {
            id: "chatUpsertConversation",
        },
    });
};

export const useChatBlock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: ChatCreateBlockDto) => {
            const response = await apiClient.post("/chat/blocks", dto);
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [CHAT_QUERY_KEY.CONVERSATIONS],
            });
        },
        scope: {
            id: "chatBlock",
        },
    });
};

export const useChatUnblock = () => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (blockedUserId: string) => {
            const response = await apiClient.delete(
                `/chat/blocks/${blockedUserId}`,
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [CHAT_QUERY_KEY.CONVERSATIONS],
            });
        },
        scope: {
            id: "chatUnblock",
        },
    });
};

export const useChatReport = () =>
    useMutation({
        mutationFn: async (dto: ChatCreateReportDto) => {
            const response = await apiClient.post("/chat/reports", dto);
            return response.data;
        },
        scope: {
            id: "chatReport",
        },
    });
