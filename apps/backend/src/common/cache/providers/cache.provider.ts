import { Provider } from '@nestjs/common';
import { RedisOptions } from 'ioredis';
import { AppLoggerService } from 'src/common/logger';

import {
    IAdvancedCacheService,
    ICacheService,
} from '../interfaces/cache-service.interface';
import { IoRedisCacheService } from '../services/ioredis-cache.service';

/**
 * 缓存服务类型
 */
export enum CacheType {
    MEMORY = 'memory', // 内存缓存（基于cache-manager）
    IOREDIS = 'ioredis', // IoRedis缓存（直接使用ioredis）
}

/**
 * 缓存服务提供者令牌
 */
export const CACHE_SERVICE = Symbol('CACHE_SERVICE');

/**
 * 缓存服务配置基础接口
 */
export interface CacheServiceOptionsBase {
    type: CacheType;
    ttl?: number;
    max?: number;
    isGlobal?: boolean;
}

/**
 * IoRedis缓存服务配置接口
 */
export interface IoRedisCacheOptions extends CacheServiceOptionsBase {
    type: CacheType.IOREDIS;
    redisOptions: RedisOptions;
    enablePubSub?: boolean;
}

/**
 * 内存缓存服务配置接口
 */
export interface MemoryCacheOptions extends CacheServiceOptionsBase {
    type: CacheType.MEMORY;
}

/**
 * 缓存服务配置类型
 */
export type CacheServiceOptions = MemoryCacheOptions | IoRedisCacheOptions;

/**
 * 创建IoRedis缓存服务的工厂函数
 */
export const createIoRedisCacheService = (
    options: IoRedisCacheOptions,
): Provider => ({
    provide: 'IOREDIS_CACHE_SERVICE',
    useFactory: (logger: AppLoggerService) => {
        const redisOptions: RedisOptions = {
            ...options.redisOptions,
        };
        return new IoRedisCacheService(
            {
                redisOptions,
                enablePubSub: options.enablePubSub ?? false,
            },
            logger,
        );
    },
    inject: [AppLoggerService],
});

/**
 * 缓存服务工厂
 * 根据配置类型选择不同的缓存实现
 */
export const cacheServiceFactory = {
    provide: CACHE_SERVICE,
    useFactory: (
        options: CacheServiceOptions,
        ioRedisCacheService: IoRedisCacheService,
    ): ICacheService | IAdvancedCacheService => {
        switch (options.type) {
            case CacheType.IOREDIS:
                if (!ioRedisCacheService) {
                    throw new Error('IoRedis缓存服务未配置，请检查模块配置');
                }
                return ioRedisCacheService;
            default:
                return ioRedisCacheService;
        }
    },
    inject: [
        'CACHE_OPTIONS',
        { token: 'IOREDIS_CACHE_SERVICE', optional: true },
    ],
};

/**
 * 缓存选项提供者
 * 用于配置缓存类型
 */
export const cacheOptionsProvider: Provider = {
    provide: 'CACHE_OPTIONS',
    useValue: {
        type: CacheType.MEMORY, // 默认使用内存缓存
    } as CacheServiceOptions,
};
