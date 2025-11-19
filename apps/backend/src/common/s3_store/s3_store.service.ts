import { Injectable, OnModuleInit } from '@nestjs/common';
import { S3Client } from '@aws-sdk/client-s3';
import {
    PutObjectCommand,
    GetObjectCommand,
    DeleteObjectsCommand,
    CreateMultipartUploadCommand,
    UploadPartCommand,
    CompleteMultipartUploadCommand,
    AbortMultipartUploadCommand,
    DeletedObject,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { NodeHttpHandler } from '@smithy/node-http-handler';
import { readFileSync, statSync, openSync, readSync, closeSync } from 'fs';

/**
 * RustFSService 提供了与 RustFS 服务器交互的功能，包括文件上传、合并和删除
 * 使用 AWS S3 SDK v3 与 RustFS 进行兼容性交互
 */
@Injectable()
export class S3StoreServer implements OnModuleInit {
    // 改为 public 以便定时任务访问
    public s3Client!: S3Client;

    /**
     * 构造函数注入 ConfigService，并初始化 S3 客户端
     * @param configSvc 用于获取环境变量中的 RustFS 配置
     */
    constructor() {}

    onModuleInit(): void {
        const endpoint = process.env.s3_NEDPOINT;

        const accessKeyId = process.env.s3_ACCESS_KEY;
        const secretAccessKey = process.env.s3_ACCESS_SECRET;

        if (!accessKeyId || !secretAccessKey) {
            throw new Error(
                's3_ACCESS_KEY and s3_ACCESS_SECRET must be provided',
            );
        }

        const s3Config = {
            endpoint: endpoint,
            region: 'us-east-1', // RustFS 兼容任意 region
            credentials: {
                accessKeyId: accessKeyId,
                secretAccessKey: secretAccessKey,
            },
            forcePathStyle: true, // 必须启用 Path-style 以兼容 RustFS
            requestHandler: new NodeHttpHandler({
                connectionTimeout: 30000, // 增加连接超时到30秒
                socketTimeout: 60000, // 增加socket超时到60秒
            }),
        };

        this.s3Client = new S3Client(s3Config);
    }

    /**
     * 上传文件到 RustFS 服务器
     * @param path 文件路径
     * @param fileName 文件名
     * @param bucketName 存储桶名
     * @param contentType 文件 MIME 类型
     * @param metaData 自定义元数据
     * @returns 返回文件的 URL 路径
     */
    async uploadFilePromisify(
        path: string,
        fileName: string,
        bucketName: string,
        contentType?: string,
        metaData?: Record<string, string>,
    ): Promise<string> {
        try {
            const fileBuffer = readFileSync(path);

            const command = new PutObjectCommand({
                Bucket: bucketName,
                Key: fileName,
                Body: fileBuffer,
                ContentType: contentType, // 正确设置 Content-Type
                Metadata: metaData, // 自定义元数据
            });

            await this.s3Client.send(command);
            return `/${bucketName}/${fileName}`;
        } catch (error) {
            throw new Error(
                `Failed to upload file: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 上传 Buffer 到 RustFS 服务器
     * @param buffer 文件 Buffer
     * @param objectName 对象名
     * @param bucketName 存储桶名
     * @param contentType 文件 MIME 类型
     * @param metaData 自定义元数据
     * @returns 返回上传操作的结果
     */
    async uploadBufferPromisify(
        buffer: Buffer,
        objectName: string,
        bucketName: string,
        contentType?: string,
        metaData?: Record<string, string>,
    ): Promise<boolean> {
        const command = new PutObjectCommand({
            Bucket: bucketName,
            Key: objectName,
            Body: buffer,
            ContentType: contentType, // 正确设置 Content-Type
            Metadata: metaData, // 自定义元数据
        });

        await this.s3Client.send(command);
        return true;
    }

    /**
     * 从 RustFS 服务器获取文件对象
     * @param bucketName 存储桶名
     * @param objectKey 对象键名
     * @returns 返回文件流
     */
    async getObject(bucketName: string, objectKey: string): Promise<any> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
            });

            const response = await this.s3Client.send(command);
            return response.Body;
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * 从 RustFS 服务器获取文件对象（支持 Range 请求）
     * @param bucketName 存储桶名
     * @param objectKey 对象键名
     * @param range Range 请求字符串，格式如 "bytes=0-1023"
     * @returns 返回包含文件流和元数据的对象
     */
    async getObjectWithRange(
        bucketName: string,
        objectKey: string,
        range?: string,
    ): Promise<{
        body: any;
        contentLength?: number;
        contentRange?: string;
        acceptRanges?: string;
        contentType?: string;
        totalSize?: number;
    }> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
                Range: range, // 传递 Range 参数给 S3
            });

            const response = await this.s3Client.send(command);

            return {
                body: response.Body,
                contentLength: response.ContentLength,
                contentRange: response.ContentRange,
                acceptRanges: response.AcceptRanges,
                contentType: response.ContentType,
                totalSize: response.ContentLength,
            };
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * 从 RustFS 服务器删除文件
     * @param bucketName 存储桶名
     * @param fileNameList 要删除的文件名列表
     * @returns 返回删除文件的操作结果
     */
    async removeFile(
        bucketName: string,
        fileNameList: string[],
    ): Promise<DeletedObject[]> {
        try {
            const command = new DeleteObjectsCommand({
                Bucket: bucketName,
                Delete: {
                    Objects: fileNameList.map((fileName) => ({
                        Key: fileName,
                    })),
                },
            });

            const response = await this.s3Client.send(command);
            return response.Deleted || [];
        } catch (error) {
            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * 大文件分片上传 - 基于本地文件路径进行分片上传
     * 这是标准的 S3 分片上传实现，适用于大文件上传
     * @param filePath 本地文件路径
     * @param fileName 目标文件名
     * @param bucketName 存储桶名
     * @param partSize 分片大小（默认 5MB）
     * @returns 返回上传操作的结果
     */
    async uploadLargeFile(
        filePath: string,
        fileName: string,
        bucketName: string,
        partSize: number = 5 * 1024 * 1024, // 5 MB
    ): Promise<void> {
        let uploadId: string | undefined;
        let fd: number | undefined;

        try {
            // 1. 创建分片上传任务
            const createCommand = new CreateMultipartUploadCommand({
                Bucket: bucketName,
                Key: fileName,
            });

            const createResponse = await this.s3Client.send(createCommand);
            uploadId = createResponse.UploadId;

            if (!uploadId) {
                throw new Error('Failed to create multipart upload');
            }

            // 2. 分段上传
            const fileSize = statSync(filePath).size;
            fd = openSync(filePath, 'r');
            const parts: Array<{ ETag: string; PartNumber: number }> = [];

            for (
                let partNumber = 1, offset = 0;
                offset < fileSize;
                partNumber++
            ) {
                const buffer = Buffer.alloc(
                    Math.min(partSize, fileSize - offset),
                );
                readSync(fd, buffer, 0, buffer.length, offset);

                const uploadPartCommand = new UploadPartCommand({
                    Bucket: bucketName,
                    Key: fileName,
                    UploadId: uploadId,
                    PartNumber: partNumber,
                    Body: buffer,
                });

                const uploadPartResponse =
                    await this.s3Client.send(uploadPartCommand);

                if (!uploadPartResponse.ETag) {
                    throw new Error(`Failed to upload part ${partNumber}`);
                }

                parts.push({
                    ETag: uploadPartResponse.ETag,
                    PartNumber: partNumber,
                });

                offset += partSize;
            }

            closeSync(fd);
            fd = undefined;

            // 3. 完成上传
            const completeCommand = new CompleteMultipartUploadCommand({
                Bucket: bucketName,
                Key: fileName,
                UploadId: uploadId,
                MultipartUpload: { Parts: parts },
            });

            await this.s3Client.send(completeCommand);
        } catch (error) {
            // 清理资源
            if (fd !== undefined) {
                try {
                    closeSync(fd);
                } catch (closeError) {
                    console.error('Failed to close file:', closeError);
                }
            }

            // 如果出错，中止分片上传
            if (uploadId) {
                try {
                    const abortCommand = new AbortMultipartUploadCommand({
                        Bucket: bucketName,
                        Key: fileName,
                        UploadId: uploadId,
                    });
                    await this.s3Client.send(abortCommand);
                } catch (abortError) {
                    console.error(
                        'Failed to abort multipart upload:',
                        abortError,
                    );
                }
            }

            throw error instanceof Error ? error : new Error(String(error));
        }
    }

    /**
     * 生成预签名下载URL
     * @param bucketName 存储桶名
     * @param objectKey 对象键名
     * @param expiresIn 过期时间（秒），默认600秒（10分钟）
     * @returns 返回预签名URL
     */
    async getPresignedDownloadUrl(
        bucketName: string,
        objectKey: string,
        expiresIn: number = 600,
    ): Promise<string> {
        try {
            const command = new GetObjectCommand({
                Bucket: bucketName,
                Key: objectKey,
            });

            const presignedUrl = await getSignedUrl(this.s3Client, command, {
                expiresIn,
            });

            return presignedUrl;
        } catch (error) {
            throw new Error(
                `Failed to generate presigned URL: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }
}
