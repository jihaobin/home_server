import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  UploadedFile,
  UseInterceptors,
  HttpException,
  HttpStatus,
  Res,
  StreamableFile,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { Response } from 'express';
import { FilesService } from './files.service';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';

/**
 * 文件上传响应接口
 */
export interface FileUploadResponse {
  success: boolean;
  data?: {
    id: string;
    originalName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileType: string;
    fileUrl: string;
    uploadedAt: Date;
  };
  error?: string;
}

/**
 * 文件列表响应接口
 */
export interface FileListResponse {
  success: boolean;
  data?: {
    id: string;
    originalName: string;
    fileName: string;
    fileSize: number;
    mimeType: string;
    fileType: string;
    fileUrl: string;
    uploadedAt: Date;
    accessCount: number;
  }[];
  error?: string;
}

@Controller('files')
export class FilesController {
  constructor(
    private readonly filesService: FilesService,
    private readonly minioService: S3StoreServer,
  ) {}

  /**
   * 文件上传端点
   */
  @Post('upload')
  @UseInterceptors(FileInterceptor('file'))
  async uploadFile(
    @UploadedFile() file: Express.Multer.File,
    @Query('userId') userId: string,
  ): Promise<FileUploadResponse> {
    if (!file) {
      throw new HttpException('未选择文件', HttpStatus.BAD_REQUEST);
    }

    if (!userId) {
      throw new HttpException('缺少用户ID', HttpStatus.BAD_REQUEST);
    }

    const fileRecord = await this.filesService.uploadFile(file, userId);
    const fileUrl = this.filesService.generateFileUrl(fileRecord);

    return {
      success: true,
      data: {
        id: fileRecord.id,
        originalName: fileRecord.originalName,
        fileName: fileRecord.fileName,
        fileSize: fileRecord.fileSize,
        mimeType: fileRecord.mimeType,
        fileType: fileRecord.fileType,
        fileUrl,
        uploadedAt: fileRecord.uploadedAt,
      },
    };
  }

  /**
   * 文件访问端点
   * 支持通过文件ID或文件hash访问，支持HTTP Range请求
   */
  @Get(':fileIdentifier')
  async getFile(@Param('fileIdentifier') fileIdentifier: string): Promise<{
    fileUrl: string;
    fileName: string;
    mimeType: string;
    fileSize: number;
    expiresIn: number;
  }> {
    try {
      // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
      let fileRecord: any;
      try {
        fileRecord = await this.filesService.getFileByHash(fileIdentifier);
      } catch {
        fileRecord = await this.filesService.getFileById(fileIdentifier);
      }

      // 增加访问次数
      await this.filesService.incrementAccessCount(fileRecord.id);

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
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `获取文件失败: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 文件下载端点
   */
  @Get(':fileIdentifier/download')
  async downloadFile(
    @Param('fileIdentifier') fileIdentifier: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<StreamableFile> {
    try {
      // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
      let fileRecord: any;
      try {
        fileRecord = await this.filesService.getFileByHash(fileIdentifier);
      } catch {
        fileRecord = await this.filesService.getFileById(fileIdentifier);
      }

      // 增加访问次数
      await this.filesService.incrementAccessCount(fileRecord.id);

      // 从RustFS获取文件流
      const fileStream = await this.minioService.getObject(
        fileRecord.bucketName,
        fileRecord.objectPath,
      );

      // 设置下载响应头 - 移除 Content-Length，让 NestJS 自动处理
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${encodeURIComponent(fileRecord.originalName)}"`,
        'Accept-Ranges': 'bytes', // 支持 Range 请求
      });

      return new StreamableFile(fileStream);
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        `下载文件失败: ${error instanceof Error ? error.message : String(error)}`,
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  /**
   * 删除文件端点
   */
  @Delete(':fileIdentifier')
  async deleteFile(
    @Param('fileIdentifier') fileIdentifier: string,
    @Query('userId') userId: string,
  ): Promise<{ success: boolean; message?: string; error?: string }> {
    try {
      if (!userId) {
        throw new HttpException('缺少用户ID', HttpStatus.BAD_REQUEST);
      }

      // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
      let fileRecord: any;
      try {
        fileRecord = await this.filesService.getFileByHash(fileIdentifier);
      } catch {
        fileRecord = await this.filesService.getFileById(fileIdentifier);
      }

      await this.filesService.deleteFile(fileRecord.id, userId);

      return {
        success: true,
        message: '文件删除成功',
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return {
        success: false,
        error: `删除文件失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 获取用户文件列表端点
   */
  @Get('user/:userId')
  async getUserFiles(
    @Param('userId') userId: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ): Promise<FileListResponse> {
    try {
      const limitNum = limit ? parseInt(limit, 10) : 50;
      const offsetNum = offset ? parseInt(offset, 10) : 0;

      const fileRecords = await this.filesService.getUserFiles(
        userId,
        limitNum,
        offsetNum,
      );

      return {
        success: true,
        data: fileRecords.map((record) => ({
          id: record.id,
          originalName: record.originalName,
          fileName: record.fileName,
          fileSize: record.fileSize,
          mimeType: record.mimeType,
          fileType: record.fileType,
          fileUrl: this.filesService.generateFileUrl(record),
          uploadedAt: record.uploadedAt,
          accessCount: record.accessCount || 0,
        })),
      };
    } catch (error) {
      return {
        success: false,
        error: `获取文件列表失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }

  /**
   * 文件信息端点
   */
  @Get(':fileId/info')
  async getFileInfo(@Param('fileId') fileId: string): Promise<{
    success: boolean;
    data?: {
      id: string;
      originalName: string;
      fileName: string;
      fileSize: number;
      mimeType: string;
      fileType: string;
      fileUrl: string;
      uploadedAt: Date;
      accessCount: number;
    };
    error?: string;
  }> {
    try {
      const fileRecord = await this.filesService.getFileById(fileId);

      return {
        success: true,
        data: {
          id: fileRecord.id,
          originalName: fileRecord.originalName,
          fileName: fileRecord.fileName,
          fileSize: fileRecord.fileSize,
          mimeType: fileRecord.mimeType,
          fileType: fileRecord.fileType,
          fileUrl: this.filesService.generateFileUrl(fileRecord),
          uploadedAt: fileRecord.uploadedAt,
          accessCount: fileRecord.accessCount || 0,
        },
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      return {
        success: false,
        error: `获取文件信息失败: ${error instanceof Error ? error.message : String(error)}`,
      };
    }
  }
}
