import { constants, createPrivateKey, privateDecrypt } from 'node:crypto';
import {
    getRequiredRoleForAuthApp,
    mergeRequiredRoleForAuthApp,
} from './app-role.utils';
import { normalizeUserRoles } from './rbac.utils';

const JVERIFICATION_LOGIN_TOKEN_VERIFY_URL =
    'https://api.verification.jpush.cn/v1/web/loginTokenVerify';

const JVERIFICATION_ENV_PREFIX = {
    'mobile-user': 'JVERIFICATION_MOBILE_USER',
    'mobile-worker': 'JVERIFICATION_MOBILE_WORKER',
} as const;

export type JVerificationApp = keyof typeof JVERIFICATION_ENV_PREFIX;
export type JVerificationPlatform = 'android' | 'ios';

export type JVerificationConfig = {
    appKey: string;
    masterSecret: string;
    privateKey: string;
};

export type JVerificationVerifyResult = {
    code: number;
    content?: string;
    phone?: string;
};

export type JVerificationUser = {
    id: string;
    email: string;
    emailVerified: boolean;
    name: string;
    image?: string | null;
    phoneNumber?: string | null;
    phoneNumberVerified?: boolean | null;
    role?: string[] | string | null;
    createdAt: Date;
    updatedAt: Date;
};

export type JVerificationSession = {
    token: string;
    id?: string;
    userId?: string;
    expiresAt?: Date;
    createdAt?: Date;
    updatedAt?: Date;
    [key: string]: unknown;
};

export type JVerificationInternalAdapter = {
    listUsers: (
        limit?: number,
        offset?: number,
        sortBy?: unknown,
        where?: { field: string; value: unknown }[],
    ) => Promise<JVerificationUser[]>;
    createUser: (user: Record<string, unknown>) => Promise<JVerificationUser>;
    updateUser: (
        userId: string,
        data: Record<string, unknown>,
    ) => Promise<JVerificationUser>;
    createSession: (userId: string) => Promise<JVerificationSession>;
};

export type JVerificationLoginInput = {
    loginToken: string;
    app: JVerificationApp;
    platform: JVerificationPlatform;
    exId?: string;
};

export type JVerificationLoginDeps = {
    verifyLoginToken?: (
        config: JVerificationConfig,
        input: { loginToken: string; exId?: string },
    ) => Promise<JVerificationVerifyResult>;
    decryptPhoneNumber?: (encryptedPhone: string, privateKey: string) => string;
    logger?: Pick<Console, 'info' | 'warn'>;
};

export class JVerificationLoginError extends Error {
    constructor(
        message: string,
        public readonly status: 'BAD_REQUEST' | 'UNAUTHORIZED' | 'BAD_GATEWAY',
    ) {
        super(message);
        this.name = 'JVerificationLoginError';
    }
}

export function maskPhoneNumber(phoneNumber: string) {
    return phoneNumber.replace(/^(\d{3})\d{4}(\d{4})$/, '$1****$2');
}

export function getJVerificationConfig(
    app: JVerificationApp,
    platform?: JVerificationPlatform,
): JVerificationConfig {
    const prefix = JVERIFICATION_ENV_PREFIX[app];
    const platformPrefix = platform
        ? `${prefix}_${platform.toUpperCase()}`
        : '';
    const appKey =
        (platformPrefix
            ? process.env[`${platformPrefix}_APP_KEY`]?.trim()
            : '') || process.env[`${prefix}_APP_KEY`]?.trim();
    const masterSecret =
        (platformPrefix
            ? process.env[`${platformPrefix}_MASTER_SECRET`]?.trim()
            : '') || process.env[`${prefix}_MASTER_SECRET`]?.trim();
    const privateKey =
        (platformPrefix
            ? process.env[`${platformPrefix}_PRIVATE_KEY`]?.trim()
            : '') || process.env[`${prefix}_PRIVATE_KEY`]?.trim();

    if (!appKey || !masterSecret || !privateKey) {
        throw new JVerificationLoginError(
            `${platformPrefix || prefix}_APP_KEY / ${platformPrefix || prefix}_MASTER_SECRET / ${platformPrefix || prefix}_PRIVATE_KEY 未配置`,
            'BAD_REQUEST',
        );
    }

    return { appKey, masterSecret, privateKey };
}

export async function verifyJVerificationLoginToken(
    config: JVerificationConfig,
    input: { loginToken: string; exId?: string },
): Promise<JVerificationVerifyResult> {
    const credentials = Buffer.from(
        `${config.appKey}:${config.masterSecret}`,
    ).toString('base64');
    const response = await fetch(JVERIFICATION_LOGIN_TOKEN_VERIFY_URL, {
        method: 'POST',
        headers: {
            Authorization: `Basic ${credentials}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            loginToken: input.loginToken,
            ...(input.exId ? { exID: input.exId } : {}),
        }),
    });
    const result = (await response
        .json()
        .catch(() => null)) as JVerificationVerifyResult | null;

    if (!response.ok || !result) {
        throw new JVerificationLoginError(
            '极光一键登录服务异常，请使用验证码登录',
            'BAD_GATEWAY',
        );
    }

    return result;
}

export function decryptJVerificationPhoneNumber(
    encryptedPhone: string,
    privateKey: string,
) {
    const normalizedPrivateKey = privateKey.includes('BEGIN')
        ? privateKey.replace(/\\n/g, '\n')
        : [
              '-----BEGIN PRIVATE KEY-----',
              privateKey.replace(/\\n/g, '\n'),
              '-----END PRIVATE KEY-----',
          ].join('\n');
    const decryptedBlock = privateDecrypt(
        {
            key: createPrivateKey(normalizedPrivateKey),
            padding: constants.RSA_NO_PADDING,
        },
        Buffer.from(encryptedPhone, 'base64'),
    );
    const separatorIndex = decryptedBlock.indexOf(0, 2);

    if (
        decryptedBlock[0] !== 0 ||
        decryptedBlock[1] !== 2 ||
        separatorIndex < 10
    ) {
        throw new Error(
            'JVerification phone encrypted payload padding invalid',
        );
    }

    const decrypted = decryptedBlock
        .subarray(separatorIndex + 1)
        .toString('utf8');

    return decrypted.trim();
}

export async function loginWithJVerification(
    input: JVerificationLoginInput,
    adapter: JVerificationInternalAdapter,
    deps: JVerificationLoginDeps = {},
) {
    const verifyLoginToken =
        deps.verifyLoginToken ?? verifyJVerificationLoginToken;
    const decryptPhoneNumber =
        deps.decryptPhoneNumber ?? decryptJVerificationPhoneNumber;
    const logger = deps.logger ?? console;
    const config = getJVerificationConfig(input.app, input.platform);
    const verifyResult = await verifyLoginToken(config, {
        loginToken: input.loginToken,
        exId: input.exId,
    });

    if (verifyResult.code !== 8000 || !verifyResult.phone) {
        logger.warn('JVerification one-click login verify failed', {
            app: input.app,
            platform: input.platform,
            exId: input.exId,
            code: verifyResult.code,
            content: verifyResult.content,
        });
        throw new JVerificationLoginError(
            '一键登录失败，请使用验证码登录',
            'UNAUTHORIZED',
        );
    }

    let phoneNumber: string;
    try {
        phoneNumber = decryptPhoneNumber(verifyResult.phone, config.privateKey);
    } catch (error) {
        logger.warn('JVerification phone decrypt failed', {
            app: input.app,
            platform: input.platform,
            exId: input.exId,
            error: error instanceof Error ? error.message : String(error),
        });
        throw new JVerificationLoginError(
            '一键登录失败，请使用验证码登录',
            'BAD_GATEWAY',
        );
    }

    if (!/^1[3-9]\d{9}$/.test(phoneNumber)) {
        logger.warn('JVerification phone number invalid', {
            app: input.app,
            platform: input.platform,
            exId: input.exId,
            phoneNumber: maskPhoneNumber(phoneNumber),
        });
        throw new JVerificationLoginError(
            '一键登录失败，请使用验证码登录',
            'UNAUTHORIZED',
        );
    }

    const existingUsers = await adapter.listUsers(1, 0, undefined, [
        { field: 'phoneNumber', value: phoneNumber },
    ]);
    const now = new Date();
    const role = [getRequiredRoleForAuthApp(input.app)];
    const user =
        existingUsers[0] ??
        (await adapter.createUser({
            email: `${phoneNumber}@phone.local`,
            emailVerified: false,
            name: phoneNumber,
            phoneNumber,
            phoneNumberVerified: true,
            role,
            image: '',
            updatedAt: now,
        }));
    const nextRoles = mergeRequiredRoleForAuthApp(user.role, input.app);
    const shouldUpdatePhoneVerified = !user.phoneNumberVerified;
    const shouldUpdateRole =
        JSON.stringify(nextRoles) !==
        JSON.stringify(normalizeUserRoles(user.role ?? undefined));
    const nextUser =
        shouldUpdatePhoneVerified || shouldUpdateRole
            ? await adapter.updateUser(user.id, {
                  ...(shouldUpdatePhoneVerified
                      ? { phoneNumberVerified: true }
                      : {}),
                  ...(shouldUpdateRole ? { role: nextRoles } : {}),
                  updatedAt: now,
              })
            : user;
    const session = await adapter.createSession(nextUser.id);

    logger.info('JVerification login succeeded', {
        app: input.app,
        platform: input.platform,
        exId: input.exId,
        userId: nextUser.id,
        phoneNumber: maskPhoneNumber(phoneNumber),
    });

    return { session, user: nextUser };
}
