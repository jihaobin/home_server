export const CHAT_ROOM_PREFIX = 'room:conversation:';

// Chat namespace 内用于“用户维度”的房间。
// 目的：支持服务端把某个 user 的所有在线连接批量加入会话房间（socketsJoin），
// 从而保证“新会话首条消息”在对方在线但尚未 join 会话房间时也能实时送达。
export const CHAT_USER_ROOM_PREFIX = 'room:user:';

export const chatUserRoom = (userId: string) =>
    `${CHAT_USER_ROOM_PREFIX}${userId}`;

export const chatConversationRoom = (conversationId: string) =>
    `${CHAT_ROOM_PREFIX}${conversationId}`;

// WebSocket 连接建立后自动加入的会话数量上限（按最近活跃排序）。
export const CHAT_AUTO_JOIN_CONVERSATIONS_LIMIT = 200;

export const CHAT_RATE_LIMIT_WINDOW_SECONDS = 60;
export const CHAT_RATE_LIMIT_DEFAULT_MAX_PER_WINDOW = 60;

export const chatRateLimitKey = (userId: string) => `chat:rate:user:${userId}`;
