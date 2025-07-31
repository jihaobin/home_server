import { betterAuth } from 'better-auth';
import { drizzleAdapter } from 'better-auth/adapters/drizzle';
import { genericOAuth } from 'better-auth/plugins';
import db from './src/common/database/db';

import * as schema from 'src/common/database/schema';
import { MailService } from 'src/common/mail/mail.service';
import { expo } from '@better-auth/expo';

const trustedOrigins = process.env.TRUSTED_ORIGINS
    ? process.env.TRUSTED_ORIGINS.split(',')
    : ['http://localhost:3000', 'http://localhost:5050']; // 默认值
const isProd = process.env.NODE_ENV === 'production';

/**
 * 创建 Better Auth 实例的工厂函数
 * @param mailService NestJS MailService 实例
 * @param options 邮箱验证配置选项
 * @returns Better Auth 实例
 */

export function createAuth(
    mailService?: MailService,
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
            database: {
                generateId: false, // 禁止better-auth自带的id生成逻辑
            },
        },
        emailAndPassword: {
            enabled: true,
            requireEmailVerification: true, // 要求邮箱验证
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
        },
        emailVerification: {
            sendOnSignUp: true, // 注册时自动发送验证邮件
            autoSignInAfterVerification: true, // 验证后自动登录
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
            cookieCache: {
                enabled: true,
                maxAge: 5 * 60, // Cache duration in seconds
            },
        },
        user: {
            // Additional custom fields that will be available in session
            additionalFields: {
                role: {
                    type: 'string',
                    required: true,
                    defaultValue: 'comu',
                    fieldName: 'role',
                    input: true,
                },
                isActive: {
                    type: 'boolean',
                    required: false,
                    defaultValue: true,
                    fieldName: 'is_active',
                },
            },
        },

        socialProviders: {
            github: {
                clientId: process.env.GITHUB_CLIENT_ID as string,
                clientSecret: process.env.GITHUB_CLIENT_SECRET as string,
            },
        },
        plugins: [
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
        ],
        ...(isProd
            ? {
                  advanced: {
                      crossSubDomainCookies: {
                          enabled: true,
                          domain: process.env.CROSS_DOMAIN_ORIGIN, // Domain with a leading period
                      },
                      defaultCookieAttributes: {
                          secure: true,
                          httpOnly: true,
                          sameSite: 'none', // Allows CORS-based cookie sharing across subdomains
                          partitioned: true, // New browser standards will mandate this for foreign cookies
                      },
                  },
              }
            : {}),
    });
}
