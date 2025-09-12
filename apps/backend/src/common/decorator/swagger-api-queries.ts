import { applyDecorators } from '@nestjs/common';
import type { ApiQueryOptions } from '@nestjs/swagger';
import { ApiQuery } from '@nestjs/swagger';
import { z } from 'zod/v4';
import type { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';

// 将 JSONSchema 转换为 OpenAPI SchemaObject
const convertToSchemaObject = (jsonSchema: any): SchemaObject => {
    const { $schema, ...schemaObject } = jsonSchema;
    return schemaObject as SchemaObject;
};

export const ApiQueries = <T extends z.ZodObject<z.ZodRawShape>>(
    zodObject: T,
    options?: Omit<ApiQueryOptions, 'schema'>,
) => {
    const optionsList = Object.keys(zodObject.shape).reduce<
        Array<ApiQueryOptions>
    >((acc, name) => {
        const zodType = zodObject.shape[name] as z.ZodTypeAny;

        if (zodType) {
            const jsonSchema = z.toJSONSchema(zodType, {
                metadata: z.globalRegistry,
                unrepresentable: 'any',
                override(ctx) {
                    const def = ctx.zodSchema._zod.def;
                    const meta = (
                        ctx.zodSchema as unknown as z.ZodTypeAny
                    ).meta();
                    if (def.type === 'date') {
                        ctx.jsonSchema.type = 'string';
                        ctx.jsonSchema.format = 'date-time';
                    }
                    ctx.jsonSchema.title = meta?.title;
                    ctx.jsonSchema.description = meta?.description;
                    ctx.jsonSchema.examples = meta?.examples as string[];
                    ctx.jsonSchema.required = Object.keys(
                        zodObject.shape,
                    ).reduce<string[]>((acc, key) => {
                        const field = zodObject.shape[key];
                        if (!field['~standard']) {
                            acc.push(key);
                        }
                        return acc;
                    }, []);
                },
            });

            acc.push({
                name,
                required: zodType.isOptional() ? false : true,
                schema: convertToSchemaObject(jsonSchema),
                ...options,
            });
        }

        return acc;
    }, []);

    return applyDecorators(...optionsList.map((options) => ApiQuery(options)));
};

// 使用示例:
/*
const UserQuerySchema = z.object({
  name: z.string().meta({ description: '用户姓名' }),
  email: z.string().email().meta({ description: '用户邮箱' }),
  age: z.number().min(18).meta({ description: '用户年龄' }),
});

// 在控制器中使用
@ApiQueries(UserQuerySchema)
@Get('users')
findAllUsers() {
  // ...
}
*/
