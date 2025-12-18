import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Server, Socket } from 'socket.io';

import type {
    NotificationEventPayload,
    NotificationHeartbeatDto,
    NotificationSocketServerMessage,
} from '@repo/types';
import {
    NOTIFICATION_SOCKET_SERVER_EVENT,
    NotificationSocketEventType,
} from '@repo/types';

export interface NotificationWsConnectionMetadata {
    platform?: NotificationHeartbeatDto['platform'];
    deviceId?: string;
    appVersion?: string;
    registrationId?: string;
}

export interface NotificationWsConnectionContext {
    userId?: string;
    metadata?: NotificationWsConnectionMetadata;
}

interface NotificationWsConnection extends NotificationWsConnectionContext {
    id: string;
    socket: Socket;
    lastHeartbeatAt: number;
}

const HEARTBEAT_TIMEOUT_MS = 45_000;
const HEARTBEAT_SWEEP_INTERVAL_MS = 15_000;

@Injectable()
export class NotificationWsService implements OnModuleDestroy {
    private readonly logger = new Logger(NotificationWsService.name);
    private server?: Server;
    private readonly broadcastRoom = '__broadcast__';
    private readonly userRoomPrefix = 'user:';
    private readonly connections = new Map<string, NotificationWsConnection>();
    private readonly heartbeatSweep: NodeJS.Timeout;

    constructor() {
        this.heartbeatSweep = setInterval(
            () => this.pruneConnections(),
            HEARTBEAT_SWEEP_INTERVAL_MS,
        );
        this.heartbeatSweep.unref?.();
    }

    onModuleDestroy() {
        if (this.heartbeatSweep) {
            clearInterval(this.heartbeatSweep);
        }
        for (const connection of this.connections.values()) {
            connection.socket.disconnect(true);
        }
        this.connections.clear();
    }

    setServer(server: Server) {
        this.server = server;
    }

    registerConnection(
        socket: Socket,
        context: NotificationWsConnectionContext,
    ): NotificationWsConnection {
        const connectionId = socket.id ?? randomUUID();
        const connection: NotificationWsConnection = {
            id: connectionId,
            socket,
            userId: context.userId,
            metadata: context.metadata ?? {},
            lastHeartbeatAt: Date.now(),
        };
        socket.data.connectionId = connectionId;
        void socket.join(this.broadcastRoom);
        if (connection.userId) {
            void socket.join(this.userRoom(connection.userId));
        }
        this.connections.set(connectionId, connection);
        return connection;
    }

    getConnection(connectionId: string) {
        return this.connections.get(connectionId);
    }

    removeConnection(
        connectionId: string,
    ): NotificationWsConnection | undefined {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return undefined;
        }
        if (connection.userId) {
            void connection.socket.leave(this.userRoom(connection.userId));
        }
        void connection.socket.leave(this.broadcastRoom);
        this.connections.delete(connectionId);
        return connection;
    }

    markHeartbeat(connectionId: string) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }
        connection.lastHeartbeatAt = Date.now();
    }

    emit(payload: NotificationEventPayload) {
        const enriched = this.ensureEventId(payload);
        const message: NotificationSocketServerMessage = {
            type: NotificationSocketEventType.Notification,
            event: enriched.event,
            payload: enriched,
            deliveryId: enriched.deliveryId,
            deliveryMode: enriched.deliveryMode,
        };
        if (!this.server) {
            this.logger.warn('WebSocket server 尚未初始化，跳过通知推送');
            return;
        }
        if (enriched.userId) {
            this.server
                .to(this.userRoom(enriched.userId))
                .emit(NOTIFICATION_SOCKET_SERVER_EVENT, message);
            return;
        }
        this.server
            .to(this.broadcastRoom)
            .emit(NOTIFICATION_SOCKET_SERVER_EVENT, message);
    }

    sendConnectionAck(connectionId: string) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }
        const message: NotificationSocketServerMessage = {
            type: NotificationSocketEventType.ConnectionAck,
            connectionId,
        };
        connection.socket.emit(NOTIFICATION_SOCKET_SERVER_EVENT, message);
    }

    sendHeartbeatAck(connectionId: string) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }
        const message: NotificationSocketServerMessage = {
            type: NotificationSocketEventType.HeartbeatAck,
            timestamp: new Date().toISOString(),
        };
        connection.socket.emit(NOTIFICATION_SOCKET_SERVER_EVENT, message);
    }

    sendError(connectionId: string, code: string, message: string) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            return;
        }
        connection.socket.emit(NOTIFICATION_SOCKET_SERVER_EVENT, {
            type: NotificationSocketEventType.Error,
            code,
            message,
        });
    }

    private ensureEventId(
        payload: NotificationEventPayload,
    ): NotificationEventPayload {
        if (payload.eventId || payload.deliveryId) {
            return payload;
        }
        return {
            ...payload,
            eventId: randomUUID(),
        };
    }

    private pruneConnections() {
        const now = Date.now();
        for (const connection of this.connections.values()) {
            if (now - connection.lastHeartbeatAt > HEARTBEAT_TIMEOUT_MS) {
                this.logger.warn(`连接 ${connection.id} 心跳超时，主动断开`);
                connection.socket.disconnect(true);
                this.connections.delete(connection.id);
            }
        }
    }

    private userRoom(userId: string) {
        return `${this.userRoomPrefix}${userId}`;
    }
}
