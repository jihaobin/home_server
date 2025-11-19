import { Injectable, Inject } from '@nestjs/common';
import { IAdvancedCacheService } from '../interfaces/cache-service.interface';
import { CACHE_SERVICE } from '../providers/cache.provider';

/**
 * 数值操作使用示例
 * 展示如何使用缓存服务的increment和decrement方法
 */
@Injectable()
export class NumericOperationsExample {
    constructor(
        @Inject(CACHE_SERVICE)
        private readonly cacheService: IAdvancedCacheService,
    ) {}

    /**
     * 示例1: 计数器功能
     * 用于统计访问次数、点击次数等
     */
    async incrementPageViews(pageId: string): Promise<number> {
        const key = `page:views:${pageId}`;
        // 增加页面访问次数，设置24小时过期
        return await this.cacheService.increment(key, 1, 24 * 60 * 60);
    }

    async getPageViews(pageId: string): Promise<number> {
        const key = `page:views:${pageId}`;
        const views = await this.cacheService.get<string>(key);
        return views ? parseInt(views) : 0;
    }

    /**
     * 示例2: 库存管理
     * 用于管理商品库存数量
     */
    async decreaseStock(productId: string, quantity: number): Promise<number> {
        const key = `product:stock:${productId}`;
        try {
            // 减少库存数量
            const remainingStock = await this.cacheService.decrement(
                key,
                quantity,
            );

            if (remainingStock < 0) {
                // 如果库存不足，回滚操作
                await this.cacheService.increment(key, quantity);
                throw new Error('库存不足');
            }

            return remainingStock;
        } catch (error) {
            throw new Error(`减少库存失败: ${error.message}`);
        }
    }

    async increaseStock(productId: string, quantity: number): Promise<number> {
        const key = `product:stock:${productId}`;
        return await this.cacheService.increment(key, quantity);
    }

    async initializeStock(
        productId: string,
        initialStock: number,
    ): Promise<void> {
        const key = `product:stock:${productId}`;
        // 初始化库存，设置为永不过期
        await this.cacheService.set(key, initialStock.toString());
    }

    /**
     * 示例3: 限流功能
     * 用于API限流，限制用户在指定时间内的请求次数
     */
    async checkRateLimit(
        userId: string,
        maxRequests: number,
        windowSeconds: number,
    ): Promise<boolean> {
        const key = `rate_limit:${userId}`;

        try {
            // 增加请求计数，设置时间窗口
            const currentCount = await this.cacheService.increment(
                key,
                1,
                windowSeconds,
            );

            return currentCount <= maxRequests;
        } catch {
            // 如果出错，允许请求通过（fail-open策略）
            return true;
        }
    }

    /**
     * 示例4: 积分系统
     * 用于用户积分的增减
     */
    async addPoints(userId: string, points: number): Promise<number> {
        const key = `user:points:${userId}`;
        return await this.cacheService.increment(key, points);
    }

    async deductPoints(userId: string, points: number): Promise<number> {
        const key = `user:points:${userId}`;

        try {
            const remainingPoints = await this.cacheService.decrement(
                key,
                points,
            );

            if (remainingPoints < 0) {
                // 如果积分不足，回滚操作
                await this.cacheService.increment(key, points);
                throw new Error('积分不足');
            }

            return remainingPoints;
        } catch (error) {
            throw new Error(`扣除积分失败: ${error.message}`);
        }
    }

    async getUserPoints(userId: string): Promise<number> {
        const key = `user:points:${userId}`;
        const points = await this.cacheService.get<string>(key);
        return points ? parseInt(points) : 0;
    }

    /**
     * 示例5: 统计功能
     * 用于实时统计数据
     */
    async incrementDailyActiveUsers(date: string): Promise<number> {
        const key = `stats:dau:${date}`;
        // 增加日活用户数，设置7天过期
        return await this.cacheService.increment(key, 1, 7 * 24 * 60 * 60);
    }

    async incrementErrorCount(errorType: string): Promise<number> {
        const key = `stats:errors:${errorType}`;
        // 增加错误计数，设置1小时过期
        return await this.cacheService.increment(key, 1, 60 * 60);
    }

    /**
     * 示例6: 批量操作
     * 展示如何进行批量数值操作
     */
    async batchIncrementCounters(
        counters: Array<{ key: string; value: number; ttl?: number }>,
    ): Promise<number[]> {
        const results: number[] = [];

        for (const counter of counters) {
            const result = await this.cacheService.increment(
                counter.key,
                counter.value,
                counter.ttl,
            );
            results.push(result);
        }

        return results;
    }

    /**
     * 示例7: 原子性操作验证
     * 展示increment和decrement的原子性特性
     */
    async demonstrateAtomicity(key: string): Promise<void> {
        // 并发执行多个操作
        const promises = [
            this.cacheService.increment(key, 10),
            this.cacheService.decrement(key, 5),
            this.cacheService.increment(key, 3),
            this.cacheService.decrement(key, 2),
        ];

        const results = await Promise.all(promises);
        console.log('并发操作结果:', results);

        // 最终结果应该是 0 + 10 - 5 + 3 - 2 = 6
        const finalValue = await this.cacheService.get<string>(key);
        console.log('最终值:', finalValue);
    }
}
