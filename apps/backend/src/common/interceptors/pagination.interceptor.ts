import {
    Injectable,
    NestInterceptor,
    ExecutionContext,
    CallHandler,
} from '@nestjs/common';
import { Request } from 'express';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

import { AppLoggerService } from '../logger';
import { PaginatedData, PaginationMeta } from '@repo/types';

/**
 * 分页数据接口
 * 用于识别控制器返回的分页数据
 */
export interface IPaginatedResult<T> {
    items: T[];
    total: number;
    page: number;
    limit: number;
}

/**
 * 分页拦截器选项接口
 */
export interface PaginationInterceptorOptions {
    /**
     * 默认页码
     */
    defaultPage: number;

    /**
     * 默认每页条数
     */
    defaultLimit: number;
}

/**
 * 分页拦截器
 * 用于统一处理分页数据格式
 */
@Injectable()
export class PaginationInterceptor<T>
    implements NestInterceptor<IPaginatedResult<T>, PaginatedData<T>>
{
    constructor(
        private readonly logger: AppLoggerService,
        private readonly options: PaginationInterceptorOptions = {
            defaultPage: 1,
            defaultLimit: 10,
        },
    ) {
        if (this.logger) {
            this.logger.setContext('PaginationInterceptor');
        }
        this.options = { ...this.options, ...options };
    }

    /**
     * 拦截方法
     * @param context 执行上下文
     * @param next 调用处理器
     * @returns 转换后的分页数据Observable
     */
    intercept(
        context: ExecutionContext,
        next: CallHandler,
    ): Observable<PaginatedData<T>> {
        const request = context.switchToHttp().getRequest<Request>();
        const { method, url } = request;
        const path = url;

        return next.handle().pipe(
            map((data: IPaginatedResult<T>) => {
                // 如果不是分页数据格式，直接返回原始数据
                if (!this.isPaginatedResult(data)) {
                    return data;
                }

                // 提取分页数据
                const { items, total, page, limit } = data;
                const currentPage = page || this.options.defaultPage;
                const currentLimit = limit || this.options.defaultLimit;

                // 计算分页元数据
                const totalPages = Math.ceil(total / currentLimit);
                const hasNext = currentPage < totalPages;
                const hasPrev = currentPage > 1;

                // 构建分页元数据
                const meta: PaginationMeta = {
                    page: currentPage,
                    limit: currentLimit,
                    total,
                    totalPages,
                    hasNext,
                    hasPrev,
                };

                // 记录响应日志
                this.logger.log(
                    `分页响应 - ${method} ${path} - 总条数: ${total}, 总页数: ${totalPages}, 当前页: ${currentPage}`,
                    'PaginationInterceptor',
                );

                if (process.env.NODE_ENV !== 'production') {
                    this.logger.debug(
                        `分页详情: ${JSON.stringify(meta)}`,
                        'PaginationInterceptor',
                    );
                }

                // 返回标准分页数据格式
                return {
                    items,
                    meta,
                };
            }),
        );
    }

    /**
     * 判断是否为分页结果
     * @param data 数据
     * @returns 是否为分页结果
     */
    private isPaginatedResult(data: unknown): data is IPaginatedResult<T> {
        if (!data || typeof data !== 'object') {
            return false;
        }

        const record = data as Record<string, unknown>;
        return Array.isArray(record.items) && typeof record.total === 'number';
    }
}
