import { Inject, Type } from '@nestjs/common';
import 'reflect-metadata';

import { ICacheService } from '../interfaces/cache-service.interface';
import { CACHE_SERVICE } from '../providers/cache.provider';

/**
 * 缓存选项接口
 */
export interface CacheableOptions {
    /**
     * 缓存键前缀
     */
    prefix?: string;
    /**
     * 缓存时间（秒）
     */
    ttl?: number;
    /**
     * 缓存键生成函数
     * @param args 方法参数
     */
    keyGenerator?: <TArgs extends unknown[]>(...args: TArgs) => string;
}

/**
 * 将类属性名映射到缓存服务的
 * 存储了所有使用InjectCacheService装饰器的属性名
 */
const CACHE_SERVICE_PROPERTY_KEY = Symbol('CACHE_SERVICE_PROPERTY');

/**
 * 类型守卫：检查对象是否包含指定键的属性
 */
function hasProperty<T extends object, K extends PropertyKey>(
    obj: T,
    key: K,
): obj is T & Record<K, unknown> {
    return key in obj;
}

/**
 * 缓存装饰器
 * 用于方法级别的缓存
 * @param options 缓存选项
 */
export function Cacheable(options: CacheableOptions = {}): MethodDecorator {
    return <T>(
        target: object,
        propertyKey: string | symbol,
        descriptor: TypedPropertyDescriptor<T>,
    ): TypedPropertyDescriptor<T> => {
        // 确保descriptor.value是函数类型
        if (typeof descriptor.value !== 'function') {
            throw new Error('Cacheable装饰器只能应用于方法');
        }

        const originalMethod = descriptor.value;
        const className = (target.constructor as Type<unknown>).name;
        const methodName = propertyKey.toString();
        const defaultPrefix = `${className}:${methodName}`;
        const prefix = options.prefix || defaultPrefix;

        // 使用泛型参数类型和返回类型
        descriptor.value = async function (
            this: object,
            ...args: unknown[]
        ): Promise<unknown> {
            // 获取缓存服务实例
            const cacheServiceKey =
                (Reflect.getMetadata(
                    CACHE_SERVICE_PROPERTY_KEY,
                    this,
                ) as string) || '_cacheService';

            // 检查对象是否有cacheServiceKey属性
            if (!hasProperty(this, cacheServiceKey)) {
                console.warn(
                    `缓存服务未注入，跳过缓存: ${className}.${methodName}`,
                );
                return originalMethod.apply(this, args);
            }

            const cacheService = this[cacheServiceKey] as ICacheService;

            // 类型检查
            if (!cacheService || typeof cacheService.get !== 'function') {
                console.warn(
                    `无效的缓存服务实例，跳过缓存: ${className}.${methodName}`,
                );
                return originalMethod.apply(this, args);
            }

            // 生成缓存键
            const cacheKey = options.keyGenerator
                ? `${prefix}:${options.keyGenerator(...args)}`
                : `${prefix}:${JSON.stringify(args)}`;

            // 尝试从缓存获取数据
            const cachedValue = await cacheService.get(cacheKey);
            if (cachedValue !== undefined) {
                return cachedValue;
            }

            // 执行原方法并缓存结果
            // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
            const result = await originalMethod.apply(this, args);

            // 只缓存非undefined的结果
            if (result !== undefined) {
                await cacheService.set(cacheKey, result, options.ttl);
            }

            return result;
        } as unknown as T;

        return descriptor;
    };
}

/**
 * 缓存服务注入装饰器
 * 用于注入缓存服务到使用Cacheable装饰器的类中
 * @param propertyKey 可选的属性名，默认为'_cacheService'
 */
export function InjectCacheService(propertyKey?: string): PropertyDecorator {
    return (target: object, key: string | symbol): void => {
        // 存储缓存服务的属性名，以便Cacheable装饰器可以找到它
        if (propertyKey) {
            Reflect.defineMetadata(
                CACHE_SERVICE_PROPERTY_KEY,
                propertyKey,
                target,
            );
        } else {
            Reflect.defineMetadata(CACHE_SERVICE_PROPERTY_KEY, key, target);
        }
        // 应用NestJS的Inject装饰器
        Inject(CACHE_SERVICE)(target, key);
    };
}
