import {
	ArgumentsHost,
	Catch,
	ExceptionFilter,
	HttpException,
	HttpStatus,
	Injectable,
} from "@nestjs/common";
import { Request, Response } from "express";

import { AppException } from "./app.exception";
import { handleDatabaseError, DatabaseError } from "./database-error.util";
import { AppLoggerService } from "../logger";
import { ApiResponse, ErrorCode } from "@repo/types";

/**
 * 全局HTTP异常过滤器
 * 捕获所有异常并转换为统一的响应格式
 */
@Catch()
@Injectable()
export class HttpExceptionFilter implements ExceptionFilter {
	/**
	 * 构造函数
	 * @param logger 日志服务
	 */
	constructor(private readonly logger: AppLoggerService) {
		this.logger.setContext(HttpExceptionFilter.name);
	}

	/**
	 * 捕获并处理异常
	 * @param exception 捕获到的异常
	 * @param host 参数宿主
	 */
	catch(exception: unknown, host: ArgumentsHost) {
		const ctx = host.switchToHttp();
		const response = ctx.getResponse<Response>();
		const request = ctx.getRequest<Request>();
		const path = request.url;
		const timestamp = Date.now();

		// 默认错误响应
		const errorResponse: ApiResponse = {
			code: ErrorCode.INTERNAL_ERROR,
			message: "服务器内部错误",
			data: null,
			timestamp,
			path,
			stack: "",
		};

		// 根据异常类型处理
		if (exception instanceof AppException) {
			// 处理应用自定义异常
			this.handleAppException(exception, errorResponse);
		} else if (exception instanceof HttpException) {
			// 处理Nest.js HTTP异常
			this.handleHttpException(exception, errorResponse);
		} else if (this.isDatabaseError(exception)) {
			// 处理数据库错误
			this.handleDatabaseException(exception, errorResponse);
		} else {
			// 处理未知错误
			this.handleUnknownException(exception, errorResponse);
		}

		// 记录错误日志
		this.logException(exception, errorResponse);

		// 设置HTTP状态码
		const statusCode = this.getStatusCode(exception);

		// 在非生产环境下添加错误堆栈
		if (process.env.NODE_ENV !== "production" && exception instanceof Error) {
			errorResponse.stack = exception.stack as string;
		}

		// 发送响应
		response.status(statusCode).json(errorResponse);
	}

	/**
	 * 处理应用自定义异常
	 * @param exception 应用异常
	 * @param errorResponse 错误响应
	 */
	private handleAppException(
		exception: AppException,
		errorResponse: ApiResponse,
	): void {
		const response = exception.getResponse();

		errorResponse.code = exception.errorCode;

		if (
			typeof response === "object" &&
			response !== null &&
			"message" in response
		) {
			errorResponse.message = (response.message as string) || exception.message;
		} else {
			errorResponse.message = exception.message;
		}

		if (exception.details) {
			errorResponse.data = exception.details;
		}
	}

	/**
	 * 处理Nest.js HTTP异常
	 * @param exception HTTP异常
	 * @param errorResponse 错误响应
	 */
	private handleHttpException(
		exception: HttpException,
		errorResponse: ApiResponse,
	): void {
		const status = exception.getStatus();
		const response = exception.getResponse() as
			| string
			| Record<string, unknown>;

		// 设置错误代码
		errorResponse.code = this.mapHttpStatusToErrorCode(status);

		// 设置错误消息
		if (typeof response === "string") {
			errorResponse.message = response;
		} else if (
			response &&
			typeof response === "object" &&
			"message" in response
		) {
			if (Array.isArray(response.message)) {
				errorResponse.message = "请求参数验证失败";
				errorResponse.data = { errors: response.message };
			} else {
				errorResponse.message = response.message as string;
			}

			// 如果有其他详细信息，添加到data
			if ("error" in response) {
				errorResponse.data =
					errorResponse.data || ({} as Record<string, unknown>);
				errorResponse.data = {
					...(errorResponse.data as Record<string, unknown>),
					error: response["error"],
				};
			}
		}
	}

	/**
	 * 处理数据库异常
	 * @param exception 数据库异常
	 * @param errorResponse 错误响应
	 */
	private handleDatabaseException(
		exception: unknown,
		errorResponse: ApiResponse,
	): void {
		// 使用类型断言，因为handleDatabaseError函数期望接收特定类型
		const dbException = handleDatabaseError(exception as DatabaseError);

		errorResponse.code = dbException.errorCode;
		errorResponse.message = dbException.message;

		if (dbException.details) {
			errorResponse.data = dbException.details;
		}
	}

	/**
	 * 处理未知异常
	 * @param exception 未知异常
	 * @param errorResponse 错误响应
	 */
	private handleUnknownException(
		exception: unknown,
		errorResponse: ApiResponse,
	): void {
		errorResponse.code = ErrorCode.UNKNOWN_ERROR;

		if (exception instanceof Error) {
			errorResponse.message = exception.message || "未知错误";
		} else if (typeof exception === "string") {
			errorResponse.message = exception;
		}
	}

	/**
	 * 获取HTTP状态码
	 * @param exception 异常
	 * @returns HTTP状态码
	 */
	private getStatusCode(exception: unknown): number {
		if (exception instanceof HttpException) {
			return exception.getStatus();
		}
		return HttpStatus.INTERNAL_SERVER_ERROR;
	}

	/**
	 * 获取错误堆栈
	 * @param exception 异常
	 * @returns 错误堆栈
	 */
	private getErrorStack(exception: unknown): string | undefined {
		if (exception instanceof Error) {
			return exception.stack;
		}
		return undefined;
	}

	/**
	 * 判断是否为数据库错误
	 * @param exception 异常
	 * @returns 是否为数据库错误
	 */
	private isDatabaseError(exception: unknown): boolean {
		// 检查常见的数据库错误特征
		if (!exception || typeof exception !== "object") {
			return false;
		}

		const dbError = exception as Record<string, unknown>;
		return !!(
			dbError.code ||
			dbError.errno ||
			dbError.sqlState ||
			dbError.sqlMessage
		);
	}

	/**
	 * 将HTTP状态码映射为错误代码
	 * @param status HTTP状态码
	 * @returns 错误代码
	 */
	private mapHttpStatusToErrorCode(status: number): ErrorCode {
		// 使用数字类型进行比较，避免枚举类型不匹配问题
		switch (status) {
			case 400: // HttpStatus.BAD_REQUEST
				return ErrorCode.BAD_REQUEST;
			case 401: // HttpStatus.UNAUTHORIZED
				return ErrorCode.UNAUTHORIZED;
			case 403: // HttpStatus.FORBIDDEN
				return ErrorCode.FORBIDDEN;
			case 404: // HttpStatus.NOT_FOUND
				return ErrorCode.NOT_FOUND;
			case 405: // HttpStatus.METHOD_NOT_ALLOWED
				return ErrorCode.METHOD_NOT_ALLOWED;
			case 406: // HttpStatus.NOT_ACCEPTABLE
				return ErrorCode.NOT_ACCEPTABLE;
			case 408: // HttpStatus.REQUEST_TIMEOUT
				return ErrorCode.REQUEST_TIMEOUT;
			case 409: // HttpStatus.CONFLICT
				return ErrorCode.CONFLICT;
			case 410: // HttpStatus.GONE
				return ErrorCode.GONE;
			case 413: // HttpStatus.PAYLOAD_TOO_LARGE
				return ErrorCode.PAYLOAD_TOO_LARGE;
			case 415: // HttpStatus.UNSUPPORTED_MEDIA_TYPE
				return ErrorCode.UNSUPPORTED_MEDIA_TYPE;
			case 429: // HttpStatus.TOO_MANY_REQUESTS
				return ErrorCode.TOO_MANY_REQUESTS;
			case 500: // HttpStatus.INTERNAL_SERVER_ERROR
			default:
				return ErrorCode.INTERNAL_ERROR;
		}
	}

	/**
	 * 记录异常日志
	 * @param exception 异常
	 * @param errorResponse 错误响应
	 */
	private logException(exception: unknown, errorResponse: ApiResponse): void {
		const { code, message, path } = errorResponse;
		const codeNum = Number(code);

		// 使用数字常量代替枚举值
		const INTERNAL_ERROR = 1001; // ErrorCode.INTERNAL_ERROR
		const DATABASE_ERROR = 3000; // ErrorCode.DATABASE_ERROR
		const UNKNOWN_ERROR = 1000; // ErrorCode.UNKNOWN_ERROR
		const UNAUTHORIZED = 2001; // ErrorCode.UNAUTHORIZED
		const FORBIDDEN = 2002; // ErrorCode.FORBIDDEN

		// 根据错误严重程度选择日志级别
		if (
			codeNum === INTERNAL_ERROR ||
			codeNum === DATABASE_ERROR ||
			codeNum === UNKNOWN_ERROR
		) {
			this.logger.error(
				`[${code}] ${message} - ${path}`,
				this.getErrorStack(exception),
			);
		} else if (codeNum === UNAUTHORIZED || codeNum === FORBIDDEN) {
			this.logger.warn(`[${code}] ${message} - ${path}`);
		} else {
			this.logger.log(`[${code}] ${message} - ${path}`);
		}
	}
}
