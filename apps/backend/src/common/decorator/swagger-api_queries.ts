import { applyDecorators } from '@nestjs/common';
import type { ApiQueryOptions } from '@nestjs/swagger';
import { ApiQuery } from '@nestjs/swagger';
import { z, toJSONSchema } from 'zod/v4';

export const ApiQueries = <T extends z.ZodObject<z.ZodRawShape>>(
    zodObject: T,
    options?: Omit<ApiQueryOptions, 'schema'>,
) => {
    const optionsList = Object.keys(zodObject.shape).reduce<
        Array<ApiQueryOptions & { schema: ReturnType<typeof toJSONSchema> }>
    >((acc, name) => {
        const zodType = zodObject.shape[name] as z.ZodTypeAny;

        // 获取字段的元数据
        let metadata: Record<string, any> | undefined;
        try {
            // 安全地调用 meta() 方法
            if (typeof zodType.meta === 'function') {
                metadata = zodType.meta();
            }
        } catch {
            // 如果获取元数据失败，继续执行但不添加元数据
            metadata = undefined;
        }

        if (zodType) {
            acc.push({
                name,
                required: zodType.safeParse(undefined).success,
                schema: z.toJSONSchema(zodType) as unknown as ReturnType<
                    typeof toJSONSchema
                >,
                // 如果元数据中有描述信息，可以添加到选项中
                ...(metadata?.description
                    ? { description: metadata.description as string }
                    : {}),
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
