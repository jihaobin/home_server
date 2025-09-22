import { ErrorCode } from "@repo/types";
import { HttpException, HttpStatus } from "@nestjs/common";

/**
 * 应用异常基类
 * 用于抛出结构化的错误
 */
export class AppException extends HttpException {
	/**
	 * 错误代码
	 */
	readonly errorCode: ErrorCode;

	/**
	 * 错误详情
	 */
	readonly details?: Record<string, unknown>;

	/**
	 * 构造函数
	 * @param message 错误消息
	 * @param errorCode 错误代码
	 * @param statusCode HTTP状态码
	 * @param details 错误详情
	 */
	constructor(
		message: string,
		errorCode: ErrorCode,
		statusCode: HttpStatus = HttpStatus.BAD_REQUEST,
		details?: Record<string, unknown>,
	) {
		super(
			{
				message,
				code: errorCode,
				details,
			},
			statusCode,
		);

		this.errorCode = errorCode;
		this.details = details;

		// 保留原始的错误堆栈
		Error.captureStackTrace(this, this.constructor);
	}
}

/**
 * 业务异常
 * 用于表示业务逻辑错误
 */
export class BusinessException extends AppException {
	constructor(
		message: string,
		errorCode: ErrorCode = ErrorCode.BUSINESS_ERROR,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.BAD_REQUEST, details);
	}
}

/**
 * 资源不存在异常
 */
export class NotFoundException extends AppException {
	constructor(
		message: string = "资源不存在",
		errorCode: ErrorCode = ErrorCode.RESOURCE_NOT_FOUND,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.NOT_FOUND, details);
	}
}

/**
 * 验证异常
 */
export class ValidationException extends AppException {
	constructor(
		message: string = "验证失败",
		errorCode: ErrorCode = ErrorCode.VALIDATION_ERROR,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.BAD_REQUEST, details);
	}
}

/**
 * 未授权异常
 */
export class UnauthorizedException extends AppException {
	constructor(
		message: string = "未授权",
		errorCode: ErrorCode = ErrorCode.UNAUTHORIZED,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.UNAUTHORIZED, details);
	}
}

/**
 * 禁止访问异常
 */
export class ForbiddenException extends AppException {
	constructor(
		message: string = "禁止访问",
		errorCode: ErrorCode = ErrorCode.FORBIDDEN,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.FORBIDDEN, details);
	}
}

/**
 * 数据库异常
 */
export class DatabaseException extends AppException {
	constructor(
		message: string = "数据库错误",
		errorCode: ErrorCode = ErrorCode.DATABASE_ERROR,
		details?: Record<string, unknown>,
	) {
		super(message, errorCode, HttpStatus.INTERNAL_SERVER_ERROR, details);
	}
}
