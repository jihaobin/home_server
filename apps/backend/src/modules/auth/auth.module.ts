import {
    Global,
    Inject,
    Logger,
    MiddlewareConsumer,
    Module,
    NestModule,
    OnModuleInit,
    Provider,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import {
    AFTER_HOOK_KEY,
    AUTH_INSTANCE_KEY,
    AUTH_MODULE_OPTIONS_KEY,
    BEFORE_HOOK_KEY,
} from './symbols';
import { Auth } from 'better-auth/*';
import {
    DiscoveryModule,
    DiscoveryService,
    HttpAdapterHost,
    MetadataScanner,
} from '@nestjs/core';
import { SkipBodyParsingMiddleware } from './middlewares';
import { toNodeHandler } from 'better-auth/node';
import type { Request, Response } from 'express';
import { createAuthMiddleware } from 'better-auth/plugins';
import 'dotenv/config';
import { WeChatModule } from './wechat/wechat.module';
import { MailModule } from 'src/common/mail/main.module';
import { MailService } from 'src/common/mail/mail.service';
import { createAuth } from 'auth';

type AuthModuleOptions = {
    disableExceptionFilter?: boolean;
    disableTrustedOriginsCors?: boolean;
    disableBodyParser?: boolean;
};

const HOOKS = [
    { metadataKey: BEFORE_HOOK_KEY, hookType: 'before' as const },
    { metadataKey: AFTER_HOOK_KEY, hookType: 'after' as const },
];

@Global()
@Module({
    imports: [DiscoveryModule, MailModule, WeChatModule],
})
export class AuthModule implements NestModule, OnModuleInit {
    private logger = new Logger(AuthModule.name);
    constructor(
        @Inject(AUTH_INSTANCE_KEY) private readonly auth: Auth,
        @Inject(DiscoveryService)
        private discoveryService: DiscoveryService,
        @Inject(MetadataScanner)
        private metadataScanner: MetadataScanner,
        @Inject(HttpAdapterHost)
        private readonly adapter: HttpAdapterHost,
        @Inject(AUTH_MODULE_OPTIONS_KEY)
        private readonly options: AuthModuleOptions,
    ) {}
    onModuleInit() {
        if (!this.auth.options.hooks) return;

        // 从nest中已注册的provider中筛选出设置了HOOK这个元数据的类
        const providers = this.discoveryService
            .getProviders()
            .filter(
                ({ metatype }) =>
                    metatype && Reflect.getMetadata(HOOKS, metatype),
            );

        for (const provider of providers) {
            const providerPrototype = Object.getPrototypeOf(provider);
            const methods =
                this.metadataScanner.getAllMethodNames(providerPrototype);
            for (const method of methods) {
                const providerMethod = providerPrototype[method];
                this.setupHooks(providerMethod);
            }
        }
    }
    configure(consumer: MiddlewareConsumer) {
        const trustedOrigins = this.auth.options.trustedOrigins;

        const isNotFunctionBased =
            trustedOrigins && Array.isArray(trustedOrigins);

        if (!this.options.disableTrustedOriginsCors && isNotFunctionBased) {
            this.adapter.httpAdapter.enableCors({
                origin: trustedOrigins,
                methods: ['GET', 'POST', 'PUT', 'DELETE'],
                credentials: true,
            });
        } else if (
            trustedOrigins &&
            !this.options.disableTrustedOriginsCors &&
            !isNotFunctionBased
        )
            throw new Error(
                'Function-based trustedOrigins not supported in NestJS. Use string array or disable CORS with disableTrustedOriginsCors: true.',
            );

        if (!this.options.disableBodyParser) {
            consumer.apply(SkipBodyParsingMiddleware).forRoutes('{*path}');
        }

        // 统一路径格式
        let basePath = this.auth.options.basePath ?? '/api/auth';

        if (!basePath.startsWith('/')) {
            basePath = `/${basePath}`;
        }

        if (basePath.endsWith('/')) {
            basePath = basePath.slice(0, -1);
        }

        // 将 better-auth 实例转换为标准的 Node.js 请求处理器
        // toNodeHandler 是适配器函数，让 better-auth 能够处理原生的 HTTP 请求和响应
        const handler = toNodeHandler(this.auth);

        // 在底层 Express 实例上直接挂载 better-auth 处理器
        // 这样做是为了绕过 NestJS 的路由系统，让 better-auth 能够完全控制认证相关的请求处理
        this.adapter.httpAdapter
            .getInstance() // 获取底层的 Express 应用实例
            .use(`${basePath}/*splat`, (req: Request, res: Response) => {
                // 将请求交给 better-auth 处理器处理
                return handler(req, res);
            });
        this.logger.log(
            `AuthModule initialized BetterAuth on '${basePath}/*splat'`,
        );
    }

    /**
     * 设置认证钩子函数
     * 这个函数是 NestJS 装饰器系统与 better-auth 钩子系统之间的桥梁
     * 它通过反射机制读取装饰器元数据，动态构建中间件链
     *
     * @param providerMethod 提供者方法，包含用户自定义的钩子逻辑
     */
    private setupHooks(providerMethod: (ctx: any) => Promise<void>) {
        // 检查 better-auth 是否配置了钩子系统，如果没有则直接返回
        if (!this.auth.options.hooks) return;

        // 遍历预定义的钩子类型数组 (before 和 after)
        for (const { metadataKey, hookType } of HOOKS) {
            // 使用反射机制获取装饰器设置的路径元数据
            // 例如：@BeforeHook('/sign-in') 会在方法上设置路径为 '/sign-in'
            const hookPath = Reflect.getMetadata(metadataKey, providerMethod);
            if (!hookPath) continue;

            // 保存原有的钩子函数（如果存在）
            const originalHook = this.auth.options.hooks[hookType];

            // 创建新的中间件，实现钩子链式调用
            this.auth.options.hooks[hookType] = createAuthMiddleware(
                async (ctx) => {
                    // 先执行原有的钩子逻辑（保持向后兼容性）
                    if (originalHook) {
                        await originalHook(ctx);
                    }

                    // 只有当请求路径与装饰器指定的路径匹配时，才执行用户自定义的逻辑
                    if (hookPath === ctx.path) {
                        await providerMethod(ctx);
                    }
                },
            );
        }
    }

    static forRoot(options: AuthModuleOptions = {}) {
        const providers: Provider[] = [
            {
                provide: AUTH_INSTANCE_KEY,
                useFactory: (mailService: MailService) => {
                    return createAuth(mailService);
                },
                inject: [MailService],
            },
            {
                provide: AUTH_MODULE_OPTIONS_KEY,
                useValue: options,
            },
            AuthService,
        ];

        return {
            global: true,
            module: AuthModule,
            providers,
            exports: [
                {
                    provide: AUTH_INSTANCE_KEY,
                    useFactory: (mailService: MailService) => {
                        return createAuth(mailService);
                    },
                    inject: [MailService],
                },
                {
                    provide: AUTH_MODULE_OPTIONS_KEY,
                    useValue: options,
                } as Provider,
                AuthService,
                WeChatModule,
            ],
        };
    }
}
