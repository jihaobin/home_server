import {
	Injectable,
	NestInterceptor,
	ExecutionContext,
	CallHandler,
	RequestTimeoutException,
} from "@nestjs/common";
import { Request } from "express";
import { Observable, throwError, TimeoutError } from "rxjs";
import { catchError, timeout } from "rxjs/operators";

import { AppLoggerService } from "../logger";
import { ErrorCode } from "@repo/types";

/**
 * 超时拦截器选项接口
 */
export interface TimeoutInterceptorOptions {
	/**
	 * 超时时间（毫秒）
	 */
	timeout?: number;

	/**
	 * 超时错误消息
	 */
	errorMessage?: string;
}

/**
 * 超时拦截器
 * 用于处理请求超时
 */
@Injectable()
export class TimeoutInterceptor implements NestInterceptor {
	private readonly defaultOptions: TimeoutInterceptorOptions = {
		timeout: 30000, // 默认30秒
		errorMessage: "请求超时，请稍后重试",
	};

	constructor(
		private readonly logger: AppLoggerService,
		private readonly options: TimeoutInterceptorOptions = {},
	) {
		this.logger.setContext("TimeoutInterceptor");
		this.options = { ...this.defaultOptions, ...options };
	}

	/**
	 * 拦截方法
	 * @param context 执行上下文
	 * @param next 调用处理器
	 * @returns 处理后的Observable
	 */
	intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
		const request = context.switchToHttp().getRequest<Request>();
		const { method, url } = request;
		const path = url; // 保存请求路径，与异常过滤器保持一致
		const timeoutMs = this.options.timeout || 30000; // 确保timeout为数字

		return next.handle().pipe(
			timeout(timeoutMs),
			catchError((err: unknown) => {
				if (err instanceof TimeoutError) {
					this.logger.warn(
						`请求超时 - ${method} ${path} - ${timeoutMs}ms`,
						"TimeoutInterceptor",
					);

					// 抛出RequestTimeoutException，将被HttpExceptionFilter捕获并处理
					// 确保错误响应格式与HttpExceptionFilter一致
					return throwError(
						() =>
							new RequestTimeoutException({
								message: this.options.errorMessage,
								code: ErrorCode.REQUEST_TIMEOUT, // 使用统一的错误代码
								path,
								timestamp: Date.now(),
							}),
					);
				}

				return throwError(() => err);
			}),
		);
	}
}
