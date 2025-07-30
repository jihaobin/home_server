import { Module, Global, Provider, DynamicModule } from '@nestjs/common';
import { APP_INTERCEPTOR, Reflector } from '@nestjs/core';

import { PaginationInterceptor } from './pagination.interceptor';
import { TimeoutInterceptor } from './timeout.interceptor';
import { TransformInterceptor } from './transform.interceptor';
import { AppLoggerService } from '../logger';
import { LoggerModule } from '../logger/logger.module';

/**
 * 拦截器模块配置接口
 */
export interface InterceptorsModuleOptions {
    /**
     * 是否启用转换拦截器
     */
    enableTransform?: boolean;

    /**
     * 是否启用超时拦截器
     */
    enableTimeout?: boolean;

    /**
     * 是否启用分页拦截器
     */
    enablePagination?: boolean;

    /**
     * 超时时间（毫秒）
     */
    timeout?: number;

    /**
     * 默认成功消息
     */
    defaultSuccessMessage?: string;
}

/**
 * 拦截器工厂接口
 */
interface InterceptorFactory {
    /**
     * 创建普通拦截器提供者
     * @param options 配置选项
     */
    createProvider(options?: unknown): Provider;

    /**
     * 创建全局拦截器提供者
     * @param options 配置选项
     */
    createGlobalProvider(options?: unknown): Provider;
}

/**
 * 拦截器模块
 * 用于全局注册和配置拦截器
 */
@Global()
@Module({
    imports: [LoggerModule],
    providers: [], // 静态模块不直接注册拦截器，避免重复
    exports: [],
})
export class InterceptorsModule {
    /**
     * 使用自定义配置创建拦截器模块
     * @param options 拦截器模块配置
     * @returns 动态模块
     */
    static forRoot(options: InterceptorsModuleOptions = {}): DynamicModule {
        const {
            enableTransform = true,
            enableTimeout = true,
            enablePagination = true,
            timeout = 30000,
            defaultSuccessMessage = '操作成功',
        } = options;

        // 定义拦截器工厂
        const interceptorFactories: Record<string, InterceptorFactory> = {
            transform: {
                createProvider: () => ({
                    provide: TransformInterceptor,
                    useFactory: (
                        logger: AppLoggerService,
                        reflector: Reflector,
                    ) =>
                        new TransformInterceptor(
                            logger,
                            { defaultSuccessMessage },
                            reflector,
                        ),
                    inject: [AppLoggerService, Reflector],
                }),
                createGlobalProvider: () => ({
                    provide: APP_INTERCEPTOR,
                    useFactory: (
                        logger: AppLoggerService,
                        reflector: Reflector,
                    ) =>
                        new TransformInterceptor(
                            logger,
                            { defaultSuccessMessage },
                            reflector,
                        ),
                    inject: [AppLoggerService, Reflector],
                }),
            },
            timeout: {
                createProvider: () => ({
                    provide: TimeoutInterceptor,
                    useFactory: (logger: AppLoggerService) =>
                        new TimeoutInterceptor(logger, { timeout }),
                    inject: [AppLoggerService],
                }),
                createGlobalProvider: () => ({
                    provide: APP_INTERCEPTOR,
                    useFactory: (logger: AppLoggerService) =>
                        new TimeoutInterceptor(logger, { timeout }),
                    inject: [AppLoggerService],
                }),
            },
            pagination: {
                createProvider: () => ({
                    provide: PaginationInterceptor,
                    useFactory: (logger: AppLoggerService) =>
                        new PaginationInterceptor(logger, {
                            defaultPage: 1,
                            defaultLimit: 10,
                        }),
                    inject: [AppLoggerService],
                }),
                createGlobalProvider: () => ({
                    provide: APP_INTERCEPTOR,
                    useFactory: (logger: AppLoggerService) =>
                        new PaginationInterceptor(logger, {
                            defaultPage: 1,
                            defaultLimit: 10,
                        }),
                    inject: [AppLoggerService],
                }),
            },
        };

        // 准备导出的拦截器
        const exports = [
            TransformInterceptor,
            TimeoutInterceptor,
            PaginationInterceptor,
        ];

        // 注册拦截器提供者
        const providers: Provider[] = [];

        // 始终添加可导出的拦截器提供者
        providers.push(interceptorFactories.transform.createProvider());
        providers.push(interceptorFactories.timeout.createProvider());
        providers.push(interceptorFactories.pagination.createProvider());

        // 根据配置添加全局拦截器
        if (enableTransform) {
            providers.push(
                interceptorFactories.transform.createGlobalProvider(),
            );
        }
        if (enableTimeout) {
            providers.push(interceptorFactories.timeout.createGlobalProvider());
        }
        if (enablePagination) {
            providers.push(
                interceptorFactories.pagination.createGlobalProvider(),
            );
        }

        return {
            module: InterceptorsModule,
            imports: [LoggerModule],
            providers,
            exports,
        };
    }
}
