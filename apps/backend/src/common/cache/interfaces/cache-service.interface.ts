/**
 * 缓存服务接口
 * 该接口定义了缓存服务的基本操作，提供统一的缓存访问抽象
 * 便于在不同的缓存实现之间切换（内存缓存、Redis缓存等）
 */
export interface ICacheService {
    /**
     * 获取缓存值
     * @param key 缓存键
     * @returns 返回缓存值或undefined（如果不存在）
     */
    get<T>(key: string): Promise<T | undefined>;

    /**
     * 设置缓存值
     * @param key 缓存键
     * @param value 缓存值
     * @param ttl 过期时间（秒），可选
     */
    set<T>(key: string, value: T, ttl?: number): Promise<void>;

    /**
     * 删除缓存
     * @param key 缓存键
     */
    del(key: string): Promise<void>;

    /**
     * 清空所有缓存
     */
    reset(): Promise<void>;

    /**
     * 检查缓存键是否存在
     * @param key 缓存键
     * @returns 是否存在
     */
    has(key: string): Promise<boolean>;

    /**
     * 获取所有缓存条目
     * 注意：此方法可能不在所有缓存实现中都可用
     * @returns 包含所有缓存键值对的对象
     */
    getAllCacheEntries?(): Promise<Record<string, unknown>>;
}

/**
 * Redis哈希表操作接口
 * 定义了Redis哈希表(Hash)的操作方法
 */
export interface IRedisHashOperations {
    /**
     * 设置哈希表字段值
     * @param key 哈希表键
     * @param field 字段名
     * @param value 字段值
     */
    hSet<T>(key: string, field: string, value: T): Promise<void>;

    /**
     * 获取哈希表字段值
     * @param key 哈希表键
     * @param field 字段名
     * @returns 字段值或undefined（如果不存在）
     */
    hGet<T>(key: string, field: string): Promise<T | undefined>;

    /**
     * 获取哈希表所有字段和值
     * @param key 哈希表键
     * @returns 字段和值的对象
     */
    hGetAll<T = Record<string, unknown>>(key: string): Promise<T>;

    /**
     * 删除哈希表字段
     * @param key 哈希表键
     * @param fields 要删除的字段
     */
    hDel(key: string, ...fields: string[]): Promise<void>;

    /**
     * 检查哈希表字段是否存在
     * @param key 哈希表键
     * @param field 字段名
     */
    hExists(key: string, field: string): Promise<boolean>;

    /**
     * 获取哈希表中的所有字段名
     * @param key 哈希表键
     */
    hKeys(key: string): Promise<string[]>;

    /**
     * 获取哈希表中字段的数量
     * @param key 哈希表键
     */
    hLen(key: string): Promise<number>;
}

/**
 * Redis列表操作接口
 * 定义了Redis列表(List)的操作方法
 */
export interface IRedisListOperations {
    /**
     * 将值推入列表左端
     * @param key 列表键
     * @param values 要推入的值
     * @returns 操作后的列表长度
     */
    lPush<T>(key: string, ...values: T[]): Promise<number>;

    /**
     * 将值推入列表右端
     * @param key 列表键
     * @param values 要推入的值
     * @returns 操作后的列表长度
     */
    rPush<T>(key: string, ...values: T[]): Promise<number>;

    /**
     * 从列表左端弹出值
     * @param key 列表键
     * @returns 弹出的值或undefined（如果列表为空）
     */
    lPop<T>(key: string): Promise<T | undefined>;

    /**
     * 从列表右端弹出值
     * @param key 列表键
     * @returns 弹出的值或undefined（如果列表为空）
     */
    rPop<T>(key: string): Promise<T | undefined>;

    /**
     * 获取列表指定范围内的元素
     * @param key 列表键
     * @param start 开始索引（0表示第一个元素）
     * @param stop 结束索引（-1表示最后一个元素）
     */
    lRange<T>(key: string, start: number, stop: number): Promise<T[]>;

    /**
     * 获取列表长度
     * @param key 列表键
     */
    lLen(key: string): Promise<number>;

    /**
     * 从列表中删除指定的元素
     * @param key 列表键
     * @param count 删除的数量（0表示删除所有匹配的元素）
     * @param value 要删除的值
     * @returns 删除的元素数量
     */
    lRem<T>(key: string, count: number, value: T): Promise<number>;
}

/**
 * Redis集合操作接口
 * 定义了Redis集合(Set)的操作方法
 */
export interface IRedisSetOperations {
    /**
     * 将成员添加到集合
     * @param key 集合键
     * @param members 要添加的成员
     * @returns 添加的成员数量
     */
    sAdd<T>(key: string, ...members: T[]): Promise<number>;

    /**
     * 获取集合中的所有成员
     * @param key 集合键
     */
    sMembers<T>(key: string): Promise<T[]>;

    /**
     * 检查成员是否在集合中
     * @param key 集合键
     * @param member 要检查的成员
     */
    sIsMember<T>(key: string, member: T): Promise<boolean>;

    /**
     * 从集合中删除成员
     * @param key 集合键
     * @param members 要删除的成员
     * @returns 删除的成员数量
     */
    sRem<T>(key: string, ...members: T[]): Promise<number>;

    /**
     * 获取集合的交集
     * @param keys 集合键列表
     */
    sInter<T>(...keys: string[]): Promise<T[]>;

    /**
     * 获取集合的并集
     * @param keys 集合键列表
     */
    sUnion<T>(...keys: string[]): Promise<T[]>;

    /**
     * 获取集合的差集
     * @param keys 集合键列表
     */
    sDiff<T>(...keys: string[]): Promise<T[]>;

    /**
     * 获取集合中的成员数量
     * @param key 集合键
     */
    sCard(key: string): Promise<number>;
}

/**
 * Redis有序集合操作接口
 * 定义了Redis有序集合(Sorted Set)的操作方法
 */
export interface IRedisSortedSetOperations {
    /**
     * 将成员及其分数添加到有序集合
     * @param key 有序集合键
     * @param score 分数
     * @param member 成员
     */
    zAdd<T>(key: string, score: number, member: T): Promise<void>;

    /**
     * 批量添加成员到有序集合
     * @param key 有序集合键
     * @param scoreMemberPairs 分数和成员的对象数组
     */
    zAddBatch<T>(
        key: string,
        scoreMemberPairs: Array<{ score: number; member: T }>,
    ): Promise<void>;

    /**
     * 获取有序集合中指定分数范围的成员
     * @param key 有序集合键
     * @param min 最小分数
     * @param max 最大分数
     */
    zRangeByScore<T>(key: string, min: number, max: number): Promise<T[]>;

    /**
     * 获取有序集合中指定排名范围的成员
     * @param key 有序集合键
     * @param start 开始排名（0表示第一个元素）
     * @param stop 结束排名（-1表示最后一个元素）
     */
    zRange<T>(key: string, start: number, stop: number): Promise<T[]>;

    /**
     * 获取有序集合中成员的分数
     * @param key 有序集合键
     * @param member 成员
     */
    zScore<T>(key: string, member: T): Promise<number | undefined>;

    /**
     * 获取有序集合中成员的排名
     * @param key 有序集合键
     * @param member 成员
     * @returns 排名（从0开始）或undefined（如果成员不存在）
     */
    zRank<T>(key: string, member: T): Promise<number | undefined>;

    /**
     * 从有序集合中删除成员
     * @param key 有序集合键
     * @param members 要删除的成员
     * @returns 删除的成员数量
     */
    zRem<T>(key: string, ...members: T[]): Promise<number>;

    /**
     * 获取有序集合中的成员数量
     * @param key 有序集合键
     */
    zCard(key: string): Promise<number>;
}

/**
 * Redis分布式锁操作接口
 * 定义了基于Redis实现的分布式锁操作
 */
export interface IRedisLockOperations {
    /**
     * 尝试获取锁
     * @param lockName 锁名称
     * @param ttl 锁的过期时间（秒）
     * @param retryTimes 重试次数
     * @param retryDelay 重试延迟（毫秒）
     * @returns 锁标识符（用于解锁）或null（如果无法获取锁）
     */
    acquireLock(
        lockName: string,
        ttl: number,
        retryTimes?: number,
        retryDelay?: number,
    ): Promise<string | null>;

    /**
     * 释放锁
     * @param lockName 锁名称
     * @param lockId 锁标识符
     * @returns 是否成功释放锁
     */
    releaseLock(lockName: string, lockId: string): Promise<boolean>;
}

/**
 * Redis发布/订阅操作接口
 * 定义了Redis发布/订阅的操作方法
 */
export interface IRedisPubSubOperations {
    /**
     * 发布消息到频道
     * @param channel 频道名称
     * @param message 消息内容
     * @returns 接收消息的客户端数量
     */
    publish<T>(channel: string, message: T): Promise<number>;

    /**
     * 订阅频道
     * @param channel 频道名称
     * @param callback 消息处理回调函数
     */
    subscribe<T>(
        channel: string,
        callback: (message: T, channel: string) => void,
    ): Promise<void>;

    /**
     * 取消订阅频道
     * @param channel 频道名称
     */
    unsubscribe(channel: string): Promise<void>;
}

/**
 * Redis数值操作接口
 * 定义了Redis数值增减的原子性操作方法
 */
export interface IRedisNumericOperations {
    /**
     * 原子性地增加Redis key对应的数值
     * @param key Redis键名
     * @param value 要增加的数值（必须为数字）
     * @param ttl 可选的过期时间（秒），如果不传递则保持key的原有过期时间不变
     * @returns 操作后的最终数值
     */
    increment(key: string, value: number, ttl?: number): Promise<number>;

    /**
     * 原子性地减少Redis key对应的数值
     * @param key Redis键名
     * @param value 要减少的数值（必须为数字）
     * @param ttl 可选的过期时间（秒），如果不传递则保持key的原有过期时间不变
     * @returns 操作后的最终数值
     */
    decrement(key: string, value: number, ttl?: number): Promise<number>;
}

/**
 * Redis高级缓存服务接口
 * 扩展基本缓存服务，添加Redis特有的数据结构操作
 */
export interface IAdvancedCacheService
    extends ICacheService,
        IRedisHashOperations,
        IRedisListOperations,
        IRedisSetOperations,
        IRedisSortedSetOperations,
        IRedisLockOperations,
        IRedisPubSubOperations,
        IRedisNumericOperations {
    /**
     * 获取缓存客户端的原始实例
     * 允许直接访问底层缓存客户端（如Redis客户端）进行高级操作
     */
    getClient<T>(): T;
}
