import { FetchError, ofetch, type FetchOptions } from 'ofetch';
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
    baseURL?: string;
    timeout?: number;
    debug?: boolean;
    toast?: (msg: string) => void;
}

/**
 * API请求选项
 */
export interface ApiRequestOptions<T = unknown> extends Omit<FetchOptions, 'method'> {
    schema?: z.ZodSchema<T>;
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
  408: ErrorCode.REQUEST_TIMEOUT,
    409: ErrorCode.CONFLICT,
  429: ErrorCode.TOO_MANY_REQUESTS,
  500: ErrorCode.INTERNAL_ERROR,
  502: ErrorCode.SERVICE_UNAVAILABLE,
  503: ErrorCode.SERVICE_UNAVAILABLE,
  504: ErrorCode.TIMEOUT_ERROR,
};

/**
 * API客户端错误类
 */
export class ApiClientError extends Error {
    code: ErrorCode;
    status?: number;
    originalError?: any;

    constructor(code: ErrorCode, message: string, originalError?: any) {
        super(message);
        this.name = 'ApiClientError';
        this.code = code;
      this.originalError = originalError;

      if (originalError instanceof FetchError) {
          this.status = originalError.status || originalError.statusCode;
    }
  }
}

/**
 * 处理 FetchError
 */
function handleFetchError<T>(error: FetchError): ApiResponse<T> {
    // 优先使用后台返回的错误信息
    if (error.data && typeof error.data === 'object' && error.data.code && error.data.message) {
        return error.data as ApiResponse<T>;
    }

    // 根据状态码映射错误
    const status = error.status || error.statusCode;
    const errorCode = status ? HTTP_STATUS_TO_ERROR_CODE[status] || ErrorCode.UNKNOWN_ERROR : ErrorCode.NETWORK_ERROR;
    const message = error.statusText || error.statusMessage || error.message || '请求失败';

    return {
        code: errorCode,
        message,
        data: null as T,
        timestamp: Date.now(),
    };
}

/**
 * 验证响应数据
 */
function validateResponse<T>(response: any, schema?: z.ZodSchema<T>, skipValidation?: boolean): ApiResponse<T> {
    try {
    const baseResponse = BaseResponseSchema.parse(response);

      if (skipValidation || !schema || baseResponse.code !== ApiStatusCode.SUCCESS) {
      return response as ApiResponse<T>;
    }

      const validatedData = schema.parse(response.data);
      return { ...baseResponse, data: validatedData } as ApiResponse<T>;
  } catch {
      return {
        code: ErrorCode.VALIDATION_ERROR,
        message: '响应数据格式错误',
        data: null as T,
        timestamp: Date.now(),
    };
  }
}

/**
 * API客户端类
 */
export class ApiClient {
    private client: typeof ofetch;
    private toast?: (msg: string) => void;

    constructor(options: ApiClientOptions = {}) {
      this.toast = options.toast;

    this.client = ofetch.create({
        baseURL: options.baseURL,
        timeout: options.timeout || 10000,
        credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
          ...options.headers,
      },
        ...options,
    });
  }

  async request<T = unknown>(
    url: string,
    options: ApiRequestOptions<T> & { method?: string } = {}
  ): Promise<ApiResponse<T>> {
      const { schema, skipValidation, method = 'GET', ...fetchOptions } = options;

    try {
        const response = await this.client(url, { method, ...fetchOptions });
        const validatedResponse = validateResponse(response, schema, skipValidation);

        if (validatedResponse.code !== ApiStatusCode.SUCCESS) {
          if (this.toast) this.toast(validatedResponse.message);
          throw new ApiClientError(validatedResponse.code as ErrorCode, validatedResponse.message);
      }

        return validatedResponse;
    } catch (error) {
        if (error instanceof FetchError) {
            const errorResponse = handleFetchError<T>(error);
            if (this.toast) this.toast(errorResponse.message);
            throw new ApiClientError(errorResponse.code as ErrorCode, errorResponse.message, error);
        }

        if (error instanceof ApiClientError) {
            if (this.toast) this.toast(error.message);
            throw error;
        }

        // 其他错误
        const message = error instanceof Error ? error.message : '未知错误';
        if (this.toast) this.toast(message);
        throw new ApiClientError(ErrorCode.UNKNOWN_ERROR, message, error);
    }
  }

    async get<T = unknown>(url: string, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
    return this.request(url, { ...options, method: 'GET' });
  }

    async post<T = unknown>(url: string, data?: any, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
        return this.request(url, { ...options, method: 'POST', body: data });
  }

    async put<T = unknown>(url: string, data?: any, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
        return this.request(url, { ...options, method: 'PUT', body: data });
  }

    async delete<T = unknown>(url: string, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
    return this.request(url, { ...options, method: 'DELETE' });
  }

    async patch<T = unknown>(url: string, data?: any, options: ApiRequestOptions<T> = {}): Promise<ApiResponse<T>> {
        return this.request(url, { ...options, method: 'PATCH', body: data });
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
    get: <T = unknown>(url: string, options?: ApiRequestOptions<T>) => apiClient.get<T>(url, options),
    post: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) => apiClient.post<T>(url, data, options),
    put: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) => apiClient.put<T>(url, data, options),
    delete: <T = unknown>(url: string, options?: ApiRequestOptions<T>) => apiClient.delete<T>(url, options),
    patch: <T = unknown>(url: string, data?: any, options?: ApiRequestOptions<T>) => apiClient.patch<T>(url, data, options),
};

/**
 * 判断错误是否为 ApiClientError
 */
export function isApiClientError(error: unknown): error is ApiClientError {
    return error instanceof ApiClientError;
}