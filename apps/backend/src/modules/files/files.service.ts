import {
    BadRequestException,
    Inject,
    Injectable,
    Logger,
    NotFoundException,
} from '@nestjs/common';
import * as crypto from 'crypto';
import { desc, eq, sql } from 'drizzle-orm';
import * as path from 'path';
import type { IAdvancedCacheService } from 'src/common/cache/interfaces/cache-service.interface';
import { CACHE_SERVICE } from 'src/common/cache/providers/cache.provider';
import { DB } from 'src/common/database/database.provider';
import type { DbType } from 'src/common/database/db';
import { files } from 'src/common/database/schema/file';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';
import { FileValidatorService } from './file-validator.service';
import { ThumbnailService } from './thumbnail.service';

/**
 * 文件服务
 * 处理文件上传、访问、去重等核心业务逻辑
 */
@Injectable()
export class FilesService {
    @Inject(DB)
    private readonly db: DbType;

    @Inject(S3StoreServer)
    private readonly minioService: S3StoreServer;

    @Inject(FileValidatorService)
    private readonly fileValidator: FileValidatorService;

    @Inject(CACHE_SERVICE)
    private readonly cacheService: IAdvancedCacheService;

    @Inject(ThumbnailService)
    private readonly thumbnailService: ThumbnailService;

    private readonly logger = new Logger(FilesService.name);

    // 缓存键前缀
    private readonly CACHE_PREFIX = {
        FILE_BY_ID: 'file:id:',
        FILE_BY_HASH: 'file:hash:',
        USER_FILES: 'file:user:',
        ACCESS_COUNT: 'file:access:',
    };

    // 缓存过期时间（秒）
    private readonly CACHE_TTL = {
        FILE_METADATA: 3600, // 1小时
        USER_FILES: 300, // 5分钟
        ACCESS_COUNT: 60, // 1分钟
    };

    /**
     * 计算文件hash值
     */
    private calculateFileHash(buffer: Buffer): string {
        return crypto.createHash('sha256').update(buffer).digest('hex');
    }

    /**
     * 生成唯一的文件名
     */
    private generateFileName(originalName: string): string {
        const ext = path.extname(originalName);
        const uuid = crypto.randomUUID();
        return `${uuid}${ext}`;
    }

    /**
     * 按自定义 objectPath + bucket 上传文件，适用于需要固定路径的场景（如 app 发布包）
     */
    async uploadFileWithObjectPath(params: {
        file: Express.Multer.File;
        uploadedBy: string;
        bucketName: string;
        objectPath: string;
        fileType?: string;
    }): Promise<typeof files.$inferSelect> {
        const { file, uploadedBy, bucketName, objectPath } = params;
        const fileType = params.fileType ?? 'document';
        const startTime = Date.now();

        const validation = await this.fileValidator.validateFile(file);
        if (!validation.isValid) {
            throw new BadRequestException(validation.error);
        }

        const fileHash = this.calculateFileHash(file.buffer);
        const sanitizedFileName =
            validation.sanitizedFileName ||
            path.basename(objectPath) ||
            'file.bin';
        const normalizedObjectPath =
            objectPath.startsWith('/') && objectPath.length > 1
                ? objectPath.slice(1)
                : objectPath;

        return await this.db.transaction(async (tx) => {
            const existingFiles = await tx
                .select()
                .from(files)
                .where(
                    sql`${files.fileHash} = ${fileHash} AND ${files.deletedAt} IS NULL`,
                )
                .limit(1)
                .for('update');

            if (existingFiles[0]) {
                const [updated] = await tx
                    .update(files)
                    .set({
                        referenceCount: sql`${files.referenceCount} + 1`,
                        updatedAt: new Date(),
                    })
                    .where(eq(files.id, existingFiles[0].id))
                    .returning();

                return updated;
            }

            const inserted = await tx
                .insert(files)
                .values({
                    originalName: sanitizedFileName,
                    fileName: path.basename(normalizedObjectPath),
                    fileSize: file.size,
                    mimeType: file.mimetype,
                    fileHash,
                    bucketName,
                    objectPath: normalizedObjectPath,
                    fileType,
                    uploadedBy,
                    uploadedAt: new Date(),
                    isPublic: false,
                    accessCount: 0,
                    referenceCount: 1,
                })
                .returning();

            const fileRecord = inserted[0];

            await this.minioService.uploadBufferPromisify(
                file.buffer,
                normalizedObjectPath,
                bucketName,
                file.mimetype,
                {
                    'original-name': encodeURIComponent(sanitizedFileName),
                    'file-size': file.size.toString(),
                    'file-type': fileType,
                },
            );

            this.logger.log(
                `文件上传成功: ${sanitizedFileName}, objectPath: ${normalizedObjectPath}, 耗时: ${
                    Date.now() - startTime
                }ms`,
            );

            return fileRecord;
        });
    }

    /**
     * 检查文件是否已存在（去重）
     * 只返回未软删除的文件
     */
    async findExistingFile(
        fileHash: string,
    ): Promise<typeof files.$inferSelect | null> {
        const existingFiles = await this.db
            .select()
            .from(files)
            .where(
                sql`${files.fileHash} = ${fileHash} AND ${files.deletedAt} IS NULL`,
            )
            .limit(1);

        return existingFiles[0] || null;
    }

    /**
     * 上传文件（使用数据库事务和行级锁解决并发问题）
     */
    async uploadFile(
        file: Express.Multer.File,
        uploadedBy: string,
        bucketName: string = 'files-live',
    ): Promise<typeof files.$inferSelect> {
        const startTime = Date.now();
        this.logger.log(
            `开始上传文件: ${file.originalname}, 大小: ${file.size} bytes, 用户: ${uploadedBy}`,
        );

        // 1. 验证文件（包括类型检测和文件名清理）
        const validation = await this.fileValidator.validateFile(file);
        if (!validation.isValid) {
            this.logger.warn(
                `文件验证失败: ${file.originalname}, 原因: ${validation.error}`,
            );
            throw new BadRequestException(validation.error);
        }

        // 2. 计算文件hash
        const fileHash = this.calculateFileHash(file.buffer);
        this.logger.debug(`文件hash计算完成: ${fileHash}`);

        // 3. 使用数据库事务处理并发
        return await this.db.transaction(async (tx) => {
            // 3.1 使用 FOR UPDATE 行级锁查询现有文件
            const existingFiles = await tx
                .select()
                .from(files)
                .where(
                    sql`${files.fileHash} = ${fileHash} AND ${files.deletedAt} IS NULL`,
                )
                .limit(1)
                .for('update'); // 行级锁，防止其他事务修改

            if (existingFiles[0]) {
                // 文件已存在，原子性增加引用计数
                const updated = await tx
                    .update(files)
                    .set({
                        referenceCount: sql`${files.referenceCount} + 1`,
                        updatedAt: new Date(),
                    })
                    .where(eq(files.id, existingFiles[0].id))
                    .returning();

                return updated[0];
            }

            // 4. 文件不存在，生成新的文件名
            const fileName = this.generateFileName(
                validation.sanitizedFileName,
            );
            const objectPath = `${validation.fileType}/${fileName}`;

            // 5. 先插入数据库记录（占位，防止并发重复上传）
            // 使用 fileHash 唯一约束防止并发冲突
            let fileRecord: typeof files.$inferSelect;
            try {
                const inserted = await tx
                    .insert(files)
                    .values({
                        originalName: validation.sanitizedFileName,
                        fileName,
                        fileSize: file.size,
                        mimeType: file.mimetype,
                        fileHash, // 唯一约束确保不会插入重复
                        bucketName,
                        objectPath,
                        fileType: validation.fileType,
                        uploadedBy,
                        uploadedAt: new Date(),
                        isPublic: false,
                        accessCount: 0,
                        referenceCount: 1,
                    })
                    .returning();

                fileRecord = inserted[0];
            } catch (error) {
                // 如果插入失败（并发导致的唯一约束冲突）
                // 说明另一个请求已经在处理同样的文件，直接增加引用计数
                const existingFile = await tx
                    .select()
                    .from(files)
                    .where(
                        sql`${files.fileHash} = ${fileHash} AND ${files.deletedAt} IS NULL`,
                    )
                    .limit(1)
                    .for('update');

                if (existingFile[0]) {
                    const updated = await tx
                        .update(files)
                        .set({
                            referenceCount: sql`${files.referenceCount} + 1`,
                            updatedAt: new Date(),
                        })
                        .where(eq(files.id, existingFile[0].id))
                        .returning();

                    return updated[0];
                }

                // 如果还是找不到，抛出原始错误
                throw error;
            }

            // 6. 上传到 RustFS（数据库记录已存在）
            try {
                await this.minioService.uploadBufferPromisify(
                    file.buffer,
                    objectPath,
                    bucketName,
                    file.mimetype,
                    {
                        'original-name': encodeURIComponent(
                            validation.sanitizedFileName,
                        ),
                        'file-size': file.size.toString(),
                        'file-type': validation.fileType,
                    },
                );

                // 7. 如果是图片，异步生成 BlurHash（不阻塞主流程）
                if (
                    validation.fileType === 'image' &&
                    this.thumbnailService.isThumbnailSupported(file.mimetype)
                ) {
                    this.logger.debug(`启动异步 BlurHash 生成: ${fileName}`);
                    this.generateBlurHashAsync(
                        file.buffer,
                        fileRecord.id,
                    ).catch((error) => {
                        this.logger.error(
                            `BlurHash 生成失败: ${fileName}`,
                            error instanceof Error
                                ? error.stack
                                : String(error),
                        );
                    });
                }

                // 上传成功，清除用户文件列表缓存
                await this.cacheService.del(
                    `${this.CACHE_PREFIX.USER_FILES}${uploadedBy}`,
                );

                // 记录性能指标
                const duration = Date.now() - startTime;
                this.logger.log(
                    `文件上传成功: ${fileRecord.originalName}, ID: ${fileRecord.id}, 耗时: ${duration}ms`,
                );

                // 返回记录
                return fileRecord;
            } catch (uploadError) {
                // 上传失败，删除数据库记录（事务会自动回滚）
                // 抛出异常让事务回滚
                this.logger.error(
                    `文件上传失败: ${file.originalname}`,
                    uploadError instanceof Error
                        ? uploadError.stack
                        : String(uploadError),
                );
                throw new BadRequestException(
                    `文件上传到存储服务失败: ${uploadError instanceof Error ? uploadError.message : String(uploadError)}`,
                );
            }
        });
    }

    /**
     * 根据ID获取文件信息（排除软删除）
     * 支持 Redis 缓存
     */
    async getFileById(fileId: string): Promise<typeof files.$inferSelect> {
        // 尝试从缓存获取
        const cacheKey = `${this.CACHE_PREFIX.FILE_BY_ID}${fileId}`;
        const cachedFile =
            await this.cacheService.get<typeof files.$inferSelect>(cacheKey);

        if (cachedFile) {
            this.logger.debug(`缓存命中: 文件ID ${fileId}`);
            return cachedFile;
        }

        // 缓存未命中，从数据库查询
        this.logger.debug(`缓存未命中: 文件ID ${fileId}, 查询数据库`);
        const fileRecords = await this.db
            .select()
            .from(files)
            .where(sql`${files.id} = ${fileId} AND ${files.deletedAt} IS NULL`)
            .limit(1);

        if (!fileRecords[0]) {
            this.logger.warn(`文件不存在: ID ${fileId}`);
            throw new NotFoundException('文件不存在或已被删除');
        }

        // 写入缓存
        await this.cacheService.set(
            cacheKey,
            fileRecords[0],
            this.CACHE_TTL.FILE_METADATA,
        );

        return fileRecords[0];
    }

    /**
     * 根据hash获取文件信息（排除软删除）
     * 支持 Redis 缓存
     */
    async getFileByHash(fileHash: string): Promise<typeof files.$inferSelect> {
        // 尝试从缓存获取
        const cacheKey = `${this.CACHE_PREFIX.FILE_BY_HASH}${fileHash}`;
        const cachedFile =
            await this.cacheService.get<typeof files.$inferSelect>(cacheKey);

        if (cachedFile) {
            return cachedFile;
        }

        // 缓存未命中，从数据库查询
        const fileRecords = await this.db
            .select()
            .from(files)
            .where(
                sql`${files.fileHash} = ${fileHash} AND ${files.deletedAt} IS NULL`,
            )
            .limit(1);

        if (!fileRecords[0]) {
            throw new NotFoundException('文件不存在或已被删除');
        }

        // 同时写入两个缓存键（按 ID 和按 hash）
        await Promise.all([
            this.cacheService.set(
                cacheKey,
                fileRecords[0],
                this.CACHE_TTL.FILE_METADATA,
            ),
            this.cacheService.set(
                `${this.CACHE_PREFIX.FILE_BY_ID}${fileRecords[0].id}`,
                fileRecords[0],
                this.CACHE_TTL.FILE_METADATA,
            ),
        ]);

        return fileRecords[0];
    }

    /**
     * 生成预签名下载链接
     */
    async getPresignedDownloadUrl(
        fileId: string,
        ttlSeconds: number = 600,
    ): Promise<string> {
        const fileRecord = await this.getFileById(fileId);
        return this.minioService.getPresignedDownloadUrl(
            fileRecord.bucketName,
            fileRecord.objectPath,
            ttlSeconds,
        );
    }

    /**
     * 增加文件访问次数
     * 使用 Redis 计数器优化性能，定期同步到数据库
     */
    async incrementAccessCount(fileId: string): Promise<void> {
        const cacheKey = `${this.CACHE_PREFIX.ACCESS_COUNT}${fileId}`;

        try {
            // 原子性增加 Redis 计数器
            const newCount = await this.cacheService.increment(
                cacheKey,
                1,
                this.CACHE_TTL.ACCESS_COUNT,
            );

            // 每10次访问同步一次到数据库（减少数据库压力）
            if (newCount % 10 === 0) {
                await this.db
                    .update(files)
                    .set({
                        accessCount: sql`${files.accessCount} + 10`,
                        updatedAt: new Date(),
                    })
                    .where(eq(files.id, fileId));

                // 重置 Redis 计数器
                await this.cacheService.del(cacheKey);
            }
        } catch {
            // Redis 失败时直接更新数据库
            await this.db
                .update(files)
                .set({
                    accessCount: sql`${files.accessCount} + 1`,
                    updatedAt: new Date(),
                })
                .where(eq(files.id, fileId));
        }
    }

    /**
     * 生成文件访问URL
     * 返回文件hash，前端通过API访问：/files/{fileHash}
     */
    generateFileUrl(fileRecord: typeof files.$inferSelect): string {
        return fileRecord.fileHash;
    }

    /**
     * 删除文件（使用引用计数、软删除和事务解决并发问题）
     * 删除后清除相关缓存
     */
    async deleteFile(fileId: string, userId: string): Promise<void> {
        this.logger.log(`开始删除文件: ID ${fileId}, 用户: ${userId}`);

        await this.db.transaction(async (tx) => {
            // 1. 使用行级锁查询文件（防止并发修改）
            const fileRecords = await tx
                .select()
                .from(files)
                .where(
                    sql`${files.id} = ${fileId} AND ${files.deletedAt} IS NULL`,
                )
                .limit(1)
                .for('update'); // 行级锁

            if (!fileRecords[0]) {
                this.logger.warn(`删除失败: 文件不存在 ID ${fileId}`);
                throw new NotFoundException('文件不存在或已被删除');
            }

            const fileRecord = fileRecords[0];

            // 2. 检查权限（只有上传者可以删除）
            if (fileRecord.uploadedBy !== userId) {
                this.logger.warn(
                    `删除失败: 权限不足 文件ID ${fileId}, 请求用户: ${userId}, 所有者: ${fileRecord.uploadedBy}`,
                );
                throw new BadRequestException('无权限删除此文件');
            }

            const currentRefCount = fileRecord.referenceCount || 1;

            if (currentRefCount > 1) {
                // 3. 还有其他引用，原子性减少计数
                this.logger.debug(
                    `减少引用计数: 文件ID ${fileId}, 当前计数: ${currentRefCount}`,
                );
                await tx
                    .update(files)
                    .set({
                        referenceCount: sql`${files.referenceCount} - 1`,
                        updatedAt: new Date(),
                    })
                    .where(eq(files.id, fileId));
            } else {
                // 4. 最后一个引用，执行软删除
                this.logger.log(
                    `执行软删除: 文件ID ${fileId}, 名称: ${fileRecord.originalName}`,
                );
                await tx
                    .update(files)
                    .set({
                        deletedAt: new Date(),
                        updatedAt: new Date(),
                    })
                    .where(eq(files.id, fileId));

                // 注意：物理文件暂不删除，可以通过定时任务异步清理
                // 如果需要立即删除物理文件，取消下面的注释：
                // await this.minioService.removeFile(fileRecord.bucketName, [
                //   fileRecord.objectPath,
                // ]);
            }

            // 5. 清除所有相关缓存
            await this.clearFileCache(
                fileRecord.id,
                fileRecord.fileHash,
                fileRecord.uploadedBy,
            );
            this.logger.log(`文件删除成功: ID ${fileId}`);
        });
    }

    /**
     * 清除文件相关的所有缓存
     */
    private async clearFileCache(
        fileId: string,
        fileHash: string,
        userId: string,
    ): Promise<void> {
        try {
            await Promise.all([
                this.cacheService.del(
                    `${this.CACHE_PREFIX.FILE_BY_ID}${fileId}`,
                ),
                this.cacheService.del(
                    `${this.CACHE_PREFIX.FILE_BY_HASH}${fileHash}`,
                ),
                this.cacheService.del(
                    `${this.CACHE_PREFIX.USER_FILES}${userId}`,
                ),
                this.cacheService.del(
                    `${this.CACHE_PREFIX.ACCESS_COUNT}${fileId}`,
                ),
            ]);
        } catch {
            // 缓存清除失败不影响主流程，静默处理
        }
    }

    /**
     * 异步生成 BlurHash（不阻塞主流程）
     */
    private async generateBlurHashAsync(
        imageBuffer: Buffer,
        fileId: string,
    ): Promise<void> {
        try {
            // 生成 BlurHash 字符串
            const blurhash =
                await this.thumbnailService.generateBlurHash(imageBuffer);

            // 更新数据库记录
            await this.db
                .update(files)
                .set({
                    blurhash,
                    updatedAt: new Date(),
                })
                .where(eq(files.id, fileId));

            // 清除文件缓存，下次查询时获取最新数据
            const fileRecord = await this.db
                .select()
                .from(files)
                .where(eq(files.id, fileId))
                .limit(1);

            if (fileRecord[0]) {
                await this.clearFileCache(
                    fileRecord[0].id,
                    fileRecord[0].fileHash,
                    fileRecord[0].uploadedBy,
                );
            }
        } catch {
            // BlurHash 生成失败不影响主流程，静默处理
        }
    }

    /**
     * 物理删除文件（内部方法，用于清理任务）
     */
    async physicallyDeleteFile(fileId: string): Promise<void> {
        const fileRecord = await this.db
            .select()
            .from(files)
            .where(eq(files.id, fileId))
            .limit(1);

        if (!fileRecord[0]) {
            throw new NotFoundException('文件不存在');
        }

        const file = fileRecord[0];

        try {
            // 从存储服务删除物理文件
            await this.minioService.removeFile(file.bucketName, [
                file.objectPath,
            ]);

            // 从数据库永久删除记录
            await this.db.delete(files).where(eq(files.id, fileId));
        } catch (error) {
            throw new BadRequestException(
                `物理删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取用户上传的文件列表（排除软删除）
     */
    async getUserFiles(
        userId: string,
        limit: number = 50,
        offset: number = 0,
    ): Promise<(typeof files.$inferSelect)[]> {
        return await this.db
            .select()
            .from(files)
            .where(
                sql`${files.uploadedBy} = ${userId} AND ${files.deletedAt} IS NULL`,
            )
            .limit(limit)
            .offset(offset)
            .orderBy(desc(files.createdAt));
    }

    /**
     * 获取文件访问信息（包括预签名URL）
     * 支持通过文件ID或hash访问
     */
    async getFileAccessInfo(fileIdentifier: string): Promise<{
        fileUrl: string;
        fileName: string;
        mimeType: string;
        fileSize: number;
        expiresIn: number;
        blurhash?: string;
    }> {
        // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
        let fileRecord: typeof files.$inferSelect;
        try {
            fileRecord = await this.getFileByHash(fileIdentifier);
        } catch {
            fileRecord = await this.getFileById(fileIdentifier);
        }

        // 增加访问次数
        await this.incrementAccessCount(fileRecord.id);

        // 生成预签名URL（10分钟有效期）
        const fileUrl = await this.minioService.getPresignedDownloadUrl(
            fileRecord.bucketName,
            fileRecord.objectPath,
            600, // 10分钟
        );

        return {
            fileUrl,
            fileName: fileRecord.originalName,
            mimeType: fileRecord.mimeType,
            fileSize: fileRecord.fileSize,
            expiresIn: 600,
            blurhash: fileRecord.blurhash || undefined,
        };
    }
}
