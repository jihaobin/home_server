import { randomUUID } from "node:crypto";
import { Inject, Injectable } from "@nestjs/common";
import { Redis, type RedisOptions } from "ioredis";
import { Redlock, type Lock } from "@sesamecare-oss/redlock";
import { AppLoggerService } from "src/common/logger";
import type { IAdvancedCacheService } from "../interfaces/cache-service.interface";

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
	private readonly redlock: Redlock;

	// 存储当前进程持有的锁信息，用于实现可重入锁
	private readonly reentrantLocks = new Map<string, { lockId: string; count: number; lock: Lock }>();

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

        // 初始化Redlock实例 with the Redis client
        this.redlock = new Redlock([this.client], {
            driftFactor: 0.01, // clock drift factor
            retryCount: 10,    // max retry attempts
            retryDelay: 200,   // delay between retries (ms)
            retryJitter: 200,  // random jitter for retries (ms)
            automaticExtensionThreshold: 500 // auto-extension threshold (ms)
        });

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
				await this.client.set(key, serializedValue, "EX", ttl);
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
			this.logger.error("清空缓存失败", error);
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
				if (Object.hasOwn(data, field)) {
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
			this.logger.warn(`检查哈希字段是否存在失败: ${key}.${field}`, error);
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

			const serializedValues = values.map((value) => JSON.stringify(value));
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

			const serializedValues = values.map((value) => JSON.stringify(value));
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
			this.logger.warn(`获取列表范围失败: ${key}[${start}:${stop}]`, error);
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

			const serializedMembers = members.map((member) => JSON.stringify(member));
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
			return (await this.client.sismember(key, JSON.stringify(member))) === 1;
		} catch (error) {
			this.logger.warn(`检查集合成员失败: ${key}`, error);
			return false;
		}
	}

	async sRem<T>(key: string, ...members: T[]): Promise<number> {
		try {
			if (members.length === 0) return 0;

			const serializedMembers = members.map((member) => JSON.stringify(member));
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

	async zRangeByScore<T>(key: string, min: number, max: number): Promise<T[]> {
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

			const serializedMembers = members.map((member) => JSON.stringify(member));
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
		// 检查是否当前进程已经持有该锁（实现可重入）
		const existingLock = this.reentrantLocks.get(lockName);
		if (existingLock) {
			// 锁已被当前进程持有，增加重入计数
			existingLock.count++;
			this.logger.log(
				`分布式锁重入成功: ${lockName}, lockId: ${existingLock.lockId}, 重入次数: ${existingLock.count}`,
			);
			return existingLock.lockId;
		}

		// 首次获取锁，使用 Redlock with custom retry settings
		const lockId = randomUUID();

		// Create a temporary redlock instance with custom retry settings for this specific call
		// to match the existing API behavior
		const tempRedlock = new Redlock([this.client], {
			driftFactor: 0.01,
			retryCount: retryTimes,
			retryDelay: retryDelay,
			retryJitter: 100, // Add some jitter to avoid thundering herd
			automaticExtensionThreshold: 500
		});

		let redlockInstance: Lock;
		try {
			redlockInstance = await tempRedlock.acquire([lockName], ttl * 1000); // ttl in milliseconds
		} catch (error) {
			// Redlock throws an error when it can't acquire the lock after all retries
			this.logger.warn(`获取分布式锁失败: ${lockName} - ${error instanceof Error ? error.message : String(error)}`);
			throw new Error(`获取分布式锁失败，重试${retryTimes}次后仍无法获取`);
		}

		// Store the lock info for reentrancy support
		this.reentrantLocks.set(lockName, {
			lockId,
			count: 1,
			lock: redlockInstance
		});

		this.logger.log(
			`分布式锁获取成功: ${lockName}, lockId: ${lockId}, 类型: ACQUIRED, 重入次数: 1`,
		);

		return lockId;
	}

	async releaseLock(lockName: string, lockId: string): Promise<boolean> {
		const existingLock = this.reentrantLocks.get(lockName);

		if (!existingLock) {
			const notExistsMessage = "锁不存在或已过期";
			this.logger.warn(
				`释放分布式锁失败: ${lockName} - ${notExistsMessage}`,
			);
			throw new Error(notExistsMessage);
		}

		if (existingLock.lockId !== lockId) {
			const wrongHolderMessage = `锁持有者不匹配，当前持有者: ${existingLock.lockId}`;
			this.logger.warn(
				`释放分布式锁失败: ${lockName} - ${wrongHolderMessage}`,
			);
			throw new Error(wrongHolderMessage);
		}

		// Decrease the reentrancy counter
		existingLock.count--;

		if (existingLock.count > 0) {
			// Still have reentrant calls, don't release the actual lock yet
			this.logger.log(
				`减少重入计数: ${lockName}, 剩余重入次数: ${existingLock.count}`,
			);
			return true;
		} else {
			// No more reentrant calls, release the actual redlock
			try {
				await existingLock.lock.release();
				this.reentrantLocks.delete(lockName);
				this.logger.log(`分布式锁释放成功: ${lockName}`);
				return true;
			} catch (error) {
				// Try to clean up the local reference even if redlock release fails
				this.reentrantLocks.delete(lockName);
				this.logger.error(`释放分布式锁异常但已清理本地状态: ${lockName}`, error);
				throw new Error(`释放分布式锁失败: ${error instanceof Error ? error.message : String(error)}`);
			}
		}
	}

	/**
	 * 手动续期锁
	 * @param lockName 锁名称
	 * @param lockId 锁标识符
	 * @param ttl 新的过期时间（秒）
	 * @returns 是否成功续期
	 */
	async renewLock(
		lockName: string,
		lockId: string,
		ttl: number,
	): Promise<boolean> {
		const existingLock = this.reentrantLocks.get(lockName);

		if (!existingLock || existingLock.lockId !== lockId) {
			this.logger.warn(`锁续期失败: ${lockName} - 锁不存在或持有者不匹配`);
			return false;
		}

		try {
			// Extend the redlock with new TTL
			const extendedLock = await existingLock.lock.extend(ttl * 1000); // ttl in milliseconds
			// Update the lock reference in our cache
			existingLock.lock = extendedLock;

			this.logger.log(`锁续期成功: ${lockName}, 新TTL: ${ttl}秒`);
			return true;
		} catch (error) {
			this.logger.warn(`锁续期失败: ${lockName}`, error);
			return false;
		}
	}

	/**
	 * 查询锁状态
	 * @param lockName 锁名称
	 * @returns 锁状态信息
	 */
	async getLockInfo(lockName: string): Promise<{
		exists: boolean;
		holder?: string;
		count?: number;
		ttl?: number;
	}> {
		// Check if the lock is held by current process (reentrant locks)
		const existingLock = this.reentrantLocks.get(lockName);
		if (existingLock) {
			// For reentrant locks, return local info
			return {
				exists: true,
				holder: `${process.pid}:${existingLock.lockId}`,
				count: existingLock.count,
				// TTL info from Redis is complex to get with redlock, so we'll return -1
				ttl: -1
			};
		}

		// Check if the lock exists in Redis (not held by current process)
		try {
			const lockExists = await this.client.exists(lockName);
			if (lockExists) {
				const ttl = await this.client.ttl(lockName);
				// Get lock holder info from Redis
				const lockInfo = await this.client.get(`${lockName}:holder`);
				return {
					exists: true,
					holder: lockInfo || undefined,
					count: 0, // Other process holds it
					ttl: ttl
				};
			} else {
				return {
					exists: false
				};
			}
		} catch (error) {
			this.logger.error(`查询锁状态失败: ${lockName}`, error);
			return {
				exists: false
			};
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
				"未启用发布/订阅功能，请在创建缓存服务时设置enablePubSub选项为true",
			);
		}

		try {
			await this.pubSubClient.subscribe(channel);

			this.pubSubClient.on(
				"message",
				(receivedChannel: string, message: string) => {
					if (receivedChannel === channel) {
						try {
							const parsedMessage = JSON.parse(message) as T;
							callback(parsedMessage, channel);
						} catch (error) {
							this.logger.warn(`解析订阅消息失败: ${channel}`, error);
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
				"未启用发布/订阅功能，请在创建缓存服务时设置enablePubSub选项为true",
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
				ttl ? ttl.toString() : "",
			);

			if (typeof result === "object" && result !== null && "err" in result) {
				const errorInfo = result as { err: string };
				throw new Error(`Redis操作失败: ${errorInfo.err}`);
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
				ttl ? ttl.toString() : "",
			);

			if (typeof result === "object" && result !== null && "err" in result) {
				const errorInfo = result as { err: string };
				throw new Error(`Redis操作失败: ${errorInfo.err}`);
			}

			return result as number;
		} catch (error) {
			this.logger.error(`减少数值失败: ${key}`, error);
			throw new Error(
				`减少数值失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * Clean up all active locks on service shutdown
	 */
	async cleanup(): Promise<void> {
		for (const [lockName, lockInfo] of this.reentrantLocks.entries()) {
			try {
				await lockInfo.lock.release();
				this.logger.log(`释放锁资源: ${lockName} on cleanup`);
			} catch (error) {
				this.logger.error(`清理锁资源失败: ${lockName}`, error);
			}
		}
		this.reentrantLocks.clear();
	}
}
