import { ListObjectsV2Command } from '@aws-sdk/client-s3';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { and, eq, isNotNull, lt } from 'drizzle-orm';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { files } from 'src/common/database/schema/file';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';

/**
 * 文件清理定时任务
 * 负责清理孤儿文件和软删除的文件
 * 执行周期：每15天
 */
@Injectable()
export class FileCleanupTask {
    private readonly logger = new Logger(FileCleanupTask.name);

    @Inject(DB)
    private readonly db: DbType;

    @Inject(S3StoreServer)
    private readonly s3Service: S3StoreServer;

    /**
     * 定时任务：每15天执行一次
     *
     */

    @Cron('0 2 */15 * *', {
        name: 'file-cleanup',
        timeZone: 'Asia/Shanghai',
    })
    async handleFileCleanup() {
        this.logger.log('=== 开始执行文件清理任务 ===');
        const startTime = Date.now();

        try {
            // 1. 清理软删除的文件（超过30天的）
            await this.cleanupSoftDeletedFiles();

            // 2. 清理孤儿文件（存在于 RustFS 但不在数据库中的文件）
            await this.cleanupOrphanFiles();

            const duration = ((Date.now() - startTime) / 1000).toFixed(2);
            this.logger.log(`=== 文件清理任务完成，耗时: ${duration}秒 ===`);
        } catch (error) {
            this.logger.error(
                `文件清理任务失败: ${error instanceof Error ? error.message : String(error)}`,
                error instanceof Error ? error.stack : undefined,
            );
        }
    }

    /**
     * 清理软删除的文件（超过30天的）
     */
    private async cleanupSoftDeletedFiles(): Promise<void> {
        this.logger.log('开始清理软删除的文件...');

        try {
            // 查询软删除超过30天的文件
            const thirtyDaysAgo = new Date(
                Date.now() - 30 * 24 * 60 * 60 * 1000,
            );
            const deletedFiles = await this.db
                .select()
                .from(files)
                .where(
                    and(
                        isNotNull(files.deletedAt),
                        lt(files.deletedAt, thirtyDaysAgo),
                    ),
                );

            if (deletedFiles.length === 0) {
                this.logger.log('没有需要清理的软删除文件');
                return;
            }

            this.logger.log(`找到 ${deletedFiles.length} 个软删除文件需要清理`);

            // 分批处理（每批 100 个）
            const batchSize = 100;
            let cleaned = 0;
            let failed = 0;

            for (let i = 0; i < deletedFiles.length; i += batchSize) {
                const batch = deletedFiles.slice(i, i + batchSize);

                // 按 bucket 分组，优化删除操作
                const filesByBucket = batch.reduce(
                    (acc, file) => {
                        if (!acc[file.bucketName]) {
                            acc[file.bucketName] = [];
                        }
                        acc[file.bucketName].push(file);
                        return acc;
                    },
                    {} as Record<string, typeof deletedFiles>,
                );

                // 并发删除各个 bucket 的文件
                await Promise.all(
                    Object.entries(filesByBucket).map(
                        async ([bucketName, bucketFiles]) => {
                            try {
                                // 从 RustFS 批量删除
                                const objectPaths = bucketFiles.map(
                                    (f) => f.objectPath,
                                );
                                await this.s3Service.removeFile(
                                    bucketName,
                                    objectPaths,
                                );

                                // 从数据库删除记录
                                await Promise.all(
                                    bucketFiles.map((file) =>
                                        this.db
                                            .delete(files)
                                            .where(eq(files.id, file.id)),
                                    ),
                                );

                                cleaned += bucketFiles.length;
                                this.logger.log(
                                    `成功清理 bucket "${bucketName}" 中的 ${bucketFiles.length} 个文件`,
                                );
                            } catch (error) {
                                failed += bucketFiles.length;
                                this.logger.error(
                                    `清理 bucket "${bucketName}" 失败: ${error instanceof Error ? error.message : String(error)}`,
                                );
                            }
                        },
                    ),
                );
            }

            this.logger.log(
                `软删除文件清理完成: 成功 ${cleaned} 个, 失败 ${failed} 个`,
            );
        } catch (error) {
            this.logger.error(
                `清理软删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * 清理孤儿文件（存在于 RustFS 但不在数据库中的文件）
     * 使用高性能分页策略遍历所有 bucket
     */
    private async cleanupOrphanFiles(): Promise<void> {
        this.logger.log('开始扫描孤儿文件...');

        try {
            // 获取所有使用的 bucket
            const buckets = await this.getUsedBuckets();
            this.logger.log(`需要扫描 ${buckets.length} 个 bucket`);

            let totalScanned = 0;
            let totalOrphans = 0;
            let totalCleaned = 0;

            // 并发扫描多个 bucket（但限制并发数）
            const concurrency = 3; // 同时扫描3个bucket
            for (let i = 0; i < buckets.length; i += concurrency) {
                const bucketBatch = buckets.slice(i, i + concurrency);
                const results = await Promise.allSettled(
                    bucketBatch.map((bucket) =>
                        this.scanBucketForOrphans(bucket),
                    ),
                );

                results.forEach((result, index) => {
                    if (result.status === 'fulfilled') {
                        totalScanned += result.value.scanned;
                        totalOrphans += result.value.orphans;
                        totalCleaned += result.value.cleaned;
                    } else {
                        this.logger.error(
                            `扫描 bucket "${bucketBatch[index]}" 失败: ${result.reason}`,
                        );
                    }
                });
            }

            this.logger.log(
                `孤儿文件扫描完成: 扫描 ${totalScanned} 个文件, 发现 ${totalOrphans} 个孤儿文件, 清理 ${totalCleaned} 个`,
            );
        } catch (error) {
            this.logger.error(
                `清理孤儿文件失败: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * 获取数据库中使用的所有 bucket
     */
    private async getUsedBuckets(): Promise<string[]> {
        const result = await this.db
            .selectDistinct({ bucketName: files.bucketName })
            .from(files);

        return result.map((r) => r.bucketName);
    }

    /**
     * 扫描单个 bucket 中的孤儿文件
     * 使用分页和批处理优化性能
     */
    private async scanBucketForOrphans(
        bucketName: string,
    ): Promise<{ scanned: number; orphans: number; cleaned: number }> {
        this.logger.log(`开始扫描 bucket: ${bucketName}`);

        let scanned = 0;
        let orphans = 0;
        let cleaned = 0;
        let continuationToken: string | undefined;

        try {
            // 使用 ListObjectsV2 分页遍历（最佳实践）
            do {
                const command = new ListObjectsV2Command({
                    Bucket: bucketName,
                    MaxKeys: 1000, // AWS 推荐的最大值
                    ContinuationToken: continuationToken,
                });

                const response = await this.s3Service['s3Client'].send(command);
                const objects = response.Contents || [];

                if (objects.length === 0) {
                    break;
                }

                scanned += objects.length;

                // 批量检查这些文件是否在数据库中
                const objectPaths = objects.map((obj) => obj.Key!);
                const orphanPaths = await this.findOrphanObjects(
                    bucketName,
                    objectPaths,
                );

                if (orphanPaths.length > 0) {
                    orphans += orphanPaths.length;
                    this.logger.log(
                        `发现 ${orphanPaths.length} 个孤儿文件 in bucket "${bucketName}"`,
                    );

                    // 批量删除孤儿文件（每次最多删除1000个）
                    const deleteResults = await this.s3Service.removeFile(
                        bucketName,
                        orphanPaths,
                    );
                    cleaned += deleteResults.length;
                }

                continuationToken = response.NextContinuationToken;

                // 避免过度占用资源，每1000个文件后暂停一下
                if (continuationToken) {
                    await this.sleep(100); // 暂停100ms
                }
            } while (continuationToken);

            this.logger.log(
                `Bucket "${bucketName}" 扫描完成: 扫描 ${scanned}, 孤儿 ${orphans}, 清理 ${cleaned}`,
            );

            return { scanned, orphans, cleaned };
        } catch (error) {
            this.logger.error(
                `扫描 bucket "${bucketName}" 失败: ${error instanceof Error ? error.message : String(error)}`,
            );
            throw error;
        }
    }

    /**
     * 查找孤儿对象（存在于 RustFS 但不在数据库中）
     * 使用批量查询优化性能
     */
    private async findOrphanObjects(
        bucketName: string,
        objectPaths: string[],
    ): Promise<string[]> {
        if (objectPaths.length === 0) {
            return [];
        }

        try {
            // 批量查询数据库中的文件记录
            const dbFiles = await this.db
                .select({ objectPath: files.objectPath })
                .from(files)
                .where(eq(files.bucketName, bucketName));

            // 创建 Set 用于快速查找
            const dbFileSet = new Set(dbFiles.map((f) => f.objectPath));

            // 找出不在数据库中的文件
            return objectPaths.filter((path) => !dbFileSet.has(path));
        } catch (error) {
            this.logger.error(
                `查找孤儿对象失败: ${error instanceof Error ? error.message : String(error)}`,
            );
            return [];
        }
    }

    /**
     * 工具方法：暂停指定毫秒
     */
    private sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
}
