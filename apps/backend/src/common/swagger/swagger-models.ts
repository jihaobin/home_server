import { z, toJSONSchema } from 'zod/v4';
import { OpenAPIObject } from '@nestjs/swagger';
import * as allTypes from '@repo/types';

// 定义 JSON Schema 的基本结构
interface JSONSchemaObject {
    type?: string;
    format?: string;
    title?: string;
    description?: string;
    examples?: any[];
    properties?: Record<string, any>;
    [key: string]: any;
}

/**
 * 标准的 Zod Schema 转换函数
 * 封装常用的转换逻辑，减少 any 类型的使用
 */
function convertZodToJSONSchema(
    schema: z.ZodTypeAny,
    options: {
        includeMetadata?: boolean;
        handleDateFormat?: boolean;
    } = {},
): JSONSchemaObject {
    const { includeMetadata = true, handleDateFormat = true } = options;

    return toJSONSchema(schema, {
        metadata: z.globalRegistry,
        unrepresentable: 'any' as const,
        override(ctx) {
            const def = ctx.zodSchema._zod?.def;

            const meta = (ctx.zodSchema as unknown as z.ZodTypeAny).meta();
            // 处理日期类型

            if (handleDateFormat && def?.type === 'date') {
                ctx.jsonSchema.type = 'string';

                ctx.jsonSchema.format = 'date-time';
            }

            // 添加元数据
            if (includeMetadata && meta) {
                if (meta.title) {
                    ctx.jsonSchema.title = meta.title;
                }

                if (meta.description) {
                    ctx.jsonSchema.description = meta.description;
                }

                if (meta.examples) {
                    ctx.jsonSchema.examples = meta.examples as string[];
                }
            }
        },
    }) as JSONSchemaObject;
}

/**
 * 全局模型定义
 * 用于在Swagger文档中展示公共的数据模型
 */
export class SwaggerModels {
    /**
     * 自动加载所有Schema的方法
     * 扫描@repo/types中所有以Schema结尾的导出项
     */
    static loadAllSchemas() {
        const schemas: Record<string, JSONSchemaObject> = {};

        // 获取所有导出的Schema
        const schemaEntries = Object.entries(allTypes).filter(
            ([key, value]) => {
                return (
                    key.endsWith('Schema') &&
                    value &&
                    typeof value === 'object' &&
                    '_zod' in value
                );
            },
        );

        console.log(`正在加载 ${schemaEntries.length} 个Schema...`);

        for (const [schemaName, schema] of schemaEntries) {
            try {
                // 跳过函数类型的Schema（如SuccessResponseSchema）
                if (typeof schema === 'function') {
                    continue;
                }

                // 转换Schema名称（移除Schema后缀，转换为PascalCase）
                const modelName = schemaName.replace(/Schema$/, '');

                // 使用标准转换函数
                schemas[modelName] = convertZodToJSONSchema(
                    schema as z.ZodTypeAny,
                );

                console.log(`✓ 已加载: ${modelName}`);
            } catch (error) {
                console.warn(`× 跳过 ${schemaName}: ${error}`);
            }
        }

        console.log(`Schema加载完成，共 ${Object.keys(schemas).length} 个模型`);
        return schemas;
    }

    /**
     * 获取所有公共模型的定义
     * 用于添加到OpenAPI文档的components.schemas中
     */
    static getGlobalSchemas() {
        // 创建示例schema用于展示
        const exampleStringSchema = z.string().meta({
            title: '示例字符串',
            description: '这是一个示例字符串字段',
        });

        return {
            // 基础响应模型
            BaseResponse: convertZodToJSONSchema(allTypes.BaseResponseSchema),

            // 成功响应模型 (使用字符串作为示例数据类型)
            SuccessResponse: convertZodToJSONSchema(
                allTypes.SuccessResponseSchema(exampleStringSchema),
            ),

            // 错误响应模型
            ErrorResponse: convertZodToJSONSchema(allTypes.ErrorResponseSchema),

            // 分页元数据模型
            PaginationMeta: convertZodToJSONSchema(
                allTypes.PaginationMetaSchema,
            ),

            // 分页数据模型 (使用字符串作为示例数据类型)
            PaginatedData: convertZodToJSONSchema(
                allTypes.PaginatedDataSchema(exampleStringSchema),
            ),

            // 分页响应模型
            PaginatedResponse: convertZodToJSONSchema(
                allTypes.PaginatedResponseSchema(exampleStringSchema),
            ),

            // 分页查询参数模型
            PaginationQuery: convertZodToJSONSchema(
                allTypes.PaginationQuerySchema,
            ),

            // API状态码枚举
            ApiStatusCode: convertZodToJSONSchema(allTypes.ApiStatusCodeSchema),

            // 错误代码枚举
            ErrorCode: convertZodToJSONSchema(allTypes.ErrorCodeSchema),

            // 自动加载的所有Schema
            ...this.loadAllSchemas(),
        };
    }

    /**
     * 将公共模型添加到OpenAPI文档中
     *
     * @param document - OpenAPI文档对象
     */
    static addToDocument(document: OpenAPIObject) {
        if (!document.components || document.components === null) {
            document.components = {};
        }
        if (
            !document.components.schemas ||
            document.components.schemas === null
        ) {
            document.components.schemas = {};
        }

        const schemas = this.getGlobalSchemas();
        Object.assign(document.components.schemas, schemas);

        return document;
    }
}
