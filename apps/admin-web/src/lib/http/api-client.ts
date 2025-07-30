import { ofetch, type FetchOptions } from 'ofetch';
import { z } from 'zod/v4';
import {
  type ApiResponse,
  ApiStatusCode,
  ErrorCode,
  BaseResponseSchema,
} from '@repo/types';

/**
 * 检测是否在服务端环境
 */
function isServerEnvironment(): boolean {
  return typeof window === 'undefined';
}

/**
 * 获取Next.js服务端headers（仅在服务端环境中可用）
 */
async function getServerHeaders(): Promise<Record<string, string> | undefined> {
  if (!isServerEnvironment()) {
    return undefined;
  }

  try {
    // 动态导入Next.js的headers函数，避免在客户端环境中出错
    const { headers } = await import('next/headers');
    const headersList = await headers();

    // 将Headers对象转换为普通对象
    const headersObj: Record<string, string> = {};
    headersList.forEach((value, key) => {
      headersObj[key] = value;
    });

    return headersObj;
  } catch (error) {
    console.warn('Failed to get server headers:', error);
    return undefined;
  }
}

/**
 * API客户端配置选项
 */
export interface ApiClientOptions extends Omit<FetchOptions, 'method' | 'body'> {
  /**
   * API基础URL
   */
  baseURL?: string;

  /**
   * 默认超时时间（毫秒）
   */
  timeout?: number;

  /**
   * 是否在开发环境下打印请求日志
   */
  debug?: boolean;
}

/**
 * API请求选项
 */
export interface ApiRequestOptions<T = unknown> extends Omit<FetchOptions, 'method'> {
  /**
   * 响应数据的Zod schema，用于数据验证
   */
  schema?: z.ZodSchema<T>;

  /**
   * 是否跳过响应数据验证
   */
  skipValidation?: boolean;
}

/**
 * HTTP状态码到错误代码的映射
 */
const HTTP_STATUS_TO_ERROR_CODE: Record<number, ErrorCode> = {
  400: ErrorCode.BAD_REQUEST,
  401: ErrorCode.UNAUTHORIZED,
  403: ErrorCode.FORBIDDEN,
  404: ErrorCode.NOT_FOUND,
  405: ErrorCode.METHOD_NOT_ALLOWED,
  406: ErrorCode.NOT_ACCEPTABLE,
  408: ErrorCode.REQUEST_TIMEOUT,
  409: ErrorCode.CONFLICT,
  410: ErrorCode.GONE,
  413: ErrorCode.PAYLOAD_TOO_LARGE,
  415: ErrorCode.UNSUPPORTED_MEDIA_TYPE,
  429: ErrorCode.TOO_MANY_REQUESTS,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.SERVICE_UNAVAILABLE,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.TIMEOUT_ERROR,
};

/**
 * 创建错误响应
 */
function createErrorResponse<T = unknown>(
  code: ErrorCode | number,
  message: string,
  path?: string,
  error?: any
): ApiResponse<T> {
  return {
    code,
    message,
    data: null as T,
    timestamp: Date.now(),
    path,
    stack: process.env.NODE_ENV === 'development' ? error?.stack : undefined,
  };
}

/**
 * 处理HTTP错误
 */
function handleHttpError<T = unknown>(error: any, path?: string): ApiResponse<T> {
  // 网络错误
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
    return createErrorResponse<T>(
      ErrorCode.NETWORK_ERROR,
      '网络连接失败，请检查网络连接',
      path,
      error
    );
  }

  // 超时错误
  if (error.name === 'AbortError' || error.message?.includes('timeout')) {
    return createErrorResponse<T>(
      ErrorCode.TIMEOUT_ERROR,
      '请求超时，请稍后重试',
      path,
      error
    );
  }

  // HTTP状态码错误
  if (error.status) {
    const errorCode = HTTP_STATUS_TO_ERROR_CODE[error.status] || ErrorCode.UNKNOWN_ERROR;
    const message = error.statusText || `HTTP ${error.status} 错误`;

    return createErrorResponse<T>(errorCode, message, path, error);
  }

  // 其他未知错误
  return createErrorResponse<T>(
    ErrorCode.UNKNOWN_ERROR,
    error.message || '未知错误',
    path,
    error
  );
}

/**
 * 验证响应数据
 */
function validateResponse<T>(
  response: any,
  schema?: z.ZodSchema<T>,
  skipValidation?: boolean
): ApiResponse<T> {
  try {
    // 验证基础响应结构
    const baseResponse = BaseResponseSchema.parse(response);

    // 如果跳过验证或没有提供schema，直接返回
    if (skipValidation || !schema) {
      return response as ApiResponse<T>;
    }

    // 验证数据字段
    if (baseResponse.code === ApiStatusCode.SUCCESS) {
      const validatedData = schema.parse(response.data);
      return {
        ...baseResponse,
        data: validatedData,
      } as ApiResponse<T>;
    }

    return response as ApiResponse<T>;
  } catch (validationError) {
    return createErrorResponse<T>(
      ErrorCode.VALIDATION_ERROR,
      '响应数据格式错误',
      undefined,
      validationError
    );
  }
}

/**
 * API客户端类
 */
export class ApiClient {
  private client: typeof ofetch;
  private options: ApiClientOptions;

  constructor(options: ApiClientOptions = {}) {
    this.options = {
      timeout: 10000,
      debug: process.env.NODE_ENV === 'development',
      ...options,
    };

    this.client = ofetch.create({
      baseURL: this.options.baseURL,
      timeout: this.options.timeout,
      credentials: 'include', // 重要：允许跨域携带cookie
      headers: {
        'Content-Type': 'application/json',
        ...this.options.headers,
      },
      onRequest: ({ request, options }) => {
        if (this.options.debug) {
          console.log('[API Request]', request, options);
        }
      },
      onRequestError: ({ request, error }) => {
        if (this.options.debug) {
          console.error('[API Request Error]', request, error);
        }
      },
      onResponse: ({ response }) => {
        if (this.options.debug) {
          console.log('[API Response]', response.status, response._data);
        }
      },
      onResponseError: ({ request, response }) => {
        if (this.options.debug) {
          console.error('[API Response Error]', request, response.status, response._data);
        }
      },
      ...this.options,
    });
  }

  /**
   * 通用API请求方法
   */
  async request<T = unknown>(
    url: string,
    options: ApiRequestOptions<T> & { method?: string } = {}
  ): Promise<ApiResponse<T>> {
    const { schema, skipValidation, method = 'GET', ...fetchOptions } = options;

    try {
      // 准备请求选项
      const requestOptions: any = {
        method,
        ...fetchOptions,
      };

      // 根据环境自动配置认证
      if (isServerEnvironment()) {
        // 服务端环境：获取headers并传递给请求
        const serverHeaders = await getServerHeaders();
        if (serverHeaders) {
          requestOptions.headers = {
            ...requestOptions.headers,
            ...serverHeaders,
          };
        }
      } else {
        // 客户端环境：确保credentials设置为include
        requestOptions.credentials = 'include';
      }

      const response = await this.client(url, requestOptions);

      return validateResponse(response, schema, skipValidation);
    } catch (error) {
      return handleHttpError<T>(error, url);
    }
  }

  /**
   * GET请求
   */
  async get<T = unknown>(
    url: string,
    options: ApiRequestOptions<T> = {}
  ): Promise<ApiResponse<T>> {
    return this.request(url, { ...options, method: 'GET' });
  }

  /**
   * POST请求
   */
  async post<T = unknown>(
    url: string,
    data?: any,
    options: ApiRequestOptions<T> = {}
  ): Promise<ApiResponse<T>> {
    return this.request(url, {
      ...options,
      method: 'POST',
      body: data,
    });
  }

  /**
   * PUT请求
   */
  async put<T = unknown>(
    url: string,
    data?: any,
    options: ApiRequestOptions<T> = {}
  ): Promise<ApiResponse<T>> {
    return this.request(url, {
      ...options,
      method: 'PUT',
      body: data,
    });
  }

  /**
   * DELETE请求
   */
  async delete<T = unknown>(
    url: string,
    options: ApiRequestOptions<T> = {}
  ): Promise<ApiResponse<T>> {
    return this.request(url, { ...options, method: 'DELETE' });
  }

  /**
   * PATCH请求
   */
  async patch<T = unknown>(
    url: string,
    data?: any,
    options: ApiRequestOptions<T> = {}
  ): Promise<ApiResponse<T>> {
    return this.request(url, {
      ...options,
      method: 'PATCH',
      body: data,
    });
  }
}

/**
 * 创建API客户端实例
 */
export function createApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient(options);
}

/**
 * 默认API客户端实例
 */
export const apiClient = createApiClient();

/**
 * 便捷的API请求方法
 */
export const api = {
  get: <T = unknown>(url: string, options?: ApiRequestOptions<T>) =>
    apiClient.get<T>(url, options),

  post: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    apiClient.post<T>(url, data, options),

  put: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    apiClient.put<T>(url, data, options),

  delete: <T = unknown>(url: string, options?: ApiRequestOptions<T>) =>
    apiClient.delete<T>(url, options),

  patch: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    apiClient.patch<T>(url, data, options),
};

/**
 * 创建支持better-auth的API客户端
 * 自动处理服务端和客户端环境的认证差异
 */
export function createBetterAuthApiClient(options: ApiClientOptions = {}): ApiClient {
  return new ApiClient({
    // 默认配置，适合better-auth
    timeout: 15000,
    debug: process.env.NODE_ENV === 'development',
    ...options,
  });
}

/**
 * 专门用于better-auth的API客户端实例
 */
export const betterAuthApiClient = createBetterAuthApiClient();

/**
 * 便捷的better-auth API请求方法
 * 自动处理服务端/客户端环境差异
 */
export const betterAuthApi = {
  get: <T = unknown>(url: string, options?: ApiRequestOptions<T>) =>
    betterAuthApiClient.get<T>(url, options),

  post: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    betterAuthApiClient.post<T>(url, data, options),

  put: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    betterAuthApiClient.put<T>(url, data, options),

  delete: <T = unknown>(url: string, options?: ApiRequestOptions<T>) =>
    betterAuthApiClient.delete<T>(url, options),

  patch: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) =>
    betterAuthApiClient.patch<T>(url, data, options),
};
