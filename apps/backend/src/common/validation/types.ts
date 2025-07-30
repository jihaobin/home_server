/**
 * 验证目标类型，表示应用验证的请求对象类型
 */
export enum ValidationTargetType {
    BODY = 'body',
    QUERY = 'query',
    PARAM = 'param',
    HEADER = 'header',
    CUSTOM = 'custom',
}
