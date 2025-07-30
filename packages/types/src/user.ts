// ============================================================================
// USER SCHEMAS
// ============================================================================

import z from "zod/v4";

/**
 * 用户角色枚举
 */
export const UserRoleEnum = z.enum(['user', 'admin', 'teacher']).openapi({
  description: '用户角色',
  example: 'user'
});

/**
 * 用户基础信息 Schema
 */
export const UserSchema = z.object({
  id: z.string().openapi({
    description: '用户ID',
    example: 'user_123abc'
  }),
  name: z.string().min(1).max(100).openapi({
    description: '用户姓名',
    example: '张三'
  }),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).openapi({
    description: '邮箱地址',
    example: 'zhangsan@example.com'
  }),
  emailVerified: z.boolean().openapi({
    description: '邮箱是否已验证',
    example: true
  }),
  image: z.string().regex(/^https?:\/\/.+/).nullable().openapi({
    description: '头像URL',
    example: 'https://example.com/avatar.jpg'
  }),
  role: UserRoleEnum.default('user'),
  createdAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/).openapi({
    description: '创建时间',
    example: '2024-01-01T00:00:00Z'
  }),
  updatedAt: z.string().regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d{3})?Z?$/).openapi({
    description: '更新时间',
    example: '2024-01-01T00:00:00Z'
  })
}).openapi('User');

/**
 * 用户公开信息 Schema（不包含敏感信息）
 */
export const UserPublicSchema = UserSchema.omit({
  email: true,
  emailVerified: true
}).openapi('UserPublic');

/**
 * 当前用户信息 Schema
 */
export const CurrentUserSchema = UserSchema.openapi('CurrentUser');

/**
 * 用户创建请求 Schema
 */
export const CreateUserSchema = z.object({
  name: z.string().min(1).max(100).openapi({
    description: '用户姓名',
    example: '张三'
  }),
  email: z.string().regex(/^[^\s@]+@[^\s@]+\.[^\s@]+$/).openapi({
    description: '邮箱地址',
    example: 'zhangsan@example.com'
  }),
  password: z.string().min(6).max(100).openapi({
    description: '密码（至少6位）',
    example: 'password123'
  }),
  role: UserRoleEnum.optional().default('user')
}).openapi('CreateUser');

/**
 * 用户更新请求 Schema
 */
export const UpdateUserSchema = z.object({
  name: z.string().min(1).max(100).optional().openapi({
    description: '用户姓名',
    example: '李四'
  }),
  image: z.string().regex(/^https?:\/\/.+/).nullable().optional().openapi({
    description: '头像URL',
    example: 'https://example.com/new-avatar.jpg'
  }),
  role: UserRoleEnum.optional().openapi({
    description: '用户角色（仅管理员可修改）'
  })
}).openapi('UpdateUser');

/**
 * 用户查询参数 Schema
 */
export const UserQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1).pipe(
    z.number().min(1).max(1000)
  ).openapi({
    description: '页码',
    example: '1'
  }),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10).pipe(
    z.number().min(1).max(100)
  ).openapi({
    description: '每页数量',
    example: '10'
  }),
  search: z.string().optional().openapi({
    description: '搜索关键词（姓名或邮箱）',
    example: '张三'
  }),
  role: UserRoleEnum.optional().openapi({
    description: '按角色筛选'
  }),
  emailVerified: z.string().optional().transform((val) => {
    if (val === 'true') return true;
    if (val === 'false') return false;
    return undefined;
  }).pipe(z.boolean().optional()).openapi({
    description: '按邮箱验证状态筛选',
    example: 'true'
  }),
  sortBy: z.enum(['name', 'email', 'createdAt', 'updatedAt']).optional().default('createdAt').openapi({
    description: '排序字段',
    example: 'createdAt'
  }),
  sortOrder: z.enum(['asc', 'desc']).optional().default('desc').openapi({
    description: '排序方向',
    example: 'desc'
  })
}).openapi('UserQuery');

/**
 * 用户统计信息 Schema
 */
export const UserStatsSchema = z.object({
  totalUsers: z.number().openapi({
    description: '总用户数',
    example: 1000
  }),
  activeUsers: z.number().openapi({
    description: '活跃用户数',
    example: 800
  }),
  newUsersThisMonth: z.number().openapi({
    description: '本月新增用户数',
    example: 50
  }),
  usersByRole: z.record(UserRoleEnum, z.number()).openapi({
    description: '按角色分组的用户数',
    example: {
      user: 900,
      teacher: 80,
      admin: 20
    }
  })
}).openapi('UserStats');


// User types (inferred from Zod schemas)
export type User = z.infer<typeof UserSchema>;
export type UserPublic = z.infer<typeof UserPublicSchema>;
export type CurrentUser = z.infer<typeof CurrentUserSchema>;
export type CreateUser = z.infer<typeof CreateUserSchema>;
export type UpdateUser = z.infer<typeof UpdateUserSchema>;
export type UserQuery = z.infer<typeof UserQuerySchema>;
export type UserStats = z.infer<typeof UserStatsSchema>;
export type UserRole = z.infer<typeof UserRoleEnum>;
