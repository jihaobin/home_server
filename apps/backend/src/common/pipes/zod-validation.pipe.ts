import { ArgumentMetadata, Injectable, PipeTransform } from '@nestjs/common';
import { z, ZodError } from 'zod/v4';

import { createValidationException } from '../validation';

/**
 * 通用Zod验证管道
 * 用于验证请求参数（body, query, params等）
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
    /**
     * @param schema - Zod验证模式
     * @param errorMessage - 自定义错误消息
     */
    constructor(
        private readonly schema: z.ZodType,
        private readonly errorMessage: string = '请求参数验证失败',
    ) {}

    /**
     * 管道转换方法
     *
     * @param value - 输入值
     * @param metadata - 元数据
     * @returns 验证并可能转换后的值
     */
    transform(value: unknown, metadata: ArgumentMetadata) {
        try {
            // 对空对象的特殊处理
            if (
                metadata.type === 'body' &&
                typeof value === 'object' &&
                Object.keys(value as object).length === 0
            ) {
                value = {}; // 确保空对象也被正确处理
            }

            // 对查询参数进行预处理
            if (metadata.type === 'query') {
                value = this.preprocessQueryParams(value);
            }

            console.log('校验之前的值', value);

            // 使用schema验证并转换值
            return this.schema.parse(value);
        } catch (error) {
            if (error instanceof ZodError) {
                // 抛出ValidationException，与系统的错误处理集成
                throw createValidationException(error, this.errorMessage);
            }

            // 非Zod错误直接抛出
            throw error;
        }
    }

    /**
     * 预处理查询参数
     * 将字符串转换为适当的类型
     */
    private preprocessQueryParams(params: any): any {
        if (!params || typeof params !== 'object') {
            return params;
        }

        const processed: any = {};

        for (const [key, value] of Object.entries(params)) {
            if (value === undefined || value === null) {
                processed[key] = value;
                continue;
            }

            if (typeof value === 'string') {
                // 尝试转换布尔值
                if (value === 'true') {
                    processed[key] = true;
                } else if (value === 'false') {
                    processed[key] = false;
                } else if (value === '') {
                    // 空字符串转换为 undefined
                    processed[key] = undefined;
                } else {
                    processed[key] = value;
                }
            } else {
                processed[key] = value;
            }
        }

        return processed;
    }
}

/**
 * 创建 Zod 验证管道的工厂函数
 * @param schema Zod schema
 * @param errorMessage 自定义错误消息
 * @returns ZodValidationPipe 实例
 */
export const createZodPipe = (schema: z.ZodType, errorMessage?: string) =>
    new ZodValidationPipe(schema, errorMessage);
