import { applyDecorators } from '@nestjs/common';
import {
    ApiOperation,
    ApiResponse,
    ApiQuery,
    ApiParam,
    ApiBody,
    ApiCookieAuth,
    ApiTags,
} from '@nestjs/swagger';
import { z } from 'zod/v4';
import { SwaggerConfig } from '../swagger/swagger.config';

/**
 * API 操作装饰器配置接口
 */
interface ApiZodOperationOptions {
    summary: string;
    description?: string;
    tags?: string[];
    auth?: 'cookie' | false;
}

/**
 * API 响应装饰器配置接口
 */
interface ApiZodResponseOptions {
    status: number;
    description: string;
    schema?: z.ZodTypeAny;
    isArray?: boolean;
}

/**
 * API 查询参数装饰器配置接口
 */
interface ApiZodQueryOptions {
    schema: z.ZodTypeAny;
    description?: string;
}

/**
 * API 路径参数装饰器配置接口
 */
interface ApiZodParamOptions {
    name: string;
    schema: z.ZodTypeAny;
    description?: string;
}

/**
 * API 请求体装饰器配置接口
 */
interface ApiZodBodyOptions {
    schema: z.ZodTypeAny;
    description?: string;
}

/**
 * 将 Zod schema 转换为 Swagger 类型定义
 */
function zodToSwaggerType(schema: z.ZodTypeAny): any {
    // 注册 schema 到 OpenAPI registry
    const schemaName = `Schema_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    SwaggerConfig.registerSchema(schemaName, schema);

    return { $ref: `#/components/schemas/${schemaName}` };
}

/**
 * API 操作装饰器
 * 用于定义 API 操作的基本信息
 */
export function ApiZodOperation(options: ApiZodOperationOptions) {
    const decorators = [
        ApiOperation({
            summary: options.summary,
            description: options.description,
        }),
    ];

    // 添加标签
    if (options.tags && options.tags.length > 0) {
        decorators.push(ApiTags(...options.tags));
    }

    // 添加 Cookie 认证装饰器
    if (options.auth === 'cookie') {
        decorators.push(ApiCookieAuth('session'));
    }

    return applyDecorators(...decorators);
}

/**
 * API 响应装饰器
 * 用于定义 API 响应的结构
 */
export function ApiZodResponse(options: ApiZodResponseOptions) {
    const responseOptions: any = {
        status: options.status,
        description: options.description,
    };

    if (options.schema) {
        if (options.isArray) {
            responseOptions.schema = {
                type: 'array',
                items: zodToSwaggerType(options.schema),
            };
        } else {
            responseOptions.schema = zodToSwaggerType(options.schema);
        }
    }

    return ApiResponse(responseOptions);
}

/**
 * API 查询参数装饰器
 * 用于定义查询参数的验证规则
 */
export function ApiZodQuery(options: ApiZodQueryOptions) {
    const decorators: any[] = [];

    // 如果是对象类型，为每个属性创建查询参数
    if (options.schema instanceof z.ZodObject) {
        const shape = options.schema.shape;
        Object.keys(shape).forEach((key) => {
            const fieldSchema = shape[key];
            const type = 'string';
            let required = true;
            let description = options.description || `${key} parameter`;

            // 检查是否为可选字段
            if (
                fieldSchema instanceof z.ZodOptional ||
                fieldSchema instanceof z.ZodDefault
            ) {
                required = false;
            }

            // 尝试从 OpenAPI 元数据获取描述
            if (
                fieldSchema._def &&
                fieldSchema._def.openapi &&
                fieldSchema._def.openapi.metadata
            ) {
                description =
                    fieldSchema._def.openapi.metadata.description ||
                    description;
            }

            decorators.push(
                ApiQuery({
                    name: key,
                    type,
                    required,
                    description,
                }),
            );
        });
    }

    return applyDecorators(...decorators);
}

/**
 * API 路径参数装饰器
 * 用于定义路径参数的验证规则
 */
export function ApiZodParam(options: ApiZodParamOptions) {
    return ApiParam({
        name: options.name,
        description: options.description || `${options.name} parameter`,
        schema: zodToSwaggerType(options.schema),
    });
}

/**
 * API 请求体装饰器
 * 用于定义请求体的验证规则
 */
export function ApiZodBody(options: ApiZodBodyOptions) {
    return ApiBody({
        description: options.description || 'Request body',
        schema: zodToSwaggerType(options.schema),
    });
}

/**
 * 组合装饰器：完整的 API 端点定义
 */
export function ApiZodEndpoint(options: {
    operation: ApiZodOperationOptions;
    responses: ApiZodResponseOptions[];
    query?: ApiZodQueryOptions;
    params?: ApiZodParamOptions[];
    body?: ApiZodBodyOptions;
}) {
    const decorators = [
        ApiZodOperation(options.operation),
        ...options.responses.map((response) => ApiZodResponse(response)),
    ];

    if (options.query) {
        decorators.push(ApiZodQuery(options.query));
    }

    if (options.params) {
        decorators.push(...options.params.map((param) => ApiZodParam(param)));
    }

    if (options.body) {
        decorators.push(ApiZodBody(options.body));
    }

    return applyDecorators(...decorators);
}

/**
 * 快捷装饰器：GET 请求
 */
export function ApiZodGet(options: {
    summary: string;
    description?: string;
    responseSchema: z.ZodTypeAny;
    querySchema?: z.ZodTypeAny;
    auth?: 'cookie' | false;
}) {
    const decorators = [
        ApiZodOperation({
            summary: options.summary,
            description: options.description,
            auth: options.auth,
        }),
        ApiZodResponse({
            status: 200,
            description: 'Success',
            schema: options.responseSchema,
        }),
    ];

    if (options.querySchema) {
        decorators.push(
            ApiZodQuery({
                schema: options.querySchema,
            }),
        );
    }

    return applyDecorators(...decorators);
}

/**
 * 快捷装饰器：POST 请求
 */
export function ApiZodPost(options: {
    summary: string;
    description?: string;
    bodySchema: z.ZodTypeAny;
    responseSchema: z.ZodTypeAny;
    auth?: 'cookie' | false;
}) {
    return applyDecorators(
        ApiZodOperation({
            summary: options.summary,
            description: options.description,
            auth: options.auth,
        }),
        ApiZodBody({
            schema: options.bodySchema,
        }),
        ApiZodResponse({
            status: 201,
            description: 'Created',
            schema: options.responseSchema,
        }),
        ApiZodResponse({
            status: 400,
            description: 'Bad Request',
        }),
    );
}
