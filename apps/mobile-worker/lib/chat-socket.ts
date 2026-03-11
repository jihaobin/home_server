import { io, type Socket } from "socket.io-client";
import {
    CHAT_SOCKET_CLIENT_EVENT,
    CHAT_SOCKET_SERVER_EVENT,
    ChatSocketClientEventType,
    type ChatMessageContent,
    type ChatSocketServerMessage,
} from "@repo/types";

type ServerMessageListener = (message: ChatSocketServerMessage) => void;

let socket: Socket | null = null;
let joinedConversationIds = new Set<string>();
const serverMessageListeners = new Set<ServerMessageListener>();

export function getChatSocket(): Socket | null {
    return socket;
}

export function connectChatSocket(params: {
    endpoint: string;
    cookieHeader: string;
    clientRole: "customer" | "service_personnel";
}) {
    if (socket && !socket.disconnected) {
        return socket;
    }
    disconnectChatSocket();

    socket = io(params.endpoint, {
        autoConnect: true,
        transports: ["websocket"],
        reconnectionAttempts: Infinity,
        reconnectionDelay: 2000,
        reconnectionDelayMax: 30_000,
        timeout: 10_000,
        withCredentials: true,
        query: {
            clientRole: params.clientRole,
        },
        auth: {
            clientRole: params.clientRole,
        },
        extraHeaders: {
            Cookie: params.cookieHeader,
        },
        transportOptions: {
            polling: {
                extraHeaders: {
                    Cookie: params.cookieHeader,
                },
            },
        },
    });

    socket.on(CHAT_SOCKET_SERVER_EVENT, (message: ChatSocketServerMessage) => {
        serverMessageListeners.forEach((listener) => listener(message));
    });

    return socket;
}

export function disconnectChatSocket() {
    if (socket) {
        socket.off(CHAT_SOCKET_SERVER_EVENT);
        socket.disconnect();
    }
    socket = null;
    joinedConversationIds = new Set<string>();
}

export function resetJoinedChatConversations() {
    joinedConversationIds = new Set<string>();
}

export function onChatServerMessage(listener: ServerMessageListener) {
    serverMessageListeners.add(listener);
    return () => {
        serverMessageListeners.delete(listener);
    };
}

export function joinChatConversation(conversationId: string) {
    if (!conversationId || joinedConversationIds.has(conversationId)) {
        return;
    }
    joinedConversationIds.add(conversationId);
    socket?.emit(CHAT_SOCKET_CLIENT_EVENT, {
        type: ChatSocketClientEventType.Join,
        clientRole: "service_personnel",
        conversationId,
    });
}

export function sendChatClientMessage(message: {
    type: ChatSocketClientEventType.Send;
    conversationId?: string;
    peerUserId?: string;
    content: ChatMessageContent;
    clientMsgId?: string;
}) {
    socket?.emit(CHAT_SOCKET_CLIENT_EVENT, {
        ...message,
        clientRole: "service_personnel",
    });
}
