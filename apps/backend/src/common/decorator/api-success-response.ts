import { applyDecorators } from '@nestjs/common';
import { ApiResponse } from '@nestjs/swagger';
import { z, toJSONSchema } from 'zod/v4';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { SuccessResponseSchema, PaginatedResponseSchema } from '@repo/types';

/**
 * 成功响应装饰器选项
 */
export interface ApiSuccessResponseOptions {
    /**
     * HTTP状态码，默认200
     */
    status?: number;

    /**
     * 响应描述
     */
    description?: string;

    /**
     * 是否为分页响应
     */
    isPaginated?: boolean;

    /**
     * 响应示例
     */
    example?: unknown;
}

/**
 * API成功响应装饰器
 * 自动包装数据到统一的成功响应格式中
 *
 * @param dataSchema - 数据的Zod Schema
 * @param options - 装饰器选项
 */
export function ApiSuccessResponse<T extends z.ZodTypeAny>(
    dataSchema: T,
    options: ApiSuccessResponseOptions = {},
) {
    const {
        status = 200,
        description = '操作成功',
        isPaginated = false,
        example,
    } = options;

    // 选择合适的响应Schema
    const responseSchema = isPaginated
        ? PaginatedResponseSchema(dataSchema as any)
        : SuccessResponseSchema(dataSchema as any);

    // 转换为JSON Schema
    const jsonSchema = toJSONSchema(responseSchema, {
        metadata: z.globalRegistry,
        unrepresentable: 'any',
        override(ctx) {
            const def = ctx.zodSchema._zod.def;
            const meta = (ctx.zodSchema as unknown as z.ZodTypeAny).meta();
            if (def.type === 'date') {
                ctx.jsonSchema.type = 'string';
                ctx.jsonSchema.format = 'date-time';
            }
            ctx.jsonSchema.title = meta?.title;
            ctx.jsonSchema.description = meta?.description;
            ctx.jsonSchema.examples = meta?.examples as string[];
        },
    }) as SchemaObject;

    // 如果提供了示例，添加到schema中
    if (example) {
        const schemaWithExample = jsonSchema as Record<string, unknown>;
        schemaWithExample.example = example;
    }

    return applyDecorators(
        ApiResponse({
            status,
            description,
            schema: jsonSchema,
        }),
    );
}

/**
 * API分页响应装饰器
 * 专门用于分页数据的响应
 *
 * @param itemSchema - 单个数据项的Zod Schema
 * @param options - 装饰器选项
 */
export function ApiPaginatedResponse<T extends z.ZodTypeAny>(
    itemSchema: T,
    options: Omit<ApiSuccessResponseOptions, 'isPaginated'> = {},
) {
    return ApiSuccessResponse(itemSchema, {
        ...options,
        isPaginated: true,
        description: options.description || '分页查询成功',
    });
}

/**
 * API简单成功响应装饰器
 * 用于不需要返回具体数据的成功响应
 *
 * @param options - 装饰器选项
 */
export function ApiSimpleSuccessResponse(
    options: Omit<ApiSuccessResponseOptions, 'isPaginated'> = {},
) {
    return ApiSuccessResponse(z.null(), {
        ...options,
        description: options.description || '操作成功',
    });
}

/**
 * 通用错误响应装饰器
 * 用于定义各种错误状态的响应
 */
export function ApiErrorResponses() {
    return applyDecorators(
        ApiResponse({
            status: 400,
            description: '请求参数错误',
            schema: {
                type: 'object',
                properties: {
                    code: { type: 'number', example: 2000 },
                    message: { type: 'string', example: '请求参数错误' },
                    data: { type: 'null' },
                    timestamp: { type: 'number', example: Date.now() },
                    path: { type: 'string', example: '/api/address/all' },
                },
            },
        }),
        ApiResponse({
            status: 401,
            description: '未授权',
            schema: {
                type: 'object',
                properties: {
                    code: { type: 'number', example: 2001 },
                    message: { type: 'string', example: '未授权访问' },
                    data: { type: 'null' },
                    timestamp: { type: 'number', example: Date.now() },
                    path: { type: 'string', example: '/api/address/all' },
                },
            },
        }),
        ApiResponse({
            status: 500,
            description: '服务器内部错误',
            schema: {
                type: 'object',
                properties: {
                    code: { type: 'number', example: 1000 },
                    message: { type: 'string', example: '服务器内部错误' },
                    data: { type: 'null' },
                    timestamp: { type: 'number', example: Date.now() },
                    path: { type: 'string', example: '/api/address/all' },
                },
            },
        }),
    );
}
