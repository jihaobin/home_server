import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { AppState, type AppStateStatus } from "react-native";
import type { InfiniteData } from "@tanstack/react-query";
import { useQueryClient } from "@tanstack/react-query";
import {
    ChatSocketEventType,
    type ChatConversationListResponse,
    type ChatMessage,
    type ChatMessageListResponse,
    type ChatSocketServerMessage,
} from "@repo/types";
import { apiClient } from "@repo/lib/http-client";
import {
    CHAT_QUERY_KEY,
    chatConversationsQueryKey,
    chatMessagesInfiniteQueryKey,
} from "@repo/hooks/api/chat";
import { useAuth } from "@repo/mobile-ui/components/SessionProvider";

import { resolveChatSocketEndpoint } from "../lib/chat-config";
import {
    connectChatSocket,
    disconnectChatSocket,
    getChatSocket,
    joinChatConversation,
    onChatServerMessage,
    resetJoinedChatConversations,
} from "../lib/chat-socket";

type ConnectionStatus =
    | "idle"
    | "connecting"
    | "connected"
    | "disconnected"
    | "error";

export type UseChatSocketResult = {
    status: ConnectionStatus;
    lastError: string | null;
};

// 后端 REST 查询参数 limit 上限为 100（Zod 校验）。
const AUTO_JOIN_LIMIT = 100;

export function useChatSocket(
    options: { enabled?: boolean } = {},
): UseChatSocketResult {
    const { enabled = true } = options;
    const queryClient = useQueryClient();
    const { getCookie } = useAuth();
    const [status, setStatus] = useState<ConnectionStatus>("idle");
    const [lastError, setLastError] = useState<string | null>(null);
    const appStateRef = useRef<AppStateStatus>(AppState.currentState);
    const hasConnectedOnceRef = useRef(false);

    const cookieHeader = useMemo(
        () =>
            getCookie?.()
                ?.replace(/^\s*;\s*/, "")
                .trim() ?? "",
        [getCookie],
    );

    const updateCachesWithIncomingMessage = useCallback(
        (conversationId: string, message: ChatMessage) => {
            // 1) 更新消息列表（第一页顶部，倒序）
            queryClient.setQueryData(
                chatMessagesInfiniteQueryKey({ conversationId }),
                (current) => {
                    const data = current as
                        | InfiniteData<ChatMessageListResponse>
                        | undefined;
                    if (!data || data.pages.length === 0) {
                        return current;
                    }
                    const first = data.pages[0];
                    if (first.items.some((item) => item.id === message.id)) {
                        return current;
                    }

                    const serverClientMsgId = message.clientMsgId;
                    if (serverClientMsgId) {
                        const idx = first.items.findIndex(
                            (item) => item.clientMsgId === serverClientMsgId,
                        );
                        if (idx >= 0) {
                            const nextItems = [...first.items];
                            nextItems[idx] = message;
                            const nextFirst: ChatMessageListResponse = {
                                ...first,
                                items: nextItems,
                            };
                            return {
                                ...data,
                                pages: [nextFirst, ...data.pages.slice(1)],
                            } satisfies InfiniteData<ChatMessageListResponse>;
                        }
                    }
                    const nextFirst: ChatMessageListResponse = {
                        ...first,
                        items: [message, ...first.items],
                    };
                    return {
                        ...data,
                        pages: [nextFirst, ...data.pages.slice(1)],
                    } satisfies InfiniteData<ChatMessageListResponse>;
                },
            );

            // 2) 更新会话列表：lastMessageAt + 置顶
            let foundConversation = false;
            queryClient.setQueriesData(
                { queryKey: [CHAT_QUERY_KEY.CONVERSATIONS] },
                (current) => {
                    const data = current as
                        | {
                              items: Array<{
                                  id: string;
                                  lastMessageAt: string | null;
                              }>;
                          }
                        | undefined;
                    if (!data?.items) {
                        return current;
                    }
                    const nextItems = [...data.items];
                    const idx = nextItems.findIndex(
                        (c) => c.id === conversationId,
                    );
                    if (idx === -1) {
                        return current;
                    }
                    foundConversation = true;
                    const updated = {
                        ...nextItems[idx],
                        lastMessageAt: message.createdAt,
                    };
                    nextItems.splice(idx, 1);
                    nextItems.unshift(updated);
                    return { ...data, items: nextItems };
                },
            );

            if (!foundConversation) {
                queryClient.invalidateQueries({
                    queryKey: [CHAT_QUERY_KEY.CONVERSATIONS],
                });
            }
        },
        [queryClient],
    );

    const joinAllConversations = useCallback(async () => {
        const response = await apiClient.get<ChatConversationListResponse>(
            "/chat/conversations",
            {
                query: {
                    limit: AUTO_JOIN_LIMIT.toString(),
                },
            },
        );
        queryClient.setQueryData(
            chatConversationsQueryKey({ limit: AUTO_JOIN_LIMIT }),
            response.data,
        );
        response.data.items.forEach((c) => joinChatConversation(c.id));
    }, [queryClient]);

    const handleServerMessage = useCallback(
        (message: ChatSocketServerMessage) => {
            if (message.type === ChatSocketEventType.Error) {
                setStatus("error");
                setLastError(message.message);
                return;
            }
            if (message.type === ChatSocketEventType.Message) {
                joinChatConversation(message.conversationId);
                updateCachesWithIncomingMessage(
                    message.conversationId,
                    message.message,
                );
            }
        },
        [updateCachesWithIncomingMessage],
    );

    const connect = useCallback(() => {
        const endpoint = resolveChatSocketEndpoint();
        if (!endpoint) {
            setStatus("error");
            setLastError("缺少聊天服务地址");
            return;
        }
        if (!cookieHeader) {
            setStatus("error");
            setLastError("未找到登录态，无法建立聊天连接");
            return;
        }
        setStatus("connecting");
        const socket = connectChatSocket({ endpoint, cookieHeader });

        const onConnect = () => {
            hasConnectedOnceRef.current = true;
            setStatus("connected");
            setLastError(null);
            void joinAllConversations().catch((error) => {
                const msg =
                    error instanceof Error ? error.message : "会话自动加入失败";
                setLastError(msg);
            });
        };

        const onDisconnect = () => {
            resetJoinedChatConversations();
            setStatus(hasConnectedOnceRef.current ? "disconnected" : "idle");
        };

        const onConnectError = (error: Error) => {
            setStatus("error");
            setLastError(error.message);
        };

        socket.on("connect", onConnect);
        socket.on("disconnect", onDisconnect);
        socket.on("connect_error", onConnectError);

        return () => {
            socket.off("connect", onConnect);
            socket.off("disconnect", onDisconnect);
            socket.off("connect_error", onConnectError);
        };
    }, [cookieHeader, joinAllConversations, resetJoinedChatConversations]);

    useEffect(() => {
        if (!enabled) {
            setStatus("idle");
            setLastError(null);
            disconnectChatSocket();
            return;
        }

        const unsubscribeServer = onChatServerMessage(handleServerMessage);
        const cleanupSocketEvents = connect();

        return () => {
            unsubscribeServer();
            cleanupSocketEvents?.();
            disconnectChatSocket();
        };
    }, [connect, enabled, handleServerMessage]);

    useEffect(() => {
        if (!enabled) {
            return;
        }
        const subscription = AppState.addEventListener(
            "change",
            (nextState) => {
                appStateRef.current = nextState;
                if (nextState === "active") {
                    const socket = getChatSocket();
                    if (socket?.disconnected) {
                        socket.connect();
                    }
                } else {
                    resetJoinedChatConversations();
                    getChatSocket()?.disconnect();
                }
            },
        );
        return () => subscription.remove();
    }, [enabled, getChatSocket, resetJoinedChatConversations]);

    return {
        status,
        lastError,
    };
}
