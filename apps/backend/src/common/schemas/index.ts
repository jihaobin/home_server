/**
 * Schema 统一导出文件
 * 在 API 项目中重新定义 schemas，确保 OpenAPI 扩展正常工作
 */

import { z } from 'zod';
import { extendZodWithOpenApi } from '@asteasolutions/zod-to-openapi';

// 确保 Zod 扩展
extendZodWithOpenApi(z);

// 从共享包导入类型定义（仅类型，不导入 schemas）
import {
    type User,
    type UserPublic,
    type CurrentUser,
    type CreateUser,
    type UpdateUser,
    type UserQuery,
    type UserStats,
    type UserRole,
    BaseResponseSchema,
    ErrorResponseSchema,
    PaginationMetaSchema,
    UserSchema,
    UserPublicSchema,
    CreateUserSchema,
    CurrentUserSchema,
    PaginationQuerySchema,
    UpdateUserSchema,
    UserQuerySchema,
    UserRoleEnum,
    UserStatsSchema,
} from '@repo/types';

// 重新导出类型以确保兼容性
export type {
    User,
    UserPublic,
    CurrentUser,
    CreateUser,
    UpdateUser,
    UserQuery,
    UserStats,
    UserRole,
};

import { SwaggerConfig } from '../swagger/swagger.config';

/**
 * 注册所有 schemas 到 OpenAPI registry
 * 这样可以在 Swagger 文档中引用这些 schemas
 */
export function registerAllSchemas() {
    // 注册基础 schemas
    SwaggerConfig.registerSchema('BaseResponse', BaseResponseSchema);
    SwaggerConfig.registerSchema('ErrorResponse', ErrorResponseSchema);
    SwaggerConfig.registerSchema('PaginationMeta', PaginationMetaSchema);
    SwaggerConfig.registerSchema('PaginationQuery', PaginationQuerySchema);

    // 注册用户相关 schemas
    SwaggerConfig.registerSchema('User', UserSchema);
    SwaggerConfig.registerSchema('UserPublic', UserPublicSchema);
    SwaggerConfig.registerSchema('CurrentUser', CurrentUserSchema);
    SwaggerConfig.registerSchema('CreateUser', CreateUserSchema);
    SwaggerConfig.registerSchema('UpdateUser', UpdateUserSchema);
    SwaggerConfig.registerSchema('UserQuery', UserQuerySchema);
    SwaggerConfig.registerSchema('UserStats', UserStatsSchema);
    SwaggerConfig.registerSchema('UserRole', UserRoleEnum);

    console.log('✅ 所有 Zod schemas 已注册到 OpenAPI registry（本地定义）');
}

/**
 * Schema 验证工具函数
 */
export { createZodPipe } from '../pipes/zod-validation.pipe';

/**
 * 装饰器
 */
export * from '../decorators/api-zod.decorator';
