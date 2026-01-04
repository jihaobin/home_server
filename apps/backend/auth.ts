import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth, phoneNumber, openAPI } from 'better-auth/plugins';
import db from './src/common/database/db';

import * as schema from 'src/common/database/schema';
import { MailService } from 'src/common/mail/mail.service';
import { expo } from '@better-auth/expo';
import { eq } from 'drizzle-orm';
import { SmsService } from 'src/common/sms/sms.service';

const envTrustedOrigins = process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',').map((origin) => origin.trim())
    : ['http://localhost:3000', 'http://localhost:5050']; // 默认值

const trustedOrigins = Array.from(
    new Set([...envTrustedOrigins, 'home-server-user://', 'mobileworker://']),
);

const isHttps =
    (process.env.BETTER_AUTH_URL ?? '').startsWith('https://') ||
    (process.env.TRUSTED_ORIGINS ?? '').includes('https://');

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
            provider: 'mysql', // 修复：使用正确的数据库类型
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
                    type: 'string',
                    required: true,
                    defaultValue: 'customer',
                    fieldName: 'role',
                    input: true,
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
                        throw new Error('短信服务未配置');
                    }
                    await smsService.sendTemplateSms({
                        phone: phoneNumber,
                        templateCode:
                            process.env.ALIYUN_SMS_TEMPLATE_VERIFICATION ||
                            process.env.ALIYUN_SMS_TEMPLATE_CODE ||
                            '',
                        templateParams: { code },
                    });
                },
                async sendPasswordResetOTP({ phoneNumber, code }) {
                    if (!smsService) {
                        console.error(
                            'SmsService未配置，无法发送找回密码短信验证码',
                        );
                        throw new Error('短信服务未配置');
                    }
                    await smsService.sendTemplateSms({
                        phone: phoneNumber,
                        templateCode:
                            process.env.ALIYUN_SMS_TEMPLATE_VERIFICATION ||
                            process.env.ALIYUN_SMS_TEMPLATE_CODE ||
                            '',
                        templateParams: { code },
                    });
                },
                signUpOnVerification: {
                    getTempEmail: (phone) => `${phone}@phone.local`,
                    getTempName: (phone) => `用户${phone.slice(-4)}`,
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
        ],
        databaseHooks: {
            user: {
                create: {
                    after: async (user) => {
                        if ((user as any).role !== 'service_personnel') {
                            return;
                        }

                        try {
                            await db.transaction(async (tx) => {
                                const existing = await tx
                                    .select({
                                        userId: schema.servicePersonnel.userId,
                                    })
                                    .from(schema.servicePersonnel)
                                    .where(
                                        eq(
                                            schema.servicePersonnel.userId,
                                            user.id,
                                        ),
                                    )
                                    .limit(1);

                                if (existing.length > 0) {
                                    console.warn(
                                        `[better-auth] service_personnel exists for user ${user.id}, skip auto insert`,
                                    );
                                    return;
                                }

                                await tx
                                    .insert(schema.servicePersonnel)
                                    .values({
                                        userId: user.id,
                                        bio: null,
                                        province: '未设置',
                                        district: null,
                                        county: null,
                                        detailedAddress: '',
                                        geom: [0, 0] as [number, number],
                                        yearsOfExperience: 0,
                                        workStartTime: '08:00:00',
                                        workEndTime: '18:00:00',
                                        isAvailable: true,
                                        workDays: '12345',
                                        currentStatus: 'available',
                                    });
                            });
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
        // ...(isProd
        //     ? {
        //           advanced: {
        //               crossSubDomainCookies: {
        //                   enabled: true,
        //                   domain: process.env.CROSS_DOMAIN_ORIGIN, // Domain with a leading period
        //               },
        //               defaultCookieAttributes: {
        //                   secure: true,
        //                   httpOnly: true,
        //                   sameSite: 'none', // Allows CORS-based cookie sharing across subdomains
        //                   partitioned: true, // New browser standards will mandate this for foreign cookies
        //               },
        //           },
        //       }
        //     : {}),
    });
}
