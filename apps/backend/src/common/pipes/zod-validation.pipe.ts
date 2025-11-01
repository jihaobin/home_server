import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { z, ZodError } from "zod/v4";

import { createValidationException } from "../validation";

/**
 * 通用Zod验证管道
 * 用于验证请求参数（body, query, params等）
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
	/**
	 * @param schema - Zod验证模式
	 * @param errorMessage - 自定义错误消息
	 */
	constructor(
		private readonly schema: z.ZodType,
		private readonly errorMessage: string = "请求参数验证失败",
        private readonly isAutoTransform: boolean = true
	) {}

	/**
	 * 管道转换方法
	 *
	 * @param value - 输入值
	 * @param metadata - 元数据
	 * @returns 验证并可能转换后的值
	 */
    transform(value: unknown, metadata: ArgumentMetadata,): unknown {
		try {
			// 对空对象的特殊处理
			if (
				metadata.type === "body" &&
				typeof value === "object" &&
				value !== null &&
				Object.keys(value).length === 0
			) {
				value = {}; // 确保空对象也被正确处理
			}

			// 对查询参数进行预处理
            if (metadata.type === "query" && this.isAutoTransform) {
				value = this.preprocessQueryParams(value);
			}

			// 使用schema验证并转换值
			return this.schema.parse(value);
		} catch (error) {
			console.log("校验之前的值", value);
			if (error instanceof ZodError) {
				// 抛出ValidationException，与系统的错误处理集成
				throw createValidationException(error, this.errorMessage);
			}

			// 非Zod错误直接抛出
			throw error;
		}
	}

	/**
	 * 预处理查询参数
	 * 将字符串转换为适当的类型
	 */
	private preprocessQueryParams(params: unknown): Record<string, unknown> {
		if (
			!params ||
			typeof params !== "object" ||
			Array.isArray(params) ||
			params === null
		) {
			return params as Record<string, unknown>;
		}

		const processed: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === null) {
				processed[key] = value;
				continue;
			}

			if (typeof value === "string") {
				// 尝试转换布尔值
				if (value === "true") {
					processed[key] = true;
				} else if (value === "false") {
					processed[key] = false;
				} else if (value === "") {
					// 空字符串转换为 undefined
					processed[key] = undefined;
				} else if (this.isNumericString(value)) {
					// 尝试转换数字
					const numValue = Number(value);
					if (!isNaN(numValue) && isFinite(numValue)) {
						processed[key] = numValue;
					} else {
						processed[key] = value;
					}
				} else {
					processed[key] = value;
				}
			} else {
				processed[key] = value;
			}
		}

		return processed;
	}

	/**
	 * 检查字符串是否是有效的数字格式
	 */
	private isNumericString(str: string): boolean {
		if (str.trim() === "") {
			return false;
		}

		// 匹配整数、浮点数（包括负数）
		const numericRegex = /^-?\d+(\.\d+)?$/;
		return numericRegex.test(str.trim());
	}
}

/**
 * 多类型参数验证管道配置接口
 */
export interface MultiZodValidationConfig {
	/** 用于验证 @Body() 参数的 schema */
	body?: z.ZodType;
	/** 用于验证 @Param() 参数的 schema */
	params?: z.ZodType;
	/** 用于验证 @Query() 参数的 schema */
	query?: z.ZodType;
	/** 自定义错误消息 */
	errorMessage?: string;
}

/**
 * 支持多种请求装饰器的Zod验证管道
 * 可同时验证 @Body(), @Param(), @Query() 等多种类型的参数
 */
@Injectable()
export class MultiZodValidationPipe implements PipeTransform {
	constructor(
		private readonly config: MultiZodValidationConfig,
		private readonly errorMessage: string = "请求参数验证失败",
	) {}

	/**
	 * 管道转换方法
	 * 根据参数类型选择对应的schema进行验证
	 */
	transform(value: unknown, metadata: ArgumentMetadata): unknown {
		const { type } = metadata;
		let schema: z.ZodType | undefined;

		// 根据参数类型选择对应的schema
		switch (type) {
			case "body":
				schema = this.config.body;
				break;
			case "param":
				schema = this.config.params;
				break;
			case "query":
				schema = this.config.query;
				break;
			default:
				// 如果没有配置对应类型的schema，直接返回原值
				return value;
		}

		// 如果没有配置对应类型的schema，直接返回原值
		if (!schema) {
			return value;
		}

		try {
			// 对空对象的特殊处理
			if (
				type === "body" &&
				typeof value === "object" &&
				value !== null &&
				Object.keys(value).length === 0
			) {
				value = {}; // 确保空对象也被正确处理
			}

			// 对查询参数进行预处理
			if (type === "query") {
				value = this.preprocessQueryParams(value);
			}

			// 使用对应的schema验证并转换值
			return schema.parse(value);
		} catch (error) {
			console.log(`校验${type}参数失败，值为:`, value);
			if (error instanceof ZodError) {
				// 抛出ValidationException，与系统的错误处理集成
				throw createValidationException(
					error,
					this.config.errorMessage || this.errorMessage,
				);
			}

			// 非Zod错误直接抛出
			throw error;
		}
	}

	/**
	 * 预处理查询参数
	 * 将字符串转换为适当的类型
	 */
	private preprocessQueryParams(params: unknown): Record<string, unknown> {
		if (
			!params ||
			typeof params !== "object" ||
			Array.isArray(params) ||
			params === null
		) {
			return params as Record<string, unknown>;
		}

		const processed: Record<string, unknown> = {};

		for (const [key, value] of Object.entries(params)) {
			if (value === undefined || value === null) {
				processed[key] = value;
				continue;
			}

			if (typeof value === "string") {
				// 尝试转换布尔值
				if (value === "true") {
					processed[key] = true;
				} else if (value === "false") {
					processed[key] = false;
				} else if (value === "") {
					// 空字符串转换为 undefined
					processed[key] = undefined;
				} else if (this.isNumericString(value)) {
					// 尝试转换数字
					const numValue = Number(value);
					if (!isNaN(numValue) && isFinite(numValue)) {
						processed[key] = numValue;
					} else {
						processed[key] = value;
					}
				} else {
					processed[key] = value;
				}
			} else {
				processed[key] = value;
			}
		}

		return processed;
	}

	/**
	 * 检查字符串是否是有效的数字格式
	 */
	private isNumericString(str: string): boolean {
		if (str.trim() === "") {
			return false;
		}

		// 匹配整数、浮点数（包括负数）
		const numericRegex = /^-?\d+(\.\d+)?$/;
		return numericRegex.test(str.trim());
	}
}

/**
 * 创建 Zod 验证管道的工厂函数
 * @param schema Zod schema
 * @param errorMessage 自定义错误消息
 * @returns ZodValidationPipe 实例
 */
export const createZodPipe = (
	schema: z.ZodType,
	errorMessage?: string,
): ZodValidationPipe => new ZodValidationPipe(schema, errorMessage);

/**
 * 创建多类型参数验证管道的工厂函数
 * @param config 多类型验证配置
 * @returns MultiZodValidationPipe 实例
 */
export const createMultiZodPipe = (
	config: MultiZodValidationConfig,
): MultiZodValidationPipe => new MultiZodValidationPipe(config);
