import { applyDecorators } from '@nestjs/common';
import type { ApiBodyOptions } from '@nestjs/swagger';
import { ApiBody } from '@nestjs/swagger';
import { SchemaObject } from '@nestjs/swagger/dist/interfaces/open-api-spec.interface';
import { z, toJSONSchema } from 'zod/v4';

export const ApiBodies = <T extends z.ZodObject<z.ZodRawShape>>(
    zodObject: T,
    options?: Omit<ApiBodyOptions, 'schema'>,
) => {
    const schema = toJSONSchema(zodObject, {
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
            ctx.jsonSchema.required = Object.keys(zodObject.shape).reduce<
                string[]
            >((acc, key) => {
                const field = zodObject.shape[key];
                if (!field['~standard']) {
                    acc.push(key);
                }
                return acc;
            }, []);
        },
    });

    return applyDecorators(
        ApiBody({
            schema: schema as unknown as SchemaObject,
            // 其他选项
            ...options,
        }),
    );
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
