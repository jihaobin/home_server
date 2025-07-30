import { Inject, Injectable } from '@nestjs/common';
import { Redis, RedisOptions } from 'ioredis';
import { AppLoggerService } from 'src/common/logger';

import { IAdvancedCacheService } from '../interfaces/cache-service.interface';
import { randomUUID } from 'node:crypto';

/**
 * IoRedis缓存服务实现
 * 基于ioredis库实现缓存服务
 */
interface IoRedisCacheOptions {
    redisOptions: RedisOptions;
    enablePubSub?: boolean;
}

@Injectable()
export class IoRedisCacheService implements IAdvancedCacheService {
    private readonly client: Redis;
    private readonly pubSubClient: Redis;

    /**
     * 构造函数
     * @param options Redis连接选项
     */
    constructor(
        options: IoRedisCacheOptions,
        @Inject(AppLoggerService) private readonly logger: AppLoggerService,
    ) {
        this.logger.setContext(IoRedisCacheService.name);

        this.client = new Redis(options.redisOptions);
        // 订阅/发布需要单独的连接
        if (options.enablePubSub) {
            this.pubSubClient = new Redis(options.redisOptions);
        }

        // 连接错误处理
        this.client.on('error', (error: Error) => {
            this.logger.error('Redis连接错误', error.message);
        });

        // 成功连接处理
        this.client.on('connect', () => {
            this.logger.log('Redis连接成功');
        });
    }

    /**
     * 获取Redis客户端实例
     */
    getClient<T>(): T {
        return this.client as unknown as T;
    }

    // ICacheService 实现 =================================================================

    async get<T>(key: string): Promise<T | undefined> {
        try {
            const data = await this.client.get(key);
            if (!data) return undefined;

            return JSON.parse(data) as T;
        } catch (error) {
            this.logger.warn(`获取缓存失败: ${key}`, error);
            return undefined;
        }
    }

    async set<T>(key: string, value: T, ttl?: number): Promise<void> {
        try {
            const serializedValue = JSON.stringify(value);

            if (ttl !== undefined) {
                await this.client.set(key, serializedValue, 'EX', ttl);
            } else {
                await this.client.set(key, serializedValue);
            }
        } catch (error) {
            this.logger.error(`设置缓存失败: ${key}`, error);
            throw new Error(
                `设置缓存失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async del(key: string): Promise<void> {
        try {
            await this.client.del(key);
        } catch (error) {
            this.logger.error(`删除缓存失败: ${key}`, error);
            throw new Error(
                `删除缓存失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async reset(): Promise<void> {
        try {
            await this.client.flushdb();
        } catch (error) {
            this.logger.error('清空缓存失败', error);
            throw new Error(
                `清空缓存失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async has(key: string): Promise<boolean> {
        try {
            return (await this.client.exists(key)) === 1;
        } catch (error) {
            this.logger.warn(`检查缓存键失败: ${key}`, error);
            return false;
        }
    }

    // IRedisHashOperations 实现 =================================================================

    async hSet<T>(key: string, field: string, value: T): Promise<void> {
        try {
            await this.client.hset(key, field, JSON.stringify(value));
        } catch (error) {
            this.logger.error(`设置哈希字段失败: ${key}.${field}`, error);
            throw new Error(
                `设置哈希字段失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async hGet<T>(key: string, field: string): Promise<T | undefined> {
        try {
            const data = await this.client.hget(key, field);
            if (!data) return undefined;

            try {
                return JSON.parse(data) as T;
            } catch (parseError) {
                this.logger.error(
                    `JSON解析失败: ${key}.${field} 数据内容: ${data}`,
                    parseError,
                );
                return data as T;
            }
        } catch (error) {
            this.logger.warn(`获取哈希字段失败: ${key}.${field}`, error);
            return undefined;
        }
    }

    async hGetAll<T = Record<string, unknown>>(key: string): Promise<T> {
        try {
            const data = await this.client.hgetall(key);

            // 反序列化所有值
            const result: Record<string, unknown> = {};
            for (const field in data) {
                if (Object.prototype.hasOwnProperty.call(data, field)) {
                    try {
                        result[field] = JSON.parse(data[field]);
                    } catch {
                        result[field] = data[field];
                    }
                }
            }

            return result as T;
        } catch (error) {
            this.logger.warn(`获取所有哈希字段失败: ${key}`, error);
            return {} as T;
        }
    }

    async hDel(key: string, ...fields: string[]): Promise<void> {
        try {
            if (fields.length > 0) {
                await this.client.hdel(key, ...fields);
            }
        } catch (error) {
            this.logger.error(`删除哈希字段失败: ${key}`, error);
            throw new Error(
                `删除哈希字段失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async hExists(key: string, field: string): Promise<boolean> {
        try {
            return (await this.client.hexists(key, field)) === 1;
        } catch (error) {
            this.logger.warn(
                `检查哈希字段是否存在失败: ${key}.${field}`,
                error,
            );
            return false;
        }
    }

    async hKeys(key: string): Promise<string[]> {
        try {
            return await this.client.hkeys(key);
        } catch (error) {
            this.logger.warn(`获取哈希所有字段失败: ${key}`, error);
            return [];
        }
    }

    async hLen(key: string): Promise<number> {
        try {
            return await this.client.hlen(key);
        } catch (error) {
            this.logger.warn(`获取哈希字段数量失败: ${key}`, error);
            return 0;
        }
    }

    // IRedisListOperations 实现 =================================================================

    async lPush<T>(key: string, ...values: T[]): Promise<number> {
        try {
            if (values.length === 0) return 0;

            const serializedValues = values.map((value) =>
                JSON.stringify(value),
            );
            return await this.client.lpush(key, ...serializedValues);
        } catch (error) {
            this.logger.error(`左推入列表失败: ${key}`, error);
            throw new Error(
                `左推入列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async rPush<T>(key: string, ...values: T[]): Promise<number> {
        try {
            if (values.length === 0) return 0;

            const serializedValues = values.map((value) =>
                JSON.stringify(value),
            );
            return await this.client.rpush(key, ...serializedValues);
        } catch (error) {
            this.logger.error(`右推入列表失败: ${key}`, error);
            throw new Error(
                `右推入列表失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async lPop<T>(key: string): Promise<T | undefined> {
        try {
            const data = await this.client.lpop(key);
            if (!data) return undefined;

            return JSON.parse(data) as T;
        } catch (error) {
            this.logger.warn(`左弹出列表失败: ${key}`, error);
            return undefined;
        }
    }

    async rPop<T>(key: string): Promise<T | undefined> {
        try {
            const data = await this.client.rpop(key);
            if (!data) return undefined;

            return JSON.parse(data) as T;
        } catch (error) {
            this.logger.warn(`右弹出列表失败: ${key}`, error);
            return undefined;
        }
    }

    async lRange<T>(key: string, start: number, stop: number): Promise<T[]> {
        try {
            const data = await this.client.lrange(key, start, stop);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(
                `获取列表范围失败: ${key}[${start}:${stop}]`,
                error,
            );
            return [];
        }
    }

    async lLen(key: string): Promise<number> {
        try {
            return await this.client.llen(key);
        } catch (error) {
            this.logger.warn(`获取列表长度失败: ${key}`, error);
            return 0;
        }
    }

    async lRem<T>(key: string, count: number, value: T): Promise<number> {
        try {
            return await this.client.lrem(key, count, JSON.stringify(value));
        } catch (error) {
            this.logger.error(`从列表删除元素失败: ${key}`, error);
            throw new Error(
                `从列表删除元素失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // IRedisSetOperations 实现 =================================================================

    async sAdd<T>(key: string, ...members: T[]): Promise<number> {
        try {
            if (members.length === 0) return 0;

            const serializedMembers = members.map((member) =>
                JSON.stringify(member),
            );
            return await this.client.sadd(key, ...serializedMembers);
        } catch (error) {
            this.logger.error(`添加集合成员失败: ${key}`, error);
            throw new Error(
                `添加集合成员失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async sMembers<T>(key: string): Promise<T[]> {
        try {
            const data = await this.client.smembers(key);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(`获取集合成员失败: ${key}`, error);
            return [];
        }
    }

    async sIsMember<T>(key: string, member: T): Promise<boolean> {
        try {
            return (
                (await this.client.sismember(key, JSON.stringify(member))) === 1
            );
        } catch (error) {
            this.logger.warn(`检查集合成员失败: ${key}`, error);
            return false;
        }
    }

    async sRem<T>(key: string, ...members: T[]): Promise<number> {
        try {
            if (members.length === 0) return 0;

            const serializedMembers = members.map((member) =>
                JSON.stringify(member),
            );
            return await this.client.srem(key, ...serializedMembers);
        } catch (error) {
            this.logger.error(`删除集合成员失败: ${key}`, error);
            throw new Error(
                `删除集合成员失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async sInter<T>(...keys: string[]): Promise<T[]> {
        try {
            if (keys.length === 0) return [];

            const data = await this.client.sinter(...keys);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(`获取集合交集失败`, error);
            return [];
        }
    }

    async sUnion<T>(...keys: string[]): Promise<T[]> {
        try {
            if (keys.length === 0) return [];

            const data = await this.client.sunion(...keys);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(`获取集合并集失败`, error);
            return [];
        }
    }

    async sDiff<T>(...keys: string[]): Promise<T[]> {
        try {
            if (keys.length === 0) return [];

            const data = await this.client.sdiff(...keys);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(`获取集合差集失败`, error);
            return [];
        }
    }

    async sCard(key: string): Promise<number> {
        try {
            return await this.client.scard(key);
        } catch (error) {
            this.logger.warn(`获取集合成员数量失败: ${key}`, error);
            return 0;
        }
    }

    // IRedisSortedSetOperations 实现 =================================================================

    async zAdd<T>(key: string, score: number, member: T): Promise<void> {
        try {
            await this.client.zadd(key, score, JSON.stringify(member));
        } catch (error) {
            this.logger.error(`添加有序集合成员失败: ${key}`, error);
            throw new Error(
                `添加有序集合成员失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async zAddBatch<T>(
        key: string,
        scoreMemberPairs: Array<{ score: number; member: T }>,
    ): Promise<void> {
        try {
            if (scoreMemberPairs.length === 0) return;

            const args: (string | number)[] = [];
            for (const pair of scoreMemberPairs) {
                args.push(pair.score, JSON.stringify(pair.member));
            }

            await this.client.zadd(key, ...args);
        } catch (error) {
            this.logger.error(`批量添加有序集合成员失败: ${key}`, error);
            throw new Error(
                `批量添加有序集合成员失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async zRangeByScore<T>(
        key: string,
        min: number,
        max: number,
    ): Promise<T[]> {
        try {
            const data = await this.client.zrangebyscore(key, min, max);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(
                `获取有序集合分数范围成员失败: ${key}[${min}:${max}]`,
                error,
            );
            return [];
        }
    }

    async zRange<T>(key: string, start: number, stop: number): Promise<T[]> {
        try {
            const data = await this.client.zrange(key, start, stop);
            return data.map((item) => JSON.parse(item) as T);
        } catch (error) {
            this.logger.warn(
                `获取有序集合排名范围成员失败: ${key}[${start}:${stop}]`,
                error,
            );
            return [];
        }
    }

    async zScore<T>(key: string, member: T): Promise<number | undefined> {
        try {
            const score = await this.client.zscore(key, JSON.stringify(member));
            return score !== null ? parseFloat(score) : undefined;
        } catch (error) {
            this.logger.warn(`获取有序集合成员分数失败: ${key}`, error);
            return undefined;
        }
    }

    async zRank<T>(key: string, member: T): Promise<number | undefined> {
        try {
            const rank = await this.client.zrank(key, JSON.stringify(member));
            return rank !== null ? rank : undefined;
        } catch (error) {
            this.logger.warn(`获取有序集合成员排名失败: ${key}`, error);
            return undefined;
        }
    }

    async zRem<T>(key: string, ...members: T[]): Promise<number> {
        try {
            if (members.length === 0) return 0;

            const serializedMembers = members.map((member) =>
                JSON.stringify(member),
            );
            return await this.client.zrem(key, ...serializedMembers);
        } catch (error) {
            this.logger.error(`删除有序集合成员失败: ${key}`, error);
            throw new Error(
                `删除有序集合成员失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async zCard(key: string): Promise<number> {
        try {
            return await this.client.zcard(key);
        } catch (error) {
            this.logger.warn(`获取有序集合成员数量失败: ${key}`, error);
            return 0;
        }
    }

    // IRedisLockOperations 实现 =================================================================

    async acquireLock(
        lockName: string,
        ttl: number,
        retryTimes = 0,
        retryDelay = 200,
    ): Promise<string | null> {
        const lockId = randomUUID();
        let acquired = false;
        let retries = 0;

        // 尝试使用Lua脚本原子性地设置锁
        const setLockScript = `
      return redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', ARGV[2])
    `;

        try {
            // 第一次尝试获取锁
            acquired =
                (await this.client.eval(
                    setLockScript,
                    1,
                    lockName,
                    lockId,
                    ttl,
                )) === 'OK';

            // 如果第一次没获取到锁且需要重试
            while (!acquired && retries < retryTimes) {
                // 等待一段时间再尝试
                await new Promise((resolve) => setTimeout(resolve, retryDelay));
                acquired =
                    (await this.client.eval(
                        setLockScript,
                        1,
                        lockName,
                        lockId,
                        ttl,
                    )) === 'OK';
                retries++;
            }

            return acquired ? lockId : null;
        } catch (error) {
            this.logger.error(`获取分布式锁失败: ${lockName}`, error);
            return null;
        }
    }

    async releaseLock(lockName: string, lockId: string): Promise<boolean> {
        // 使用Lua脚本，确保释放的是自己的锁
        const releaseLockScript = `
      if redis.call('GET', KEYS[1]) == ARGV[1] then
        return redis.call('DEL', KEYS[1])
      else
        return 0
      end
    `;

        try {
            return (
                (await this.client.eval(
                    releaseLockScript,
                    1,
                    lockName,
                    lockId,
                )) === 1
            );
        } catch (error) {
            this.logger.error(`释放分布式锁失败: ${lockName}`, error);
            return false;
        }
    }

    // IRedisPubSubOperations 实现 =================================================================

    async publish<T>(channel: string, message: T): Promise<number> {
        try {
            return await this.client.publish(channel, JSON.stringify(message));
        } catch (error) {
            this.logger.error(`发布消息失败: ${channel}`, error);
            throw new Error(
                `发布消息失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async subscribe<T>(
        channel: string,
        callback: (message: T, channel: string) => void,
    ): Promise<void> {
        if (!this.pubSubClient) {
            throw new Error(
                '未启用发布/订阅功能，请在创建缓存服务时设置enablePubSub选项为true',
            );
        }

        try {
            await this.pubSubClient.subscribe(channel);

            this.pubSubClient.on(
                'message',
                (receivedChannel: string, message: string) => {
                    if (receivedChannel === channel) {
                        try {
                            const parsedMessage = JSON.parse(message) as T;
                            callback(parsedMessage, channel);
                        } catch (error) {
                            this.logger.warn(
                                `解析订阅消息失败: ${channel}`,
                                error,
                            );
                        }
                    }
                },
            );
        } catch (error) {
            this.logger.error(`订阅频道失败: ${channel}`, error);
            throw new Error(
                `订阅频道失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    async unsubscribe(channel: string): Promise<void> {
        if (!this.pubSubClient) {
            throw new Error(
                '未启用发布/订阅功能，请在创建缓存服务时设置enablePubSub选项为true',
            );
        }

        try {
            await this.pubSubClient.unsubscribe(channel);
        } catch (error) {
            this.logger.error(`取消订阅频道失败: ${channel}`, error);
            throw new Error(
                `取消订阅频道失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    // 数值操作方法 =================================================================

    /**
     * 原子性地增加Redis key对应的数值
     * @param key Redis键名
     * @param value 要增加的数值
     * @param ttl 可选的过期时间（秒），如果不传递则保持key的原有过期时间不变
     * @returns 操作后的最终数值
     */
    async increment(
        key: string,
        value: number = 1,
        ttl?: number,
    ): Promise<number> {
        // 使用Lua脚本确保操作的原子性
        const incrementScript = `
      local key = KEYS[1]
      local increment_value = tonumber(ARGV[1])
      local ttl_value = ARGV[2]

      -- 检查key是否存在
      local exists = redis.call('EXISTS', key)

      if exists == 1 then
        -- key存在，检查是否为数值类型
        local current_type = redis.call('TYPE', key)['ok']
        if current_type ~= 'string' then
          return {err = 'ERR value is not a valid number or out of range'}
        end

        -- 尝试获取当前值并检查是否为数值
        local current_value = redis.call('GET', key)
        if current_value and not tonumber(current_value) then
          return {err = 'ERR value is not a valid number or out of range'}
        end
      end

      -- 执行增加操作
      local result = redis.call('INCRBY', key, increment_value)

      -- 设置TTL（如果提供）
      if ttl_value ~= '' and tonumber(ttl_value) then
        redis.call('EXPIRE', key, tonumber(ttl_value))
      end

      return result
    `;

        try {
            const result = await this.client.eval(
                incrementScript,
                1,
                key,
                value.toString(),
                ttl ? ttl.toString() : '',
            );

            if (
                typeof result === 'object' &&
                result !== null &&
                'err' in result
            ) {
                throw new Error(`Redis操作失败: ${(result as any).err}`);
            }

            return result as number;
        } catch (error) {
            this.logger.error(`增加数值失败: ${key}`, error);
            throw new Error(
                `增加数值失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 原子性地减少Redis key对应的数值
     * @param key Redis键名
     * @param value 要减少的数值
     * @param ttl 可选的过期时间（秒），如果不传递则保持key的原有过期时间不变
     * @returns 操作后的最终数值
     */
    async decrement(
        key: string,
        value: number = 1,
        ttl?: number,
    ): Promise<number> {
        // 使用Lua脚本确保操作的原子性
        const decrementScript = `
      local key = KEYS[1]
      local decrement_value = tonumber(ARGV[1])
      local ttl_value = ARGV[2]

      -- 检查key是否存在
      local exists = redis.call('EXISTS', key)

      if exists == 1 then
        -- key存在，检查是否为数值类型
        local current_type = redis.call('TYPE', key)['ok']
        if current_type ~= 'string' then
          return {err = 'ERR value is not a valid number or out of range'}
        end

        -- 尝试获取当前值并检查是否为数值
        local current_value = redis.call('GET', key)
        if current_value and not tonumber(current_value) then
          return {err = 'ERR value is not a valid number or out of range'}
        end
      end

      -- 执行减少操作
      local result = redis.call('DECRBY', key, decrement_value)

      -- 设置TTL（如果提供）
      if ttl_value ~= '' and tonumber(ttl_value) then
        redis.call('EXPIRE', key, tonumber(ttl_value))
      end

      return result
    `;

        try {
            const result = await this.client.eval(
                decrementScript,
                1,
                key,
                value.toString(),
                ttl ? ttl.toString() : '',
            );

            if (
                typeof result === 'object' &&
                result !== null &&
                'err' in result
            ) {
                throw new Error(`Redis操作失败: ${(result as any).err}`);
            }

            return result as number;
        } catch (error) {
            this.logger.error(`减少数值失败: ${key}`, error);
            throw new Error(
                `减少数值失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
