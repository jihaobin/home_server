import { constants, generateKeyPairSync, publicEncrypt } from 'node:crypto';
import {
    decryptJVerificationPhoneNumber,
    JVerificationLoginError,
    loginWithJVerification,
} from './jverification-login';

const ORIGINAL_ENV = process.env;

function createUser(overrides: Record<string, unknown> = {}) {
    const now = new Date('2026-05-08T00:00:00.000Z');

    return {
        id: 'user_1',
        email: '13812345678@phone.local',
        emailVerified: false,
        name: '13812345678',
        image: '',
        phoneNumber: '13812345678',
        phoneNumberVerified: true,
        role: ['customer'],
        createdAt: now,
        updatedAt: now,
        ...overrides,
    };
}

function createEndpointContext(overrides: Record<string, unknown> = {}) {
    const user = createUser();
    const session = {
        id: 'session_1',
        token: 'session_token',
        userId: user.id,
        expiresAt: new Date('2026-06-08T00:00:00.000Z'),
        createdAt: new Date('2026-05-08T00:00:00.000Z'),
        updatedAt: new Date('2026-05-08T00:00:00.000Z'),
    };
    const internalAdapter = {
        listUsers: jest.fn().mockResolvedValue([]),
        createUser: jest.fn().mockResolvedValue(user),
        updateUser: jest.fn(),
        createSession: jest.fn().mockResolvedValue(session),
    };

    return {
        context: {
            internalAdapter,
            options: {},
        },
        ...overrides,
    };
}

describe('JVerification one-click login endpoint', () => {
    beforeEach(() => {
        jest.spyOn(console, 'info').mockImplementation(() => undefined);
        jest.spyOn(console, 'warn').mockImplementation(() => undefined);
        process.env = {
            ...ORIGINAL_ENV,
            JVERIFICATION_MOBILE_USER_APP_KEY: 'user-app-key',
            JVERIFICATION_MOBILE_USER_MASTER_SECRET: 'user-secret',
            JVERIFICATION_MOBILE_USER_PRIVATE_KEY: 'user-private-key',
            JVERIFICATION_MOBILE_WORKER_APP_KEY: 'worker-app-key',
            JVERIFICATION_MOBILE_WORKER_MASTER_SECRET: 'worker-secret',
            JVERIFICATION_MOBILE_WORKER_PRIVATE_KEY: 'worker-private-key',
        };
    });

    afterEach(() => {
        jest.restoreAllMocks();
        process.env = ORIGINAL_ENV;
    });

    it('一键登录成功后创建手机号用户并写入 better-auth session', async () => {
        const ctx = createEndpointContext();

        const result = await loginWithJVerification(
            {
                loginToken: 'one-click-login-token',
                app: 'mobile-user',
                platform: 'android',
                exId: 'request-1',
            },
            ctx.context.internalAdapter,
            {
                verifyLoginToken: jest.fn().mockResolvedValue({
                    code: 8000,
                    phone: 'encrypted-phone',
                }),
                decryptPhoneNumber: jest.fn().mockReturnValue('13812345678'),
            },
        );

        expect(ctx.context.internalAdapter.createUser).toHaveBeenCalledWith(
            expect.objectContaining({
                email: '13812345678@phone.local',
                phoneNumber: '13812345678',
                phoneNumberVerified: true,
                role: ['customer'],
            }),
        );
        expect(ctx.context.internalAdapter.createSession).toHaveBeenCalledWith(
            'user_1',
        );
        expect(result).toEqual(
            expect.objectContaining({
                session: expect.objectContaining({ token: 'session_token' }),
                user: expect.objectContaining({ id: 'user_1' }),
            }),
        );
    });

    it('服务人员端首次一键登录登录时创建 service_personnel 角色用户', async () => {
        const ctx = createEndpointContext({
            context: {
                internalAdapter: {
                    ...createEndpointContext().context.internalAdapter,
                    createUser: jest.fn().mockResolvedValue(
                        createUser({
                            id: 'worker_1',
                            phoneNumber: '13912345678',
                            role: ['service_personnel'],
                        }),
                    ),
                    createSession: jest
                        .fn()
                        .mockResolvedValue({ token: 'worker_token' }),
                },
                options: {},
            },
        });

        await loginWithJVerification(
            {
                loginToken: 'one-click-login-token',
                app: 'mobile-worker',
                platform: 'android',
            },
            ctx.context.internalAdapter,
            {
                verifyLoginToken: jest.fn().mockResolvedValue({
                    code: 8000,
                    phone: 'encrypted-worker-phone',
                }),
                decryptPhoneNumber: jest.fn().mockReturnValue('13912345678'),
            },
        );

        expect(ctx.context.internalAdapter.createUser).toHaveBeenCalledWith(
            expect.objectContaining({
                phoneNumber: '13912345678',
                role: ['service_personnel'],
            }),
        );
    });

    it('服务人员端一键登录已有 customer 手机号时补齐 service_personnel 角色', async () => {
        const existingUser = createUser({
            id: 'customer_1',
            phoneNumber: '13812345678',
            role: ['customer'],
        });
        const upgradedUser = createUser({
            ...existingUser,
            role: ['customer', 'service_personnel'],
        });
        const ctx = createEndpointContext({
            context: {
                internalAdapter: {
                    ...createEndpointContext().context.internalAdapter,
                    listUsers: jest.fn().mockResolvedValue([existingUser]),
                    updateUser: jest.fn().mockResolvedValue(upgradedUser),
                    createSession: jest
                        .fn()
                        .mockResolvedValue({ token: 'worker_token' }),
                },
                options: {},
            },
        });

        const result = await loginWithJVerification(
            {
                loginToken: 'one-click-login-token',
                app: 'mobile-worker',
                platform: 'android',
            },
            ctx.context.internalAdapter,
            {
                verifyLoginToken: jest.fn().mockResolvedValue({
                    code: 8000,
                    phone: 'encrypted-phone',
                }),
                decryptPhoneNumber: jest.fn().mockReturnValue('13812345678'),
            },
        );

        expect(ctx.context.internalAdapter.updateUser).toHaveBeenCalledWith(
            'customer_1',
            expect.objectContaining({
                role: ['customer', 'service_personnel'],
            }),
        );
        expect(result.user.role).toEqual(['customer', 'service_personnel']);
    });

    it('用户端一键登录已有 service_personnel 手机号时补齐 customer 角色', async () => {
        const existingUser = createUser({
            id: 'worker_1',
            phoneNumber: '13912345678',
            role: ['service_personnel'],
        });
        const upgradedUser = createUser({
            ...existingUser,
            role: ['service_personnel', 'customer'],
        });
        const ctx = createEndpointContext({
            context: {
                internalAdapter: {
                    ...createEndpointContext().context.internalAdapter,
                    listUsers: jest.fn().mockResolvedValue([existingUser]),
                    updateUser: jest.fn().mockResolvedValue(upgradedUser),
                    createSession: jest
                        .fn()
                        .mockResolvedValue({ token: 'customer_token' }),
                },
                options: {},
            },
        });

        const result = await loginWithJVerification(
            {
                loginToken: 'one-click-login-token',
                app: 'mobile-user',
                platform: 'android',
            },
            ctx.context.internalAdapter,
            {
                verifyLoginToken: jest.fn().mockResolvedValue({
                    code: 8000,
                    phone: 'encrypted-worker-phone',
                }),
                decryptPhoneNumber: jest.fn().mockReturnValue('13912345678'),
            },
        );

        expect(ctx.context.internalAdapter.updateUser).toHaveBeenCalledWith(
            'worker_1',
            expect.objectContaining({
                role: ['service_personnel', 'customer'],
            }),
        );
        expect(result.user.role).toEqual(['service_personnel', 'customer']);
    });

    it('极光返回非 8000 时拒绝登录且不创建 session', async () => {
        const ctx = createEndpointContext();

        await expect(
            loginWithJVerification(
                {
                    loginToken: 'bad-token',
                    app: 'mobile-user',
                    platform: 'android',
                },
                ctx.context.internalAdapter,
                {
                    verifyLoginToken: jest.fn().mockResolvedValue({
                        code: 8001,
                        content: 'invalid token',
                    }),
                    decryptPhoneNumber: jest.fn(),
                },
            ),
        ).rejects.toBeInstanceOf(JVerificationLoginError);
        expect(
            ctx.context.internalAdapter.createSession,
        ).not.toHaveBeenCalled();
    });

    it('使用 Node 22 兼容方式解密极光 RSA_PKCS1_PADDING 手机号', () => {
        const { publicKey, privateKey } = generateKeyPairSync('rsa', {
            modulusLength: 2048,
        });
        const encryptedPhone = publicEncrypt(
            {
                key: publicKey,
                padding: constants.RSA_PKCS1_PADDING,
            },
            Buffer.from('13812345678'),
        ).toString('base64');
        const privateKeyPem = privateKey.export({
            type: 'pkcs8',
            format: 'pem',
        }) as string;

        expect(
            decryptJVerificationPhoneNumber(encryptedPhone, privateKeyPem),
        ).toBe('13812345678');
    });
});
