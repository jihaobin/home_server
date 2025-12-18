import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
} from '@nestjs/websockets';
import { Inject, Logger } from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from 'better-auth/auth';

import {
    NOTIFICATION_SOCKET_CLIENT_EVENT,
    NOTIFICATION_SOCKET_SERVER_EVENT,
    NotificationHeartbeatDto,
    NotificationSocketClientEventType,
    NotificationSocketClientMessage,
    NotificationSocketEventType,
} from '@repo/types';

import { AUTH_INSTANCE_KEY } from '../auth/symbols';
import { NotificationClientService } from './notification-client.service';
import {
    NotificationWsConnectionMetadata,
    NotificationWsService,
} from './notification-ws.service';

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

@WebSocketGateway({
    namespace: '/api/notifications',
    cors: {
        origin: trustedOrigins.length ? trustedOrigins : true,
        credentials: true,
    },
})
export class NotificationWsGateway
    implements
        OnGatewayInit<Server>,
        OnGatewayConnection<Socket>,
        OnGatewayDisconnect<Socket>
{
    private readonly logger = new Logger(NotificationWsGateway.name);

    constructor(
        private readonly notificationWsService: NotificationWsService,
        private readonly notificationClientService: NotificationClientService,
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    afterInit(server: Server) {
        this.notificationWsService.setServer(server);
    }

    async handleConnection(client: Socket) {
        try {
            const session = await this.auth.api.getSession({
                headers: fromNodeHeaders(client.handshake.headers ?? {}),
            });

            if (!session || !session.user) {
                this.emitErrorAndDisconnect(
                    client,
                    'UNAUTHORIZED',
                    '未登录或会话已失效',
                );
                return;
            }

            const metadata = this.extractMetadata(client);
            const connection = this.notificationWsService.registerConnection(
                client,
                {
                    userId: session.user.id,
                    metadata,
                },
            );

            await this.notificationClientService.recordHeartbeat(
                session.user.id,
                {
                    connectionId: connection.id,
                    deviceId: metadata.deviceId,
                    platform: metadata.platform ?? 'web',
                    appVersion: metadata.appVersion,
                    registrationId: metadata.registrationId,
                },
            );

            this.notificationWsService.sendConnectionAck(connection.id);
        } catch (error) {
            this.logger.warn(
                '通知 WebSocket 握手失败',
                error instanceof Error ? error.message : String(error),
            );
            this.emitErrorAndDisconnect(
                client,
                'UNAUTHORIZED',
                '鉴权失败，请重新登录',
            );
        }
    }

    async handleDisconnect(client: Socket) {
        const connection = this.notificationWsService.removeConnection(
            client.id,
        );
        if (connection?.userId) {
            await this.notificationClientService.markOffline(
                connection.userId,
                {
                    connectionId: connection.id,
                    deviceId: connection.metadata?.deviceId,
                    platform: connection.metadata?.platform ?? 'unknown',
                    appVersion: connection.metadata?.appVersion,
                    registrationId: connection.metadata?.registrationId,
                },
            );
        }
    }

    @SubscribeMessage(NOTIFICATION_SOCKET_CLIENT_EVENT)
    async handleClientEvent(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: NotificationSocketClientMessage,
    ) {
        if (!body || typeof body !== 'object') {
            return;
        }

        const connection = this.notificationWsService.getConnection(client.id);
        if (!connection || !connection.userId) {
            return;
        }

        switch (body.type) {
            case NotificationSocketClientEventType.Heartbeat: {
                this.notificationWsService.markHeartbeat(client.id);
                await this.notificationClientService.recordHeartbeat(
                    connection.userId,
                    {
                        connectionId: client.id,
                        deviceId:
                            body.deviceId ?? connection.metadata?.deviceId,
                        platform:
                            body.platform ??
                            connection.metadata?.platform ??
                            'unknown',
                        appVersion:
                            body.appVersion ?? connection.metadata?.appVersion,
                        registrationId:
                            body.registrationId ??
                            connection.metadata?.registrationId,
                    },
                );
                if (body.registrationId) {
                    connection.metadata = {
                        ...connection.metadata,
                        registrationId: body.registrationId,
                    };
                }
                this.notificationWsService.sendHeartbeatAck(client.id);
                break;
            }
            case NotificationSocketClientEventType.Offline: {
                await this.notificationClientService.markOffline(
                    connection.userId,
                    {
                        connectionId: client.id,
                        deviceId:
                            body.deviceId ?? connection.metadata?.deviceId,
                        platform:
                            body.platform ??
                            connection.metadata?.platform ??
                            'unknown',
                        appVersion:
                            body.appVersion ?? connection.metadata?.appVersion,
                        registrationId:
                            body.registrationId ??
                            connection.metadata?.registrationId,
                    },
                );
                break;
            }
            default:
                break;
        }
    }

    private extractMetadata(client: Socket): NotificationWsConnectionMetadata {
        const query = client.handshake.query ?? {};
        return {
            deviceId: this.toOptionalString(query.deviceId),
            appVersion: this.toOptionalString(query.appVersion),
            platform: this.normalizePlatform(query.platform),
            registrationId: this.toOptionalString(query.registrationId),
        };
    }

    private toOptionalString(value: unknown): string | undefined {
        const convert = (input?: string): string | undefined => {
            if (!input) {
                return undefined;
            }
            const trimmed = input.trim();
            if (!trimmed.length) {
                return undefined;
            }
            const normalized = trimmed.toLowerCase();
            if (normalized === 'undefined' || normalized === 'null') {
                return undefined;
            }
            return trimmed;
        };
        if (typeof value === 'string') {
            return convert(value);
        }
        if (Array.isArray(value) && value.length > 0) {
            const [first] = value;
            return typeof first === 'string' ? convert(first) : undefined;
        }
        return undefined;
    }

    private normalizePlatform(
        value: unknown,
    ): NotificationHeartbeatDto['platform'] {
        const input = this.toOptionalString(value)?.toLowerCase();
        switch (input) {
            case 'ios':
            case 'android':
            case 'web':
                return input;
            default:
                return 'unknown';
        }
    }

    private emitErrorAndDisconnect(
        client: Socket,
        code: string,
        message: string,
    ) {
        client.emit(NOTIFICATION_SOCKET_SERVER_EVENT, {
            type: NotificationSocketEventType.Error,
            code,
            message,
        });
        client.disconnect(true);
    }
}
