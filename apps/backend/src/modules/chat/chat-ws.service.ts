import { Injectable } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';

export interface ChatWsConnectionContext {
    userId: string;
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
}
