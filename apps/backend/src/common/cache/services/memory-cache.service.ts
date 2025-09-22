import { Injectable } from "@nestjs/common";
import { AppLoggerService } from "src/common/logger";

import { ICacheService } from "../interfaces/cache-service.interface";

/**
 * 自定义内存缓存项结构
 */
interface CacheItem<T> {
	value: T;
	expireAt: number | null; // null表示永不过期
}

/**
 * 内存缓存服务实现
 * 基于原生Map实现
 */
@Injectable()
export class MemoryCacheService implements ICacheService {
	private readonly cache = new Map<string, CacheItem<unknown>>();
	private readonly defaultTTL = 300; // 默认缓存时间，单位秒
	private readonly cleanupInterval: NodeJS.Timeout;

	constructor(private readonly logger: AppLoggerService) {
		this.logger.setContext(MemoryCacheService.name);
		this.logger.log("自定义内存缓存服务已初始化");
		// 定期清理过期缓存
		this.cleanupInterval = setInterval(() => this.cleanupExpiredItems(), 60000); // 每分钟清理一次
	}

	/**
	 * 获取缓存值
	 * @param key 缓存键
	 * @returns 返回缓存值或undefined（如果不存在或已过期）
	 */
	async get<T>(key: string): Promise<T | undefined> {
		try {
			const item = this.cache.get(key);

			// 缓存项不存在
			if (!item) {
				this.logger.debug(`获取缓存: 键=${key}, 返回值=undefined (缓存不存在)`);
				return undefined;
			}

			// 检查是否过期
			if (item.expireAt !== null && Date.now() > item.expireAt) {
				this.logger.debug(`获取缓存: 键=${key}, 返回值=undefined (缓存已过期)`);
				this.cache.delete(key);
				return undefined;
			}

			this.logger.debug(
				`获取缓存: 键=${key}, 返回值=${JSON.stringify(item.value)}`,
			);
			return item.value as T;
		} catch (error) {
			this.logger.error(
				`获取缓存失败: 键=${key}, 错误=${error instanceof Error ? error.message : String(error)}`,
			);
			return undefined;
		}
	}

	/**
	 * 设置缓存值
	 * @param key 缓存键
	 * @param value 缓存值
	 * @param ttl 过期时间（秒），可选
	 */
	async set<T>(key: string, value: T, ttl?: number): Promise<void> {
		try {
			const expireAt =
				ttl === undefined
					? this.defaultTTL > 0
						? Date.now() + this.defaultTTL * 1000
						: null
					: ttl > 0
						? Date.now() + ttl * 1000
						: null;

			this.logger.debug(
				`设置缓存: 键=${key}, 值=${JSON.stringify(value)}, TTL=${ttl || this.defaultTTL}秒, 过期时间=${expireAt}`,
			);

			this.cache.set(key, { value, expireAt });

			// 验证缓存已设置
			const storedItem = this.cache.get(key);
			if (!storedItem) {
				this.logger.warn(`缓存设置可能失败: 键=${key}, 设置后无法读取`);
			} else {
				this.logger.debug(`缓存设置成功: 键=${key}`);
			}
		} catch (error) {
			this.logger.error(
				`设置缓存失败: 键=${key}, 错误=${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	/**
	 * 删除缓存
	 * @param key 缓存键
	 */
	async del(key: string): Promise<void> {
		try {
			this.logger.debug(`删除缓存: 键=${key}`);
			this.cache.delete(key);
		} catch (error) {
			this.logger.error(
				`删除缓存失败: 键=${key}, 错误=${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	/**
	 * 清空所有缓存
	 */
	async reset(): Promise<void> {
		try {
			this.logger.debug("清空所有缓存");
			this.cache.clear();
		} catch (error) {
			this.logger.error(
				`清空缓存失败: ${error instanceof Error ? error.message : String(error)}`,
			);
			throw error;
		}
	}

	/**
	 * 检查缓存键是否存在
	 * @param key 缓存键
	 * @returns 是否存在
	 */
	async has(key: string): Promise<boolean> {
		try {
			const item = this.cache.get(key);
			if (!item) {
				return false;
			}

			// 检查是否过期
			if (item.expireAt !== null && Date.now() > item.expireAt) {
				this.cache.delete(key);
				return false;
			}

			return true;
		} catch (error) {
			this.logger.error(
				`检查缓存键存在失败: 键=${key}, 错误=${error instanceof Error ? error.message : String(error)}`,
			);
			return false;
		}
	}

	/**
	 * 获取所有缓存条目
	 * @returns 包含所有缓存键值对的对象
	 */
	async getAllCacheEntries(): Promise<Record<string, unknown>> {
		try {
			this.logger.debug("获取所有缓存条目");
			const entries: Record<string, unknown> = {};

			// 检查每个缓存项是否过期，并收集有效项
			for (const [key, item] of this.cache.entries()) {
				if (item.expireAt === null || Date.now() <= item.expireAt) {
					entries[key] = item.value;
				} else {
					// 删除过期项
					this.cache.delete(key);
				}
			}

			this.logger.debug(`成功获取${Object.keys(entries).length}个缓存条目`);
			return entries;
		} catch (error) {
			this.logger.error(
				`获取所有缓存条目失败: ${error instanceof Error ? error.message : String(error)}`,
			);
			return {};
		}
	}

	/**
	 * 清理过期的缓存项
	 * 由定时器定期调用
	 */
	private cleanupExpiredItems(): void {
		try {
			let expiredCount = 0;
			const now = Date.now();

			for (const [key, item] of this.cache.entries()) {
				if (item.expireAt !== null && now > item.expireAt) {
					this.cache.delete(key);
					expiredCount++;
				}
			}

			if (expiredCount > 0) {
				this.logger.debug(`自动清理: 已删除${expiredCount}个过期缓存项`);
			}
		} catch (error) {
			this.logger.error(
				`自动清理过期缓存失败: ${error instanceof Error ? error.message : String(error)}`,
			);
		}
	}

	/**
	 * 销毁实例时清理资源
	 */
	onModuleDestroy() {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
		}
	}
}
