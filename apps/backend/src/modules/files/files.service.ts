import {
  Injectable,
  Inject,
  BadRequestException,
  NotFoundException,
} from '@nestjs/common';
import { eq, desc, sql } from 'drizzle-orm';
import * as crypto from 'crypto';
import * as path from 'path';
import { DB } from 'src/common/database/database.provider';
import { DbType } from 'src/common/database/db';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';
import { files } from 'src/common/database/schema/file';

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

  /**
   * 支持的文件类型配置
   */
  private readonly fileTypeConfig = {
    image: {
      extensions: ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.bmp', '.svg'],
      maxSize: 50 * 1024 * 1024, // 10MB
      mimeTypes: [
        'image/jpeg',
        'image/png',
        'image/gif',
        'image/webp',
        'image/bmp',
        'image/svg+xml',
      ],
    },
    video: {
      extensions: ['.mp4', '.avi', '.mov', '.wmv', '.flv', '.webm', '.mkv'],
      maxSize: 100 * 1024 * 1024, // 100MB
      mimeTypes: [
        'video/mp4',
        'video/avi',
        'video/quicktime',
        'video/x-ms-wmv',
        'video/x-flv',
        'video/webm',
        'video/x-matroska',
      ],
    },
    document: {
      extensions: [
        '.pdf',
        '.doc',
        '.docx',
        '.txt',
        '.rtf',
        '.xls',
        '.xlsx',
        '.ppt',
        '.pptx',
      ],
      maxSize: 50 * 1024 * 1024, // 50MB
      mimeTypes: [
        'application/pdf',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'text/plain',
        'application/rtf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/vnd.ms-powerpoint',
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      ],
    },
  };

  /**
   * 验证文件类型和大小
   */
  private validateFile(file: Express.Multer.File): {
    fileType: string;
    isValid: boolean;
    error?: string;
  } {
    const ext = path.extname(file.originalname).toLowerCase();
    const mimeType = file.mimetype.toLowerCase();

    // 检查文件类型
    let fileType = '';
    let config: {
      extensions: string[];
      maxSize: number;
      mimeTypes: string[];
    } | null = null;

    for (const [type, typeConfig] of Object.entries(this.fileTypeConfig)) {
      if (
        typeConfig.extensions.includes(ext) &&
        typeConfig.mimeTypes.includes(mimeType)
      ) {
        fileType = type;
        config = typeConfig;
        break;
      }
    }

    if (!fileType || !config) {
      return {
        fileType: '',
        isValid: false,
        error: `不支持的文件类型: ${ext} (${mimeType})`,
      };
    }

    // 检查文件大小
    if (file.size > config.maxSize) {
      const maxSizeMB = config.maxSize / (1024 * 1024);
      return {
        fileType,
        isValid: false,
        error: `文件大小超过限制，${fileType}类型文件最大支持${maxSizeMB}MB`,
      };
    }

    return { fileType, isValid: true };
  }

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
   * 检查文件是否已存在（去重）
   */
  async findExistingFile(
    fileHash: string,
  ): Promise<typeof files.$inferSelect | null> {
    const existingFiles = await this.db
      .select()
      .from(files)
      .where(eq(files.fileHash, fileHash))
      .limit(1);

    return existingFiles[0] || null;
  }

  /**
   * 上传文件
   */
  async uploadFile(
    file: Express.Multer.File,
    uploadedBy: string,
    bucketName: string = 'chat-files',
  ): Promise<typeof files.$inferSelect> {
    // 修复文件名编码问题
    let originalName = file.originalname;

    // 尝试修复UTF-8编码问题
    // 如果文件名包含乱码，尝试重新编码
    const buffer = Buffer.from(originalName, 'latin1');
    const utf8Name = buffer.toString('utf8');

    // 验证转换后的文件名是否更合理（包含更少的特殊字符）
    if (utf8Name.length > 0 && utf8Name !== originalName) {
      originalName = utf8Name;
    }

    // 验证文件
    const validation = this.validateFile(file);
    if (!validation.isValid) {
      throw new BadRequestException(validation.error);
    }

    // 计算文件hash
    const fileHash = this.calculateFileHash(file.buffer);

    // 检查是否已存在相同文件
    const existingFile = await this.findExistingFile(fileHash);
    if (existingFile) {
      // 文件已存在，直接返回现有记录
      return existingFile;
    }

    // 生成新的文件名
    const fileName = this.generateFileName(file.originalname);
    const objectPath = `${validation.fileType}/${fileName}`;
    // 上传到RustFS
    await this.minioService.uploadBufferPromisify(
      file.buffer,
      objectPath,
      bucketName,
      file.mimetype, // 正确传递 Content-Type
      {
        'original-name': encodeURIComponent(file.originalname), // 编码文件名避免特殊字符问题
        'file-size': file.size.toString(),
        'file-type': validation.fileType,
      },
    );

    // 保存文件记录到数据库，使用修复后的文件名
    const fileRecord = await this.db
      .insert(files)
      .values({
        originalName: originalName, // 使用修复后的文件名
        fileName,
        fileSize: file.size,
        mimeType: file.mimetype,
        fileHash,
        bucketName,
        objectPath,
        fileType: validation.fileType,
        uploadedBy,
        uploadedAt: new Date(),
        isPublic: false,
        accessCount: 0,
      })
      .returning();

    return fileRecord[0];
  }

  /**
   * 根据ID获取文件信息
   */
  async getFileById(fileId: string): Promise<typeof files.$inferSelect> {
    const fileRecords = await this.db
      .select()
      .from(files)
      .where(eq(files.id, fileId))
      .limit(1);

    if (!fileRecords[0]) {
      throw new NotFoundException('文件不存在');
    }

    return fileRecords[0];
  }

  /**
   * 根据hash获取文件信息
   */
  async getFileByHash(fileHash: string): Promise<typeof files.$inferSelect> {
    const fileRecords = await this.db
      .select()
      .from(files)
      .where(eq(files.fileHash, fileHash))
      .limit(1);

    if (!fileRecords[0]) {
      throw new NotFoundException('文件不存在');
    }

    return fileRecords[0];
  }

  /**
   * 增加文件访问次数
   */
  async incrementAccessCount(fileId: string): Promise<void> {
    await this.db
      .update(files)
      .set({
        accessCount: sql`${files.accessCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(files.id, fileId));
  }

  /**
   * 生成文件访问URL
   * 返回文件hash，前端通过API访问：/files/{fileHash}
   */
  generateFileUrl(fileRecord: typeof files.$inferSelect): string {
    return fileRecord.fileHash;
  }

  /**
   * 删除文件
   */
  async deleteFile(fileId: string, userId: string): Promise<void> {
    const fileRecord = await this.getFileById(fileId);

    // 检查权限（只有上传者可以删除）
    if (fileRecord.uploadedBy !== userId) {
      throw new BadRequestException('无权限删除此文件');
    }

    try {
      // 从MinIO删除文件
      await this.minioService.removeFile(fileRecord.bucketName, [
        fileRecord.objectPath,
      ]);

      // 从数据库删除记录
      await this.db.delete(files).where(eq(files.id, fileId));
    } catch (error) {
      throw new BadRequestException(
        `删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * 获取用户上传的文件列表
   */
  async getUserFiles(
    userId: string,
    limit: number = 50,
    offset: number = 0,
  ): Promise<(typeof files.$inferSelect)[]> {
    return await this.db
      .select()
      .from(files)
      .where(eq(files.uploadedBy, userId))
      .limit(limit)
      .offset(offset)
      .orderBy(desc(files.createdAt));
  }
}
