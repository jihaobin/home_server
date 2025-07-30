import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
    HttpStatus,
    SetMetadata,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppLoggerService } from '../logger';
import { ApiResponse, ApiStatusCode } from '@repo/types';

/**
 * 用于标记跳过响应转换的元数据键
 */
export const SKIP_TRANSFORM_KEY = 'skipTransform';

/**
 * 跳过响应转换装饰器
 * 用于标记控制器方法返回原始数据，不进行标准格式转换
 */
export const SkipTransform = () => SetMetadata(SKIP_TRANSFORM_KEY, true);

/**
 * 转换拦截器选项接口
 */
export interface TransformInterceptorOptions {
    /**
     * 是否记录响应日志
     */
    logResponse?: boolean;

    /**
     * 是否包含时间戳
     */
    includeTimestamp?: boolean;

    /**
     * 默认成功消息
     */
    defaultSuccessMessage?: string;
}

/**
 * 响应转换拦截器
 * 用于统一API响应格式
 */
@Injectable()
export class TransformInterceptor<T>
    implements NestInterceptor<T, ApiResponse<T> | T>
{
    private readonly defaultOptions: TransformInterceptorOptions = {
        logResponse: true,
        includeTimestamp: true,
        defaultSuccessMessage: '操作成功',
    };

    constructor(
        private readonly logger: AppLoggerService,
        private readonly options: TransformInterceptorOptions = {},
        private readonly reflector?: Reflector,
    ) {
        this.logger.setContext('TransformInterceptor');
        this.options = { ...this.defaultOptions, ...options };
    }

    /**
     * 拦截方法
     * @param context 执行上下文
     * @param next 调用处理器
     * @returns 转换后的响应Observable
     */
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<ApiResponse<T> | T> {
        const request = context.switchToHttp().getRequest<Request>();
        // 使用类型断言确保类型安全
        const method = request.method;
        const url = request.url;
        const body = request.body as Record<string, unknown>;
        const params = request.params as Record<string, string>;
        const query = request.query as Record<string, unknown>;
        const path = url; // 保存请求路径，与异常过滤器保持一致
        const now = Date.now();

        // 检查是否需要跳过转换
        const skipTransform =
            this.reflector?.get<boolean>(
                SKIP_TRANSFORM_KEY,
                context.getHandler(),
            ) || false;

        // 记录请求日志
        if (this.options.logResponse) {
            this.logger.log(
                `请求开始 - ${method} ${path}`,
                'TransformInterceptor',
            );

            // 在开发环境下记录请求详情
            if (process.env.NODE_ENV !== 'production') {
                const requestData = {
                    params,
                    query,
                    body: this.sanitizeRequestBody(body),
                };
                this.logger.debug(
                    `请求详情: ${JSON.stringify(requestData)}`,
                    'TransformInterceptor',
                );
            }
        }

        return next.handle().pipe(
            map((data) => {
                // 使用正确的Express Response类型
                const response = context.switchToHttp().getResponse<Response>();
                const statusCode = response.statusCode || HttpStatus.OK;
                const timestamp = this.options.includeTimestamp
                    ? Date.now()
                    : undefined;

                // 记录响应完成日志
                if (this.options.logResponse) {
                    const duration = Date.now() - now;
                    this.logger.log(
                        `请求完成 - ${method} ${path} - ${statusCode} - ${duration}ms`,
                        'TransformInterceptor',
                    );

                    // 在开发环境下记录响应详情
                    if (process.env.NODE_ENV !== 'production') {
                        this.logger.debug(
                            `响应详情: ${this.sanitizeResponseData(
                                skipTransform
                                    ? data
                                    : { data, transformed: true },
                            )}`,
                            'TransformInterceptor',
                        );
                    }
                }

                // 如果标记为跳过转换，则直接返回原始数据
                if (skipTransform) {
                    return data;
                }

                // 构建统一响应格式，与异常过滤器返回格式保持一致
                const result: ApiResponse<T> = {
                    code: ApiStatusCode.SUCCESS,
                    message: this.getSuccessMessage(data),
                    data: data as T,
                    timestamp: timestamp || Date.now(),
                    path, // 添加请求路径，与异常过滤器保持一致
                };

                return result;
            }),
        );
    }

    /**
     * 获取成功消息
     * @param data 响应数据
     * @returns 成功消息
     */
    private getSuccessMessage(data: T): string {
        // 如果数据中包含message字段，优先使用
        if (data && typeof data === 'object' && 'message' in data) {
            return data.message as string;
        }

        // 否则使用默认成功消息
        return this.options.defaultSuccessMessage || '';
    }

    /**
     * 清理请求体数据（用于日志记录）
     * @param body 请求体
     * @returns 清理后的请求体
     */
    private sanitizeRequestBody(
        body: Record<string, unknown>,
    ): Record<string, unknown> {
        if (!body) return {};

        // 创建请求体的副本
        const sanitized: Record<string, unknown> = { ...body };

        // 移除敏感字段
        const sensitiveFields = [
            'password',
            'token',
            'secret',
            'authorization',
        ];
        sensitiveFields.forEach((field) => {
            if (field in sanitized) {
                sanitized[field] = '******';
            }
        });

        return sanitized;
    }

    /**
     * 清理响应数据（用于日志记录）
     * @param data 响应数据
     * @returns 清理后的响应数据
     */
    private sanitizeResponseData(data: unknown): string {
        if (!data) return 'null';

        try {
            // 对于大型响应，限制日志大小
            const jsonStr = JSON.stringify(data);
            const maxLength = 1000;

            if (jsonStr.length <= maxLength) {
                return jsonStr;
            }

            return `${jsonStr.substring(0, maxLength)}... (截断，总长度: ${jsonStr.length})`;
        } catch (error) {
            return `[无法序列化的响应数据: ${(error as Error).message}]`;
        }
    }
}
