import {
    Controller,
    Delete,
    Get,
    HttpException,
    HttpStatus,
    Param,
    Post,
    Query,
    Req,
    Res,
    StreamableFile,
    UploadedFile,
    UseGuards,
    UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Request, Response } from 'express';
import { S3StoreServer } from 'src/common/s3_store/s3_store.service';
import type { UserSession } from '../auth/auth.guard';
import { AuthGuard } from '../auth/auth.guard';
import { Session } from '../auth/decorators';
import { FilesService } from './files.service';
import { FileListResponse, FileUploadResponse } from '@repo/types';

@Controller('files')
export class FilesController {
    constructor(
        private readonly filesService: FilesService,
        private readonly S3Service: S3StoreServer,
    ) {}

    /**
     * 文件上传端点
     */
    @Post('upload')
    @UseGuards(AuthGuard)
    @UseInterceptors(FileInterceptor('file'))
    async uploadFile(
        @UploadedFile() file: Express.Multer.File,
        @Req() req: Request,
    ): Promise<FileUploadResponse> {
        if (!file) {
            throw new HttpException('未选择文件', HttpStatus.BAD_REQUEST);
        }

        const userId = req.user.id;
        const fileRecord = await this.filesService.uploadFile(file, userId);
        const fileUrl = this.filesService.generateFileUrl(fileRecord);

        return {
            id: fileRecord.id,
            originalName: fileRecord.originalName,
            fileName: fileRecord.fileName,
            fileSize: fileRecord.fileSize,
            mimeType: fileRecord.mimeType,
            fileType: fileRecord.fileType,
            fileUrl,
            uploadedAt: fileRecord.uploadedAt,
            blurhash: fileRecord.blurhash || undefined,
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
        blurhash?: string;
    }> {
        try {
            return await this.filesService.getFileAccessInfo(fileIdentifier);
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
                fileRecord =
                    await this.filesService.getFileByHash(fileIdentifier);
            } catch {
                fileRecord =
                    await this.filesService.getFileById(fileIdentifier);
            }

            // 增加访问次数
            await this.filesService.incrementAccessCount(fileRecord.id);

            // 从RustFS获取文件流
            const fileStream = await this.S3Service.getObject(
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
    @UseGuards(AuthGuard)
    async deleteFile(
        @Param('fileIdentifier') fileIdentifier: string,
        @Session() session: UserSession,
    ): Promise<string> {
        try {
            const userId = session.user.id;

            // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
            let fileRecord: any;
            try {
                fileRecord =
                    await this.filesService.getFileByHash(fileIdentifier);
            } catch {
                fileRecord =
                    await this.filesService.getFileById(fileIdentifier);
            }

            await this.filesService.deleteFile(fileRecord.id, userId);

            return '文件删除成功';
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            return `删除文件失败: ${error instanceof Error ? error.message : String(error)}`;
        }
    }

    /**
     * 获取用户文件列表端点
     */
    @Get('user/list')
    @UseGuards(AuthGuard)
    async getUserFiles(
        @Session() session: UserSession,
        @Query('limit') limit?: string,
        @Query('offset') offset?: string,
    ): Promise<FileListResponse> {
        try {
            const userId = session.user.id;
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
            blurhash?: string;
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
                    blurhash: fileRecord.blurhash || undefined,
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

    /**
     * 获取 BlurHash 端点
     */
    @Get(':fileIdentifier/blurhash')
    async getBlurHash(
        @Param('fileIdentifier') fileIdentifier: string,
    ): Promise<{
        blurhash: string;
        fileName: string;
    }> {
        try {
            // 尝试通过hash获取文件，如果失败则通过ID获取（向后兼容）
            let fileRecord: any;
            try {
                fileRecord =
                    await this.filesService.getFileByHash(fileIdentifier);
            } catch {
                fileRecord =
                    await this.filesService.getFileById(fileIdentifier);
            }

            // 检查是否有 BlurHash
            if (!fileRecord.blurhash) {
                throw new HttpException(
                    '该文件没有 BlurHash',
                    HttpStatus.NOT_FOUND,
                );
            }

            return {
                blurhash: fileRecord.blurhash,
                fileName: fileRecord.originalName,
            };
        } catch (error) {
            if (error instanceof HttpException) {
                throw error;
            }
            throw new HttpException(
                `获取 BlurHash 失败: ${error instanceof Error ? error.message : String(error)}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
