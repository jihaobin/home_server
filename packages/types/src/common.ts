import { z } from 'zod/v4';

/**
 * API响应状态码枚举
 */
export enum ApiStatusCode {
  /**
   * 成功
   */
  SUCCESS = 0,

  /**
   * 失败
   */
  FAIL = 1,
}

/**
 * 统一API响应接口
 */
export interface ApiResponse<T = unknown> {
  /**
   * 状态码
   * 0表示成功，其他值表示错误
   */
  code: ApiStatusCode | ErrorCode | number;

  /**
   * 消息
   */
  message: string;

  /**
   * 数据
   * 成功时返回实际数据，失败时可能包含错误详情
   */
  data: T;

  /**
   * 时间戳
   */
  timestamp: number;

  /**
   * 请求路径
   * 主要用于错误响应
   */
  path?: string;

  /**
   * 错误堆栈
   * 仅在开发环境下的错误响应中返回
   */
  stack?: string;
}

/**
 * 分页元数据接口
 */
export interface PaginationMeta {
  /**
   * 当前页码
   */
  page: number;

  /**
   * 每页条数
   */
  limit: number;

  /**
   * 总条数
   */
  total: number;

  /**
   * 总页数
   */
  totalPages: number;

  /**
   * 是否有下一页
   */
  hasNext: boolean;

  /**
   * 是否有上一页
   */
  hasPrev: boolean;
}

/**
 * 分页数据接口
 */
export interface PaginatedData<T> {
  /**
   * 数据列表
   */
  items: T[];

  /**
   * 分页元数据
   */
  meta: PaginationMeta;
}

/**
 * 错误代码枚举
 * 用于区分不同类型的错误
 */
export enum ErrorCode {
  // 系统级错误 (1000-1999)
  INTERNAL_ERROR = 1000,
  UNKNOWN_ERROR = 1001,
  SERVICE_UNAVAILABLE = 1002,
  TIMEOUT_ERROR = 1003,
  NETWORK_ERROR = 1004,

  // HTTP错误 (2000-2999)
  BAD_REQUEST = 2000,
  UNAUTHORIZED = 2001,
  FORBIDDEN = 2002,
  NOT_FOUND = 2003,
  METHOD_NOT_ALLOWED = 2004,
  NOT_ACCEPTABLE = 2005,
  REQUEST_TIMEOUT = 2008,
  CONFLICT = 2009,
  GONE = 2010,
  PAYLOAD_TOO_LARGE = 2013,
  UNSUPPORTED_MEDIA_TYPE = 2015,
  TOO_MANY_REQUESTS = 2029,

  // 数据库错误 (3000-3999)
  DATABASE_ERROR = 3000,
  CONNECTION_ERROR = 3001,
  QUERY_ERROR = 3002,
  TRANSACTION_ERROR = 3003,
  CONSTRAINT_ERROR = 3004,
  FOREIGN_KEY_ERROR = 3005,
  UNIQUE_VIOLATION = 3006,
  NOT_NULL_VIOLATION = 3007,

  // 验证错误 (4000-4999)
  VALIDATION_ERROR = 4000,
  INVALID_PAYLOAD = 4001,
  INVALID_PARAM = 4002,
  INVALID_QUERY = 4003,
  INVALID_CREDENTIALS = 4004,

  // 业务逻辑错误 (5000-5999)
  BUSINESS_ERROR = 5000,
  RESOURCE_EXISTS = 5001,
  RESOURCE_NOT_FOUND = 5002,
  OPERATION_FAILED = 5003,
  OPERATION_NOT_ALLOWED = 5004,
  INSUFFICIENT_PERMISSIONS = 5005,

  // 外部服务错误 (6000-6999)
  EXTERNAL_SERVICE_ERROR = 6000,
  API_ERROR = 6001,
  INTEGRATION_ERROR = 6002,
}

export type ErrorCodeType = (typeof ErrorCode)[keyof typeof ErrorCode];

// ============================================================================
// ZOD SCHEMAS
// ============================================================================

/**
 * API响应状态码枚举 Schema
 */
export const ApiStatusCodeSchema = z.enum(ApiStatusCode)
    .meta({
        description: 'API响应状态码枚举',
        enum: {
            SUCCESS: '成功',
            FAIL: '失败'
        }
    });

/**
 * 错误代码枚举 Schema
 */
export const ErrorCodeSchema = z.enum(ErrorCode)
    .meta({
        description: '错误代码枚举，用于区分不同类型的错误',
        examples: [
            '1000-1999(系统级错误)',
            '2000-2999(HTTP错误)',
            '3000-3999(数据库错误)',
            '4000-4999(验证错误)',
            '5000-5999(业务逻辑错误)',
            '6000-6999(外部服务错误)'
        ]
    });

/**
 * 基础响应 Schema
 */
export const BaseResponseSchema = z.object({
    code: z.number()
        .meta({
            description: '状态码，0表示成功，其他值表示错误',
            title: '状态码',
            examples: [0, 1000, 2000]
        }),
    message: z.string()
        .meta({
            description: '消息',
            title: '消息',
            examples: ['操作成功', '系统错误']
        }),
    data: z.any()
        .meta({
            description: '数据，成功时返回实际数据，失败时可能包含错误详情',
            title: '数据'
        }),
    timestamp: z.number()
        .meta({
            description: '时间戳',
            title: '时间戳',
            examples: [1672531200000]
        }),
    path: z.string().optional()
        .meta({
            description: '请求路径，主要用于错误响应',
            title: '请求路径',
            examples: ['/api/address/all']
        }),
    stack: z.string().optional()
        .meta({
            description: '错误堆栈，仅在开发环境下的错误响应中返回',
            title: '错误堆栈'
        })
}).meta({
    title: '基础API响应',
    description: '统一的API响应格式'
});

/**
 * 成功响应 Schema
 */
export const SuccessResponseSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  BaseResponseSchema.extend({
      code: z.literal(ApiStatusCode.SUCCESS).meta({
          description: '成功状态码',
          title: '状态码'
      }),
      data: dataSchema
  }).meta({
      title: '成功响应',
      description: '成功响应 Schema'
  });

/**
 * 错误响应 Schema
 */
export const ErrorResponseSchema = BaseResponseSchema.extend({
    code: z.union([
        ErrorCodeSchema,
    ]).meta({
        description: '错误状态码',
        title: '状态码'
    }),
  error: z.object({
      type: z.string().meta({
          description: '错误类型',
          title: '错误类型'
      }),
      details: z.any().optional().meta({
          description: '错误详情',
          title: '错误详情'
      })
  }).optional()
}).meta({
    title: '错误响应',
    description: '错误响应 Schema'
});

/**
 * 分页元数据 Schema
 */
export const PaginationMetaSchema = z.object({
    page: z.number().min(1)
        .meta({
            description: '当前页码',
            title: '当前页码',
            examples: [1, 2, 3]
        }),
    limit: z.number().min(1).max(100)
        .meta({
            description: '每页条数',
            title: '每页条数',
            examples: [10, 20, 50]
        }),
    total: z.number().min(0)
        .meta({
            description: '总条数',
            title: '总条数',
            examples: [100, 500, 1000]
        }),
    totalPages: z.number().min(0)
        .meta({
            description: '总页数',
            title: '总页数',
            examples: [10, 25, 100]
        }),
    hasNext: z.boolean()
        .meta({
            description: '是否有下一页',
            title: '是否有下一页',
            examples: [true, false]
        }),
    hasPrev: z.boolean()
        .meta({
            description: '是否有上一页',
            title: '是否有上一页',
            examples: [true, false]
        })
}).meta({
    title: '分页元数据',
    description: '分页查询的元数据信息'
});

/**
 * 分页数据 Schema
 */
export const PaginatedDataSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
  z.object({
      items: z.array(itemSchema)
          .meta({
              description: '数据列表',
              title: '数据列表'
          }),
    meta: PaginationMetaSchema
          .meta({
              description: '分页元数据',
              title: '分页元数据'
          })
  }).meta({
      title: '分页数据',
      description: '分页数据 Schema'
  });

/**
 * 分页响应 Schema
 */
export const PaginatedResponseSchema = <T extends z.ZodTypeAny>(itemSchema: T) =>
    SuccessResponseSchema(PaginatedDataSchema(itemSchema))
        .meta({
            title: '分页响应',
            description: '分页响应 Schema'
        });

/**
 * 分页查询参数 Schema
 */
export const PaginationQuerySchema = z.object({
  page: z.string().optional().transform((val) => val ? parseInt(val, 10) : 1).pipe(
    z.number().min(1).max(1000)
    ).meta({
        description: '页码',
        title: '页码',
        examples: [1, 2, 3]
    }),
  limit: z.string().optional().transform((val) => val ? parseInt(val, 10) : 10).pipe(
    z.number().min(1).max(100)
    ).meta({
        description: '每页条数',
        title: '每页条数',
        examples: [10, 20, 50]
    }),
    search: z.string().optional()
        .meta({
            description: '搜索关键字',
            title: '搜索关键字',
            examples: ['北京', '上海']
        }),
    sortBy: z.string().optional()
        .meta({
            description: '排序字段',
            title: '排序字段',
            examples: ['id', 'name', 'created_at']
        }),
    sortOrder: z.enum(['asc', 'desc']).optional().default('desc')
        .meta({
            description: '排序顺序',
            title: '排序顺序',
            examples: ['asc', 'desc']
        })
}).meta({
    title: '分页查询参数',
    description: '通用分页查询参数'
});

// ============================================================================
// TYPE EXPORTS
// ============================================================================

// Zod-inferred types
export type ZodApiStatusCode = z.infer<typeof ApiStatusCodeSchema>;
export type ZodErrorCode = z.infer<typeof ErrorCodeSchema>;
export type ZodBaseResponse = z.infer<typeof BaseResponseSchema>;
export type ZodErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type ZodPaginationMeta = z.infer<typeof PaginationMetaSchema>;
export type ZodPaginatedData<T = unknown> = z.infer<ReturnType<typeof PaginatedDataSchema<z.ZodObject<any>>>>;
export type ZodPaginationQuery = z.infer<typeof PaginationQuerySchema>;
