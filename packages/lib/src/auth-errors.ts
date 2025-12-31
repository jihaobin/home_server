const DEFAULT_LOGIN_ERROR = '登录失败，请稍后重试';
const CHINESE_CHAR_REGEXP = /[\u4e00-\u9fff]/;

const CODE_TRANSLATIONS = {
    USER_NOT_FOUND: '用户不存在或尚未注册',
    FAILED_TO_CREATE_USER: '创建用户失败，请稍后重试',
    FAILED_TO_CREATE_SESSION: '登录状态创建失败，请稍后重试',
    FAILED_TO_UPDATE_USER: '更新用户信息失败，请稍后重试',
    FAILED_TO_GET_SESSION: '读取登录状态失败，请重新尝试',
    INVALID_PASSWORD: '密码错误，请重新输入',
    INVALID_EMAIL: '邮箱格式不正确',
    INVALID_EMAIL_OR_PASSWORD: '邮箱或密码错误',
    INVALID_PHONE_NUMBER: '手机号格式不正确',
    INVALID_PHONE_NUMBER_OR_PASSWORD: '手机号或密码错误',
    PHONE_NUMBER_EXIST: '手机号已存在，请直接登录',
    PHONE_NUMBER_NOT_EXIST: '手机号未注册，请先完成注册',
    PHONE_NUMBER_NOT_VERIFIED: '手机号尚未验证，请先验证后再试',
    PHONE_NUMBER_CANNOT_BE_UPDATED: '手机号无法修改，请联系客服',
    INVALID_OTP: '验证码错误，请重试',
    OTP_EXPIRED: '验证码已过期，请重新获取',
    OTP_NOT_FOUND: '验证码不存在或已失效，请重新获取',
    TOO_MANY_ATTEMPTS: '验证码尝试次数过多，请稍后再试',
    SOCIAL_ACCOUNT_ALREADY_LINKED: '该第三方账号已绑定其他用户',
    PROVIDER_NOT_FOUND: '登录渠道不存在或暂未接入',
    INVALID_TOKEN: '登录凭证无效或已过期',
    ID_TOKEN_NOT_SUPPORTED: '暂不支持当前登录凭证，请更换方式',
    FAILED_TO_GET_USER_INFO: '获取用户信息失败，请稍后重试',
    USER_EMAIL_NOT_FOUND: '账号缺少邮箱信息，请联系客服处理',
    EMAIL_NOT_VERIFIED: '邮箱尚未验证，请先完成邮箱验证',
    PASSWORD_TOO_SHORT: '密码长度过短，请设置至少 8 位密码',
    PASSWORD_TOO_LONG: '密码长度过长，请缩短密码后重试',
    USER_ALREADY_EXISTS: '账号已存在，请直接登录',
    USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL: '该邮箱已被注册，请更换邮箱',
    EMAIL_CAN_NOT_BE_UPDATED: '邮箱无法修改，请联系客服',
    CREDENTIAL_ACCOUNT_NOT_FOUND: '未找到对应的登录凭证，请重新输入',
    SESSION_EXPIRED: '登录状态已过期，请重新登录',
    FAILED_TO_UNLINK_LAST_ACCOUNT: '无法解绑最后一个关联账号',
    ACCOUNT_NOT_FOUND: '账号不存在或已被注销',
    USER_ALREADY_HAS_PASSWORD: '账号已设置密码，请使用该密码登录',
} as const;

const MESSAGE_TRANSLATIONS: Record<string, string> = {
    'user not found': CODE_TRANSLATIONS.USER_NOT_FOUND,
    'failed to create user': CODE_TRANSLATIONS.FAILED_TO_CREATE_USER,
    'failed to create session': CODE_TRANSLATIONS.FAILED_TO_CREATE_SESSION,
    'failed to update user': CODE_TRANSLATIONS.FAILED_TO_UPDATE_USER,
    'failed to get session': CODE_TRANSLATIONS.FAILED_TO_GET_SESSION,
    'invalid password': CODE_TRANSLATIONS.INVALID_PASSWORD,
    'invalid email': CODE_TRANSLATIONS.INVALID_EMAIL,
    'invalid email or password': CODE_TRANSLATIONS.INVALID_EMAIL_OR_PASSWORD,
    'invalid phone number': CODE_TRANSLATIONS.INVALID_PHONE_NUMBER,
    'invalid phone number or password':
        CODE_TRANSLATIONS.INVALID_PHONE_NUMBER_OR_PASSWORD,
    'phone number already exists': CODE_TRANSLATIONS.PHONE_NUMBER_EXIST,
    "phone number isn't registered": CODE_TRANSLATIONS.PHONE_NUMBER_NOT_EXIST,
    'phone number not verified': CODE_TRANSLATIONS.PHONE_NUMBER_NOT_VERIFIED,
    'phone number cannot be updated':
        CODE_TRANSLATIONS.PHONE_NUMBER_CANNOT_BE_UPDATED,
    'invalid otp': CODE_TRANSLATIONS.INVALID_OTP,
    'otp expired': CODE_TRANSLATIONS.OTP_EXPIRED,
    'otp not found': CODE_TRANSLATIONS.OTP_NOT_FOUND,
    'too many attempts': CODE_TRANSLATIONS.TOO_MANY_ATTEMPTS,
    'social account already linked': CODE_TRANSLATIONS.SOCIAL_ACCOUNT_ALREADY_LINKED,
    'provider not found': CODE_TRANSLATIONS.PROVIDER_NOT_FOUND,
    'invalid token': CODE_TRANSLATIONS.INVALID_TOKEN,
    'id_token not supported': CODE_TRANSLATIONS.ID_TOKEN_NOT_SUPPORTED,
    'failed to get user info': CODE_TRANSLATIONS.FAILED_TO_GET_USER_INFO,
    'user email not found': CODE_TRANSLATIONS.USER_EMAIL_NOT_FOUND,
    'email not verified': CODE_TRANSLATIONS.EMAIL_NOT_VERIFIED,
    'password too short': CODE_TRANSLATIONS.PASSWORD_TOO_SHORT,
    'password too long': CODE_TRANSLATIONS.PASSWORD_TOO_LONG,
    'user already exists. use another email.':
        CODE_TRANSLATIONS.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL,
    'user already exists.': CODE_TRANSLATIONS.USER_ALREADY_EXISTS,
    'email can not be updated': CODE_TRANSLATIONS.EMAIL_CAN_NOT_BE_UPDATED,
    'credential account not found':
        CODE_TRANSLATIONS.CREDENTIAL_ACCOUNT_NOT_FOUND,
    'session expired. re-authenticate to perform this action.':
        CODE_TRANSLATIONS.SESSION_EXPIRED,
    "you can't unlink your last account":
        CODE_TRANSLATIONS.FAILED_TO_UNLINK_LAST_ACCOUNT,
    'account not found': CODE_TRANSLATIONS.ACCOUNT_NOT_FOUND,
    'user already has a password. provide that to delete the account.':
        CODE_TRANSLATIONS.USER_ALREADY_HAS_PASSWORD,
    'failed to fetch': '网络连接失败，请检查网络后重试',
    'network request failed': '网络连接失败，请稍后重试',
};

type CodeKey = keyof typeof CODE_TRANSLATIONS;

const STATUS_TRANSLATIONS: Record<number, string> = {
    400: '请求参数有误，请检查输入后重试',
    401: '登录状态已失效，请重新登录',
    403: '暂无权限，请联系管理员',
    404: '接口暂不可用，请稍后再试',
    408: '请求超时，请检查网络后再次尝试',
    409: '账号状态异常，请联系客服处理',
    429: '操作过于频繁，请稍后再试',
    500: '服务器开小差了，请稍后再试',
    502: '服务器暂不可用，请稍后再试',
    503: '服务器繁忙，请稍后再试',
    504: '服务器响应超时，请稍后再试',
};

const KEYWORD_TRANSLATIONS: Array<{ match: (value: string) => boolean; message: string }> = [
    {
        match: (value) => value.includes('network') || value.includes('fetch'),
        message: '网络连接失败，请稍后重试',
    },
    {
        match: (value) => value.includes('timeout'),
        message: '请求超时，请稍后重试',
    },
    {
        match: (value) => value.includes('permission') || value.includes('forbidden'),
        message: '暂无权限，请联系管理员',
    },
    {
        match: (value) => value.includes('too many requests'),
        message: STATUS_TRANSLATIONS["429"] as string,
    },
];

type ErrorLike = {
    code?: string;
    message?: string;
    error?: string;
    error_description?: string;
    status?: number;
    statusText?: string;
    data?: unknown;
    body?: unknown;
    response?: unknown;
    cause?: unknown;
} | null;

/**
 * 将 Better Auth 抛出的英文错误描述转换为中文提示
 */
export function translateAuthErrorMessage(
    error: unknown,
    fallback: string = DEFAULT_LOGIN_ERROR,
): string {
    const candidates = extractErrorMessages(error);

    for (const candidate of candidates) {
        if (containsChinese(candidate)) {
            return candidate;
        }
    }

    for (const candidate of candidates) {
        const translated = translateCandidate(candidate);
        if (translated) {
            return translated;
        }
    }

    const status = extractStatusCode(error);
    if (status && STATUS_TRANSLATIONS[status]) {
        return STATUS_TRANSLATIONS[status];
    }

    return fallback;
}

function extractStatusCode(error: unknown): number | undefined {
    if (!error || typeof error !== 'object') return undefined;
    const status = (error as ErrorLike)?.status;
    if (typeof status === 'number') {
        return status;
    }
    const response = (error as ErrorLike)?.response as ErrorLike;
    if (response && typeof response.status === 'number') {
        return response.status;
    }
    return undefined;
}

function translateCandidate(value: string): string | undefined {
    if (!value) return undefined;

    const upperKey = value.toUpperCase();
    if (isCodeKey(upperKey)) {
        return CODE_TRANSLATIONS[upperKey];
    }

    const normalized = normalize(value);
    if (normalized in MESSAGE_TRANSLATIONS) {
        return MESSAGE_TRANSLATIONS[normalized];
    }

    for (const { match, message } of KEYWORD_TRANSLATIONS) {
        if (match(normalized)) {
            return message;
        }
    }

    return undefined;
}

function isCodeKey(value: string): value is CodeKey {
    return value in CODE_TRANSLATIONS;
}

function extractErrorMessages(error: unknown): string[] {
    const collected: string[] = [];
    const seen = new Set<string>();

    const push = (value?: string | null) => {
        if (!value) return;
        const trimmed = value.trim();
        if (!trimmed || seen.has(trimmed)) return;
        seen.add(trimmed);
        collected.push(trimmed);
    };

    if (typeof error === 'string') {
        push(error);
        return collected;
    }

    if (!error || typeof error !== 'object') {
        return collected;
    }

    const main = error as ErrorLike;
    collectFromObject(main, push);

    const nestedTargets = [
        main?.data,
        main?.body,
        main?.response,
        main?.cause,
    ];

    for (const target of nestedTargets) {
        if (!target) continue;
        if (typeof target === 'string') {
            push(target);
            continue;
        }
        if (typeof target === 'object') {
            collectFromObject(target as ErrorLike, push);
        }
    }

    return collected;
}

function collectFromObject(
    source: ErrorLike,
    push: (value?: string | null) => void,
) {
    if (!source || typeof source !== 'object') return;

    const keys: Array<keyof NonNullable<ErrorLike>> = [
        'message',
        'code',
        'error',
        'error_description',
        'statusText',
    ];

    for (const key of keys) {
        const value = source?.[key];
        if (typeof value === 'string') {
            push(value);
        }
    }
}

function containsChinese(value: string) {
    return CHINESE_CHAR_REGEXP.test(value);
}

function normalize(value: string) {
    return value.trim().toLowerCase().replace(/\s+/g, ' ');
}

export function getAuthErrorFallback() {
    return DEFAULT_LOGIN_ERROR;
}
