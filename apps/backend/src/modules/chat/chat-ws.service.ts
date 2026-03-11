import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

import { CHAT_SOCKET_SERVER_EVENT, type ChatConversation } from '@repo/types';

import type { ChatClientRole } from './chat.repository';

import { chatConversationRoom, chatUserRoom } from './chat.constants';

export interface ChatWsConnectionContext {
    userId: string;
    clientRole: ChatClientRole;
}

interface ChatWsConnection extends ChatWsConnectionContext {
    id: string;
    socket: Socket;
}

@Injectable()
export class ChatWsService {
    private server?: Server;
    private readonly connections = new Map<string, ChatWsConnection>();

    setServer(server: Server) {
        this.server = server;
    }

    getServer() {
        return this.server;
    }

    registerConnection(socket: Socket, context: ChatWsConnectionContext) {
        const connection: ChatWsConnection = {
            id: socket.id,
            socket,
            userId: context.userId,
            clientRole: context.clientRole,
        };
        this.connections.set(socket.id, connection);
        return connection;
    }

    removeConnection(socketId: string) {
        const conn = this.connections.get(socketId);
        if (!conn) {
            return undefined;
        }
        this.connections.delete(socketId);
        return conn;
    }

    getConnection(socketId: string) {
        return this.connections.get(socketId);
    }

    emitConversationUpdated(params: {
        conversationId: string;
        conversation: ChatConversation;
    }) {
        if (!this.server) {
            return;
        }
        const conversation = params.conversation as ChatConversation & {
            lastMessagePreview?: {
                type: string;
                text: string;
                messageId: string;
                createdAt: string;
                senderUserId: string;
            } | null;
        };

        this.server
            .to(chatConversationRoom(params.conversationId))
            .emit(CHAT_SOCKET_SERVER_EVENT, {
                type: 'conversation_updated',
                conversationId: params.conversationId,
                lastMessageAt:
                    params.conversation.lastMessageAt ??
                    params.conversation.updatedAt,
                lastMessagePreview:
                    conversation.lastMessagePreview ?? undefined,
            });
    }

    emitReadReceipt(params: {
        conversationId: string;
        readerUserId: string;
        lastReadMessageId: string;
        lastReadAt: string;
    }) {
        if (!this.server) {
            return;
        }

        this.server
            .to(chatConversationRoom(params.conversationId))
            .emit(CHAT_SOCKET_SERVER_EVENT, {
                type: 'read_receipt',
                conversationId: params.conversationId,
                readerUserId: params.readerUserId,
                lastReadMessageId: params.lastReadMessageId,
                lastReadAt: params.lastReadAt,
            });
    }

    joinUserToConversation(params: { userId: string; conversationId: string }) {
        if (!this.server) {
            return;
        }
        this.server
            .in(chatUserRoom(params.userId))
            .socketsJoin(chatConversationRoom(params.conversationId));
    }
}
