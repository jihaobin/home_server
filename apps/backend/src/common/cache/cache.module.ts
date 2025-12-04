import { DynamicModule, Module, Provider } from '@nestjs/common';

import {
    CACHE_SERVICE,
    CacheServiceOptions,
    CacheType,
    IoRedisCacheOptions,
    cacheOptionsProvider,
    cacheServiceFactory,
    createIoRedisCacheService,
} from './providers/cache.provider';
export { OrderExpireRedisKeys } from './constants/order-expire-redis-keys';

// 重新导出CacheType以便外部使用
export { CacheType };

@Module({})
export class CacheModule {
    /**
     * 注册方法 - 使用默认配置
     */
    static register(): DynamicModule {
        return {
            module: CacheModule,
            global: true,
            providers: [cacheOptionsProvider, cacheServiceFactory],
            exports: [CACHE_SERVICE],
        };
    }

    /**
     * 注册方法 - 使用自定义配置
     * @param options 缓存配置选项
     */
    static registerAsync(options: CacheServiceOptions): DynamicModule {
        const cacheOptions = {
            provide: 'CACHE_OPTIONS',
            useValue: options,
        };

        // 根据缓存类型创建不同的模块配置
        switch (options.type) {
            case CacheType.IOREDIS:
                return this.registerIoRedisCache(options, cacheOptions);
            case CacheType.MEMORY:
            default:
                return this.registerMemoryCache(options, cacheOptions);
        }
    }

    /**
     * 注册内存缓存
     */
    private static registerMemoryCache(
        options: CacheServiceOptions,
        cacheOptions: Provider,
    ): DynamicModule {
        return {
            module: CacheModule,
            global: true,
            providers: [cacheOptions, cacheServiceFactory],
            exports: [CACHE_SERVICE],
        };
    }

    /**
     * 注册IoRedis缓存（直接使用ioredis）
     */
    private static registerIoRedisCache(
        options: IoRedisCacheOptions,
        cacheOptions: Provider,
    ): DynamicModule {
        // 创建IoRedis缓存服务
        const ioRedisCacheServiceProvider = createIoRedisCacheService(options);

        return {
            module: CacheModule,
            global: true,
            providers: [
                ioRedisCacheServiceProvider,
                cacheOptions,
                cacheServiceFactory,
            ],
            exports: [CACHE_SERVICE],
        };
    }
}
