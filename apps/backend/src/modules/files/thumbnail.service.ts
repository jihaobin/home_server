import { Injectable } from '@nestjs/common';
import { encode } from 'blurhash';
import * as sharp from 'sharp';

/**
 * BlurHash 配置
 */
export interface BlurHashConfig {
    componentX?: number; // X轴组件数量，默认 4
    componentY?: number; // Y轴组件数量，默认 3
    resizeWidth?: number; // 处理前缩放宽度，默认 32（提高性能）
    resizeHeight?: number; // 处理前缩放高度，默认 32（提高性能）
}

/**
 * BlurHash 默认配置
 */
export const DEFAULT_BLURHASH_CONFIG: Required<BlurHashConfig> = {
    componentX: 4,
    componentY: 3,
    resizeWidth: 32,
    resizeHeight: 32,
};

/**
 * BlurHash 服务
 * 负责为图片生成 BlurHash 占位符字符串
 */
@Injectable()
export class ThumbnailService {
    /**
     * 检查文件类型是否支持 BlurHash 生成
     */
    isThumbnailSupported(mimeType: string): boolean {
        const supportedTypes = [
            'image/jpeg',
            'image/jpg',
            'image/png',
            'image/webp',
            'image/gif',
            'image/bmp',
            'image/tiff',
        ];
        return supportedTypes.includes(mimeType);
    }

    /**
     * 生成 BlurHash 字符串
     * @param imageBuffer 原始图片 Buffer
     * @param config BlurHash 配置
     * @returns BlurHash 字符串
     */
    async generateBlurHash(
        imageBuffer: Buffer,
        config: BlurHashConfig = {},
    ): Promise<string> {
        try {
            const {
                componentX = DEFAULT_BLURHASH_CONFIG.componentX,
                componentY = DEFAULT_BLURHASH_CONFIG.componentY,
                resizeWidth = DEFAULT_BLURHASH_CONFIG.resizeWidth,
                resizeHeight = DEFAULT_BLURHASH_CONFIG.resizeHeight,
            } = config;

            // 将图片转换为 raw 格式的 Buffer
            // 为了提高性能，先将图片缩小到较小的尺寸
            const { data, info } = await sharp(imageBuffer)
                .resize(resizeWidth, resizeHeight, {
                    fit: 'inside',
                })
                .ensureAlpha()
                .raw()
                .toBuffer({
                    resolveWithObject: true,
                });

            // 使用 blurhash 库生成哈希
            const blurhash = encode(
                new Uint8ClampedArray(data),
                info.width,
                info.height,
                componentX,
                componentY,
            );

            return blurhash;
        } catch (error) {
            throw new Error(
                `生成 BlurHash 失败: ${error instanceof Error ? error.message : String(error)}`,
            );
        }
    }

    /**
     * 获取图片元数据
     * @param imageBuffer 图片 Buffer
     * @returns 图片元数据
     */
    async getImageMetadata(imageBuffer: Buffer): Promise<sharp.Metadata> {
        return await sharp(imageBuffer).metadata();
    }

    /**
     * 验证图片是否有效
     * @param imageBuffer 图片 Buffer
     * @returns 是否有效
     */
    async isValidImage(imageBuffer: Buffer): Promise<boolean> {
        try {
            await sharp(imageBuffer).metadata();
            return true;
        } catch {
            return false;
        }
    }
}
