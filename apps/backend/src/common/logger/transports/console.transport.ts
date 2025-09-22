import * as winston from "winston";

import { LogLevel } from "../logger.constants";
import { ConsoleTransportOptions } from "../logger.interface";

/**
 * 创建控制台日志传输器
 * @param options 控制台传输器选项
 * @returns Winston控制台传输器
 */
export const createConsoleTransport = (
	options: ConsoleTransportOptions = {},
): winston.transport => {
	const { level = LogLevel.INFO } = options;

	return new winston.transports.Console({
		level,
	});
};
