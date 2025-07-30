/**
 * 内部访问控制配置
 */
export interface InternalAccessConfig {
    /** 是否启用内部访问控制 */
    enabled: boolean;

    /** 允许的IP地址列表 */
    allowedIPs: string[];

    /** 是否允许本地IP访问 */
    allowLocalIPs: boolean;

    /** 是否允许私有网络IP访问 */
    allowPrivateIPs: boolean;

    /** 是否需要内部API密钥 */
    requireInternalAPIKey: boolean;

    /** 内部API密钥环境变量名 */
    internalAPIKeyEnvVar: string;
}

/**
 * 默认的内部访问控制配置
 */
export const defaultInternalAccessConfig: InternalAccessConfig = {
    enabled: true,
    allowedIPs: [],
    allowLocalIPs: true,
    allowPrivateIPs: true,
    requireInternalAPIKey: false,
    internalAPIKeyEnvVar: 'INTERNAL_API_KEY',
};

/**
 * 获取内部访问控制配置
 */
export function getInternalAccessConfig(): InternalAccessConfig {
    return {
        enabled: process.env.INTERNAL_ACCESS_ENABLED !== 'false',
        allowedIPs: process.env.INTERNAL_ALLOWED_IPS
            ? process.env.INTERNAL_ALLOWED_IPS.split(',').map((ip) => ip.trim())
            : defaultInternalAccessConfig.allowedIPs,
        allowLocalIPs: process.env.INTERNAL_ALLOW_LOCAL_IPS !== 'false',
        allowPrivateIPs: process.env.INTERNAL_ALLOW_PRIVATE_IPS !== 'false',
        requireInternalAPIKey: process.env.INTERNAL_REQUIRE_API_KEY === 'true',
        internalAPIKeyEnvVar:
            process.env.INTERNAL_API_KEY_ENV_VAR || 'INTERNAL_API_KEY',
    };
}
