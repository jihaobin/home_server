import {
    ConnectedSocket,
    MessageBody,
    OnGatewayConnection,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
} from '@nestjs/websockets';
import {
    BadRequestException,
    ForbiddenException,
    Inject,
    Logger,
    UnauthorizedException,
} from '@nestjs/common';
import type { Server, Socket } from 'socket.io';
import { fromNodeHeaders } from 'better-auth/node';
import type { Auth } from 'better-auth/auth';

import {
    CHAT_SOCKET_CLIENT_EVENT,
    CHAT_SOCKET_SERVER_EVENT,
    ChatMessageContentSchema,
    ChatSocketClientEventType,
    ChatSocketEventType,
    type ChatSocketClientMessage,
} from '@repo/types';

import { AUTH_INSTANCE_KEY } from '../auth/symbols';
import {
    CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT,
    chatConversationRoom,
    chatUserRoom,
} from './chat.constants';
import { ChatService } from './chat.service';
import { ChatWsService } from './chat-ws.service';

const trustedOrigins = (process.env.TRUSTED_ORIGINS ?? '')
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);

@WebSocketGateway({
    namespace: '/api/chat',
    cors: {
        origin: trustedOrigins.length ? trustedOrigins : true,
        credentials: true,
    },
})
export class ChatWsGateway
    implements
        OnGatewayInit<Server>,
        OnGatewayConnection<Socket>,
        OnGatewayDisconnect<Socket>
{
    private readonly logger = new Logger(ChatWsGateway.name);

    private formatDebugValue(value: unknown): string {
        if (Array.isArray(value)) {
            const serialized = value.map((item) => this.formatDebugValue(item));
            return `[${serialized.join(', ')}]`;
        }
        if (typeof value === 'string') {
            return `"${value}"`;
        }
        if (value === null) {
            return 'null';
        }
        if (value === undefined) {
            return 'undefined';
        }
        try {
            return JSON.stringify(value);
        } catch {
            return String(value);
        }
    }

    private toOptionalString(value: unknown): string | undefined {
        const normalize = (input?: string): string | undefined => {
            if (!input) {
                return undefined;
            }
            const trimmed = input.trim();
            if (!trimmed.length) {
                return undefined;
            }
            const lowered = trimmed.toLowerCase();
            if (lowered === 'undefined' || lowered === 'null') {
                return undefined;
            }
            return lowered;
        };

        if (typeof value === 'string') {
            return normalize(value);
        }
        if (Array.isArray(value) && value.length > 0) {
            const [first] = value;
            return typeof first === 'string' ? normalize(first) : undefined;
        }
        return undefined;
    }

    constructor(
        private readonly chatService: ChatService,
        private readonly chatWsService: ChatWsService,
        @Inject(AUTH_INSTANCE_KEY)
        private readonly auth: Auth,
    ) {}

    private parseClientRole(raw: unknown): 'customer' | 'service_personnel' {
        const normalized = this.toOptionalString(raw);
        if (normalized === 'customer' || normalized === 'service_personnel') {
            return normalized;
        }
        throw new BadRequestException(
            `clientRole 参数无效，必须为 customer 或 service_personnel；收到=${this.formatDebugValue(raw)}（type=${Array.isArray(raw) ? 'array' : typeof raw}）`,
        );
    }

    afterInit(server: Server) {
        this.chatWsService.setServer(server);
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
            const authRoleRaw =
                client.handshake.auth &&
                typeof client.handshake.auth === 'object' &&
                'clientRole' in client.handshake.auth
                    ? (client.handshake.auth as { clientRole?: unknown })
                          .clientRole
                    : undefined;
            const queryRoleRaw = client.handshake.query?.clientRole;

            const clientRole = this.parseClientRole(
                authRoleRaw ?? queryRoleRaw,
            );

            this.chatWsService.registerConnection(client, {
                userId: session.user.id,
                clientRole,
            });

            // 连接建立后：
            // 1) 加入 user room（用于跨连接/跨节点批量 socketsJoin）
            // 2) 自动加入历史会话房间（避免对方在线但未 join 导致首条消息丢失）
            await client.join(chatUserRoom(session.user.id));
            try {
                const conversationIds =
                    await this.chatService.listConversationIdsForAutoJoin({
                        requesterId: session.user.id,
                        limit: CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT,
                        clientRole,
                    });
                await Promise.all(
                    conversationIds.map((conversationId) =>
                        client.join(chatConversationRoom(conversationId)),
                    ),
                );
            } catch (error) {
                this.logger.warn(
                    'Chat WebSocket 自动加入会话房间失败',
                    error instanceof Error ? error.message : String(error),
                );
            }
        } catch (error) {
            this.logger.warn(
                'Chat WebSocket 握手失败',
                error instanceof Error ? error.message : String(error),
            );
            this.emitErrorAndDisconnect(
                client,
                'UNAUTHORIZED',
                '鉴权失败，请重新登录',
            );
        }
    }

    handleDisconnect(client: Socket) {
        this.chatWsService.removeConnection(client.id);
    }

    @SubscribeMessage(CHAT_SOCKET_CLIENT_EVENT)
    async handleClientEvent(
        @ConnectedSocket() client: Socket,
        @MessageBody() body: ChatSocketClientMessage,
    ) {
        if (!body || typeof body !== 'object') {
            return;
        }
        const connection = this.chatWsService.getConnection(client.id);
        if (!connection?.userId) {
            return;
        }
        const bodyClientRole = this.parseClientRole(
            (body as { clientRole?: unknown }).clientRole,
        );

        switch (body.type) {
            case ChatSocketClientEventType.Join: {
                try {
                    if (bodyClientRole !== connection.clientRole) {
                        throw new ForbiddenException('客户端身份不匹配');
                    }
                    await this.chatService.requireConversationJoinable({
                        requesterId: connection.userId,
                        conversationId: body.conversationId,
                        clientRole: connection.clientRole,
                    });
                    await client.join(
                        chatConversationRoom(body.conversationId),
                    );
                } catch (error) {
                    this.emitError(
                        client,
                        error instanceof ForbiddenException
                            ? 'FORBIDDEN'
                            : 'BAD_REQUEST',
                        error instanceof Error ? error.message : String(error),
                    );
                }
                break;
            }
            case ChatSocketClientEventType.Send: {
                try {
                    if (bodyClientRole !== connection.clientRole) {
                        throw new ForbiddenException('客户端身份不匹配');
                    }
                    const content = ChatMessageContentSchema.parse(
                        body.content,
                    );
                    // 允许首条消息直接携带 peerUserId，让服务端自动创建/获取会话。
                    // 兼容老协议：仍可直接传 conversationId。
                    let conversationId: string | undefined;
                    if (
                        'conversationId' in body &&
                        typeof body.conversationId === 'string' &&
                        body.conversationId.length > 0
                    ) {
                        conversationId = body.conversationId;
                    }

                    if (!conversationId) {
                        const peerUserId =
                            'peerUserId' in body ? body.peerUserId : undefined;
                        if (!peerUserId || typeof peerUserId !== 'string') {
                            throw new BadRequestException(
                                '缺少 conversationId 或 peerUserId',
                            );
                        }
                        const conversation =
                            await this.chatService.upsertConversation({
                                requesterId: connection.userId,
                                peerUserId,
                                clientRole: connection.clientRole,
                            });
                        conversationId = conversation.id;
                    }

                    if (!conversationId) {
                        throw new BadRequestException(
                            '无法确定 conversationId',
                        );
                    }

                    const message = await this.chatService.sendMessage({
                        requesterId: connection.userId,
                        conversationId,
                        clientRole: connection.clientRole,
                        content,
                        clientMsgId: body.clientMsgId,
                    });

                    // 确保发送方已经加入房间
                    await client.join(chatConversationRoom(conversationId));

                    // 确保接收方（若在线）也已经加入会话房间。
                    // 通过 user room 批量 socketsJoin，避免对方在线但未 join 导致首条消息丢失。
                    const conversation =
                        await this.chatService.requireConversationAccessible({
                            requesterId: connection.userId,
                            conversationId,
                            clientRole: connection.clientRole,
                        });
                    const peerUserId =
                        conversation.userId === connection.userId
                            ? conversation.workerUserId
                            : conversation.userId;

                    this.chatWsService.joinUserToConversation({
                        userId: peerUserId,
                        conversationId,
                    });

                    const server = this.chatWsService.getServer();
                    if (!server) {
                        return;
                    }

                    server
                        .to(chatConversationRoom(conversationId))
                        .emit(CHAT_SOCKET_SERVER_EVENT, {
                            type: ChatSocketEventType.Message,
                            conversationId,
                            message,
                        });

                    const conversationDetail =
                        await this.chatService.getConversationDetail({
                            requesterId: connection.userId,
                            conversationId,
                            clientRole: connection.clientRole,
                        });
                    this.chatWsService.emitConversationUpdated({
                        conversationId,
                        conversation: conversationDetail,
                    });
                } catch (error) {
                    this.emitError(
                        client,
                        error instanceof UnauthorizedException
                            ? 'UNAUTHORIZED'
                            : error instanceof ForbiddenException
                              ? 'FORBIDDEN'
                              : 'BAD_REQUEST',
                        error instanceof Error ? error.message : String(error),
                    );
                }
                break;
            }
            default:
                break;
        }
    }

    private emitError(client: Socket, code: string, message: string) {
        client.emit(CHAT_SOCKET_SERVER_EVENT, {
            type: ChatSocketEventType.Error,
            code,
            message,
        });
    }

    private emitErrorAndDisconnect(
        client: Socket,
        code: string,
        message: string,
    ) {
        this.emitError(client, code, message);
        client.disconnect(true);
    }
}
