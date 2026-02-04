export function createChatClientMsgId(): string {
    // 简单幂等标识：无需额外依赖，RN/JS 环境通用。
    return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}
