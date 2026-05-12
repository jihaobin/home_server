import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, phoneNumber, openAPI } from 'better-auth/plugins';
import { APIError } from 'better-call';
import { setSessionCookie } from 'better-auth/cookies';
import { createAuthEndpoint } from '@better-auth/core/api';
import db, { type DbType } from './src/common/database/db';

import * as schema from 'src/common/database/schema';
import { MailService } from 'src/common/mail/mail.service';
import { expo } from '@better-auth/expo';
import { eq, sql } from 'drizzle-orm';
import { SmsService } from 'src/common/sms/sms.service';
import { normalizeUserRoles } from 'src/modules/auth/rbac.utils';
import type { UserRole } from '@repo/types';
import type { Session, User } from 'better-auth';
import * as z from 'zod';
import {
    JVerificationLoginError,
    loginWithJVerification,
} from 'src/modules/auth/jverification-login';

const envTrustedOrigins = process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5050']; // 默认值

const trustedOrigins = Array.from(
    new Set([...envTrustedOrigins, 'home-server-user://', 'mobileworker://']),
);

const isHttps =
    (process.env.BETTER_AUTH_URL ?? '').startsWith('https://') ||
    (process.env.TRUSTED_ORIGINS ?? '').includes('https://');

const DEFAULT_WORK_DAYS = '1234567';
const WORKER_ORIGIN_PREFIX = 'mobileworker://';

const jverificationLoginBodySchema = z.object({
    loginToken: z.string().min(1),
    app: z.enum(['mobile-user', 'mobile-worker']),
    platform: z.enum(['android', 'ios']),
    exId: z.string().min(1).max(128).optional(),
});

function isWorkerOrigin(origin?: string | null) {
    if (!origin) {
        return false;
    }
    return origin.startsWith(WORKER_ORIGIN_PREFIX);
}

function createJVerificationEndpoint() {
    return createAuthEndpoint(
        '/jverification/login',
        {
            method: 'POST',
            body: jverificationLoginBodySchema,
        },
        async (ctx) => {
            try {
                const { session, user } = await loginWithJVerification(
                    ctx.body,
                    ctx.context.internalAdapter,
                );
                await setSessionCookie(ctx, {
                    session: session as Session,
                    user: user as User,
                });

                return ctx.json({
                    status: true,
                    token: session.token,
                    user: {
                        id: user.id,
                        email: user.email,
                        emailVerified: user.emailVerified,
                        name: user.name,
                        image: user.image,
                        phoneNumber: user.phoneNumber,
                        phoneNumberVerified: user.phoneNumberVerified,
                        createdAt: user.createdAt,
                        updatedAt: user.updatedAt,
                        role: user.role,
                    },
                });
            } catch (error) {
                if (error instanceof JVerificationLoginError) {
                    throw new APIError(error.status, { message: error.message });
                }
                throw error;
            }
        },
    );
}

function getTimestamp(value: unknown): number | null {
    if (!value) {
        return null;
    }
    const date = value instanceof Date ? value : new Date(value as string);
    const time = date.getTime();
    if (Number.isNaN(time)) {
        return null;
    }
    return time;
}

function isNewlyCreatedUser(user: {
    createdAt?: unknown;
    updatedAt?: unknown;
}) {
    const createdAt = getTimestamp(user.createdAt);
    const updatedAt = getTimestamp(user.updatedAt);
    if (createdAt === null || updatedAt === null) {
        return false;
    }
    return Math.abs(updatedAt - createdAt) <= 1000;
}

function getSmsErrorMessage(error: unknown, fallback: string): string {
    if (!error) {
        return fallback;
    }
    if (typeof error === 'string') {
        return error;
    }
    if (typeof error === 'object') {
        const response = (
            error as { getResponse?: () => unknown }
        ).getResponse?.();
        const responseMessage = extractResponseMessage(response);
        if (responseMessage) {
            return responseMessage;
        }
        const rawResponse = (error as { response?: unknown }).response;
        const rawMessage = extractResponseMessage(rawResponse);
        if (rawMessage) {
            return rawMessage;
        }
        const message = (error as { message?: unknown }).message;
        if (typeof message === 'string' && message) {
            return message;
        }
    }
    return fallback;
}

function extractResponseMessage(response: unknown): string | null {
    if (!response) {
        return null;
    }
    if (typeof response === 'string') {
        return response;
    }
    if (typeof response === 'object') {
        const message = (response as { message?: unknown }).message;
        if (typeof message === 'string' && message) {
            return message;
        }
        if (Array.isArray(message) && message.length > 0) {
            return message
                .filter((item): item is string => typeof item === 'string')
                .join('; ');
        }
    }
    return null;
}

type DbExecutor = {
    select: DbType['select'];
    insert: DbType['insert'];
    update: DbType['update'];
};

async function ensureServicePersonnelRecord(
    userId: string,
    executor?: DbExecutor,
) {
    const run = async (tx: DbExecutor) => {
        const [user] = await tx
            .select({
                name: schema.users.name,
                image: schema.users.image,
            })
            .from(schema.users)
            .where(eq(schema.users.id, userId))
            .limit(1);

        const normalizedName = user?.name?.trim() || null;
        const normalizedAvatar = user?.image?.trim() || null;
        const existing = await tx
            .select({
                userId: schema.servicePersonnel.userId,
            })
            .from(schema.servicePersonnel)
            .where(eq(schema.servicePersonnel.userId, userId))
            .limit(1);

        if (existing.length > 0) {
            return;
        }

        await tx.insert(schema.servicePersonnel).values({
            userId,
            name: normalizedName,
            avatar: normalizedAvatar,
            bio: null,
            province: '未设置',
            district: null,
            county: null,
            detailedAddress: null,
            geom: [0, 0] as [number, number],
            yearsOfExperience: 0,
            workStartTime: '08:00:00',
            workEndTime: '18:00:00',
            isAvailable: true,
            workDays: DEFAULT_WORK_DAYS,
            currentStatus: 'available',
        });
    };

    if (executor) {
        await run(executor);
        return;
    }

    await db.transaction(async (tx) => {
        await run(tx);
    });
}

async function updateUserRoles(
    userId: string,
    roles: UserRole[],
    executor: DbExecutor = db,
) {
    const normalizedRoles = roles.length ? roles : ['customer'];
    const roleValues = normalizedRoles.map((role) => sql`${role}`);

    await executor
        .update(schema.users)
        .set({
            role: sql`ARRAY[${sql.join(roleValues, sql`, `)}]::user_role[]`,
            updatedAt: new Date(),
        })
        .where(eq(schema.users.id, userId));
}

export async function upgradeToServicePersonnel(
    userId: string,
    rawRoles?: string | string[],
) {
    const currentRoles = normalizeUserRoles(rawRoles);
    const hasServicePersonnel = currentRoles.includes('service_personnel');
    const nextRoles = hasServicePersonnel
        ? currentRoles
        : Array.from(
              new Set([...currentRoles, 'customer', 'service_personnel']),
          );

    if (hasServicePersonnel) {
        await ensureServicePersonnelRecord(userId);
        return nextRoles;
    }

    await db.transaction(async (tx) => {
        await updateUserRoles(userId, nextRoles as UserRole[], tx);
        await ensureServicePersonnelRecord(userId, tx);
    });

    return nextRoles;
}

/**
 * 创建 Better Auth 实例的工厂函数
 * @param mailService NestJS MailService 实例
 * @param smsService 短信服务实例
 * @param options 邮箱验证配置选项
 * @returns Better Auth 实例
 */

export function createAuth(
    mailService?: MailService,
    smsService?: SmsService,
    options?: {
        emailVerification?: {
            verificationPagePath?: string;
            frontendBaseUrl?: string;
        };
    },
) {
    return betterAuth({
        trustedOrigins,
        database: drizzleAdapter(db, {
            provider: 'pg', // 修复：使用正确的数据库类型
            usePlural: true,
            schema: schema,
        }),
        advanced: {
            database: {},
            // crossSubDomainCookies: {
            //     enabled: true,
            //     domain: process.env.CROSS_DOMAIN_ORIGIN, // Domain with a leading period
            // },
            defaultCookieAttributes: {
                secure: isHttps, // 仅 https 时才加 Secure
                sameSite: isHttps ? 'none' : 'lax', // HTTP 时用 lax，便于同站端口写 cookie
                partitioned: isHttps, // HTTP 暂时关掉 partitioned
                path: '/',
            },
        },
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: false, // 关闭传统的邮箱验证，使用OTP代替
            sendResetPassword: async ({ user, token }) => {
                if (!mailService) {
                    console.error('MailService未配置，无法发送重置密码邮件');
                    throw new Error('邮件服务未配置');
                }
                try {
                    // 获取配置选项，支持多种配置方式
                    const emailVerificationConfig =
                        options?.emailVerification || {};

                    // 1. 优先使用传入的配置
                    // 2. 其次使用环境变量
                    // 3. 最后使用默认值
                    const frontendBaseUrl =
                        emailVerificationConfig.frontendBaseUrl ||
                        process.env.TRUSTED_ORIGINS ||
                        'http://localhost:3000';

                    const verificationPagePath =
                        emailVerificationConfig.verificationPagePath ||
                        process.env.PASSWORD_RESET_PAGE_PATH ||
                        '/auth/reset-password';

                    const verificationUrl = `${frontendBaseUrl}${verificationPagePath}?token=${token}`;
                    await mailService.sendResetPasswordEmail(
                        user.email,
                        verificationUrl,
                        user.name,
                    );
                } catch (error) {
                    console.error('发送重置密码邮件失败:', error);
                    throw new Error('邮件发送失败，请稍后重试');
                }
            },
            autoSignIn: false,
        },
        emailVerification: {
            sendOnSignUp: false, // 关闭注册时自动发送验证邮件，使用OTP代替
            autoSignInAfterVerification: false, // 验证后自动登录
            expiresIn: 15 * 60, // 15分钟后过期
            sendVerificationEmail: async ({ user, url }) => {
                console.log('sendEmaliUrl', url);
                if (!mailService) {
                    console.error('MailService未配置，无法发送验证邮件');
                    throw new Error('邮件服务未配置');
                }
                try {
                    await mailService.sendVerificationEmail(
                        user.email,
                        url,
                        user.name,
                    );
                    console.log(
                        `验证邮件已发送到: ${user.email}, 验证链接: ${url}`,
                    );
                } catch (error) {
                    console.error('发送验证邮件失败:', error);
                    throw new Error('邮件发送失败，请稍后重试');
                }
            },
        },
        session: {
            freshAge: 10,
            expiresIn: 60 * 60 * 24 * 30, // 30 days
            updateAge: 60 * 60 * 24, // 24 hours
            // cookieCache: {
            // 	enabled: true,
            // 	maxAge: 5 * 60, // Cache duration in seconds
            // },
        },
        user: {
            // Additional custom fields that will be available in session
            additionalFields: {
                role: {
                    type: 'string[]',
                    required: true,
                    defaultValue: ['customer'],
                    fieldName: 'role',
                    input: true,
                    transform: {
                        input: (value) => {
                            if (Array.isArray(value)) {
                                return value;
                            }
                            if (typeof value === 'string') {
                                return normalizeUserRoles(value);
                            }
                            return ['customer'];
                        },
                    },
                },
                // isActive: {
                //     type: 'boolean',
                //     required: false,
                //     defaultValue: true,
                //     fieldName: 'is_active',
                // },
            },
        },

        socialProviders: {
            github: {
                clientId: process.env.GITHUB_CLIENT_ID as string,
                clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
            },
        },
        plugins: [
            phoneNumber({
                otpLength: 6,
                expiresIn: 300,
                allowedAttempts: 3,
                requireVerification: true,
                phoneNumberValidator: (value) => /^1\d{10}$/.test(value),
                async sendOTP({ phoneNumber, code }) {
                    if (!smsService) {
                        console.error('SmsService未配置，无法发送短信验证码');
                        throw new APIError('BAD_REQUEST', {
                            message: '短信服务未配置',
                        });
                    }
                    let result: { success: boolean; error?: string };
                    try {
                        result = await smsService.sendTemplateSms({
                            phone: phoneNumber,
                            templateCode:
                                process.env.ALIYUN_SMS_TEMPLATE_VERIFICATION ||
                                '',
                            templateParams: { code },
                        });
                    } catch (error) {
                        throw new APIError('BAD_REQUEST', {
                            message: getSmsErrorMessage(error, '短信发送失败'),
                        });
                    }
                    if (!result.success) {
                        throw new APIError('BAD_REQUEST', {
                            message: result.error || '短信发送失败',
                        });
                    }
                },
                async sendPasswordResetOTP({ phoneNumber, code }) {
                    if (!smsService) {
                        console.error(
                            'SmsService未配置，无法发送找回密码短信验证码',
                        );
                        throw new APIError('BAD_REQUEST', {
                            message: '短信服务未配置',
                        });
                    }
                    let result: { success: boolean; error?: string };
                    try {
                        result = await smsService.sendTemplateSms({
                            phone: phoneNumber,
                            templateCode:
                                process.env.ALIYUN_SMS_TEMPLATE_VERIFICATION ||
                                '',

                            templateParams: { code },
                        });
                    } catch (error) {
                        throw new APIError('BAD_REQUEST', {
                            message: getSmsErrorMessage(error, '短信发送失败'),
                        });
                    }
                    if (!result.success) {
                        throw new APIError('BAD_REQUEST', {
                            message: result.error || '短信发送失败',
                        });
                    }
                },
                signUpOnVerification: {
                    getTempEmail: (phone) => `${phone}@phone.local`,
                    getTempName: (phone) => `用户${phone.slice(-4)}`,
                },
                async callbackOnVerification({ user }, ctx) {
                    const origin = ctx?.getHeader?.('expo-origin');
                    if (!isWorkerOrigin(origin)) {
                        return;
                    }
                    const roles = normalizeUserRoles((user as any).role);
                    try {
                        if (isNewlyCreatedUser(user)) {
                            await upgradeToServicePersonnel(user.id, roles);
                            return;
                        }
                        if (!roles.includes('service_personnel')) {
                            return;
                        }
                        await ensureServicePersonnelRecord(user.id);
                    } catch (error) {
                        console.error(
                            `[better-auth] Failed to apply service_personnel for ${user.id}`,
                            error,
                        );
                        throw error;
                    }
                },
            }),
            genericOAuth({
                config: [
                    {
                        providerId: 'wechat',
                        clientId: process.env.WECHAT_CLIENT_ID as string,
                        clientSecret: process.env
                            .WECHAT_CLIENT_SECRET as string,
                        authorizationUrl:
                            'https://open.weixin.qq.com/connect/qrconnect',
                        tokenUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/auth/wechat/token`,
                        userInfoUrl: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/auth/wechat/userinfo`,
                        scopes: ['snsapi_login'],
                        responseType: 'code',
                        pkce: false,

                        getUserInfo: async (tokens) => {
                            console.log('WeChat tokens received:', tokens);
                            try {
                                // 从scope字段中提取openid
                                let openid = '';
                                let unionid = '';

                                if (tokens.scopes && tokens.scopes.length > 0) {
                                    const scopeStr = tokens.scopes.join(' ');
                                    const openidMatch =
                                        scopeStr.match(/openid:([^ ]+)/);
                                    const unionidMatch =
                                        scopeStr.match(/unionid:([^ ]+)/);

                                    if (openidMatch && openidMatch[1]) {
                                        openid = openidMatch[1];
                                    }

                                    if (unionidMatch && unionidMatch[1]) {
                                        unionid = unionidMatch[1];
                                    }
                                }

                                console.log('Extracted openid:', openid);

                                if (!openid) {
                                    console.error(
                                        'WeChat getUserInfo error: No openid found in token response',
                                    );
                                    return null;
                                }

                                // 获取用户信息
                                const userInfoUrl = new URL(
                                    `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/auth/wechat/userinfo`,
                                );
                                // userInfoUrl.searchParams.set(
                                //     'access_token',
                                //     tokens.accessToken,
                                // );
                                userInfoUrl.searchParams.set('openid', openid);
                                userInfoUrl.searchParams.set(
                                    'unionid',
                                    unionid,
                                );
                                userInfoUrl.searchParams.set('lang', 'zh_CN');

                                const response = await fetch(
                                    userInfoUrl.toString(),
                                );
                                const userInfo = await response.json();
                                console.log('wechat userInfo:', userInfo);

                                if (userInfo.errcode) {
                                    console.error(
                                        'WeChat getUserInfo error:',
                                        userInfo,
                                    );
                                    return null;
                                }

                                const now = new Date();
                                console.log(
                                    'WeChat getUserInfo success:',
                                    tokens,
                                );
                                return {
                                    id: userInfo.unionid || userInfo.openid,
                                    name: userInfo.nickname,
                                    email: `${userInfo.unionid || userInfo.openid}@wechat.com`,
                                    image: userInfo.headimgurl,
                                    emailVerified: false,
                                    createdAt: now,
                                    updatedAt: now,
                                };
                            } catch (error) {
                                console.error(
                                    'WeChat getUserInfo error:',
                                    error,
                                );
                                return null;
                            }
                        },
                        authorizationUrlParams: {
                            appid: process.env.WECHAT_CLIENT_ID as string,
                            response_type: 'code',
                            scope: 'snsapi_login',
                            redirect_uri: `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5050'}/auth/callback/wechat`,
                        },
                    },
                ],
            }),
            expo(),
            openAPI(),
            {
                id: 'jverification',
                endpoints: {
                    jverificationLogin: createJVerificationEndpoint(),
                },
            },
        ],
        databaseHooks: {
            user: {
                update: {
                    before: async (data) => {
                        if (!data || !('role' in data)) {
                            return;
                        }
                        const rawRole = (
                            data as {
                                role?: string | string[] | null;
                            }
                        ).role;
                        if (rawRole === undefined || rawRole === null) {
                            return;
                        }
                        const nextRoles = normalizeUserRoles(rawRole);
                        return {
                            data: {
                                role: nextRoles,
                            },
                        };
                    },
                    after: async (user) => {
                        const roles = normalizeUserRoles((user as any).role);
                        if (!roles.includes('service_personnel')) {
                            return;
                        }

                        try {
                            await ensureServicePersonnelRecord(user.id);
                        } catch (error) {
                            console.error(
                                `[better-auth] auto insert service_personnel failed for user ${user.id}`,
                                error,
                            );
                            throw error;
                        }
                    },
                },
                create: {
                    after: async (user) => {
                        const roles = normalizeUserRoles((user as any).role);
                        if (!roles.includes('service_personnel')) {
                            return;
                        }

                        try {
                            await ensureServicePersonnelRecord(user.id);
                        } catch (error) {
                            await db
                                .delete(schema.users)
                                .where(eq(schema.users.id, user.id));
                            throw error;
                        }
                    },
                },
            },
        },
    });
}
