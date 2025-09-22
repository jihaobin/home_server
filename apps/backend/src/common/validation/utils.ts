import { ZodError, z } from "zod/v4";
import { ErrorCode } from "@repo/types";

import { ValidationException } from "../exceptions";

z.config(z.locales.zhCN());

/**
 * 格式化 Zod 验证错误
 * 将 Zod 错误转换为标准格式的验证错误
 *
 * @param error Zod 错误对象
 * @returns 格式化后的验证错误列表
 */
export function formatZodError(error: ZodError) {
	console.log("zodError", JSON.stringify(ZodError));
	return error.issues.map((issue: z.core.$ZodIssue) => {
		const friendlyPath = issue.path
			.map((p, i) => (i === 0 ? `字段'${String(p)}'` : `子字段'${String(p)}'`))
			.join("");

		const friendlyMessage = issue.message;

		return {
			code: issue.code,
			path: issue.path.join("."),
			message: `${friendlyPath} ${friendlyMessage}`,
			friendlyPath,
			friendlyMessage,
		};
	});
}

/**
 * 从Zod错误创建ValidationException
 *
 * @param error Zod错误对象
 * @param message 自定义错误消息
 * @returns ValidationException实例
 */
export function createValidationException(
	error: ZodError,
	message: string = "请求参数验证失败",
): ValidationException {
	const formattedErrors = formatZodError(error);

	const detailedMessage =
		formattedErrors.length > 0
			? `${message}: ${formattedErrors[0].friendlyPath} ${formattedErrors[0].friendlyMessage}`
			: message;

	return new ValidationException(detailedMessage, ErrorCode.VALIDATION_ERROR, {
		errors: formattedErrors,
	});
}

/**
 * 判断值是否为 undefined 或 null
 *
 * @param value 要检查的值
 * @returns 如果值为 undefined 或 null 则返回 true，否则返回 false
 */
export function isNil(value: unknown): value is null | undefined {
	return value === undefined || value === null;
}

/**
 * 判断值是否为对象
 *
 * @param value 要检查的值
 * @returns 如果值为对象则返回 true，否则返回 false
 */
export function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}
