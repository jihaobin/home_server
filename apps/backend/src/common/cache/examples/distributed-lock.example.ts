/**
 * 分布式锁使用示例
 * 演示如何使用基于Redis Hash存储的可重入分布式锁
 */

import { IoRedisCacheService } from "../services/ioredis-cache.service";
import { AppLoggerService } from "src/common/logger";

class DistributedLockExample {
	private cacheService: IoRedisCacheService;
	private logger: AppLoggerService;

	constructor() {
		this.logger = new AppLoggerService();
		this.cacheService = new IoRedisCacheService(
			{
				redisOptions: {
					host: "localhost",
					port: 6379,
				},
			},
			this.logger,
		);
	}

	/**
	 * 示例 1: 基础锁使用
	 */
	async example1_BasicLock() {
		console.log("\n=== 示例 1: 基础锁使用 ===");

		const lockName = "my_business_lock";
		const ttl = 30; // 30秒

		try {
			// 获取锁
			const lockId = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`锁获取成功，lockId: ${lockId}`);

			// 查看锁状态（现在包含重入计数）
			const lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("锁状态:", lockInfo);
			// 输出: {exists: true, holder: '1234:uuid', count: 1, ttl: 30}

			// 模拟业务操作
			await new Promise((resolve) => setTimeout(resolve, 2000));

			// 释放锁
			const released = await this.cacheService.releaseLock(lockName, lockId!);
			console.log(`锁释放结果: ${released}`);
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 2: 重入锁使用（现在使用Redis Hash存储）
	 */
	async example2_ReentrantLock() {
		console.log("\n=== 示例 2: 重入锁使用 ===");

		const lockName = "my_reentrant_lock";
		const ttl = 60;

		try {
			// 第一次获取锁
			const lockId1 = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`首次获取锁成功，lockId: ${lockId1}`);

			let lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("首次获取后状态:", lockInfo);
			// Redis Hash 结构: {holder: 'instanceId:lockId1', count: 1}

			// 第二次获取锁（重入）
			const lockId2 = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`重入获取锁成功，lockId: ${lockId2}`);

			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("重入后状态:", lockInfo);
			// Redis Hash 结构: {holder: 'instanceId:lockId2', count: 2}

			// 第三次获取锁（再次重入）
			const lockId3 = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`再次重入获取锁成功，lockId: ${lockId3}`);

			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("再次重入后状态:", lockInfo);
			// Redis Hash 结构: {holder: 'instanceId:lockId3', count: 3}

			// 第一次释放（只减少计数）
			await this.cacheService.releaseLock(lockName, lockId3!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("第一次释放后状态:", lockInfo);
			// Redis Hash 结构: {holder: 'instanceId:lockId3', count: 2}

			// 第二次释放（只减少计数）
			await this.cacheService.releaseLock(lockName, lockId2!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("第二次释放后状态:", lockInfo);
			// Redis Hash 结构: {holder: 'instanceId:lockId2', count: 1}

			// 第三次释放（真正释放锁）
			await this.cacheService.releaseLock(lockName, lockId1!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("最后释放后状态:", lockInfo);
			// 锁已被完全释放: {exists: false}
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 3: 手动续期锁
	 */
	async example3_ManualRenewal() {
		console.log("\n=== 示例 3: 手动续期锁 ===");

		const lockName = "my_renewable_lock";
		const ttl = 10; // 10秒短过期时间

		try {
			const lockId = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`获取锁成功，lockId: ${lockId}`);

			// 等待5秒，然后手动续期
			await new Promise((resolve) => setTimeout(resolve, 5000));

			const renewed = await this.cacheService.renewLock(lockName, lockId!, 30); // 续期到30秒
			console.log(`手动续期结果: ${renewed}`);

			// 查看更新后的TTL
			const lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("续期后锁状态:", lockInfo);

			// 释放锁
			await this.cacheService.releaseLock(lockName, lockId!);
			console.log("锁已释放");
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 4: 锁状态查询
	 */
	async example4_LockStatusQuery() {
		console.log("\n=== 示例 4: 锁状态查询 ===");

		const lockName = "my_status_lock";

		try {
			// 查询不存在的锁
			let lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("不存在的锁状态:", lockInfo);
			// {exists: false}

			// 获取锁
			const lockId = await this.cacheService.acquireLock(lockName, 60);
			console.log(`获取锁成功: ${lockId}`);

			// 查询存在的锁状态（包含重入计数）
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("存在的锁状态:", lockInfo);
			// {exists: true, holder: 'instanceId:lockId', count: 1, ttl: 60}

			// 释放锁
			await this.cacheService.releaseLock(lockName, lockId!);
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 5: 错误处理
	 */
	async example5_ErrorHandling() {
		console.log("\n=== 示例 5: 错误处理 ===");

		const lockName = "my_error_lock";

		try {
			// 获取锁
			const lockId1 = await this.cacheService.acquireLock(lockName, 30);
			console.log(`第一个实例获取锁成功: ${lockId1}`);

			// 模拟另一个实例尝试获取同一个锁（使用不同的instanceId）
			const originalPid = process.pid;
			// @ts-expect-error - 仅供演示用途
			process.pid = 9999; // 模拟不同的进程ID

			try {
				await this.cacheService.acquireLock(lockName, 30, 2, 100);
			} catch (error) {
				console.log("第二个实例获取锁失败:", error.message);
				// 输出: 锁已被持有，当前持有者: originalPid:lockId1，剩余时间: xx秒
			}

			// 恢复原有PID
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-expect-error
			process.pid = originalPid;

			// 尝试用错误的lockId释放锁
			try {
				await this.cacheService.releaseLock(lockName, "wrong-lock-id");
			} catch (error) {
				console.log("错误的lockId释放失败:", error.message);
				// 输出: 锁持有者不匹配，当前持有者: originalPid:lockId1
			}

			// 正确释放锁
			await this.cacheService.releaseLock(lockName, lockId1!);
			console.log("锁已正确释放");
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 6: 并发测试
	 */
	async example6_ConcurrencyTest() {
		console.log("\n=== 示例 6: 并发测试 ===");

		const lockName = "my_concurrent_lock";
		const promises: Promise<void>[] = [];

		// 启动多个并发任务
		for (let i = 0; i < 5; i++) {
			promises.push(
				(async (taskId: number) => {
					try {
						console.log(`任务 ${taskId}: 尝试获取锁...`);
						const lockId = await this.cacheService.acquireLock(
							lockName,
							10,
							3,
							500,
						);
						console.log(`任务 ${taskId}: 获取锁成功! lockId: ${lockId}`);

						// 模拟业务处理
						await new Promise((resolve) => setTimeout(resolve, 2000));

						await this.cacheService.releaseLock(lockName, lockId!);
						console.log(`任务 ${taskId}: 释放锁成功`);
					} catch (error) {
						console.log(`任务 ${taskId}: 失败 - ${error.message}`);
					}
				})(i),
			);
		}

		await Promise.all(promises);
		console.log("并发测试完成");
	}

	/**
	 * 示例 7: 自动续期演示
	 */
	async example7_AutoRenewal() {
		console.log("\n=== 示例 7: 自动续期演示 ===");

		const lockName = "my_auto_renewal_lock";
		const ttl = 15; // 15秒TTL

		try {
			const lockId = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`获取锁成功，lockId: ${lockId}, TTL: ${ttl}秒`);

			// 模拟长时间业务处理（超过原始TTL）
			console.log("开始长时间业务处理...");
			for (let i = 0; i < 6; i++) {
				await new Promise((resolve) => setTimeout(resolve, 5000));

				// 检查锁状态
				const lockInfo = await this.cacheService.getLockInfo(lockName);
				console.log(`处理中 ${i + 1}/6, 锁状态:`, {
					exists: lockInfo.exists,
					ttl: lockInfo.ttl,
					count: lockInfo.count,
				});
			}

			console.log("业务处理完成，释放锁");
			await this.cacheService.releaseLock(lockName, lockId!);
			console.log("锁已释放");
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 示例 8: Redis Hash存储结构演示
	 */
	async example8_RedisHashStructure() {
		console.log("\n=== 示例 8: Redis Hash存储结构演示 ===");

		const lockName = "demo_hash_structure";
		const ttl = 60;

		try {
			console.log("演示Redis Hash存储结构:");
			console.log('Key: "demo_hash_structure"');
			console.log("Hash Fields:");
			console.log('  holder: "instanceId:lockId"');
			console.log("  count: 重入计数");

			// 获取锁
			const lockId = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`\n1. 首次获取锁: ${lockId}`);

			let lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("   Redis Hash内容:", {
				holder: lockInfo.holder,
				count: lockInfo.count,
				ttl: lockInfo.ttl,
			});

			// 重入
			const lockId2 = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`\n2. 重入获取锁: ${lockId2}`);

			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("   Redis Hash内容:", {
				holder: lockInfo.holder,
				count: lockInfo.count,
				ttl: lockInfo.ttl,
			});

			// 再次重入
			const lockId3 = await this.cacheService.acquireLock(lockName, ttl);
			console.log(`\n3. 再次重入获取锁: ${lockId3}`);

			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("   Redis Hash内容:", {
				holder: lockInfo.holder,
				count: lockInfo.count,
				ttl: lockInfo.ttl,
			});

			// 逐步释放
			console.log("\n开始释放锁:");

			await this.cacheService.releaseLock(lockName, lockId3!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("第一次释放后:", {
				exists: lockInfo.exists,
				count: lockInfo.count,
			});

			await this.cacheService.releaseLock(lockName, lockId2!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("第二次释放后:", {
				exists: lockInfo.exists,
				count: lockInfo.count,
			});

			await this.cacheService.releaseLock(lockName, lockId!);
			lockInfo = await this.cacheService.getLockInfo(lockName);
			console.log("最终释放后:", {
				exists: lockInfo.exists,
			});
		} catch (error) {
			console.error("错误:", error);
		}
	}

	/**
	 * 运行所有示例
	 */
	async runAllExamples() {
		console.log("🔒 分布式锁示例演示开始");
		console.log("特性: 基于Redis Hash存储的可重入分布式锁");

		await this.example1_BasicLock();
		await this.example2_ReentrantLock();
		await this.example3_ManualRenewal();
		await this.example4_LockStatusQuery();
		await this.example5_ErrorHandling();
		await this.example6_ConcurrencyTest();
		await this.example7_AutoRenewal();
		await this.example8_RedisHashStructure();

		console.log("\n=== 所有示例执行完成 ===");
		console.log("🎉 Redis Hash存储的分布式锁演示完成!");

		// 优雅关闭
		setTimeout(() => {
			process.exit(0);
		}, 1000);
	}

	/**
	 * 模拟业务逻辑
	 */
	private async simulateBusinessLogic(
		description: string,
		duration: number,
	): Promise<void> {
		console.log(`执行业务逻辑: ${description}`);
		await new Promise((resolve) => setTimeout(resolve, duration));
		console.log(`业务逻辑完成: ${description}`);
	}
}

// 运行示例
if (require.main === module) {
	const example = new DistributedLockExample();
	example.runAllExamples().catch(console.error);
}

export { DistributedLockExample };
