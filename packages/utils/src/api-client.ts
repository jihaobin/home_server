import { ofetch, type FetchOptions } from 'ofetch';
import { z } from 'zod/v4';
import {
  type ApiResponse,
  ApiStatusCode,
  ErrorCode,
  BaseResponseSchema,
} from '@repo/types';


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

    /**
     * 错误提示的toast实现，不同端传入不同实现
     */
    toast?: (msg: string) => void;
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
 * 严格按照 ApiResponse 接口和 ErrorCode 枚举
 */
function createErrorResponse<T = unknown>(
    code: ErrorCode,
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
 * API客户端错误类
 * 严格按照 ErrorCode 枚举定义
 */
export class ApiClientError extends Error {
    code: ErrorCode;
    path?: string;
    originalError?: any;
    timestamp: number;

    constructor(code: ErrorCode, message: string, path?: string, originalError?: any) {
        super(message);
        this.name = 'ApiClientError';
        this.code = code;
        this.path = path;
        this.originalError = originalError;
        this.timestamp = Date.now();
    }

    /**
     * 转换为 ApiResponse 格式
     */
    toApiResponse<T = unknown>(): ApiResponse<T> {
        return {
            code: this.code,
            message: this.message,
            data: null as T,
            timestamp: this.timestamp,
            path: this.path,
            stack: process.env.NODE_ENV === 'development' ? this.stack : undefined,
        };
    }
}

/**
 * 处理HTTP错误，返回严格符合 ErrorCode 枚举的错误响应
 */
function handleHttpError<T = unknown>(error: any, path?: string): ApiResponse<T> {
    let errorCode: ErrorCode;
    let message: string;

  // 网络错误
  if (error.name === 'TypeError' && error.message.includes('fetch')) {
      errorCode = ErrorCode.NETWORK_ERROR;
      message = '网络连接失败，请检查网络连接';
  }
  // 超时错误
  else if (error.name === 'AbortError' || error.message?.includes('timeout')) {
      errorCode = ErrorCode.TIMEOUT_ERROR;
      message = '请求超时，请稍后重试';
  }
  // HTTP状态码错误
  else if (error.status) {
      errorCode = HTTP_STATUS_TO_ERROR_CODE[error.status] || ErrorCode.UNKNOWN_ERROR;
      message = error.statusText || `HTTP ${error.status} 错误`;
  }
  // 其他未知错误
    else {
        errorCode = ErrorCode.UNKNOWN_ERROR;
        message = error.message || '未知错误';
    }

    return createErrorResponse<T>(errorCode, message, path, error);
}

/**
 * 验证响应数据
 * 严格按照 ApiResponse 接口处理错误
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
      // 返回严格符合 ErrorCode 枚举的验证错误
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
    private toast?: (msg: string) => void;

  constructor(options: ApiClientOptions = {}) {
    this.options = {
      timeout: 10000,
      debug: process.env.NODE_ENV === 'development',
      ...options,
    };
      this.toast = options.toast;

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
   * 出现错误时返回 rejected Promise
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

      const response = await this.client(url, requestOptions);

        // 验证响应数据
        const validatedResponse = validateResponse(response, schema, skipValidation);

        // 如果是错误响应（非成功状态码）
        if (validatedResponse.code !== ApiStatusCode.SUCCESS) {
            // 显示错误 toast
            if (this.toast) {
                this.toast(validatedResponse.message);
            }

            // 确保错误码是 ErrorCode 枚举中的值
            const errorCode = Object.values(ErrorCode).includes(validatedResponse.code as ErrorCode)
                ? (validatedResponse.code as ErrorCode)
                : ErrorCode.UNKNOWN_ERROR;

            const error = new ApiClientError(
                errorCode,
                validatedResponse.message,
                validatedResponse.path,
                validatedResponse
            );

            // 返回 rejected Promise
            return Promise.reject(error);
        }

        return validatedResponse;
    } catch (error) {
        // 如果已经是 ApiClientError，直接处理
        if (error instanceof ApiClientError) {
            if (this.toast) {
                this.toast(error.message);
            }
            return Promise.reject(error);
        }

        // 处理网络、超时等底层错误
        const errorResponse = handleHttpError<T>(error, url);

        // 显示错误 toast
        if (this.toast) {
            this.toast(errorResponse.message);
        }

        // 创建 ApiClientError 并返回 rejected Promise
        const apiError = new ApiClientError(
            errorResponse.code as ErrorCode,
            errorResponse.message,
            errorResponse.path,
            error
        );

        return Promise.reject(apiError);
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

// ============================================================================
// UTILITY FUNCTIONS AND TYPE GUARDS
// ============================================================================

/**
 * 判断错误是否为 ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
}

/**
 * 获取错误消息的工具函数
 */
export function getErrorMessage(error: unknown): string {
    if (isApiClientError(error)) {
        return error.message;
    }
    if (error instanceof Error) {
        return error.message;
    }
    return '未知错误';
}

/**
 * 获取错误代码的工具函数
 */
export function getErrorCode(error: unknown): ErrorCode {
    if (isApiClientError(error)) {
        return error.code;
    }
    return ErrorCode.UNKNOWN_ERROR;
}