import { Injectable } from '@nestjs/common';
import { fileTypeFromBuffer } from 'file-type';
import * as path from 'path';

/**
 * 文件验证服务
 * 负责文件类型、大小、安全性验证
 */
@Injectable()
export class FileValidatorService {
    /**
     * 支持的文件类型配置
     */
    private readonly fileTypeConfig = {
        image: {
            extensions: [
                '.jpg',
                '.jpeg',
                '.png',
                '.gif',
                '.webp',
                '.bmp',
                '.svg',
            ],
            maxSize: 50 * 1024 * 1024, // 50MB
            mimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/bmp',
                'image/svg+xml',
            ],
            // file-type 库检测到的真实 MIME 类型
            realMimeTypes: [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/bmp',
            ],
        },
        video: {
            extensions: [
                '.mp4',
                '.avi',
                '.mov',
                '.wmv',
                '.flv',
                '.webm',
                '.mkv',
            ],
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
            realMimeTypes: [
                'video/mp4',
                'video/quicktime',
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
            realMimeTypes: [
                'application/pdf',
                'application/msword',
                'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                'text/plain',
                'application/vnd.ms-excel',
                'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
                'application/vnd.ms-powerpoint',
                'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            ],
        },
    };

    /**
     * 清理文件名，移除不安全字符
     */
    sanitizeFileName(filename: string): string {
        // 移除路径遍历字符和特殊字符，保留中文、英文、数字、点、下划线、连字符
        const sanitized = filename
            .replace(/\.\./g, '') // 移除 ..
            .replace(/[/\\]/g, '') // 移除路径分隔符
            .replace(/[^a-zA-Z0-9\u4e00-\u9fa5._\-\s]/g, '_') // 只保留安全字符
            .substring(0, 200); // 限制长度

        // 确保文件名不为空
        if (!sanitized || sanitized.trim().length === 0) {
            return 'unnamed_file';
        }

        return sanitized;
    }

    /**
     * 验证文件真实类型（使用 file-type 库检测文件头）
     */
    async validateRealFileType(
        buffer: Buffer,
        declaredMimeType: string,
    ): Promise<{
        isValid: boolean;
        realMimeType?: string;
        error?: string;
    }> {
        try {
            const detectedType = await fileTypeFromBuffer(buffer);

            // 某些文件类型（如 txt, csv）无法通过文件头检测
            const undetectableTypes = [
                'text/plain',
                'text/csv',
                'application/rtf',
            ];

            if (!detectedType) {
                // 如果检测不到，检查是否是允许的不可检测类型
                if (undetectableTypes.includes(declaredMimeType)) {
                    return { isValid: true, realMimeType: declaredMimeType };
                }
                return {
                    isValid: false,
                    error: '无法检测文件类型，可能是不支持的格式',
                };
            }

            // 检查检测到的类型是否在我们支持的类型列表中
            let isSupported = false;
            for (const config of Object.values(this.fileTypeConfig)) {
                if (config.realMimeTypes.includes(detectedType.mime)) {
                    isSupported = true;
                    break;
                }
            }

            if (!isSupported) {
                return {
                    isValid: false,
                    realMimeType: detectedType.mime,
                    error: `检测到不支持的文件类型: ${detectedType.mime}`,
                };
            }

            // 检查声明的类型与实际类型是否匹配（允许一定的容差）
            const isMimeTypeMatch = this.isMimeTypeCompatible(
                declaredMimeType,
                detectedType.mime,
            );

            if (!isMimeTypeMatch) {
                return {
                    isValid: false,
                    realMimeType: detectedType.mime,
                    error: `文件类型不匹配: 声明为 ${declaredMimeType}，实际为 ${detectedType.mime}`,
                };
            }

            return {
                isValid: true,
                realMimeType: detectedType.mime,
            };
        } catch (error) {
            return {
                isValid: false,
                error: `文件类型验证失败: ${error instanceof Error ? error.message : String(error)}`,
            };
        }
    }

    /**
     * 检查 MIME 类型是否兼容
     * 某些格式有多种表示方式，需要特殊处理
     */
    private isMimeTypeCompatible(declared: string, detected: string): boolean {
        // 完全匹配
        if (declared === detected) return true;

        // JPEG 的多种表示
        const jpegTypes = ['image/jpeg', 'image/jpg'];
        if (jpegTypes.includes(declared) && jpegTypes.includes(detected)) {
            return true;
        }

        // Microsoft Office 文档可能有多种 MIME 类型
        const officeDocTypes = [
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        ];
        if (
            officeDocTypes.includes(declared) &&
            officeDocTypes.includes(detected)
        ) {
            return true;
        }

        return false;
    }

    /**
     * 验证文件（综合验证）
     */
    async validateFile(file: Express.Multer.File): Promise<{
        fileType: string;
        isValid: boolean;
        sanitizedFileName: string;
        error?: string;
    }> {
        // 1. 清理文件名
        const sanitizedFileName = this.sanitizeFileName(file.originalname);

        // 2. 检查文件扩展名和声明的 MIME 类型
        const ext = path.extname(sanitizedFileName).toLowerCase();
        const declaredMimeType = file.mimetype.toLowerCase();

        let fileType = '';
        let config:
            | (typeof this.fileTypeConfig)[keyof typeof this.fileTypeConfig]
            | null = null;

        for (const [type, typeConfig] of Object.entries(this.fileTypeConfig)) {
            if (
                typeConfig.extensions.includes(ext) &&
                typeConfig.mimeTypes.includes(declaredMimeType)
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
                sanitizedFileName,
                error: `不支持的文件类型: ${ext} (${declaredMimeType})`,
            };
        }

        // 3. 检查文件大小
        if (file.size > config.maxSize) {
            const maxSizeMB = config.maxSize / (1024 * 1024);
            return {
                fileType,
                isValid: false,
                sanitizedFileName,
                error: `文件大小超过限制，${fileType}类型文件最大支持${maxSizeMB}MB`,
            };
        }

        // 4. 验证文件真实类型（通过文件头检测）
        const realTypeValidation = await this.validateRealFileType(
            file.buffer,
            declaredMimeType,
        );

        if (!realTypeValidation.isValid) {
            return {
                fileType,
                isValid: false,
                sanitizedFileName,
                error: realTypeValidation.error,
            };
        }

        return {
            fileType,
            isValid: true,
            sanitizedFileName,
        };
    }
}
