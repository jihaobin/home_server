import {
    useMutation,
    useQuery,
    useQueryClient,
    useSuspenseInfiniteQuery,
    useSuspenseQuery,
} from "@tanstack/react-query";
import type {
    ChatConversation,
    ChatConversationReadDto,
    ChatConversationListResponse,
    ChatCreateBlockDto,
    ChatCreateReportDto,
    ChatMessageListResponse,
    ChatUpsertConversationDto,
} from "@repo/types";

type ChatClientRole = "customer" | "service_personnel";

import { apiClient } from "@repo/lib/http-client";

export const CHAT_QUERY_KEY = {
    CONVERSATIONS: "chat-conversations",
    MESSAGES_INFINITE: "chat-messages-infinite",
} as const;

export function chatConversationsQueryKey(params?: {
    limit?: number;
    clientRole?: ChatClientRole;
}) {
    return [
        CHAT_QUERY_KEY.CONVERSATIONS,
        { limit: params?.limit ?? 50, clientRole: params?.clientRole },
    ] as const;
}

export function chatMessagesInfiniteQueryKey(params: {
    conversationId: string;
    limit?: number;
    clientRole?: ChatClientRole;
}) {
    return [
        CHAT_QUERY_KEY.MESSAGES_INFINITE,
        {
            conversationId: params.conversationId,
            limit: params.limit ?? 20,
            clientRole: params.clientRole,
        },
    ] as const;
}

export const useChatConversations = (params: {
    limit?: number;
    clientRole: ChatClientRole;
}) =>
    useSuspenseQuery({
        queryKey: chatConversationsQueryKey({
            limit: params.limit,
            clientRole: params.clientRole,
        }),
        queryFn: async () => {
            const response = await apiClient.get<ChatConversationListResponse>(
                "/chat/conversations",
                {
                    query: {
                        clientRole: params.clientRole,
                        limit:
                            params.limit !== undefined
                                ? params.limit.toString()
                                : undefined,
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "会话列表获取失败",
        },
    });

export const useChatConversationsQuery = (params: {
    limit?: number;
    clientRole: ChatClientRole;
}) =>
    useQuery({
        queryKey: chatConversationsQueryKey({
            limit: params.limit,
            clientRole: params.clientRole,
        }),
        queryFn: async () => {
            const response = await apiClient.get<ChatConversationListResponse>(
                "/chat/conversations",
                {
                    query: {
                        clientRole: params.clientRole,
                        limit:
                            params.limit !== undefined
                                ? params.limit.toString()
                                : undefined,
                    },
                },
            );
            return response.data;
        },
        meta: {
            errorMessage: "会话列表获取失败",
        },
    });

export const useChatConversationDetailQuery = (params: {
    conversationId: string;
    clientRole: ChatClientRole;
}) =>
    useQuery({
        queryKey: [
            CHAT_QUERY_KEY.CONVERSATIONS,
            "detail",
            params.conversationId,
        ],
        queryFn: async () => {
            const response = await apiClient.get<ChatConversation>(
                `/chat/conversations/${params.conversationId}`,
                {
                    query: {
                        clientRole: params.clientRole,
                    },
                },
            );
            return response.data;
        },
        enabled: !!params.conversationId,
        meta: {
            errorMessage: "会话详情获取失败",
        },
    });

export const useChatMessagesInfinite = (params: {
    conversationId: string;
    limit?: number;
    clientRole: ChatClientRole;
}) =>
    useSuspenseInfiniteQuery({
        queryKey: chatMessagesInfiniteQueryKey({
            conversationId: params.conversationId,
            limit: params.limit,
            clientRole: params.clientRole,
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
                        clientRole: params.clientRole,
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
        mutationFn: async (params: {
            dto: ChatUpsertConversationDto;
            clientRole: ChatClientRole;
        }) => {
            const response = await apiClient.post<ChatConversation>(
                "/chat/conversations",
                params.dto,
                {
                    query: {
                        clientRole: params.clientRole,
                    },
                },
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

export const useChatMarkConversationRead = (params: {
    conversationId: string;
    clientRole: ChatClientRole;
}) => {
    const queryClient = useQueryClient();
    return useMutation({
        mutationFn: async (dto: ChatConversationReadDto) => {
            const response = await apiClient.post<{ ok: boolean }>(
                `/chat/conversations/${params.conversationId}/read`,
                dto,
                {
                    query: {
                        clientRole: params.clientRole,
                    },
                },
            );
            return response.data;
        },
        onSuccess: () => {
            queryClient.invalidateQueries({
                queryKey: [CHAT_QUERY_KEY.CONVERSATIONS],
            });
        },
        scope: {
            id: `chatMarkConversationRead-${params.conversationId}`,
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
